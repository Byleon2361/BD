-- business_queries.sql
-- Бизнес-запросы для анализа новостного агрегатора

-- 1. Топ-10 самых популярных новостей
SELECT 
    title,
    views_count,
    likes_count,
    publish_date,
    (SELECT name FROM categories WHERE id = news.category_id) as category_name
FROM news
WHERE is_active = TRUE
ORDER BY views_count DESC
LIMIT 10;

-- 2. Статистика по авторам
SELECT 
    a.first_name || ' ' || a.last_name as author_name,
    COUNT(n.id) as articles_count,
    SUM(n.views_count) as total_views,
    ROUND(AVG(n.views_count), 2) as avg_views,
    SUM(n.likes_count) as total_likes
FROM authors a
JOIN news n ON a.id = n.author_id
GROUP BY a.id, author_name
HAVING COUNT(n.id) > 0
ORDER BY total_views DESC
LIMIT 15;

-- 3. Активность по категориям за последний месяц
SELECT 
    c.name as category_name,
    COUNT(n.id) as articles_count,
    SUM(n.views_count) as total_views,
    ROUND(AVG(n.views_count), 2) as avg_views
FROM categories c
LEFT JOIN news n ON c.id = n.category_id 
    AND n.publish_date >= CURRENT_DATE - INTERVAL '1 month'
GROUP BY c.id, c.name
ORDER BY articles_count DESC;

-- 4. Еженедельная статистика публикаций
SELECT 
    EXTRACT(YEAR FROM publish_date) as year,
    EXTRACT(WEEK FROM publish_date) as week,
    COUNT(*) as articles_count,
    SUM(views_count) as weekly_views,
    ROUND(AVG(views_count), 2) as avg_views_per_article
FROM news
WHERE publish_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY year, week
ORDER BY year DESC, week DESC;

-- 5. Эффективность источников новостей
SELECT 
    s.name as source_name,
    s.country,
    COUNT(n.id) as articles_count,
    SUM(n.views_count) as total_views,
    ROUND(AVG(n.views_count), 2) as avg_views,
    ROUND(SUM(n.likes_count) * 100.0 / NULLIF(SUM(n.views_count), 0), 2) as engagement_rate
FROM sources s
JOIN news n ON s.id = n.source_id
GROUP BY s.id, s.name, s.country
HAVING COUNT(n.id) > 10
ORDER BY avg_views DESC;