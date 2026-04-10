"""
News Aggregator - Kafka Streams (pure kafka-python, без Faust)
Faust несовместим с Python 3.11 из-за mode.utils.contexts.nullcontext.
Реализуем то же самое вручную через kafka-python KafkaConsumer/KafkaProducer.

1. ТРАНСФОРМАЦИЯ  — обогащаем ArticleViewed полем categoryLabel + engagementScore
2. АГРЕГАЦИЯ      — считаем суммарные просмотры по article_id (в памяти, KTable-style)
3. ОКОННОЕ ВЫЧИСЛЕНИЕ — просмотры по категории за последнюю 1 минуту (tumbling window)
4. Результаты → отдельные топики
"""

import json
import logging
import time
import threading
from collections import defaultdict
from datetime import datetime, timezone

from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [streams] %(message)s",
)
logger = logging.getLogger("news-streams")

BOOTSTRAP = "kafka:29092"

# Input topics
TOPIC_VIEWS     = "news.views.events"
TOPIC_REACTIONS = "news.reactions.events"

# Output topics
TOPIC_ENRICHED = "news.enriched.views"
TOPIC_AGG      = "news.stats.article-views"
TOPIC_WINDOW   = "news.stats.category-windows"

CATEGORY_LABELS = {
    1: "politics", 2: "sports", 3: "technology",
    4: "entertainment", 5: "business", 6: "health", 7: "science",
}

WINDOW_SECONDS = 60  # tumbling window size


# ─── State (in-memory KTables) ────────────────────────────────────────────────
article_view_counts = defaultdict(int)   # article_id -> total views
article_like_counts = defaultdict(int)   # article_id -> total likes

# windowed: category_id -> list of timestamps in current window
window_timestamps = defaultdict(list)

state_lock = threading.Lock()


def make_producer():
    while True:
        try:
            p = KafkaProducer(
                bootstrap_servers=BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=5,
            )
            logger.info("Producer connected")
            return p
        except Exception as e:
            logger.warning(f"Producer connect failed: {e}, retrying in 5s...")
            time.sleep(5)


def make_consumer(group_id, *topics):
    while True:
        try:
            c = KafkaConsumer(
                *topics,
                bootstrap_servers=BOOTSTRAP,
                group_id=group_id,
                enable_auto_commit=True,
                auto_offset_reset="earliest",
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
                key_deserializer=lambda k: k.decode("utf-8") if k else None,
                session_timeout_ms=30000,
                request_timeout_ms=40000,
            )
            logger.info(f"Consumer '{group_id}' connected to {topics}")
            return c
        except Exception as e:
            logger.warning(f"Consumer connect failed: {e}, retrying in 5s...")
            time.sleep(5)


# ─── 1. ТРАНСФОРМАЦИЯ + АГРЕГАЦИЯ + ОКОННОЕ ВЫЧИСЛЕНИЕ ───────────────────────
def run_views_stream():
    """
    Читает news.views.events.
    - Трансформация: добавляет categoryLabel и engagementScore → news.enriched.views
    - Агрегация: считает суммарные просмотры по статье → news.stats.article-views
    - Окно: считает просмотры по категории за 1 мин → news.stats.category-windows
    """
    producer = make_producer()
    consumer = make_consumer("streams-views-group", TOPIC_VIEWS)

    for msg in consumer:
        try:
            event   = msg.value
            payload = event.get("payload", {})
            cat_id  = payload.get("categoryId", 0)
            article_id = str(event.get("entityId", "unknown"))
            views   = payload.get("viewsCount", 0)
            likes   = payload.get("likesCount", 0)

            # ── 1. ТРАНСФОРМАЦИЯ ──────────────────────────────────────────────
            cat_label = CATEGORY_LABELS.get(cat_id, "unknown")
            engagement = round(min(likes / max(views, 1), 1.0), 4)
            enriched = {
                **event,
                "enriched":        True,
                "categoryLabel":   cat_label,
                "engagementScore": engagement,
                "processedAt":     datetime.now(timezone.utc).isoformat(),
            }
            producer.send(TOPIC_ENRICHED, key=article_id, value=enriched)

            # ── 2. АГРЕГАЦИЯ (running total) ──────────────────────────────────
            with state_lock:
                article_view_counts[article_id] += 1
                total = article_view_counts[article_id]

            agg_result = {
                "articleId":  article_id,
                "totalViews": total,
                "updatedAt":  datetime.now(timezone.utc).isoformat(),
            }
            producer.send(TOPIC_AGG, key=article_id, value=agg_result)

            if total % 50 == 0:
                logger.info(f"[AGG] article={article_id} total_views={total}")

            # ── 3. ОКОННОЕ ВЫЧИСЛЕНИЕ (1-min tumbling window) ─────────────────
            now_ts = time.time()
            cat_key = str(cat_id)
            with state_lock:
                # Убираем метки старше 1 минуты
                window_timestamps[cat_key] = [
                    t for t in window_timestamps[cat_key]
                    if now_ts - t < WINDOW_SECONDS
                ]
                window_timestamps[cat_key].append(now_ts)
                window_count = len(window_timestamps[cat_key])

            window_result = {
                "categoryId":   cat_id,
                "categoryName": cat_label,
                "windowCount":  window_count,
                "windowType":   "tumbling-1min",
                "windowEnd":    datetime.now(timezone.utc).isoformat(),
            }
            producer.send(TOPIC_WINDOW, key=cat_key, value=window_result)

            logger.debug(
                f"[STREAMS] article={article_id} cat={cat_label} "
                f"total_views={total} window_count={window_count}"
            )

        except Exception as exc:
            logger.error(f"[STREAMS] Error processing message: {exc}", exc_info=True)


# ─── 2. АГРЕГАЦИЯ ЛАЙКОВ ─────────────────────────────────────────────────────
def run_reactions_stream():
    """Читает news.reactions.events, агрегирует лайки по статье."""
    consumer = make_consumer("streams-reactions-group", TOPIC_REACTIONS)
    for msg in consumer:
        try:
            event      = msg.value
            article_id = str(event.get("entityId", "unknown"))
            with state_lock:
                article_like_counts[article_id] += 1
                total_likes = article_like_counts[article_id]
            logger.info(f"[LIKES] article={article_id} total_likes={total_likes}")
        except Exception as exc:
            logger.error(f"[LIKES] Error: {exc}", exc_info=True)


# ─── Периодический лог состояния ─────────────────────────────────────────────
def run_stats_logger():
    while True:
        time.sleep(30)
        with state_lock:
            total_articles = len(article_view_counts)
            top = sorted(article_view_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        logger.info(f"[STATE] tracked_articles={total_articles} top3={top}")


if __name__ == "__main__":
    logger.info("Kafka Streams app starting (pure kafka-python)...")

    # Подождём пока Kafka поднимется
    time.sleep(10)

    threads = [
        threading.Thread(target=run_views_stream,     daemon=True, name="views-stream"),
        threading.Thread(target=run_reactions_stream, daemon=True, name="reactions-stream"),
        threading.Thread(target=run_stats_logger,     daemon=True, name="stats-logger"),
    ]
    for t in threads:
        t.start()
        logger.info(f"Started thread: {t.name}")

    # Держим главный поток живым
    for t in threads:
        t.join()