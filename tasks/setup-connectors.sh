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
