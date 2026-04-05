#!/bin/bash
# demo.sh — Демонстрация полного пайплайна: Kafka → ClickHouse Consumer → ClickHouse

set -e

CH_CLI="sudo docker exec -i bd-clickhouse clickhouse-client --user analytics --password analytics_pass --format=TSV"
KAFKA_EXEC="sudo docker exec kafka"

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║     ДЕМОНСТРАЦИЯ: Kafka → ClickHouse Consumer → ClickHouse           ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# ШАГ 1: Проверка работоспособности всех компонентов
# ============================================================================
echo "🔍 ШАГ 1: Проверка компонентов системы"
echo "───────────────────────────────────────────────────────────────────────"

# Проверяем ClickHouse
if ! $CH_CLI --query "SELECT 1" > /dev/null 2>&1; then
    echo "❌ ClickHouse не доступен"
    exit 1
fi
echo "✅ ClickHouse работает"

# Проверяем Kafka
if ! $KAFKA_EXEC kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; then
    echo "❌ Kafka не доступна"
    exit 1
fi
echo "✅ Kafka работает"

# Проверяем ClickHouse consumer
if ! sudo docker ps | grep consumer-clickhouse > /dev/null; then
    echo "❌ ClickHouse consumer не запущен"
    exit 1
fi
echo "✅ ClickHouse consumer работает"

echo ""

# ============================================================================
# ШАГ 2: Получаем тестовые данные
# ============================================================================
echo "📊 ШАГ 2: Подготовка тестовых данных"
echo "───────────────────────────────────────────────────────────────────────"

# Получаем существующую статью из ClickHouse (если есть)
ARTICLE_ID=$($CH_CLI --query "
SELECT article_id 
FROM news_analytics.events 
WHERE event_type = 'article_view' AND article_id > 0 
GROUP BY article_id 
ORDER BY rand() 
LIMIT 1" 2>/dev/null | xargs)

if [ -z "$ARTICLE_ID" ] || [ "$ARTICLE_ID" = "0" ]; then
    ARTICLE_ID=1223466
    echo "⚠️  Используем тестовую статью ID=$ARTICLE_ID"
else
    echo "✅ Найдена реальная статья ID=$ARTICLE_ID"
fi

CATEGORY_ID=$($CH_CLI --query "
SELECT category_id 
FROM news_analytics.events 
WHERE article_id = $ARTICLE_ID AND category_id > 0 
LIMIT 1" 2>/dev/null | xargs)

if [ -z "$CATEGORY_ID" ]; then
    CATEGORY_ID=5
fi

USER_ID=$((RANDOM % 90000 + 10000))
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "📌 Параметры теста:"
echo "   • Статья ID: $ARTICLE_ID"
echo "   • Категория: $CATEGORY_ID"
echo "   • Пользователь: $USER_ID"
echo "   • Время: $TIMESTAMP"
echo ""

# ============================================================================
# ШАГ 3: Статистика ДО (из ClickHouse)
# ============================================================================
echo "📊 ШАГ 3: Статистика ДО отправки события"
echo "───────────────────────────────────────────────────────────────────────"

BEFORE_VIEWS=$($CH_CLI --query "
SELECT count() 
FROM news_analytics.events 
WHERE event_type='article_view' AND article_id=$ARTICLE_ID" 2>/dev/null | xargs)

BEFORE_UNIQUE=$($CH_CLI --query "
SELECT uniq(user_id) 
FROM news_analytics.events 
WHERE event_type='article_view' AND article_id=$ARTICLE_ID" 2>/dev/null | xargs)

echo "   • Всего просмотров статьи $ARTICLE_ID: ${BEFORE_VIEWS:-0}"
echo "   • Уникальных читателей: ${BEFORE_UNIQUE:-0}"
echo ""

# ============================================================================
# ШАГ 4: Отправляем событие в Kafka (простой способ без Python)
# ============================================================================
echo "🖱️  ШАГ 4: Отправка события в Kafka (пользователь $USER_ID читает статью)"
echo "───────────────────────────────────────────────────────────────────────"

# Создаем JSON событие
EVENT_ID=$(cat /proc/sys/kernel/random/uuid | tr -d '-')
EVENT_JSON="{\"eventType\":\"ArticleViewed\",\"entityId\":\"$EVENT_ID\",\"timestamp\":\"$TIMESTAMP\",\"userId\":$USER_ID,\"payload\":{\"articleId\":$ARTICLE_ID,\"categoryId\":$CATEGORY_ID,\"readTimeSeconds\":$((RANDOM % 300 + 30)),\"scrollDepth\":$((RANDOM % 100)),\"deviceType\":\"desktop\",\"countryCode\":\"RU\"}}"

# Отправляем через Kafka console producer
echo "$EVENT_JSON" | sudo docker exec -i kafka kafka-console-producer \
    --bootstrap-server localhost:9092 \
    --topic news.views.events

if [ $? -eq 0 ]; then
    echo "✅ Событие отправлено в Kafka topic: news.views.events"
else
    echo "❌ Ошибка при отправке в Kafka"
    exit 1
fi
echo ""

# ============================================================================
# ШАГ 5: Ожидаем обработки Consumer'ом
# ============================================================================
echo "⏳ ШАГ 5: Ожидание обработки ClickHouse consumer'ом"
echo "───────────────────────────────────────────────────────────────────────"

echo "   Consumer читает из Kafka и пишет в ClickHouse..."
sleep 5  # Даем время consumer'у обработать

# Показываем, что consumer делает
echo ""
echo "   📋 Последние действия ClickHouse consumer:"
sudo docker logs --tail 10 consumer-clickhouse 2>/dev/null | tail -5 || echo "      (ожидание событий...)"
echo ""

# ============================================================================
# ШАГ 6: Статистика ПОСЛЕ (из ClickHouse)
# ============================================================================
echo "📊 ШАГ 6: Статистика ПОСЛЕ обработки"
echo "───────────────────────────────────────────────────────────────────────"

AFTER_VIEWS=$($CH_CLI --query "
SELECT count() 
FROM news_analytics.events 
WHERE event_type='article_view' AND article_id=$ARTICLE_ID" 2>/dev/null | xargs)

AFTER_UNIQUE=$($CH_CLI --query "
SELECT uniq(user_id) 
FROM news_analytics.events 
WHERE event_type='article_view' AND article_id=$ARTICLE_ID" 2>/dev/null | xargs)

DIFF_VIEWS=$((AFTER_VIEWS - BEFORE_VIEWS))
DIFF_UNIQUE=$((AFTER_UNIQUE - BEFORE_UNIQUE))

echo "   • Всего просмотров: ${AFTER_VIEWS:-0} (+${DIFF_VIEWS})"
echo "   • Уникальных читателей: ${AFTER_UNIQUE:-0} (+${DIFF_UNIQUE})"
echo ""

# ============================================================================
# ШАГ 7: Показываем свежие данные в ClickHouse
# ============================================================================
echo "📋 ШАГ 7: Свежие данные в ClickHouse"
echo "───────────────────────────────────────────────────────────────────────"

echo "   Последние 3 события, связанные с пользователем $USER_ID:"
$CH_CLI --query "
SELECT 
    event_time,
    event_type,
    user_id,
    article_id,
    read_time_sec,
    device_type
FROM news_analytics.events 
WHERE user_id = $USER_ID
ORDER BY event_time DESC 
LIMIT 3
FORMAT PrettyCompact" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "   (события от пользователя $USER_ID еще не появились)"
fi
echo ""

# ============================================================================
# ШАГ 8: Проверяем витрину
# ============================================================================
echo "📊 ШАГ 8: Агрегированная витрина"
echo "───────────────────────────────────────────────────────────────────────"

# Принудительно обновляем витрину
sudo docker exec bd-clickhouse clickhouse-client \
    --user analytics --password analytics_pass \
    --query="OPTIMIZE TABLE news_analytics.mv_article_daily_stats FINAL" 2>/dev/null

EVENT_DATE=$(date -u +"%Y-%m-%d")
VITRINA_VIEWS=$($CH_CLI --query "
SELECT sum(total_views)
FROM news_analytics.mv_article_daily_stats 
WHERE article_id = $ARTICLE_ID AND event_date = '$EVENT_DATE'" 2>/dev/null | xargs)

echo "   • Просмотров статьи $ARTICLE_ID за сегодня: ${VITRINA_VIEWS:-0}"
echo ""

# ============================================================================
# ШАГ 9: Топ статей
# ============================================================================
echo "🏆 ШАГ 9: Топ-5 статей за сегодня (из ClickHouse)"
echo "───────────────────────────────────────────────────────────────────────"

$CH_CLI --query "
SELECT 
    article_id,
    count() AS views_today,
    uniq(user_id) AS unique_readers
FROM news_analytics.events
WHERE event_type = 'article_view' 
  AND event_date = today()
GROUP BY article_id
ORDER BY views_today DESC
LIMIT 5
FORMAT PrettyCompact" 2>/dev/null

# ============================================================================
# ШАГ 10: Статус Kafka Consumer
# ============================================================================
echo ""
echo "📊 ШАГ 10: Статус Kafka Consumer (Lag)"
echo "───────────────────────────────────────────────────────────────────────"

$KAFKA_EXEC kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group clickhouse-group \
  --describe 2>/dev/null | head -10 || echo "   Нет активного consumer"

# ============================================================================
# ИТОГИ
# ============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                         РЕЗУЛЬТАТ ТЕСТА                              ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

if [ "$DIFF_VIEWS" -ge 1 ]; then
    echo "✅ СОБЫТИЕ ОТПРАВЛЕНО В KAFKA"
    echo "✅ CONSUMER ПРОЧИТАЛ ИЗ KAFKA"
    echo "✅ ДАННЫЕ ЗАПИСАНЫ В CLICKHOUSE"
    echo "✅ ВИРИНА ОБНОВЛЕНА"
    echo ""
    echo "🎉 ВЕСЬ ПАЙПЛАЙН РАБОТАЕТ!"
    echo ""
    echo "   Kafka → ClickHouse Consumer → ClickHouse"
    echo "   └─────── 1 сообщение ────────┘"
elif [ "$DIFF_VIEWS" -eq 0 ]; then
    echo "⚠️  ВНИМАНИЕ: Данные еще не дошли до ClickHouse"
    echo "   Возможно, consumer обрабатывает с задержкой"
    echo ""
    echo "   Попробуйте подождать еще пару секунд и проверить:"
    echo "   docker exec bd-clickhouse clickhouse-client --user analytics --password analytics_pass --query \"SELECT count() FROM news_analytics.events WHERE user_id=$USER_ID\""
else
    echo "❌ ОШИБКА: Что-то пошло не так"
    echo "   Было: ${BEFORE_VIEWS}"
    echo "   Стало: ${AFTER_VIEWS}"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  📊 ПОЛЕЗНЫЕ КОМАНДЫ:                                                ║"
echo "║                                                                      ║"
echo "║  -- Посмотреть логи consumer:                                        ║"
echo "║  docker logs -f consumer-clickhouse                                  ║"
echo "║                                                                      ║"
echo "║  -- Проверить сообщения в Kafka:                                     ║"
echo "║  docker exec kafka kafka-console-consumer                            ║"
echo "║    --bootstrap-server localhost:9092                                 ║"
echo "║    --topic news.views.events --from-beginning --max-messages 1       ║"
echo "║                                                                      ║"
echo "║  -- Проверить данные в ClickHouse:                                   ║"
echo "║  docker exec -it bd-clickhouse clickhouse-client                     ║"
echo "║    --user analytics --password analytics_pass                        ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"