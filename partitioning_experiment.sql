-- partitioning_experiment.sql
-- Эксперименты с партиционированием таблицы news

-- 1. Создаем копию основной таблицы
CREATE TABLE IF NOT EXISTS news_copy (LIKE news INCLUDING ALL);
INSERT INTO news_copy SELECT * FROM news;

-- 2. Создаем партиционированную таблицу по годам
CREATE TABLE IF NOT EXISTS news_partitioned (
    LIKE news INCLUDING ALL
) PARTITION BY RANGE (publish_date);

-- 3. Создаем партиции для разных годов
CREATE TABLE IF NOT EXISTS news_part_2022 PARTITION OF news_partitioned
    FOR VALUES FROM ('2022-01-01') TO ('2023-01-01');

CREATE TABLE IF NOT EXISTS news_part_2023 PARTITION OF news_partitioned
    FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

CREATE TABLE IF NOT EXISTS news_part_2024 PARTITION OF news_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS news_part_2025 PARTITION OF news_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- 4. Копируем данные в партиционированную таблицу
INSERT INTO news_partitioned SELECT * FROM news;

-- 5. Эксперимент 1: Запрос по условию партиционирования (по дате)
-- Обычная таблица
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) as count_regular FROM news 
WHERE publish_date >= '2024-01-01' AND publish_date < '2025-01-01';

-- Партиционированная таблица  
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) as count_partitioned FROM news_partitioned
WHERE publish_date >= '2024-01-01' AND publish_date < '2025-01-01';

-- 6. Эксперимент 2: Запрос НЕ по условию партиционирования
-- Обычная таблица
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) as count_regular FROM news 
WHERE category_id = 1 AND views_count > 1000;

-- Партиционированная таблица
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) as count_partitioned FROM news_partitioned 
WHERE category_id = 1 AND views_count > 1000;

-- 7. Показываем статистику по таблицам
SELECT 
    'news' as table_name,
    COUNT(*) as row_count,
    PG_SIZE_PRETTY(PG_TOTAL_RELATION_SIZE('news')) as total_size
FROM news
UNION ALL
SELECT 
    'news_copy' as table_name,
    COUNT(*) as row_count, 
    PG_SIZE_PRETTY(PG_TOTAL_RELATION_SIZE('news_copy')) as total_size
FROM news_copy
UNION ALL
SELECT 
    'news_partitioned' as table_name,
    COUNT(*) as row_count,
    PG_SIZE_PRETTY(PG_TOTAL_RELATION_SIZE('news_partitioned')) as total_size
FROM news_partitioned;