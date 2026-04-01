#!/bin/bash

set -e

echo "🧹 Cleaning old containers..."
docker compose down --remove-orphans -v || true

echo "🧽 Pruning volumes and networks..."
docker volume prune -f || true
docker network prune -f || true

echo "🚀 Starting docker-compose..."
docker compose up -d --build

echo "⏳ Waiting for Postgres to be ready..."
until docker exec bd-postgres-1 pg_isready -U postgres >/dev/null 2>&1; do
  sleep 2
  echo "Waiting for Postgres..."
done

echo "✅ Postgres is ready!"

echo "📦 Creating Kafka tables in Postgres..."

docker exec -i bd-postgres-1 psql -U postgres -d news_aggregator <<'EOF'

CREATE TABLE IF NOT EXISTS kafka_article_stats (
    article_id  BIGINT PRIMARY KEY,
    view_count  BIGINT  DEFAULT 0,
    like_count  BIGINT  DEFAULT 0,
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kafka_category_windows (
    id            SERIAL PRIMARY KEY,
    category_id   INT,
    category_name VARCHAR(100),
    window_count  BIGINT DEFAULT 0,
    window_type   VARCHAR(50),
    window_end    TIMESTAMP,
    recorded_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kafka_dlq_log (
    id             SERIAL PRIMARY KEY,
    original_topic VARCHAR(255),
    original_key   VARCHAR(255),
    error_message  TEXT,
    payload        JSONB,
    failed_at      TIMESTAMP,
    recorded_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kafka_stats_updated ON kafka_article_stats(updated_at);
CREATE INDEX IF NOT EXISTS idx_kafka_windows_cat   ON kafka_category_windows(category_id);
CREATE INDEX IF NOT EXISTS idx_kafka_windows_end   ON kafka_category_windows(window_end);

EOF

echo "🎉 Setup completed successfully!"