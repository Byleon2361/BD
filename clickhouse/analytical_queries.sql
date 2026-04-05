-- ============================================================
-- 03_analytical_queries.sql — Аналитические запросы (8 штук)
-- ============================================================
-- Все запросы запускаются на таблице news_analytics.events
-- Для ClickHouse: подключение через clickhouse-client или HTTP

USE news_analytics;

-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 1: Топ-10 самых читаемых статей за последние 7 дней
-- Бизнес-задача: выявить вирусный контент для продвижения
-- Техники: фильтрация по времени, агрегация, сортировка, LIMIT
-- ─────────────────────────────────────────────────────────────
SELECT
    article_id,
    count()                                     AS total_views,
    uniq(user_id)                               AS unique_readers,
    round(avg(read_time_sec), 1)                AS avg_read_sec,
    round(avg(scroll_depth), 1)                 AS avg_scroll_pct,
    countIf(is_subscriber = 1)                  AS subscriber_views,
    round(countIf(is_subscriber=1) / count() * 100, 1) AS subscriber_pct
FROM events
WHERE event_type = 'article_view'
  AND event_time >= now() - INTERVAL 7 DAY
GROUP BY article_id
ORDER BY total_views DESC
LIMIT 10;


-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 2: Активность по часам суток (паттерны трафика)
-- Бизнес-задача: определить лучшее время для публикации статей
-- Техники: toHour(), группировка, сортировка по часу
-- ─────────────────────────────────────────────────────────────
SELECT
    toHour(event_time)                          AS hour_of_day,
    count()                                     AS total_events,
    countIf(event_type = 'article_view')        AS views,
    countIf(event_type = 'article_reaction')    AS reactions,
    countIf(event_type = 'search_query')        AS searches,
    uniq(user_id)                               AS unique_users,
    bar(count(), 0, 10000, 30)                  AS chart  -- ASCII-график!
FROM events
WHERE event_time >= now() - INTERVAL 30 DAY
GROUP BY hour_of_day
ORDER BY hour_of_day;


-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 3: Вовлечённость по категориям (реакции / просмотры)
-- Бизнес-задача: какие темы вызывают наибольший отклик у аудитории
-- Техники: JOIN-like через subquery, деление агрегатов, HAVING
-- ─────────────────────────────────────────────────────────────
SELECT
    category_id,
    countIf(event_type = 'article_view')        AS views,
    countIf(event_type = 'article_reaction')    AS reactions,
    countIf(reaction_type = 'like')             AS likes,
    countIf(reaction_type = 'dislike')          AS dislikes,
    countIf(reaction_type = 'bookmark')         AS bookmarks,
    round(
        countIf(event_type='article_reaction')
        / nullIf(countIf(event_type='article_view'), 0) * 100
    , 2)                                        AS engagement_rate_pct
FROM events
WHERE event_time >= now() - INTERVAL 30 DAY
GROUP BY category_id
HAVING views > 100
ORDER BY engagement_rate_pct DESC;


-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 4: Сравнение устройств — поведение пользователей
-- Бизнес-задача: оптимизировать UX под целевую платформу
-- Техники: группировка по двум полям, условные агрегаты
-- ─────────────────────────────────────────────────────────────
SELECT
    device_type,
    platform,
    count()                                     AS total_views,
    uniq(user_id)                               AS unique_users,
    round(avg(read_time_sec), 0)                AS avg_read_sec,
    round(avg(scroll_depth), 1)                 AS avg_scroll_pct,
    round(countIf(scroll_depth >= 80) / count() * 100, 1) AS full_read_pct
FROM events
WHERE event_type = 'article_view'
  AND device_type != ''
GROUP BY device_type, platform
ORDER BY total_views DESC;


-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 5: Поисковые запросы без кликов (нулевая конверсия)
-- Бизнес-задача: найти темы, по которым нет контента — gap analysis
-- Техники: фильтрация по полю=0, группировка, HAVING, сортировка
-- ─────────────────────────────────────────────────────────────
SELECT
    query_text,
    count()                                     AS total_searches,
    countIf(clicked_result = 0)                 AS zero_click_searches,
    round(
        countIf(clicked_result = 0) / count() * 100
    , 1)                                        AS zero_click_rate_pct,
    round(avg(results_count), 1)                AS avg_results_shown
FROM events
WHERE event_type = 'search_query'
  AND query_text != ''
  AND event_time >= now() - INTERVAL 30 DAY
GROUP BY query_text
HAVING total_searches >= 5
ORDER BY zero_click_rate_pct DESC, total_searches DESC
LIMIT 20;


-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 6: Еженедельный DAU/WAU тренд за последние 12 недель
-- Бизнес-задача: отслеживать рост/спад аудитории во времени
-- Техники: toMonday(), uniq(), сравнение week over week
-- ─────────────────────────────────────────────────────────────
SELECT
    toMonday(event_time)                        AS week_start,
    uniq(user_id)                               AS wau,
    count()                                     AS total_events,
    countIf(event_type = 'article_view')        AS weekly_views,
    round(count() / 7.0, 0)                     AS avg_daily_events,
    -- Изменение к прошлой неделе
    round(
        (uniq(user_id) - lagInFrame(uniq(user_id)) OVER (ORDER BY week_start))
        / nullIf(lagInFrame(uniq(user_id)) OVER (ORDER BY week_start), 0) * 100
    , 1)                                        AS wau_change_pct
FROM events
WHERE event_time >= now() - INTERVAL 84 DAY   -- 12 недель
GROUP BY week_start
ORDER BY week_start;


-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 7: Географический анализ — топ стран по вовлечённости
-- Бизнес-задача: приоритизировать локализацию контента
-- Техники: несколько агрегатов, деление, HAVING, ORDER
-- ─────────────────────────────────────────────────────────────
SELECT
    country_code,
    uniq(user_id)                               AS unique_users,
    count()                                     AS total_events,
    countIf(event_type = 'article_view')        AS views,
    countIf(is_subscriber = 1)                  AS subscriber_events,
    round(
        countIf(is_subscriber=1)
        / nullIf(count(), 0) * 100
    , 2)                                        AS subscriber_rate_pct,
    round(avg(read_time_sec), 0)                AS avg_read_sec
FROM events
WHERE event_time >= now() - INTERVAL 30 DAY
  AND country_code != ''
GROUP BY country_code
HAVING unique_users >= 10
ORDER BY unique_users DESC;


-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 8: Когортный анализ — удержание читателей по дням
-- Бизнес-задача: понять, возвращаются ли пользователи на сайт
-- Техники: подзапрос, dateDiff, uniq по условию
-- ─────────────────────────────────────────────────────────────
WITH
    -- Когорта: пользователи, впервые пришедшие в каждый день
    first_visits AS (
        SELECT
            user_id,
            toDate(min(event_time))             AS first_date
        FROM events
        WHERE event_type = 'article_view'
          AND event_time >= now() - INTERVAL 30 DAY
        GROUP BY user_id
    )
SELECT
    fv.first_date                               AS cohort_date,
    dateDiff('day', fv.first_date, toDate(e.event_time)) AS day_number,
    uniq(fv.user_id)                            AS retained_users
FROM events e
JOIN first_visits fv ON e.user_id = fv.user_id
WHERE e.event_type = 'article_view'
  AND dateDiff('day', fv.first_date, toDate(e.event_time)) BETWEEN 0 AND 7
GROUP BY cohort_date, day_number
ORDER BY cohort_date, day_number;


-- ─────────────────────────────────────────────────────────────
-- ЗАПРОС 9 (БОНУС): Сравнение сырого запроса vs витрина
-- Бизнес-задача: статистика статей за вчера — два способа
-- ─────────────────────────────────────────────────────────────

-- Способ 1: СЫРОЙ запрос к основной таблице (медленнее)
SELECT
    article_id,
    count()                 AS views,
    uniq(user_id)           AS unique_readers,
    avg(read_time_sec)      AS avg_read_sec
FROM events
WHERE event_type = 'article_view'
  AND event_date = today() - 1
GROUP BY article_id
ORDER BY views DESC
LIMIT 10;

-- Способ 2: ЧЕРЕЗ ВИТРИНУ (быстрее, данные уже агрегированы)
SELECT
    article_id,
    sum(total_views)                        AS views,
    uniqMerge(unique_users)                 AS unique_readers,
    round(avgMerge(avg_read_sec), 1)        AS avg_read_sec
FROM mv_article_daily_stats
WHERE event_date = today() - 1
GROUP BY article_id
ORDER BY views DESC
LIMIT 10;
-- ^ Этот запрос читает в 10-50x меньше данных с диска,
--   потому что агрегация уже выполнена заранее