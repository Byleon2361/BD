#!/bin/sh
set -e

CONNECT_URL="http://kafka-connect:8083"

echo "=== Waiting for Kafka Connect REST API ==="
until curl -sf "$CONNECT_URL/connectors" > /dev/null; do
  echo "  Kafka Connect not ready yet, waiting 10s..."
  sleep 10
done
echo "  Kafka Connect is ready!"

# ─── CONNECTOR 1: JDBC Sink — пишет статистику просмотров из Kafka в PostgreSQL ───
echo "=== Creating JDBC Sink connector ==="
curl -sf -X POST "$CONNECT_URL/connectors" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "jdbc-sink-article-stats",
    "config": {
      "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
      "tasks.max": "1",
      "topics": "news.stats.article-views",
      "connection.url": "jdbc:postgresql://postgres:5432/news_aggregator",
      "connection.user": "postgres",
      "connection.password": "password",
      "auto.create": "false",
      "auto.evolve": "false",
      "insert.mode": "upsert",
      "pk.mode": "record_value",
      "pk.fields": "articleId",
      "table.name.format": "kafka_article_stats",
      "key.converter": "org.apache.kafka.connect.storage.StringConverter",
      "value.converter": "org.apache.kafka.connect.json.JsonConverter",
      "value.converter.schemas.enable": "false",
      "transforms": "rename",
      "transforms.rename.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
      "transforms.rename.renames": "articleId:article_id,totalViews:view_count,updatedAt:updated_at"
    }
  }' && echo "  jdbc-sink-article-stats created OK" || echo "  jdbc-sink-article-stats already exists or failed"

# ─── CONNECTOR 2: JDBC Source — читает статистику из PostgreSQL обратно в Kafka ───
echo "=== Creating JDBC Source connector ==="
curl -sf -X POST "$CONNECT_URL/connectors" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "jdbc-source-article-stats",
    "config": {
      "connector.class": "io.confluent.connect.jdbc.JdbcSourceConnector",
      "tasks.max": "1",
      "connection.url": "jdbc:postgresql://postgres:5432/news_aggregator",
      "connection.user": "postgres",
      "connection.password": "password",
      "table.whitelist": "kafka_article_stats",
      "mode": "timestamp",
      "timestamp.column.name": "updated_at",
      "topic.prefix": "db.",
      "poll.interval.ms": "10000",
      "key.converter": "org.apache.kafka.connect.storage.StringConverter",
      "value.converter": "org.apache.kafka.connect.json.JsonConverter",
      "value.converter.schemas.enable": "false"
    }
  }' && echo "  jdbc-source-article-stats created OK" || echo "  jdbc-source-article-stats already exists or failed"

echo "=== All connectors registered ==="
curl -s "$CONNECT_URL/connectors" | tr ',' '\n'