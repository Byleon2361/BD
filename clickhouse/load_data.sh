#!/bin/bash
# load_data.sh — Генерация и загрузка 150k записей в ClickHouse
set -e

CH="sudo docker exec -i bd-clickhouse clickhouse-client --user analytics --password analytics_pass"

echo "=== Загружаем 150 000 событий ==="
$CH --query "
INSERT INTO news_analytics.events
  (event_time, event_type, user_id, article_id, category_id,
   read_time_sec, scroll_depth, is_subscriber, device_type,
   source_site, reaction_type, query_text, results_count,
   clicked_result, session_sec, pages_visited, country_code, platform)
SELECT
  now() - toIntervalSecond(rand() % (90*86400))           AS event_time,
  ['article_view','article_view','article_view',
   'article_reaction','article_reaction',
   'search_query','user_session'][1 + rand() % 7]         AS event_type,
  1 + rand() % 2000                                       AS user_id,
  1 + rand() % 500                                        AS article_id,
  1 + rand() % 7                                          AS category_id,
  rand() % 300                                            AS read_time_sec,
  rand() % 101                                            AS scroll_depth,
  rand() % 10 < 2                                         AS is_subscriber,
  ['desktop','mobile','tablet'][1 + rand() % 3]           AS device_type,
  ['direct','search','social','email'][1 + rand() % 4]    AS source_site,
  ['like','dislike','bookmark','share',''][1 + rand() % 5] AS reaction_type,
  ['искусственный интеллект','футбол','технологии',
   'экономика','здоровье','космос',''][1 + rand() % 7]    AS query_text,
  rand() % 50                                             AS results_count,
  rand() % 2 * (1 + rand() % 500)                        AS clicked_result,
  rand() % 3600                                           AS session_sec,
  1 + rand() % 25                                         AS pages_visited,
  ['RU','US','DE','FR','GB','UA','BY'][1 + rand() % 7]    AS country_code,
  ['web','ios','android'][1 + rand() % 3]                 AS platform
FROM numbers(150000);
"

echo "=== Также загружаем в таблицу дедупликации (с ~5% дублей) ==="
$CH --query "
INSERT INTO news_analytics.events_dedup
  (event_id, event_time, event_type, user_id, article_id, category_id,
   read_time_sec, reaction_type, query_text, device_type, platform)
SELECT
  generateUUIDv4(),
  now() - toIntervalSecond(rand() % (90*86400)),
  ['article_view','article_view','article_reaction','search_query'][1 + rand() % 4],
  1 + rand() % 2000,
  1 + rand() % 500,
  1 + rand() % 7,
  rand() % 300,
  ['like','dislike','bookmark',''][1 + rand() % 4],
  ['технологии','спорт','политика',''][1 + rand() % 4],
  ['desktop','mobile','tablet'][1 + rand() % 3],
  ['web','ios','android'][1 + rand() % 3]
FROM numbers(157000);
"

echo ""
echo "=== Проверка ==="
$CH --query "
SELECT
    event_type,
    count()            AS cnt,
    bar(count(), 0, 80000, 30) AS chart
FROM news_analytics.events
GROUP BY event_type
ORDER BY cnt DESC;
"

echo ""
$CH --query "
SELECT
    toYYYYMM(event_time) AS month,
    count()              AS events
FROM news_analytics.events
GROUP BY month
ORDER BY month;
"

echo ""
$CH --query "SELECT 'events total:' AS tbl, count() AS rows FROM news_analytics.events
             UNION ALL
             SELECT 'events_dedup:', count() FROM news_analytics.events_dedup;"

echo ""
echo "✅ Готово!"