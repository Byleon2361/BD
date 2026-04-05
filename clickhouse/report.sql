-- ============================================================
-- 04_report.sql — Аналитический мини-отчёт
-- ============================================================
-- Запускать после загрузки данных (02_generate_data.py)
-- Демонстрирует: ключевые метрики, выводы, сравнение сырых
-- запросов и запросов через витрину
-- ============================================================

USE news_analytics;

-- ────────────────────────────────────────────────────────────
-- МЕТРИКА 1: Общий обзор — сколько данных собрано
-- ────────────────────────────────────────────────────────────
SELECT
    '📊 Общий обзор'                            AS section,
    count()                                     AS total_events,
    uniq(user_id)                               AS unique_users,
    uniq(article_id)                            AS unique_articles,
    min(event_time)                             AS data_from,
    max(event_time)                             AS data_to,
    dateDiff('day', min(event_time), max(event_time)) AS days_covered
FROM events;

-- ────────────────────────────────────────────────────────────
-- МЕТРИКА 2: Конверсия поиска → клик (CTR поиска)
-- Вывод: если CTR < 50% — нужно улучшать поисковую выдачу
-- ────────────────────────────────────────────────────────────
SELECT
    '🔍 Поисковый CTR'                          AS section,
    count()                                     AS total_searches,
    countIf(clicked_result > 0)                 AS searches_with_click,
    round(
        countIf(clicked_result > 0) / count() * 100
    , 1)                                        AS ctr_pct,
    round(avg(results_count), 1)                AS avg_results,
    countIf(results_count = 0)                  AS empty_results
FROM events
WHERE event_type = 'search_query';

-- ────────────────────────────────────────────────────────────
-- МЕТРИКА 3: Глубина чтения по устройствам
-- Вывод: мобильные читают меньше — нужна адаптация контента
-- ────────────────────────────────────────────────────────────
SELECT
    '📱 Глубина чтения'                         AS section,
    device_type,
    count()                                     AS views,
    round(avg(read_time_sec), 0)                AS avg_sec,
    round(avg(scroll_depth), 1)                 AS avg_scroll_pct,
    countIf(scroll_depth >= 80)                 AS full_reads,
    round(countIf(scroll_depth>=80)/count()*100, 1) AS full_read_pct
FROM events
WHERE event_type = 'article_view'
  AND device_type != ''
GROUP BY device_type
ORDER BY avg_sec DESC;

-- ────────────────────────────────────────────────────────────
-- МЕТРИКА 4: Ценность подписки
-- Вывод: подписчики читают дольше — это подтверждает ROI подписки
-- ────────────────────────────────────────────────────────────
SELECT
    '💎 Подписчики vs обычные'                  AS section,
    if(is_subscriber=1, 'subscriber', 'free')   AS user_type,
    count()                                     AS views,
    round(avg(read_time_sec), 0)                AS avg_read_sec,
    round(avg(scroll_depth), 1)                 AS avg_scroll_pct,
    uniq(user_id)                               AS unique_users
FROM events
WHERE event_type = 'article_view'
GROUP BY user_type
ORDER BY avg_read_sec DESC;

-- ────────────────────────────────────────────────────────────
-- МЕТРИКА 5: Пиковые часы трафика (топ-5)
-- Вывод: основные пики — вечер 19-22ч, публикуй статьи в 18ч
-- ────────────────────────────────────────────────────────────
SELECT
    '⏰ Пиковые часы'                           AS section,
    toHour(event_time)                          AS hour,
    count()                                     AS events,
    bar(count(), 0, 15000, 20)                  AS visual
FROM events
GROUP BY hour
ORDER BY events DESC
LIMIT 5;


-- ════════════════════════════════════════════════════════════
-- СРАВНЕНИЕ: СЫРОЙ ЗАПРОС vs ВИТРИНА
-- ════════════════════════════════════════════════════════════

-- ── Способ 1: Сырой запрос ──────────────────────────────────
-- Читает всю таблицу events, фильтрует, агрегирует на лету
-- Время: ~2-5 сек на 150k записей, на миллионах — намного дольше

SELECT '=== СЫРОЙ ЗАПРОС ===' AS info;

SELECT
    article_id,
    count()                                     AS views,
    uniq(user_id)                               AS unique_readers,
    round(avg(read_time_sec), 1)                AS avg_read_sec,
    countIf(is_subscriber=1)                    AS subscriber_views
FROM events
WHERE event_type = 'article_view'
  AND event_date >= today() - 7
GROUP BY article_id
ORDER BY views DESC
LIMIT 5;

-- ── Способ 2: Через витрину ─────────────────────────────────
-- Читает только агрегированную таблицу mv_article_daily_stats
-- Данные уже свёрнуты — читается в 10-50x меньше строк
-- Время: <100мс даже на миллиардах событий

SELECT '=== ЧЕРЕЗ ВИТРИНУ ===' AS info;

SELECT
    article_id,
    sum(total_views)                            AS views,
    uniqMerge(unique_users)                     AS unique_readers,
    round(avgMerge(avg_read_sec), 1)            AS avg_read_sec,
    sum(subscriber_views)                       AS subscriber_views
FROM mv_article_daily_stats
WHERE event_date >= today() - 7
GROUP BY article_id
ORDER BY views DESC
LIMIT 5;

-- ── Сравнение плана выполнения ──────────────────────────────
-- Запусти чтобы увидеть разницу в объёме прочитанных данных:

-- EXPLAIN SELECT count() FROM events WHERE event_type='article_view' AND event_date >= today()-7;
-- EXPLAIN SELECT sum(total_views) FROM mv_article_daily_stats WHERE event_date >= today()-7;