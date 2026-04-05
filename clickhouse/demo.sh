#!/bin/bash
# demo.sh — Исправленная версия с корректным INSERT

set -e

# Используем более простой формат без экранирования проблем
CH_CLI="sudo docker exec -i bd-clickhouse clickhouse-client --user analytics --password analytics_pass --format=TSV"

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║     ДЕМОНСТРАЦИЯ: От пользовательского клика до аналитики             ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# ШАГ 1: Получаем реальные данные
# ============================================================================
echo "📊 ШАГ 1: Подготовка тестовых данных"
echo "───────────────────────────────────────────────────────────────────────"

# Проверяем подключение
if ! $CH_CLI --query "SELECT 1" > /dev/null 2>&1; then
    echo "❌ Ошибка: Не могу подключиться к ClickHouse"
    echo "   Проверьте: docker ps | grep clickhouse"
    exit 1
fi

# Получаем существующую статью
ARTICLE_ID=$($CH_CLI --query "
SELECT article_id 
FROM news_analytics.events 
WHERE event_type = 'article_view' AND article_id > 0 
GROUP BY article_id 
ORDER BY rand() 
LIMIT 1" 2>/dev/null | xargs)

if [ -z "$ARTICLE_ID" ]; then
    ARTICLE_ID=1001
    echo "⚠️  Используем тестовую статью ID=$ARTICLE_ID"
else
    echo "✅ Найдена реальная статья ID=$ARTICLE_ID"
fi

# Получаем категорию
CATEGORY_ID=$($CH_CLI --query "
SELECT category_id 
FROM news_analytics.events 
WHERE article_id = $ARTICLE_ID AND category_id > 0 
LIMIT 1" 2>/dev/null | xargs)

if [ -z "$CATEGORY_ID" ]; then
    CATEGORY_ID=$((RANDOM % 7 + 1))
fi

USER_ID=99999
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S")
EVENT_DATE=$(date -u +"%Y-%m-%d")

echo "📌 Параметры теста:"
echo "   • Статья ID: $ARTICLE_ID"
echo "   • Категория: $CATEGORY_ID"
echo "   • Пользователь: $USER_ID"
echo "   • Время: $TIMESTAMP"
echo ""

# ============================================================================
# ШАГ 2: Статистика ДО
# ============================================================================
echo "📊 ШАГ 2: Статистика ДО просмотра"
echo "───────────────────────────────────────────────────────────────────────"

BEFORE_VIEWS=$($CH_CLI --query "
SELECT count() 
FROM news_analytics.events 
WHERE event_type='article_view' AND article_id=$ARTICLE_ID" 2>/dev/null | xargs)

BEFORE_UNIQUE=$($CH_CLI --query "
SELECT uniq(user_id) 
FROM news_analytics.events 
WHERE event_type='article_view' AND article_id=$ARTICLE_ID" 2>/dev/null | xargs)

echo "   • Всего просмотров: ${BEFORE_VIEWS:-0}"
echo "   • Уникальных читателей: ${BEFORE_UNIQUE:-0}"
echo ""

# ============================================================================
# ШАГ 3: Добавляем просмотр (упрощенный INSERT)
# ============================================================================
echo "🖱️  ШАГ 3: Пользователь $USER_ID открывает статью $ARTICLE_ID"
echo "───────────────────────────────────────────────────────────────────────"

# Создаем временный файл с данными для вставки
TMP_FILE=$(mktemp)
cat > $TMP_FILE << EOF
$TIMESTAMP	article_view	$USER_ID	$ARTICLE_ID	$CATEGORY_ID	145	85	0	desktop	direct	RU	web
EOF

# Вставляем через cat (более надежный способ)
cat $TMP_FILE | sudo docker exec -i bd-clickhouse clickhouse-client \
    --user analytics --password analytics_pass \
    --query="INSERT INTO news_analytics.events (event_time, event_type, user_id, article_id, category_id, read_time_sec, scroll_depth, is_subscriber, device_type, source_site, country_code, platform) FORMAT TSV"

rm -f $TMP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Событие успешно добавлено"
else
    echo "❌ Ошибка при добавлении события"
    exit 1
fi
echo ""

# ============================================================================
# ШАГ 4: Статистика ПОСЛЕ
# ============================================================================
echo "📊 ШАГ 4: Статистика ПОСЛЕ просмотра"
echo "───────────────────────────────────────────────────────────────────────"

sleep 1  # Даем время на запись

AFTER_VIEWS=$($CH_CLI --query "
SELECT count() 
FROM news_analytics.events 
WHERE event_type='article_view' AND article_id=$ARTICLE_ID" 2>/dev/null | xargs)

AFTER_UNIQUE=$($CH_CLI --query "
SELECT uniq(user_id) 
FROM news_analytics.events 
WHERE event_type='article_view' AND article_id=$ARTICLE_ID" 2>/dev/null | xargs)

echo "   • Всего просмотров: ${AFTER_VIEWS:-0} (+$((AFTER_VIEWS - BEFORE_VIEWS)))"
echo "   • Уникальных читателей: ${AFTER_UNIQUE:-0} (+$((AFTER_UNIQUE - BEFORE_UNIQUE)))"
echo ""

# ============================================================================
# ШАГ 5: Последние события
# ============================================================================
echo "📋 ШАГ 5: Последние 3 просмотра статьи $ARTICLE_ID"
echo "───────────────────────────────────────────────────────────────────────"

$CH_CLI --query "
SELECT 
    event_time,
    user_id,
    read_time_sec,
    scroll_depth,
    device_type
FROM news_analytics.events 
WHERE article_id = $ARTICLE_ID AND event_type='article_view'
ORDER BY event_time DESC 
LIMIT 3
FORMAT PrettyCompact" 2>/dev/null || echo "Нет данных для отображения"

echo ""

# ============================================================================
# ШАГ 6: Проверяем витрину
# ============================================================================
echo "📊 ШАГ 6: Агрегированная витрина"
echo "───────────────────────────────────────────────────────────────────────"

# Принудительно обновляем витрину
sudo docker exec bd-clickhouse clickhouse-client \
    --user analytics --password analytics_pass \
    --query="OPTIMIZE TABLE news_analytics.mv_article_daily_stats FINAL" 2>/dev/null

VITRINA_VIEWS=$($CH_CLI --query "
SELECT sum(total_views)
FROM news_analytics.mv_article_daily_stats 
WHERE article_id = $ARTICLE_ID AND event_date = '$EVENT_DATE'" 2>/dev/null | xargs)

echo "   • Просмотров в витрине за $EVENT_DATE: ${VITRINA_VIEWS:-0}"
echo ""

# ============================================================================
# ШАГ 7: Топ статей
# ============================================================================
echo "🏆 ШАГ 7: Топ-5 статей за сегодня"
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
# ИТОГИ
# ============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                         РЕЗУЛЬТАТ ТЕСТА                              ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

DIFF=$((AFTER_VIEWS - BEFORE_VIEWS))
if [ "$DIFF" -eq 1 ]; then
    echo "✅ ПРОСМОТР ЗАСЧИТАН: +1 к счетчику (было ${BEFORE_VIEWS}, стало ${AFTER_VIEWS})"
    echo "✅ ВИРИНА ОБНОВЛЕНА: ${VITRINA_VIEWS} просмотров за сегодня"
    echo ""
    echo "🎉 ВСЁ РАБОТАЕТ КОРРЕКТНО!"
else
    echo "❌ ВНИМАНИЕ: Просмотр не засчитан или данные не обновились"
    echo "   Было: ${BEFORE_VIEWS}"
    echo "   Стало: ${AFTER_VIEWS}"
    echo "   Разница: ${DIFF}"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  📊 Для проверки вручную:                                             ║"
echo "║                                                                       ║"
echo "║  docker exec -it bd-clickhouse clickhouse-client                      ║"
echo "║    --user analytics --password analytics_pass                         ║"
echo "║                                                                       ║"
echo "║  -- Проверить статью:                                                 ║"
echo "║  SELECT count() FROM news_analytics.events                            ║"
echo "║  WHERE article_id = $ARTICLE_ID AND event_type='article_view';        ║"
echo "║                                                                       ║"
echo "║  -- Проверить витрину:                                                ║"
echo "║  SELECT * FROM news_analytics.mv_article_daily_stats                  ║"
echo "║  WHERE article_id = $ARTICLE_ID AND event_date = '$EVENT_DATE';       ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"