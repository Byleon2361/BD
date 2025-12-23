#!/bin/bash

echo "🚀 Начинаем инициализацию MongoDB кластера..."

# Функция для ожидания готовности контейнера
wait_for_mongo() {
    echo "⏳ Ожидание $1..."
    until docker exec $1 mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
        sleep 2
    done
}

# Ожидаем основные узлы
wait_for_mongo bd-mongo-config-1
wait_for_mongo bd-mongo-shard1-1
wait_for_mongo bd-mongo-shard2-1
wait_for_mongo bd-mongos-1

echo "1️⃣ Инициализация Config Server..."
docker exec bd-mongo-config-1 mongosh --eval "
  rs.initiate({
    _id: 'configrs',
    configsvr: true,
    members: [{ _id: 0, host: 'bd-mongo-config-1:27017' }]
  })
"

echo "2️⃣ Инициализация Shard 1..."
docker exec bd-mongo-shard1-1 mongosh --eval "
  rs.initiate({
    _id: 'shard1rs',
    members: [
      { _id: 0, host: 'bd-mongo-shard1-1:27017', priority: 2 },
      { _id: 1, host: 'bd-mongo-shard1-1-replica:27017', priority: 1 }
    ]
  })
"

echo "3️⃣ Инициализация Shard 2..."
docker exec bd-mongo-shard2-1 mongosh --eval "
  rs.initiate({
    _id: 'shard2rs',
    members: [
      { _id: 0, host: 'bd-mongo-shard2-1:27017', priority: 2 },
      { _id: 1, host: 'bd-mongo-shard2-1-replica:27017', priority: 1 }
    ]
  })
"

echo "⏳ Ожидание синхронизации реплика-сетов (15 сек)..."
sleep 15

echo "4️⃣ Настройка шардинга в mongos..."
docker exec bd-mongos-1 mongosh --eval "
  sh.addShard('shard1rs/bd-mongo-shard1-1:27017');
  sh.addShard('shard2rs/bd-mongo-shard2-1:27017');
  sh.enableSharding('news_aggregator');
  db.adminCommand({ shardCollection: 'news_aggregator.news', key: { _id: 'hashed' } });
"

echo "✅ Инициализация успешно завершена!"