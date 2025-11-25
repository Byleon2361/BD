#!/bin/bash
# full-benchmark.sh
CONTAINER_NAME="bd-postgres-1"
DB_NAME="news_aggregator"

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

# Перезапуск экземпляра
echo "3. Restarting container to apply settings..."
docker-compose down
docker-compose up -d
sleep 5  # Ждём, пока контейнер запустится

# Проверка параметров
echo "4. Verifying server parameters..."
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "SHOW maintenance_work_mem;"
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "SHOW max_connections;"

# Инициализация pgbench
echo "5. Initializing pgbench with scale 10..."
docker exec $CONTAINER_NAME pgbench -U postgres -i -s 10 $DB_NAME

# Измеряем размер до теста
echo "6. Database size before bloat:"
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_table_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND relname LIKE 'pgbench%';"

# Первый тест
echo "7. First benchmark test (10 seconds)..."
docker exec $CONTAINER_NAME pgbench -U postgres -c 5 -j 2 -T 10 $DB_NAME

# Создаем блоатинг
echo "8. Creating bloat..."
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "UPDATE pgbench_accounts SET abalance = abalance WHERE aid % 10 = 0;"

# Измеряем размер после блоатинга
echo "9. Database size after bloat:"
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_table_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND relname LIKE 'pgbench%';"

# Второй тест
echo "10. Second benchmark test (10 seconds)..."
docker exec $CONTAINER_NAME pgbench -U postgres -c 5 -j 2 -T 10 $DB_NAME

# Проверка процессов
echo "11. Checking server processes..."
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "
SELECT pid, usename, application_name, state, query
FROM pg_stat_activity
WHERE datname = '$DB_NAME';"

# Аварийное завершение
echo "12. Performing crash and recovery..."
docker kill --signal=SIGKILL $CONTAINER_NAME
docker-compose up -d
sleep 5
echo "Checking logs for crash recovery..."
docker-compose logs postgres | grep -i "crash\|recovery"

# Запрет подключений
echo "13. Blocking application connections..."
docker exec $CONTAINER_NAME bash -c "echo 'host all all 0.0.0.0/0 reject' >> /var/lib/postgresql/data/pg_hba.conf"
docker exec $CONTAINER_NAME psql -U postgres -c "SELECT pg_reload_conf();" > /dev/null

# Перестроение объектов
echo "14. Rebuilding pgbench objects..."
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "
VACUUM FULL pgbench_accounts;
VACUUM FULL pgbench_branches;
VACUUM FULL pgbench_tellers;
VACUUM FULL pgbench_history;
REINDEX TABLE pgbench_accounts;
REINDEX TABLE pgbench_branches;
REINDEX TABLE pgbench_tellers;
REINDEX TABLE pgbench_history;
"

# Измеряем размер после перестроения
echo "15. Database size after rebuild:"
docker exec $CONTAINER_NAME psql -U postgres -d $DB_NAME -c "
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_table_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND relname LIKE 'pgbench%';"

# Разрешение подключений
echo "16. Allowing application connections..."
docker exec $CONTAINER_NAME bash -c "sed -i '/reject/d' /var/lib/postgresql/data/pg_hba.conf"
docker exec $CONTAINER_NAME bash -c "echo 'host all all 0.0.0.0/0 md5' >> /var/lib/postgresql/data/pg_hba.conf"
docker exec $CONTAINER_NAME psql -U postgres -c "SELECT pg_reload_conf();" > /dev/null

# Третий тест
echo "17. Third benchmark test (10 seconds)..."
docker exec $CONTAINER_NAME pgbench -U postgres -c 5 -j 2 -T 10 $DB_NAME

echo "=== Benchmark completed! ==="