-- 5. РЕАЛИЗАЦИЯ ЗАПРОСОВ ДЛЯ РАЗРАБОТАННЫХ КЕЙСОВ (ИСПРАВЛЕННАЯ ВЕРСИЯ)

-- КЕЙС 1: АНАЛИТИКА НОВОСТЕЙ ПО ПЕРИОДАМ И КАТЕГОРИЯМ

-- 1.1. Еженедельная статистика новостей по категориям
SELECT 
    DATE_TRUNC('week', publish_date) as week_start,
    c.name as category_name,
    COUNT(*) as news_count,
    SUM(views_count) as total_views,
    AVG(views_count) as avg_views,
    SUM(likes_count) as total_likes,
    SUM(shares_count) as total_shares
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE publish_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY week_start, c.name
ORDER BY week_start DESC, total_views DESC;

-- 1.2. Топ-10 самых популярных новостей за месяц
SELECT 
    n.title,
    c.name as category,
    s.name as source,
    n.publish_date,
    n.views_count,
    n.likes_count,
    n.shares_count,
    ROUND(n.likes_count::decimal / NULLIF(n.views_count, 0) * 100, 2) as engagement_rate
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN sources s ON n.source_id = s.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '1 month'
  AND n.views_count > 1000
ORDER BY n.views_count DESC
LIMIT 10;

-- 1.3. Динамика публикаций по часам
SELECT 
    EXTRACT(HOUR FROM publish_date) as hour_of_day,
    COUNT(*) as news_count,
    ROUND(AVG(views_count), 1) as avg_views,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM news WHERE publish_date >= CURRENT_DATE - INTERVAL '6 months'), 2) as percent_of_total
FROM news
WHERE publish_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY hour_of_day
ORDER BY news_count DESC;

-- КЕЙС 2: АНАЛИЗ ИСТОЧНИКОВ И АВТОРОВ

-- 2.1. Рейтинг источников по engagement
SELECT 
    s.name as source_name,
    s.country,
    COUNT(*) as total_news,
    SUM(n.views_count) as total_views,
    SUM(n.likes_count) as total_likes,
    ROUND(AVG(n.views_count), 1) as avg_views_per_news,
    ROUND(SUM(n.likes_count)::decimal / NULLIF(SUM(n.views_count), 0) * 100, 3) as overall_engagement_rate
FROM news n
JOIN sources s ON n.source_id = s.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY s.id, s.name, s.country
HAVING COUNT(*) >= 10
ORDER BY overall_engagement_rate DESC
LIMIT 15;

-- 2.2. Статистика авторов
SELECT 
    a.first_name || ' ' || a.last_name as author_name,
    COUNT(*) as articles_written,
    COUNT(DISTINCT n.category_id) as categories_covered,
    SUM(n.views_count) as total_views,
    ROUND(AVG(n.views_count), 1) as avg_views_per_article,
    MAX(n.views_count) as max_views_article
FROM news n
JOIN authors a ON n.author_id = a.id
GROUP BY a.id, author_name
HAVING COUNT(*) >= 5
ORDER BY total_views DESC;

-- КЕЙС 3: ТРЕНДЫ И ПРЕДСКАЗАНИЯ

-- 3.1. Выявление растущих трендов по категориям
WITH monthly_stats AS (
    SELECT 
        DATE_TRUNC('month', publish_date) as month,
        c.name as category,
        COUNT(*) as news_count,
        SUM(views_count) as total_views,
        AVG(views_count) as avg_views
    FROM news n
    JOIN categories c ON n.category_id = c.id
    WHERE publish_date >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY month, c.name
),
category_growth AS (
    SELECT 
        category,
        month,
        news_count,
        total_views,
        LAG(news_count) OVER (PARTITION BY category ORDER BY month) as prev_news_count,
        LAG(total_views) OVER (PARTITION BY category ORDER BY month) as prev_total_views
    FROM monthly_stats
)
SELECT 
    category,
    TO_CHAR(month, 'YYYY-MM') as month,
    news_count,
    total_views,
    CASE 
        WHEN prev_news_count IS NOT NULL THEN
            ROUND((news_count - prev_news_count) * 100.0 / prev_news_count, 1)
        ELSE NULL
    END as news_growth_percent,
    CASE 
        WHEN prev_total_views IS NOT NULL THEN
            ROUND((total_views - prev_total_views) * 100.0 / prev_total_views, 1)
        ELSE NULL
    END as views_growth_percent
FROM category_growth
ORDER BY month DESC, views_growth_percent DESC NULLS LAST;

-- КЕЙС 4: ОПЕРАТИВНЫЙ МОНИТОРИНГ

-- 4.1. Активность за последние 24 часа
SELECT 
    c.name as category,
    COUNT(*) as news_last_24h,
    SUM(views_count) as total_views,
    SUM(likes_count) as total_likes,
    ROUND(AVG(views_count), 1) as avg_views,
    MAX(views_count) as max_views
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE publish_date >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
  AND is_active = true
GROUP BY c.name
ORDER BY news_last_24h DESC;

-- 4.2. Мониторинг производительности источников
SELECT 
    s.name as source,
    COUNT(*) as weekly_articles,
    SUM(n.views_count) as weekly_views,
    ROUND(AVG(n.views_count), 1) as avg_views_per_article,
    ROUND(SUM(n.likes_count)::decimal / NULLIF(SUM(n.views_count), 0) * 100, 3) as engagement_rate,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM news WHERE publish_date >= CURRENT_DATE - INTERVAL '7 days'), 2) as market_share_percent
FROM news n
JOIN sources s ON n.source_id = s.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY s.id, s.name
ORDER BY weekly_views DESC;

-- КЕЙС 5: ОТЧЕТЫ ДЛЯ РУКОВОДСТВА (ИСПРАВЛЕННЫЕ)

-- 5.1. Сводный отчет за последний месяц
SELECT 
    'Общая статистика за месяц' as metric,
    COUNT(*)::text as value
FROM news 
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 month'

UNION ALL

SELECT 
    'Всего просмотров',
    SUM(views_count)::text
FROM news 
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 month'

UNION ALL

SELECT 
    'Всего лайков', 
    SUM(likes_count)::text
FROM news 
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 month'

UNION ALL

SELECT 
    'Всего репостов',
    SUM(shares_count)::text
FROM news 
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 month'

UNION ALL

SELECT 
    'Среднее время публикации (час дня)',
    ROUND(AVG(EXTRACT(HOUR FROM publish_date)), 1)::text
FROM news 
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 month'

UNION ALL

SELECT 
    'Engagement Rate (%)',
    ROUND(SUM(likes_count) * 100.0 / NULLIF(SUM(views_count), 0), 2)::text
FROM news 
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 month'

UNION ALL

SELECT 
    'Самая популярная категория',
    (SELECT c.name FROM news n 
     JOIN categories c ON n.category_id = c.id 
     WHERE n.publish_date >= CURRENT_DATE - INTERVAL '1 month'
     GROUP BY c.name 
     ORDER BY SUM(n.views_count) DESC 
     LIMIT 1)
     
UNION ALL

SELECT 
    'Самый активный источник',
    (SELECT s.name FROM news n 
     JOIN sources s ON n.source_id = s.id 
     WHERE n.publish_date >= CURRENT_DATE - INTERVAL '1 month'
     GROUP BY s.name 
     ORDER BY COUNT(*) DESC 
     LIMIT 1);

-- 5.2. KPI по категориям для дашборда
SELECT 
    c.name as category,
    COUNT(*) as total_articles,
    SUM(n.views_count) as total_views,
    SUM(n.likes_count) as total_likes,
    SUM(n.shares_count) as total_shares,
    ROUND(AVG(n.views_count), 1) as avg_views_per_article,
    ROUND(SUM(n.views_count) * 100.0 / (SELECT SUM(views_count) FROM news WHERE publish_date >= CURRENT_DATE - INTERVAL '3 months'), 1) as views_market_share,
    ROUND(SUM(n.likes_count)::decimal / NULLIF(SUM(n.views_count), 0) * 100, 2) as engagement_rate
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY c.id, c.name
ORDER BY total_views DESC;

-- 5.3. JSON отчет для API (альтернатива)
SELECT 
    json_build_object(
        'period', 'last_month',
        'total_articles', COUNT(*),
        'total_views', SUM(views_count),
        'total_likes', SUM(likes_count), 
        'total_shares', SUM(shares_count),
        'avg_publish_hour', ROUND(AVG(EXTRACT(HOUR FROM publish_date)), 1),
        'engagement_rate', ROUND(SUM(likes_count) * 100.0 / NULLIF(SUM(views_count), 0), 2)
    ) as dashboard_data
FROM news 
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 month';