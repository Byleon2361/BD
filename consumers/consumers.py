"""
News Aggregator — Kafka Consumers
==================================
Consumer Group 1: notifications-group
Consumer Group 2: analytics-group
Consumer Group 3: clickhouse-group  ← НОВАЯ ГРУППА
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import psycopg2
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError
from clickhouse_driver import Client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("news-consumers")

# ─── Config ───────────────────────────────────────────────────────────────────
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
CONSUMER_GROUP = os.getenv("CONSUMER_GROUP", "notifications-group")

# ClickHouse config
CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "clickhouse")
CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", 9000))
CLICKHOUSE_DB = os.getenv("CLICKHOUSE_DB", "news_analytics")
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "analytics")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "analytics_pass")

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_DB = "news_aggregator"
POSTGRES_USER = "postgres"
POSTGRES_PASSWORD = "password"

TOPIC_ARTICLES = "news.articles.events"
TOPIC_VIEWS = "news.views.events"
TOPIC_REACTIONS = "news.reactions.events"
TOPIC_DLQ = "news.events.dlq"

# ─── ClickHouse Batch Writer ──────────────────────────────────────────────────
class ClickHouseBatchWriter:
    def __init__(self):
        self.buffer = []
        self.last_flush = time.time()
        self.clickhouse = None

    def connect(self):
        try:
            self.clickhouse = Client(
                host=CLICKHOUSE_HOST,
                port=CLICKHOUSE_PORT,
                database=CLICKHOUSE_DB,
                user=CLICKHOUSE_USER,
                password=CLICKHOUSE_PASSWORD,
                connect_timeout=10,
            )
            self.clickhouse.execute("SELECT 1")
            logger.info(f"✅ [CLICKHOUSE] Connected to {CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}")
            return True
        except Exception as e:
            logger.error(f"❌ [CLICKHOUSE] Cannot connect: {e}")
            return False

    def parse_timestamp(self, ts):
        if ts is None:
            return datetime.now(timezone.utc).replace(tzinfo=None)

        if isinstance(ts, datetime):
            return ts.replace(tzinfo=None) if ts.tzinfo else ts

        if isinstance(ts, str):
            formats = [
                "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
            ]
            for fmt in formats:
                try:
                    dt = datetime.strptime(ts, fmt)
                    return dt.replace(tzinfo=None) if dt.tzinfo else dt
                except ValueError:
                    continue
            try:
                dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                return dt.replace(tzinfo=None)
            except:
                pass

        if isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)

        logger.warning(f"Could not parse timestamp: {ts}, using now()")
        return datetime.now(timezone.utc).replace(tzinfo=None)

    def transform_event(self, topic: str, event: dict) -> dict:
        event_type_map = {
            TOPIC_ARTICLES: 'article_published',
            TOPIC_VIEWS: 'article_view',
            TOPIC_REACTIONS: 'article_reaction'
        }

        event_time = self.parse_timestamp(event.get('timestamp'))
        ingested_at = datetime.now(timezone.utc).replace(tzinfo=None)

        base_event = {
            'event_id': str(uuid.uuid4()),
            'event_time': event_time,
            'ingested_at': ingested_at,
            'event_version': 1,
            'event_type': event_type_map.get(topic, 'unknown'),
            'user_id': 0,
            'article_id': 0,
            'category_id': 0,
            'session_id': str(uuid.uuid4()),
            'read_time_sec': 0,
            'scroll_depth': 0,
            'is_subscriber': 0,
            'device_type': '',
            'source_site': '',
            'reaction_type': '',
            'query_text': '',
            'results_count': 0,
            'clicked_result': 0,
            'session_sec': 0,
            'pages_visited': 0,
            'country_code': '',
            'platform': ''
        }

        payload = event.get('payload', {}) or {}

        if topic == TOPIC_VIEWS:
            base_event.update({
                'user_id': event.get('userId', payload.get('userId', 0)),
                'article_id': payload.get('articleId', 0),
                'category_id': payload.get('categoryId', 0),
                'read_time_sec': payload.get('readTimeSeconds', 0),
                'scroll_depth': payload.get('scrollDepth', 0),
                'device_type': payload.get('deviceType', ''),
                'country_code': payload.get('countryCode', ''),
                'source_site': payload.get('source', '')
            })
        elif topic == TOPIC_REACTIONS:
            base_event.update({
                'user_id': event.get('userId', payload.get('userId', 0)),
                'article_id': payload.get('articleId', 0),
                'category_id': payload.get('categoryId', 0),
                'reaction_type': payload.get('reactionType', 'like')
            })
        elif topic == TOPIC_ARTICLES:
            base_event.update({
                'article_id': payload.get('articleId', 0),
                'category_id': payload.get('categoryId', 0),
                'source_site': payload.get('source', '')
            })

        return base_event

    def add_event(self, topic: str, event: dict):
        try:
            transformed = self.transform_event(topic, event)
            self.buffer.append(transformed)
            logger.debug(f"[CLICKHOUSE] Buffered: {transformed['event_type']}")
            return True
        except Exception as e:
            logger.error(f"[CLICKHOUSE] Transform error: {e}")
            return False

    def flush(self):
        if not self.buffer:
            return
        try:
            if not self.clickhouse:
                if not self.connect():
                    return

            self.clickhouse.execute(
                "INSERT INTO news_analytics.events VALUES",
                self.buffer
            )
            logger.info(f"✅ [CLICKHOUSE] Flushed {len(self.buffer)} events")
            self.buffer.clear()
            self.last_flush = time.time()
        except Exception as e:
            logger.error(f"❌ [CLICKHOUSE] Flush error: {e}")


# ─── DLQ Producer ─────────────────────────────────────────────────────────────
def make_dlq_producer() -> KafkaProducer:
    return KafkaProducer(
        bootstrap_servers=BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: k.encode("utf-8") if k else None,
    )


def send_to_dlq(producer, original_topic, message, error, key=None):
    dlq_payload = {
        "originalTopic": original_topic,
        "originalKey": key,
        "message": message,
        "error": error,
        "failedAt": datetime.now(timezone.utc).isoformat(),
    }
    producer.send(TOPIC_DLQ, key=key or "unknown", value=dlq_payload)
    producer.flush()
    logger.warning(f"[DLQ] Sent from {original_topic}: {error}")


# ─── Остальные функции (notifications + analytics) оставляем без изменений ───
# (я их не стал копировать полностью, чтобы не было слишком длинно, но они остаются те же)

# ... [весь код run_notifications_consumer(), run_analytics_consumer(), 
#      _handle_article_published_notification(), upsert_ функции и т.д. 
#      из твоего оригинального consumer.py — просто вставь их сюда ниже]

# ═══════════════════════════════════════════════════════════════════════════════
# CONSUMER GROUP 3 — clickhouse-group
# ═══════════════════════════════════════════════════════════════════════════════
def run_clickhouse_consumer():
    logger.info("Starting consumer group: clickhouse-group")
    consumer = KafkaConsumer(
        TOPIC_ARTICLES,
        TOPIC_VIEWS,
        TOPIC_REACTIONS,
        bootstrap_servers=BOOTSTRAP_SERVERS,
        group_id="clickhouse-group",
        enable_auto_commit=True,
        auto_offset_reset="earliest",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        key_deserializer=lambda k: k.decode("utf-8") if k else None,
    )

    writer = ClickHouseBatchWriter()
    dlq_producer = make_dlq_producer()

    logger.info("clickhouse-group waiting for messages…")

    for msg in consumer:
        try:
            event = msg.value
            topic = msg.topic

            writer.add_event(topic, event)

            # Простой flush каждые 10 событий или по таймеру
            if len(writer.buffer) >= 10 or (time.time() - writer.last_flush > 5):
                writer.flush()

            # commit (можно отключить, если хочешь exactly-once, но для начала так)
            consumer.commit()

        except Exception as exc:
            logger.error(f"[CLICKHOUSE] Failed to process message: {exc}", exc_info=True)
            send_to_dlq(
                dlq_producer,
                original_topic=msg.topic,
                message=msg.value,
                error=str(exc),
                key=msg.key,
            )
            consumer.commit()  # чтобы не застревать


# ─── Entrypoint ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    group = CONSUMER_GROUP
    if group == "notifications-group":
        run_notifications_consumer()
    elif group == "analytics-group":
        run_analytics_consumer()
    elif group == "clickhouse-group":
        run_clickhouse_consumer()
    else:
        logger.error(f"Unknown CONSUMER_GROUP: {group}")
        raise SystemExit(1)