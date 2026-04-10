"""
News Aggregator - Kafka Producer (pure kafka-python, без FastStream)
Генерирует события на основе структуры БД из agregatorCreate.py:
- categories: politics, sports, technology, entertainment, business, health, science
- sources: Reuters, AP, BBC, CNN, Al Jazeera, Bloomberg, TechCrunch, ESPN
- authors: 100 авторов (Author_1..Author_100)

3 типа событий:
  ArticlePublished  — ключ = article_id  (новая статья опубликована)
  ArticleViewed     — ключ = user_id     (пользователь открыл статью)
  ArticleLiked      — ключ = user_id     (пользователь лайкнул статью)

Формат каждого сообщения:
  eventId, eventType, entityId, timestamp, source, version, payload, metadata
"""

import json
import uuid
import random
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [producer] %(message)s",
)
logger = logging.getLogger("news-producer")

BOOTSTRAP = "kafka:29092"

TOPIC_ARTICLES  = "news.articles.events"
TOPIC_VIEWS     = "news.views.events"
TOPIC_REACTIONS = "news.reactions.events"

# ─── Данные из agregatorCreate.py ─────────────────────────────────────────────
CATEGORIES = [
    (1, "politics",       "Political news and government affairs"),
    (2, "sports",         "Sports events and competitions"),
    (3, "technology",     "IT and technology innovations"),
    (4, "entertainment",  "Movies, music and entertainment"),
    (5, "business",       "Business and economic news"),
    (6, "health",         "Healthcare and medicine"),
    (7, "science",        "Scientific discoveries and research"),
]

SOURCES = [
    (1, "Reuters",          "International"),
    (2, "Associated Press", "USA"),
    (3, "BBC News",         "UK"),
    (4, "CNN",              "USA"),
    (5, "Al Jazeera",       "Qatar"),
    (6, "Bloomberg",        "USA"),
    (7, "TechCrunch",       "USA"),
    (8, "ESPN",             "USA"),
]

BASE_TITLES = [
    "Breaking News", "Latest Update", "Exclusive Report", "Special Coverage",
    "Market Analysis", "Sports Roundup", "Tech Review", "Political Briefing",
    "In-Depth Investigation", "Weekly Summary", "Expert Opinion", "Live Report",
]

BASE_CONTENTS = [
    "Significant developments have occurred in this area with far-reaching implications.",
    "Experts are analyzing the latest trends and data to provide comprehensive insights.",
    "This event has drawn international attention from various stakeholders.",
    "New research reveals important findings that could change current understanding.",
    "Market participants are closely watching the situation for potential opportunities.",
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
]


def _random_ip():
    return f"{random.randint(1,254)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"


def _now_ms():
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def build_article_published_event(article_id: int) -> dict:
    """EventType 1: новая статья опубликована."""
    cat_id, cat_name, _ = random.choice(CATEGORIES)
    src_id, src_name, _ = random.choice(SOURCES)
    author_id = random.randint(1, 100)
    title_type = random.choice(BASE_TITLES)

    return {
        "eventId":   str(uuid.uuid4()),
        "eventType": "ArticlePublished",
        "entityId":  str(article_id),
        "timestamp": _now_ms(),
        "source":    "news-cms",
        "version":   "1.0",
        "payload": {
            "articleId":   article_id,
            "title":       f"{title_type} #{article_id} - {cat_name.capitalize()}",
            "content":     f"{random.choice(BASE_CONTENTS)} Article #{article_id}.",
            "categoryId":  cat_id,
            "categoryName": cat_name,
            "sourceId":    src_id,
            "sourceName":  src_name,
            "authorId":    author_id,
            "authorName":  f"Author_{author_id} LastName_{author_id}",
            "viewsCount":  0,
            "likesCount":  0,
            "publishDate": _now_iso(),
            "url":         f"https://newsportal.com/{cat_name}/{article_id}",
        },
        "metadata": {
            "correlationId": str(uuid.uuid4()),
            "userId":        None,
            "ipAddress":     _random_ip(),
            "userAgent":     None,
            "environment":   "production",
        },
    }


def build_article_viewed_event(article_id: int, user_id: str) -> dict:
    """EventType 2: пользователь просмотрел статью."""
    cat_id, cat_name, _ = random.choice(CATEGORIES)
    src_id, src_name, _ = random.choice(SOURCES)

    return {
        "eventId":   str(uuid.uuid4()),
        "eventType": "ArticleViewed",
        "entityId":  str(article_id),
        "timestamp": _now_ms(),
        "source":    "news-api",
        "version":   "1.0",
        "payload": {
            "articleId":   article_id,
            "title":       f"{random.choice(BASE_TITLES)} #{article_id}",
            "content":     "",
            "categoryId":  cat_id,
            "categoryName": cat_name,
            "sourceId":    src_id,
            "sourceName":  src_name,
            "authorId":    random.randint(1, 100),
            "authorName":  f"Author_{random.randint(1,100)}",
            "viewsCount":  random.randint(1, 50000),
            "likesCount":  random.randint(0, 1000),
            "publishDate": _now_iso(),
            "url":         f"https://newsportal.com/{cat_name}/{article_id}",
        },
        "metadata": {
            "correlationId": str(uuid.uuid4()),
            "userId":        user_id,
            "ipAddress":     _random_ip(),
            "userAgent":     random.choice(USER_AGENTS),
            "environment":   "production",
        },
    }


def build_article_liked_event(article_id: int, user_id: str) -> dict:
    """EventType 3: пользователь лайкнул статью."""
    cat_id, cat_name, _ = random.choice(CATEGORIES)
    src_id, src_name, _ = random.choice(SOURCES)

    return {
        "eventId":   str(uuid.uuid4()),
        "eventType": "ArticleLiked",
        "entityId":  str(article_id),
        "timestamp": _now_ms(),
        "source":    "news-api",
        "version":   "1.0",
        "payload": {
            "articleId":   article_id,
            "title":       f"{random.choice(BASE_TITLES)} #{article_id}",
            "content":     "",
            "categoryId":  cat_id,
            "categoryName": cat_name,
            "sourceId":    src_id,
            "sourceName":  src_name,
            "authorId":    random.randint(1, 100),
            "authorName":  f"Author_{random.randint(1,100)}",
            "viewsCount":  random.randint(1, 50000),
            "likesCount":  random.randint(1, 1000),
            "publishDate": _now_iso(),
            "url":         f"https://newsportal.com/{cat_name}/{article_id}",
        },
        "metadata": {
            "correlationId": str(uuid.uuid4()),
            "userId":        user_id,
            "ipAddress":     _random_ip(),
            "userAgent":     random.choice(USER_AGENTS),
            "environment":   "production",
        },
    }


def make_producer() -> KafkaProducer:
    """Подключается к Kafka, ретраит до победы."""
    while True:
        try:
            p = KafkaProducer(
                bootstrap_servers=BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=5,
                linger_ms=10,        # небольшая задержка для батчинга
                batch_size=16384,
            )
            logger.info(f"Connected to Kafka at {BOOTSTRAP}")
            return p
        except NoBrokersAvailable:
            logger.warning("Kafka not available yet, retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            logger.warning(f"Connection error: {e}, retrying in 5s...")
            time.sleep(5)


def run():
    logger.info("News Producer starting...")

    # Ждём пока Kafka поднимется
    time.sleep(15)

    producer = make_producer()

    # Начинаем с article_id = 3_000_001 чтобы не пересекаться с данными в БД
    # (agregatorCreate.py генерирует 3 млн записей с id 1..3_000_000)
    article_counter = 3_000_001
    published_count = 0
    viewed_count = 0
    liked_count = 0

    logger.info("Starting event generation loop...")

    while True:
        try:
            # ── Event 1: ArticlePublished ──────────────────────────────────────
            event1 = build_article_published_event(article_counter)
            future = producer.send(
                TOPIC_ARTICLES,
                key=str(article_counter),
                value=event1,
                headers=[
                    ("eventType", b"ArticlePublished"),
                    ("version",   b"1.0"),
                    ("source",    b"news-cms"),
                ],
            )
            future.get(timeout=10)  # ждём подтверждения
            published_count += 1
            logger.info(
                f"[{published_count}] ArticlePublished | "
                f"article_id={article_counter} | "
                f"title={event1['payload']['title'][:40]}"
            )

            # ── Event 2: ArticleViewed ─────────────────────────────────────────
            # Просматривают как новые статьи, так и старые из БД (1..article_counter)
            view_id   = random.randint(1, article_counter)
            user_id   = f"user-{random.randint(1, 50000)}"
            event2    = build_article_viewed_event(view_id, user_id)
            producer.send(
                TOPIC_VIEWS,
                key=user_id,
                value=event2,
                headers=[
                    ("eventType", b"ArticleViewed"),
                    ("version",   b"1.0"),
                    ("source",    b"news-api"),
                ],
            )
            viewed_count += 1
            logger.info(
                f"[{viewed_count}] ArticleViewed | "
                f"article_id={view_id} user={user_id}"
            )

            # ── Event 3: ArticleLiked (40% вероятность) ────────────────────────
            if random.random() < 0.40:
                like_id   = random.randint(1, article_counter)
                like_user = f"user-{random.randint(1, 50000)}"
                event3    = build_article_liked_event(like_id, like_user)
                producer.send(
                    TOPIC_REACTIONS,
                    key=like_user,
                    value=event3,
                    headers=[
                        ("eventType", b"ArticleLiked"),
                        ("version",   b"1.0"),
                        ("source",    b"news-api"),
                    ],
                )
                liked_count += 1
                logger.info(
                    f"[{liked_count}] ArticleLiked | "
                    f"article_id={like_id} user={like_user}"
                )

            article_counter += 1

            # Флашим буфер каждые 10 сообщений
            if article_counter % 10 == 0:
                producer.flush()

            # Пауза между итерациями: 1 событие/сек
            time.sleep(1.0)

        except KeyboardInterrupt:
            logger.info("Shutting down producer...")
            producer.flush()
            producer.close()
            break

        except Exception as exc:
            logger.error(f"Error sending message: {exc}", exc_info=True)
            time.sleep(5)
            # Переподключаемся если соединение потеряно
            try:
                producer.close()
            except Exception:
                pass
            producer = make_producer()


if __name__ == "__main__":
    run()