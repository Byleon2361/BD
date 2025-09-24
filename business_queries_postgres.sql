-- ============================================
-- BUSINESS QUERIES FOR NEWS DATABASE (PostgreSQL)
-- ============================================

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

-- ОКОННЫЕ ФУНКЦИИ (5 штук)

-- 1. Рейтинг новостей внутри категорий
SELECT n.title, c.name as category, n.views_count,
       RANK() OVER (PARTITION BY n.category_id ORDER BY n.views_count DESC) as rank_in_category,
       DENSE_RANK() OVER (ORDER BY n.views_count DESC) as global_rank
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.is_active = TRUE
ORDER BY c.name, rank_in_category;

-- 2. Сравнение с предыдущей новостью автора
SELECT a.first_name, a.last_name, n.title, n.publish_date, n.views_count,
       LAG(n.views_count) OVER (PARTITION BY n.author_id ORDER BY n.publish_date) as prev_views,
       n.views_count - LAG(n.views_count) OVER (PARTITION BY n.author_id ORDER BY n.publish_date) as views_diff
FROM news n
JOIN authors a ON n.author_id = a.id
ORDER BY a.id, n.publish_date;

-- 3. Накопительный итог просмотров по месяцам
SELECT EXTRACT(YEAR FROM publish_date) as year, 
       EXTRACT(MONTH FROM publish_date) as month,
       SUM(views_count) as monthly_views,
       SUM(SUM(views_count)) OVER (ORDER BY EXTRACT(YEAR FROM publish_date), EXTRACT(MONTH FROM publish_date)) as cumulative_views
FROM news
GROUP BY EXTRACT(YEAR FROM publish_date), EXTRACT(MONTH FROM publish_date)
ORDER BY year, month;

-- 4. Процентное соотношение просмотров от категории
SELECT n.title, c.name as category, n.views_count,
       ROUND(n.views_count * 100.0 / SUM(n.views_count) OVER (PARTITION BY n.category_id), 2) as percent_of_category
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.views_count > 0;

-- 5. Скользящее среднее просмотров за 7 дней
SELECT publish_date, views_count,
       AVG(views_count) OVER (ORDER BY publish_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7d
FROM news
WHERE publish_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY publish_date;

-- ЗАПРОСЫ С ОБЪЕДИНЕНИЕМ ТАБЛИЦ

-- 2 таблицы (2 запроса)
-- 1. Новости с именами категорий
SELECT n.title, n.publish_date, n.views_count, c.name as category
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY n.views_count DESC
LIMIT 20;

-- 2. Авторы и их статистика
SELECT a.first_name, a.last_name, 
       COUNT(n.id) as articles_count,
       AVG(n.views_count) as avg_views
FROM authors a
LEFT JOIN news n ON a.id = n.author_id
GROUP BY a.id, a.first_name, a.last_name
ORDER BY articles_count DESC;

-- 3 таблицы (4 запроса)
-- 1. Новости с категориями и источниками
SELECT n.title, c.name as category, s.name as source, n.publish_date
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN sources s ON n.source_id = s.id
WHERE n.is_active = TRUE
ORDER BY n.publish_date DESC
LIMIT 15;

-- 2. Комментарии с информацией о новостях
SELECT n.title, c.user_name, c.content, c.created_at as comment_date
FROM comments c
JOIN news n ON c.news_id = n.id
WHERE c.is_approved = TRUE
ORDER BY c.created_at DESC
LIMIT 20;

-- 3. Авторы, их новости и категории
SELECT a.first_name, a.last_name, n.title, c.name as category
FROM authors a
JOIN news n ON a.id = n.author_id
JOIN categories c ON n.category_id = c.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '1 month'
ORDER BY n.publish_date DESC;

-- 4. Новости с тегами и категориями
SELECT n.title, c.name as category, STRING_AGG(t.name, ', ') as tags
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN news_tags nt ON n.id = nt.news_id
JOIN tags t ON nt.tag_id = t.id
GROUP BY n.id, n.title, c.name
ORDER BY n.publish_date DESC
LIMIT 15;

-- 4 таблицы (1 запрос)
SELECT n.title, n.publish_date, n.views_count,
       c.name as category,
       s.name as source,
       a.first_name, a.last_name as author,
       STRING_AGG(DISTINCT t.name, ', ') as tags
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN sources s ON n.source_id = s.id
JOIN authors a ON n.author_id = a.id
LEFT JOIN news_tags nt ON n.id = nt.news_id
LEFT JOIN tags t ON nt.tag_id = t.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY n.id, n.title, n.publish_date, n.views_count, c.name, s.name, a.first_name, a.last_name
ORDER BY n.views_count DESC
LIMIT 10;

-- 5 таблиц (1 запрос)
SELECT n.title, n.publish_date, n.views_count, n.likes_count,
       c.name as category,
       s.name as source,
       a.first_name || ' ' || a.last_name as author,
       STRING_AGG(DISTINCT t.name, ', ') as tags,
       COUNT(cm.id) as comments_count,
       AVG(LENGTH(cm.content)) as avg_comment_length
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN sources s ON n.source_id = s.id
JOIN authors a ON n.author_id = a.id
LEFT JOIN news_tags nt ON n.id = nt.news_id
LEFT JOIN tags t ON nt.tag_id = t.id
LEFT JOIN comments cm ON n.id = cm.news_id
WHERE n.publish_date BETWEEN '2023-01-01' AND CURRENT_DATE
GROUP BY n.id, n.title, n.publish_date, n.views_count, n.likes_count,
         c.name, s.name, a.first_name, a.last_name
HAVING COUNT(cm.id) > 0
ORDER BY n.views_count DESC
LIMIT 10;
