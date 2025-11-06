-- checking_data.sql
\echo '=== ПРОВЕРКА ЗАГРУЗКИ ДАННЫХ ==='

-- 1. Общее количество записей в таблицах
\echo '\n1. Количество записей в таблицах:'
SELECT 
    'news' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT id) as unique_ids,
    MIN(publish_date) as earliest_date,
    MAX(publish_date) as latest_date
FROM news
UNION ALL
SELECT 
    'authors',
    COUNT(*),
    COUNT(DISTINCT id),
    NULL,
    NULL
FROM authors
UNION ALL
SELECT 
    'categories', 
    COUNT(*),
    COUNT(DISTINCT id),
    NULL,
    NULL
FROM categories
UNION ALL
SELECT 
    'sources',
    COUNT(*),
    COUNT(DISTINCT id),
    NULL,
    NULL
FROM sources;

-- 2. Проверка данных в news
\echo '\n2. Статистика таблицы news:'
SELECT 
    COUNT(*) as total_news,
    COUNT(DISTINCT category_id) as categories_used,
    COUNT(DISTINCT author_id) as authors_used, 
    COUNT(DISTINCT source_id) as sources_used,
    AVG(views_count) as avg_views,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_news,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM news;

-- 3. Проверка связей между таблицами
\echo '\n3. Проверка связей данных:'
SELECT 
    'categories' as relation,
    COUNT(DISTINCT c.id) as total_in_master,
    COUNT(DISTINCT n.category_id) as used_in_news,
    ROUND(100.0 * COUNT(DISTINCT n.category_id) / COUNT(DISTINCT c.id), 2) as usage_percent
FROM categories c
LEFT JOIN news n ON c.id = n.category_id
UNION ALL
SELECT 
    'authors',
    COUNT(DISTINCT a.id),
    COUNT(DISTINCT n.author_id),
    ROUND(100.0 * COUNT(DISTINCT n.author_id) / COUNT(DISTINCT a.id), 2)
FROM authors a
LEFT JOIN news n ON a.id = n.author_id
UNION ALL
SELECT 
    'sources', 
    COUNT(DISTINCT s.id),
    COUNT(DISTINCT n.source_id),
    ROUND(100.0 * COUNT(DISTINCT n.source_id) / COUNT(DISTINCT s.id), 2)
FROM sources s
LEFT JOIN news n ON s.id = n.source_id;

-- 4. Проверка качества данных
\echo '\n4. Качество данных:'
SELECT 
    'null_category' as issue,
    COUNT(*) as count
FROM news 
WHERE category_id IS NULL
UNION ALL
SELECT 
    'null_author',
    COUNT(*) 
FROM news 
WHERE author_id IS NULL
UNION ALL
SELECT 
    'null_source',
    COUNT(*)
FROM news 
WHERE source_id IS NULL
UNION ALL
SELECT 
    'future_dates',
    COUNT(*)
FROM news 
WHERE publish_date > CURRENT_DATE;

-- 5. Проверка индексов
\echo '\n5. Состояние индексов:'
SELECT 
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE relname = 'news';