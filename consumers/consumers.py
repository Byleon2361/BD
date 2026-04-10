"""
News Aggregator — Kafka Consumers
==================================
Consumer Group 1: notifications-group
  - Subscribes to all 3 event topics
  - Sends notifications on ArticlePublished
  - Manual offset commit
  - DLQ for failed messages

Consumer Group 2: analytics-group
  - Subscribes to views + reactions
  - Persists stats to PostgreSQL
  - Auto commit with at-least-once semantics
  - Retry logic with exponential backoff
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone

import psycopg2
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("news-consumers")

# ─── Config ───────────────────────────────────────────────────────────────────
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
CONSUMER_GROUP    = os.getenv("CONSUMER_GROUP", "notifications-group")
POSTGRES_HOST     = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_DB       = "news_aggregator"
POSTGRES_USER     = "postgres"
POSTGRES_PASSWORD = "password"

TOPIC_ARTICLES  = "news.articles.events"
TOPIC_VIEWS     = "news.views.events"
TOPIC_REACTIONS = "news.reactions.events"
TOPIC_DLQ       = "news.events.dlq"

MAX_RETRY_ATTEMPTS = 3
RETRY_BACKOFF_BASE = 2  # seconds


# ─── DLQ Producer ─────────────────────────────────────────────────────────────
def make_dlq_producer() -> KafkaProducer:
    return KafkaProducer(
        bootstrap_servers=BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
    )


def send_to_dlq(producer: KafkaProducer, original_topic: str,
                message: dict, error: str, key: str | None = None):
    """Wrap failed message in DLQ envelope and publish."""
    dlq_payload = {
        "originalTopic": original_topic,
        "originalKey":   key,
        "message":       message,
        "error":         error,
        "failedAt":      datetime.now(timezone.utc).isoformat(),
    }
    producer.send(TOPIC_DLQ, key=key or "unknown", value=dlq_payload)
    producer.flush()
    logger.warning(f"[DLQ] Sent to DLQ from topic={original_topic} key={key}: {error}")


# ─── Helper: retry wrapper ─────────────────────────────────────────────────────
def with_retry(fn, *args, attempts=MAX_RETRY_ATTEMPTS, **kwargs):
    """Run fn with exponential backoff retries."""
    for attempt in range(1, attempts + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            if attempt == attempts:
                raise
            wait = RETRY_BACKOFF_BASE ** attempt
            logger.warning(f"Attempt {attempt}/{attempts} failed: {exc}. Retrying in {wait}s…")
            time.sleep(wait)


# ─── PostgreSQL helpers ────────────────────────────────────────────────────────
def get_pg_conn():
    return psycopg2.connect(
        host=POSTGRES_HOST,
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
    )


def upsert_view_stats(conn, article_id: int):
    """Increment view counter in PostgreSQL."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO kafka_article_stats (article_id, view_count, like_count, updated_at)
            VALUES (%s, 1, 0, NOW())
            ON CONFLICT (article_id)
            DO UPDATE SET
                view_count = kafka_article_stats.view_count + 1,
                updated_at = NOW()
            """,
            (article_id,),
        )
    conn.commit()


def upsert_like_stats(conn, article_id: int):
    """Increment like counter in PostgreSQL."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO kafka_article_stats (article_id, view_count, like_count, updated_at)
            VALUES (%s, 0, 1, NOW())
            ON CONFLICT (article_id)
            DO UPDATE SET
                like_count = kafka_article_stats.like_count + 1,
                updated_at = NOW()
            """,
            (article_id,),
        )
    conn.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# CONSUMER GROUP 1 — notifications-group
#   • Manual offset commit (enable_auto_commit=False)
#   • Sends alerts on ArticlePublished
#   • Pushes failed messages to DLQ
# ═══════════════════════════════════════════════════════════════════════════════

def run_notifications_consumer():
    logger.info("Starting consumer group: notifications-group")

    consumer = KafkaConsumer(
        TOPIC_ARTICLES,
        TOPIC_VIEWS,
        TOPIC_REACTIONS,
        bootstrap_servers=BOOTSTRAP_SERVERS,
        group_id="notifications-group",
        enable_auto_commit=False,          # ← manual commit
        auto_offset_reset="earliest",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        key_deserializer=lambda k: k.decode("utf-8") if k else None,
        max_poll_records=100,
        session_timeout_ms=30_000,
        heartbeat_interval_ms=10_000,
    )

    dlq_producer = make_dlq_producer()

    logger.info("notifications-group waiting for messages…")

    for msg in consumer:
        try:
            event = msg.value
            event_type = event.get("eventType", "UNKNOWN")
            entity_id  = event.get("entityId", "?")
            topic      = msg.topic
            key        = msg.key

            logger.info(
                f"[NOTIF] topic={topic} partition={msg.partition} "
                f"offset={msg.offset} eventType={event_type} entityId={entity_id}"
            )

            # Business logic: send notification on new article
            if event_type == "ArticlePublished":
                _handle_article_published_notification(event)

            # ✅ Manual commit after successful processing
            consumer.commit()

        except Exception as exc:
            logger.error(f"[NOTIF] Failed to process message: {exc}", exc_info=True)
            send_to_dlq(
                dlq_producer,
                original_topic=msg.topic,
                message=msg.value,
                error=str(exc),
                key=msg.key,
            )
            # Commit anyway to avoid infinite loop on poison pill
            consumer.commit()


def _handle_article_published_notification(event: dict):
    payload = event.get("payload", {})
    title   = payload.get("title", "Unknown")
    source  = payload.get("sourceName", "Unknown")
    logger.info(f"  📢 NOTIFICATION: New article published — '{title}' from {source}")
    # In production: send email / push / Slack notification here


# ═══════════════════════════════════════════════════════════════════════════════
# CONSUMER GROUP 2 — analytics-group
#   • Auto commit (simpler, acceptable for analytics)
#   • Persists stats to PostgreSQL
#   • Retry on DB errors
# ═══════════════════════════════════════════════════════════════════════════════

def run_analytics_consumer():
    logger.info("Starting consumer group: analytics-group")

    consumer = KafkaConsumer(
        TOPIC_VIEWS,
        TOPIC_REACTIONS,
        bootstrap_servers=BOOTSTRAP_SERVERS,
        group_id="analytics-group",
        enable_auto_commit=True,           # ← auto commit
        auto_commit_interval_ms=5_000,
        auto_offset_reset="earliest",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        key_deserializer=lambda k: k.decode("utf-8") if k else None,
    )

    dlq_producer = make_dlq_producer()
    pg_conn = None

    while True:
        try:
            if pg_conn is None or pg_conn.closed:
                pg_conn = with_retry(get_pg_conn)
                logger.info("[ANALYTICS] Connected to PostgreSQL")

            for msg in consumer:
                event      = msg.value
                event_type = event.get("eventType", "UNKNOWN")
                payload    = event.get("payload", {})
                article_id = payload.get("articleId")

                logger.info(
                    f"[ANALYTICS] topic={msg.topic} eventType={event_type} articleId={article_id}"
                )

                try:
                    if event_type == "ArticleViewed" and article_id:
                        with_retry(upsert_view_stats, pg_conn, article_id)
                    elif event_type == "ArticleLiked" and article_id:
                        with_retry(upsert_like_stats, pg_conn, article_id)

                except Exception as exc:
                    logger.error(f"[ANALYTICS] DB error for article {article_id}: {exc}")
                    send_to_dlq(
                        dlq_producer,
                        original_topic=msg.topic,
                        message=event,
                        error=str(exc),
                        key=msg.key,
                    )

        except KafkaError as ke:
            logger.error(f"[ANALYTICS] Kafka error: {ke}. Reconnecting in 5s…")
            time.sleep(5)

        except Exception as exc:
            logger.error(f"[ANALYTICS] Unexpected error: {exc}", exc_info=True)
            time.sleep(5)
            pg_conn = None  # force reconnect


# ─── Entrypoint ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    group = CONSUMER_GROUP

    if group == "notifications-group":
        run_notifications_consumer()
    elif group == "analytics-group":
        run_analytics_consumer()
    else:
        logger.error(f"Unknown CONSUMER_GROUP: {group}")
        raise SystemExit(1)