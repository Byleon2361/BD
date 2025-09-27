-- ОКОННЫЕ ФУНКЦИИ
-- 1. Рейтинг новостей внутри категорий
SELECT n.title, c.name as category, n.views_count,
       RANK() OVER (PARTITION BY n.category_id ORDER BY n.views_count DESC) as rank_in_category,
       DENSE_RANK() OVER (ORDER BY n.views_count DESC) as global_rank
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.is_active = TRUE
ORDER BY c.name, rank_in_category
LIMIT 10;

-- 2. Сравнение с предыдущей новостью автора
SELECT a.first_name, a.last_name, n.title, n.publish_date, n.views_count,
       LAG(n.views_count) OVER (PARTITION BY n.author_id ORDER BY n.publish_date) as prev_views,
       n.views_count - LAG(n.views_count) OVER (PARTITION BY n.author_id ORDER BY n.publish_date) as views_diff
FROM news n
JOIN authors a ON n.author_id = a.id
ORDER BY a.id, n.publish_date
LIMIT 10;

-- 3. Накопительный итог просмотров по месяцам
SELECT EXTRACT(YEAR FROM publish_date) as year,
       EXTRACT(MONTH FROM publish_date) as month,
       SUM(views_count) as monthly_views,
       SUM(SUM(views_count)) OVER (ORDER BY EXTRACT(YEAR FROM publish_date), EXTRACT(MONTH FROM publish_date)) as cumulative_views
FROM news
GROUP BY EXTRACT(YEAR FROM publish_date), EXTRACT(MONTH FROM publish_date)
ORDER BY year, month
LIMIT 10;

-- 4. Процентное соотношение просмотров от категории
SELECT n.title, c.name as category, n.views_count,
       ROUND(n.views_count * 100.0 / SUM(n.views_count) OVER (PARTITION BY n.category_id), 2) as percent_of_category
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.views_count > 0
ORDER BY c.name, n.views_count DESC
LIMIT 10;

-- 5. Скользящее среднее просмотров за 7 дней
SELECT publish_date, views_count,
       AVG(views_count) OVER (ORDER BY publish_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7d
FROM news
WHERE publish_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY publish_date
LIMIT 10;