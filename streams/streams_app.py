"""
News Aggregator — Kafka Streams (Python / Faust)
================================================
Implements all required stream operations:

1. TRANSFORMATION  — enrich ArticleViewed events with category label
2. AGGREGATION     — count total views per article (KTable)
3. WINDOWED COUNT  — views per category per 1-minute tumbling window
4. OUTPUT TOPICS:
   - news.enriched.views      ← transformed events
   - news.stats.article-views ← aggregated view counts
   - news.stats.category-windows ← windowed counts
"""

import logging
import json
import faust
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s - %(message)s")
logger = logging.getLogger("news-streams")

# ─── Faust App ────────────────────────────────────────────────────────────────
app = faust.App(
    "news-streams",
    broker="kafka://kafka:29092",
    value_serializer="json",
    store="memory://",
    topic_partitions=4,
)

# ─── Topic Declarations ───────────────────────────────────────────────────────
views_topic     = app.topic("news.views.events",           value_type=dict)
reactions_topic = app.topic("news.reactions.events",       value_type=dict)

# Output topics (results)
enriched_topic   = app.topic("news.enriched.views",           value_type=dict)
agg_views_topic  = app.topic("news.stats.article-views",      value_type=dict)
cat_window_topic = app.topic("news.stats.category-windows",   value_type=dict)

# ─── KTable: total views per article ─────────────────────────────────────────
article_view_table = app.Table(
    "article-view-counts",
    default=int,
    partitions=4,
)

# KTable: likes per article
article_like_table = app.Table(
    "article-like-counts",
    default=int,
    partitions=4,
)

# Windowed KTable: views per category in 1-minute tumbling windows
category_window_table = app.Table(
    "category-view-windows",
    default=int,
    partitions=4,
).tumbling(60.0, expires=faust.windows.Window(60.0))

# ─── Category map (mirrors DB seed data) ─────────────────────────────────────
CATEGORY_LABELS = {
    1: "politics",
    2: "sports",
    3: "technology",
    4: "entertainment",
    5: "business",
    6: "health",
    7: "science",
}


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT 1: TRANSFORMATION
# Enriches raw ArticleViewed events with human-readable category label
# and computed engagement score.
# Output → news.enriched.views
# ═══════════════════════════════════════════════════════════════════════════════
@app.agent(views_topic)
async def enrich_view_events(stream):
    """
    Transformation: add categoryLabel + engagementScore to each view event.
    """
    async for event in stream:
        try:
            payload      = event.get("payload", {})
            category_id  = payload.get("categoryId", 0)
            views_count  = payload.get("viewsCount", 0)
            likes_count  = payload.get("likesCount", 0)

            # ── Transform 1: human-readable category ──────────────────────────
            category_label = CATEGORY_LABELS.get(category_id, "unknown")

            # ── Transform 2: engagement score ─────────────────────────────────
            # score = likes / views (0–1), clamped
            engagement_score = round(
                min(likes_count / max(views_count, 1), 1.0), 4
            )

            enriched = {
                **event,
                "enriched": True,
                "categoryLabel":    category_label,
                "engagementScore":  engagement_score,
                "processedAt":      datetime.now(timezone.utc).isoformat(),
            }

            await enriched_topic.send(
                key=event.get("entityId", "unknown"),
                value=enriched,
            )

            logger.debug(
                f"[TRANSFORM] article={event.get('entityId')} "
                f"category={category_label} score={engagement_score}"
            )

        except Exception as exc:
            logger.error(f"[TRANSFORM] Error: {exc}", exc_info=True)


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT 2: AGGREGATION
# Counts total views per article (stateful KTable)
# Output → news.stats.article-views
# ═══════════════════════════════════════════════════════════════════════════════
@app.agent(views_topic)
async def aggregate_article_views(stream):
    """
    Aggregation: running total of views per article_id stored in KTable.
    Emits updated count to output topic on every event.
    """
    async for event in stream:
        try:
            article_id = str(event.get("entityId", "unknown"))

            # ── Aggregation: increment KTable counter ─────────────────────────
            article_view_table[article_id] += 1
            total_views = article_view_table[article_id]

            result = {
                "articleId":   article_id,
                "totalViews":  total_views,
                "updatedAt":   datetime.now(timezone.utc).isoformat(),
            }

            await agg_views_topic.send(key=article_id, value=result)

            if total_views % 100 == 0:
                logger.info(f"[AGGREGATE] article={article_id} total_views={total_views}")

        except Exception as exc:
            logger.error(f"[AGGREGATE] Error: {exc}", exc_info=True)


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT 3: WINDOWED COMPUTATION
# Counts views per category in 1-minute tumbling windows.
# Output → news.stats.category-windows
# ═══════════════════════════════════════════════════════════════════════════════
@app.agent(views_topic)
async def windowed_category_views(stream):
    """
    Windowed aggregation: count views per category per 1-minute tumbling window.
    Emits window snapshot on every event.
    """
    async for event in stream.group_by(
        lambda e: str(e.get("payload", {}).get("categoryId", 0))
    ):
        try:
            payload     = event.get("payload", {})
            category_id = str(payload.get("categoryId", 0))
            category    = CATEGORY_LABELS.get(int(category_id), "unknown")

            # ── Windowed count (1-minute tumbling window) ─────────────────────
            category_window_table[category_id] += 1
            window_count = category_window_table[category_id].current()

            window_result = {
                "categoryId":    category_id,
                "categoryName":  category,
                "windowCount":   window_count,
                "windowType":    "tumbling-1min",
                "windowEnd":     datetime.now(timezone.utc).isoformat(),
            }

            await cat_window_topic.send(key=category_id, value=window_result)
            logger.debug(
                f"[WINDOW] category={category} count_in_window={window_count}"
            )

        except Exception as exc:
            logger.error(f"[WINDOW] Error: {exc}", exc_info=True)


# ═══════════════════════════════════════════════════════════════════════════════
# AGENT 4: REACTIONS AGGREGATION
# Counts likes per article (bonus aggregation)
# ═══════════════════════════════════════════════════════════════════════════════
@app.agent(reactions_topic)
async def aggregate_article_likes(stream):
    """Aggregation: running like count per article in KTable."""
    async for event in stream:
        try:
            article_id = str(event.get("entityId", "unknown"))
            article_like_table[article_id] += 1
            logger.debug(
                f"[LIKES] article={article_id} total_likes={article_like_table[article_id]}"
            )
        except Exception as exc:
            logger.error(f"[LIKES] Error: {exc}", exc_info=True)


# ─── Entrypoint ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.main()