#!/bin/bash
# full-benchmark.sh

CONTAINER_NAME="bd-postgres-1"
DB_NAME="demo_big"

echo "=== PostgreSQL Benchmark Test ==="

# Проверка контейнера
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "ERROR: Container $CONTAINER_NAME is not running"
    exit 1
fi

echo "1. Container is running"

# Настройка параметров
echo "2. Configuring server parameters..."
docker exec $CONTAINER_NAME psql -U postgres -c "ALTER SYSTEM SET maintenance_work_mem = '128MB';" > /dev/null
docker exec $CONTAINER_NAME psql -U postgres -c "ALTER SYSTEM SET max_connections = 200;" > /dev/null
docker exec $CONTAINER_NAME psql -U postgres -c "SELECT pg_reload_conf();" > /dev/null

# Инициализация pgbench
echo "3. Initializing pgbench with scale 10..."
docker exec $CONTAINER_NAME pgbench -U postgres -i -s 10 $DB_NAME

# Измеряем размер до теста
echo "4. Database size before bloat:"
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'pgbench%';"

# Первый тест
echo "5. First benchmark test (10 seconds)..."
docker exec $CONTAINER_NAME pgbench -U postgres -c 5 -j 2 -T 10 $DB_NAME

# Создаем блоттинг
echo "6. Creating bloat..."
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "UPDATE pgbench_accounts SET abalance = abalance WHERE aid % 10 = 0;"

# Измеряем размер после блоттинга
echo "7. Database size after bloat:"
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'pgbench%';"

# Второй тест
echo "8. Second benchmark test (10 seconds)..."
docker exec $CONTAINER_NAME pgbench -U postgres -c 5 -j 2 -T 10 $DB_NAME

echo "=== Benchmark completed! ==="