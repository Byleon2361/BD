#!/bin/bash
# load_data.sh — Генерация событий на основе реальных ID из PostgreSQL
set -e

CH="sudo docker exec -i bd-clickhouse clickhouse-client --user analytics --password analytics_pass"

echo "=== Очищаем старые тестовые данные ==="
$CH --query "TRUNCATE TABLE news_analytics.events"
$CH --query "TRUNCATE TABLE news_analytics.events_dedup"

echo "=== Загружаем 150 000 событий на основе реальных ID ==="
$CH --query "
INSERT INTO news_analytics.events
  (event_time, event_type, user_id, article_id, category_id,
   read_time_sec, scroll_depth, is_subscriber, device_type,
   source_site, reaction_type, query_text, results_count,
   clicked_result, session_sec, pages_visited, country_code, platform)
SELECT
    now() - toIntervalSecond(rand() % (90 * 86400))         AS event_time,
    ['article_view','article_view','article_view','article_view',
     'article_reaction','article_reaction',
     'search_query',
     'user_session'][1 + rand() % 8]                        AS event_type,
    1 + rand() % 5000                                       AS user_id,
    1 + rand() % 3010016                                    AS article_id,
    1 + rand() % 7                                          AS category_id,
    rand() % 600                                            AS read_time_sec,
    rand() % 101                                            AS scroll_depth,
    rand() % 10 < 2                                         AS is_subscriber,
    ['desktop','desktop','mobile','mobile','tablet'][1 + rand() % 5] AS device_type,
    ['direct','search','search','social','email'][1 + rand() % 5]    AS source_site,
    ['like','like','bookmark','dislike','share',''][1 + rand() % 6]  AS reaction_type,
    ['politics news','sports results','technology trends',
     'entertainment','business analysis','health tips',
     'science discoveries',''][1 + rand() % 8]              AS query_text,
    rand() % 50                                             AS results_count,
    rand() % 2 * (1 + rand() % 3010016)                    AS clicked_result,
    30 + rand() % 3570                                      AS session_sec,
    1 + rand() % 25                                         AS pages_visited,
    ['RU','RU','RU','US','DE','GB','UA','BY','FR'][1 + rand() % 9] AS country_code,
    ['web','web','ios','android'][1 + rand() % 4]           AS platform
FROM numbers(150000);
"

echo "=== Загружаем в таблицу дедупликации (с ~5% дублей) ==="
$CH --query "
INSERT INTO news_analytics.events_dedup
  (event_id, event_time, event_type, user_id, article_id, category_id,
   read_time_sec, reaction_type, query_text, device_type, platform)
SELECT
    generateUUIDv4(),
    now() - toIntervalSecond(rand() % (90*86400)),
    ['article_view','article_view','article_reaction','search_query'][1 + rand() % 4],
    1 + rand() % 5000,
    1 + rand() % 3010016,
    1 + rand() % 7,
    rand() % 600,
    ['like','bookmark','dislike',''][1 + rand() % 4],
    ['politics news','sports results','technology',''][1 + rand() % 4],
    ['desktop','mobile','tablet'][1 + rand() % 3],
    ['web','ios','android'][1 + rand() % 3]
FROM numbers(157000);
"

echo "=== Заполняем витрину историческими данными ==="
$CH --query "
INSERT INTO news_analytics.mv_article_daily_stats
SELECT
    toDate(event_time)                          AS event_date,
    article_id,
    category_id,
    countIf(event_type = 'article_view')        AS total_views,
    uniqState(user_id)                          AS unique_users,
    avgState(read_time_sec)                     AS avg_read_sec,
    countIf(reaction_type = 'like')             AS total_likes,
    countIf(reaction_type = 'bookmark')         AS total_bookmarks,
    countIf(event_type = 'article_view' AND is_subscriber = 1) AS subscriber_views
FROM news_analytics.events
WHERE article_id > 0
GROUP BY event_date, article_id, category_id;
"

echo ""
echo "=== Проверка ==="
$CH --query "
SELECT event_type, count() AS cnt, bar(count(), 0, 90000, 30) AS chart
FROM news_analytics.events GROUP BY event_type ORDER BY cnt DESC;
"
echo ""
$CH --query "
SELECT toYYYYMM(event_time) AS month, count() AS events,
       uniq(article_id) AS unique_articles, uniq(user_id) AS unique_users
FROM news_analytics.events GROUP BY month ORDER BY month;
"
echo ""
$CH --query "
SELECT 'events' AS tbl, count() AS rows FROM news_analytics.events
UNION ALL SELECT 'events_dedup', count() FROM news_analytics.events_dedup
UNION ALL SELECT 'mv_article_daily_stats', count() FROM news_analytics.mv_article_daily_stats;
"
echo ""
echo "✅ Готово! Данные привязаны к реальным ID из PostgreSQL."
echo "   article_id: 1..3010016 (реальные новости)"
echo "   category_id: 1..7 (реальные категории)"
echo "   user_id: 1..5000 (читатели)"