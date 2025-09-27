-- 2 таблицы
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
ORDER BY articles_count DESC
LIMIT 10;

-- 3 таблицы
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
ORDER BY n.publish_date DESC
LIMIT 10;

-- 4. Новости с тегами и категориями
SELECT n.title, c.name as category, STRING_AGG(t.name, ', ') as tags
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN news_tags nt ON n.id = nt.news_id
JOIN tags t ON nt.tag_id = t.id
GROUP BY n.id, n.title, c.name
ORDER BY n.publish_date DESC
LIMIT 15;

-- 4 таблицы
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

-- 5 таблиц
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