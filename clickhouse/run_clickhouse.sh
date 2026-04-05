#!/bin/bash
# ============================================================
# run_clickhouse.sh — Запуск всего ClickHouse-стека
# ============================================================
# Использование: bash run_clickhouse.sh
# ============================================================

set -e
COMPOSE_CMD="sudo docker compose"
CH_CONTAINER="bd-clickhouse"

echo "════════════════════════════════════════════════"
echo "  Шаг 1: Создаём папку для init-скриптов"
echo "════════════════════════════════════════════════"
mkdir -p ./clickhouse/init
cp ./clickhouse/01_ddl.sql ./clickhouse/init/

echo ""
echo "════════════════════════════════════════════════"
echo "  Шаг 2: Добавляем ClickHouse в docker-compose.yml"
echo "  (если ещё не добавлен)"
echo "════════════════════════════════════════════════"
if grep -q "clickhouse" docker-compose.yml; then
    echo "  ClickHouse уже есть в docker-compose.yml"
else
    echo "  Добавь вручную из файла docker-compose-clickhouse.yml"
    echo "  или выполни:"
    echo "    cat clickhouse/docker-compose-clickhouse.yml"
    echo "  и скопируй секцию services.clickhouse и volumes.clickhouse_data"
fi

echo ""
echo "════════════════════════════════════════════════"
echo "  Шаг 3: Поднимаем ClickHouse"
echo "════════════════════════════════════════════════"
$COMPOSE_CMD up -d clickhouse

echo "  Ждём готовности ClickHouse (health check)..."
for i in $(seq 1 30); do
    if $COMPOSE_CMD exec clickhouse wget -q --spider http://localhost:8123/ping 2>/dev/null; then
        echo "  ✅ ClickHouse готов!"
        break
    fi
    echo "  ... попытка $i/30"
    sleep 3
done

echo ""
echo "════════════════════════════════════════════════"
echo "  Шаг 4: Проверяем что DDL применился"
echo "════════════════════════════════════════════════"
$COMPOSE_CMD exec clickhouse clickhouse-client \
    --user analytics --password analytics_pass \
    --query "SHOW TABLES FROM news_analytics"

echo ""
echo "════════════════════════════════════════════════"
echo "  Шаг 5: Генерируем и загружаем тестовые данные"
echo "════════════════════════════════════════════════"
# Устанавливаем зависимости и запускаем генератор
$COMPOSE_CMD exec clickhouse bash -c "
    pip install clickhouse-driver --quiet 2>/dev/null || true
    python3 /dev/stdin
" < ./clickhouse/02_generate_data.py

echo ""
echo "════════════════════════════════════════════════"
echo "  Шаг 6: Проверяем количество загруженных данных"
echo "════════════════════════════════════════════════"
$COMPOSE_CMD exec clickhouse clickhouse-client \
    --user analytics --password analytics_pass \
    --query "
        SELECT
            'events' as table_name,
            count() as rows,
            formatReadableSize(sum(data_compressed_bytes)) as size
        FROM system.parts
        WHERE database = 'news_analytics' AND table = 'events' AND active = 1
        UNION ALL
        SELECT
            'events_dedup',
            count(),
            formatReadableSize(sum(data_compressed_bytes))
        FROM system.parts
        WHERE database = 'news_analytics' AND table = 'events_dedup' AND active = 1
    "

echo ""
echo "════════════════════════════════════════════════"
echo "  Шаг 7: Запускаем аналитические запросы"
echo "════════════════════════════════════════════════"
$COMPOSE_CMD exec -T clickhouse clickhouse-client \
    --user analytics --password analytics_pass \
    --multiquery < ./clickhouse/03_analytical_queries.sql

echo ""
echo "✅ Всё готово!"
echo ""
echo "Полезные команды:"
echo "  Открыть clickhouse-client интерактивно:"
echo "    sudo docker exec -it bd-clickhouse clickhouse-client --user analytics --password analytics_pass"
echo ""
echo "  HTTP API (проверить что работает):"
echo "    curl 'http://localhost:8123/?user=analytics&password=analytics_pass' --data 'SELECT count() FROM news_analytics.events'"
echo ""
echo "  Веб-интерфейс Kafka UI (уже был):"
echo "    http://localhost:8080"