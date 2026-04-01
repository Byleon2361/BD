"""
News Aggregator - Kafka Producer (FastStream)
============================================
Generates 3 types of business events:
  - ArticlePublished
  - ArticleViewed
  - ArticleLiked

Each event follows the unified schema:
  eventId, eventType, entityId, timestamp, source, payload, version, metadata
"""

import asyncio
import uuid
import random
import logging
from datetime import datetime, timezone
from typing import Any

from faststream import FastStream
from faststream.kafka import KafkaBroker
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("news-producer")

# ─── Kafka Topics ──────────────────────────────────────────────────────────────
TOPIC_ARTICLES  = "news.articles.events"
TOPIC_VIEWS     = "news.views.events"
TOPIC_REACTIONS = "news.reactions.events"

# ─── Pydantic models (unified event format) ───────────────────────────────────

class ArticlePayload(BaseModel):
    articleId:    int
    title:        str
    categoryId:   int
    categoryName: str
    sourceId:     int
    sourceName:   str
    authorId:     int
    viewsCount:   int = 0
    likesCount:   int = 0
    publishDate:  str

class EventMetadata(BaseModel):
    correlationId: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId:        str | None = None
    ipAddress:     str | None = None
    userAgent:     str | None = None
    environment:   str = "production"

class NewsEvent(BaseModel):
    eventId:   str = Field(default_factory=lambda: str(uuid.uuid4()))
    eventType: str
    entityId:  str
    timestamp: int = Field(default_factory=lambda: int(datetime.now(timezone.utc).timestamp() * 1000))
    source:    str = "news-producer"
    version:   str = "1.0"
    payload:   ArticlePayload
    metadata:  EventMetadata

# ─── Sample data (mirrors the DB from agregatorCreate.py) ─────────────────────
CATEGORIES = [
    (1, "politics"), (2, "sports"), (3, "technology"),
    (4, "entertainment"), (5, "business"), (6, "health"), (7, "science"),
]
SOURCES = [
    (1, "Reuters"), (2, "Associated Press"), (3, "BBC News"),
    (4, "CNN"), (5, "Al Jazeera"), (6, "Bloomberg"),
]
BASE_TITLES = [
    "Breaking News", "Latest Update", "Exclusive Report",
    "Market Analysis", "Sports Roundup", "Tech Review",
]
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64)",
]

def _random_ip() -> str:
    return f"{random.randint(1,254)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"

def _build_payload(article_id: int) -> ArticlePayload:
    cat_id, cat_name = random.choice(CATEGORIES)
    src_id, src_name = random.choice(SOURCES)
    return ArticlePayload(
        articleId=article_id,
        title=f"{random.choice(BASE_TITLES)} #{article_id} - {cat_name.capitalize()}",
        categoryId=cat_id,
        categoryName=cat_name,
        sourceId=src_id,
        sourceName=src_name,
        authorId=random.randint(1, 100),
        viewsCount=random.randint(0, 50_000),
        likesCount=random.randint(0, 1_000),
        publishDate=datetime.now(timezone.utc).isoformat(),
    )

def _build_metadata(user_id: str | None = None) -> EventMetadata:
    return EventMetadata(
        userId=user_id,
        ipAddress=_random_ip(),
        userAgent=random.choice(USER_AGENTS),
    )

# ─── Event factory functions ───────────────────────────────────────────────────

def make_article_published(article_id: int) -> tuple[str, NewsEvent]:
    """Event type 1: ArticlePublished — key = article_id"""
    event = NewsEvent(
        eventType="ArticlePublished",
        entityId=str(article_id),
        source="news-cms",
        payload=_build_payload(article_id),
        metadata=_build_metadata(),
    )
    return str(article_id), event

def make_article_viewed(article_id: int, user_id: str) -> tuple[str, NewsEvent]:
    """Event type 2: ArticleViewed — key = user_id (partition by reader)"""
    payload = _build_payload(article_id)
    event = NewsEvent(
        eventType="ArticleViewed",
        entityId=str(article_id),
        source="news-api",
        payload=payload,
        metadata=_build_metadata(user_id),
    )
    return user_id, event

def make_article_liked(article_id: int, user_id: str) -> tuple[str, NewsEvent]:
    """Event type 3: ArticleLiked — key = user_id"""
    payload = _build_payload(article_id)
    payload.likesCount += 1
    event = NewsEvent(
        eventType="ArticleLiked",
        entityId=str(article_id),
        source="news-api",
        payload=payload,
        metadata=_build_metadata(user_id),
    )
    return user_id, event

# ─── FastStream app ────────────────────────────────────────────────────────────

broker = KafkaBroker("kafka:29092")
app = FastStream(broker)

@app.after_startup
async def produce_events():
    logger.info("Producer started — publishing events to Kafka...")

    article_counter = 1_000_000  # continue from existing DB range

    while True:
        try:
            # --- Event 1: ArticlePublished ---
            article_id = article_counter
            key, event = make_article_published(article_id)
            await broker.publish(
                event.model_dump(),
                topic=TOPIC_ARTICLES,
                key=key,
                headers={
                    "eventType": event.eventType,
                    "version":   event.version,
                    "source":    event.source,
                },
            )
            logger.info(f"[PUBLISHED] ArticlePublished | article_id={article_id}")

            # --- Event 2: ArticleViewed (random existing article) ---
            view_article_id = random.randint(1, article_id)
            user_id = f"user-{random.randint(1, 10_000)}"
            key2, ev2 = make_article_viewed(view_article_id, user_id)
            await broker.publish(
                ev2.model_dump(),
                topic=TOPIC_VIEWS,
                key=key2,
                headers={
                    "eventType": ev2.eventType,
                    "version":   ev2.version,
                    "source":    ev2.source,
                },
            )
            logger.info(f"[PUBLISHED] ArticleViewed | article_id={view_article_id} user={user_id}")

            # --- Event 3: ArticleLiked (30% chance) ---
            if random.random() < 0.30:
                like_article_id = random.randint(1, article_id)
                like_user_id = f"user-{random.randint(1, 10_000)}"
                key3, ev3 = make_article_liked(like_article_id, like_user_id)
                await broker.publish(
                    ev3.model_dump(),
                    topic=TOPIC_REACTIONS,
                    key=key3,
                    headers={
                        "eventType": ev3.eventType,
                        "version":   ev3.version,
                        "source":    ev3.source,
                    },
                )
                logger.info(f"[PUBLISHED] ArticleLiked | article_id={like_article_id} user={like_user_id}")

            article_counter += 1
            await asyncio.sleep(0.5)  # 2 events/sec

        except Exception as exc:
            logger.error(f"Producer error: {exc}", exc_info=True)
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(app.run())