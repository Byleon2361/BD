-- АГРЕГИРУЮЩИЕ ЗАПРОСЫ (5 штук)

-- 1. Количество новостей по категориям
SELECT c.name as category, COUNT(n.id) as news_count,
       AVG(n.views_count) as avg_views,
       MAX(n.views_count) as max_views
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.is_active = TRUE
GROUP BY c.id, c.name
ORDER BY news_count DESC;

-- 2. Статистика по авторам
SELECT a.first_name, a.last_name,
       COUNT(n.id) as articles_count,
       SUM(n.views_count) as total_views,
       AVG(n.views_count) as avg_views_per_article,
       SUM(n.likes_count) as total_likes
FROM authors a
JOIN news n ON a.id = n.author_id
GROUP BY a.id, a.first_name, a.last_name
HAVING COUNT(n.id) > 10
ORDER BY total_views DESC;

-- 3. Активность по месяцам
SELECT EXTRACT(YEAR FROM publish_date) as year, 
       EXTRACT(MONTH FROM publish_date) as month,
       COUNT(*) as articles_count,
       SUM(views_count) as total_views,
       AVG(views_count) as avg_views
FROM news
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY EXTRACT(YEAR FROM publish_date), EXTRACT(MONTH FROM publish_date)
ORDER BY year DESC, month DESC;

-- 4. Популярность тегов
SELECT t.name as tag_name,
       COUNT(nt.news_id) as usage_count,
       AVG(n.views_count) as avg_views
FROM tags t
JOIN news_tags nt ON t.id = nt.tag_id
JOIN news n ON nt.news_id = n.id
GROUP BY t.id, t.name
ORDER BY usage_count DESC;

-- 5. Эффективность источников
SELECT s.name as source,
       COUNT(n.id) as articles_count,
       SUM(n.views_count) as total_views,
       AVG(n.views_count) as avg_views,
       SUM(n.likes_count) as total_likes
FROM sources s
JOIN news n ON s.id = n.source_id
GROUP BY s.id, s.name
ORDER BY avg_views DESC;