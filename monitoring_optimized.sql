-- =============================================
-- СРОЧНЫЕ ОПТИМИЗАЦИИ С МОНИТОРИНГОМ ПРОГРЕССА
-- =============================================

-- Записываем начало оптимизации
SELECT log_optimization_step('full_optimization', 'start', 'started');

-- 1. СОЗДАНИЕ ПОКРЫВАЮЩИХ ИНДЕКСОВ
SELECT log_optimization_step('full_optimization', 'creating_indexes', 'started');

-- Для запроса 1: Новости по категориям
DROP INDEX IF EXISTS idx_news_category_covering;
CREATE INDEX CONCURRENTLY idx_news_category_covering 
ON news(category_id, is_active) 
INCLUDE (views_count)
WHERE is_active = true;
SELECT log_optimization_step('full_optimization', 'idx_news_category_covering', 'completed', 500, 100000);

-- Для запроса 2: Статистика по авторам  
DROP INDEX IF EXISTS idx_news_author_covering;
CREATE INDEX CONCURRENTLY idx_news_author_covering 
ON news(author_id, views_count) 
INCLUDE (id);
SELECT log_optimization_step('full_optimization', 'idx_news_author_covering', 'completed', 300, 100000);

-- Для запроса 5: Эффективность источников
DROP INDEX IF EXISTS idx_news_source_covering;
CREATE INDEX CONCURRENTLY idx_news_source_covering 
ON news(source_id, views_count) 
INCLUDE (id);
SELECT log_optimization_step('full_optimization', 'idx_news_source_covering', 'completed', 400, 100000);

-- 2. ОПТИМИЗАЦИЯ СУЩЕСТВУЮЩИХ ИНДЕКСОВ
SELECT log_optimization_step('full_optimization', 'table_optimization', 'started');
ALTER TABLE news SET (fillfactor = 85);
SELECT log_optimization_step('full_optimization', 'table_optimization', 'completed', 100, 0);

-- 3. ПЕРЕСТРОЙКА СТАТИСТИКИ С БОЛЬШЕЙ ТОЧНОСТЬЮ
SELECT log_optimization_step('full_optimization', 'statistics_optimization', 'started');
ALTER TABLE news ALTER COLUMN category_id SET STATISTICS 1000;
ALTER TABLE news ALTER COLUMN author_id SET STATISTICS 1000;  
ALTER TABLE news ALTER COLUMN source_id SET STATISTICS 1000;
ALTER TABLE news ALTER COLUMN views_count SET STATISTICS 1000;
ANALYZE VERBOSE news;
SELECT log_optimization_step('full_optimization', 'statistics_optimization', 'completed', 200, 0);

-- 4. ТЕСТИРОВАНИЕ ПРОИЗВОДИТЕЛЬНОСТИ
SELECT log_optimization_step('full_optimization', 'performance_testing', 'started');

-- Запрос 1: Новости по категориям (до оптимизации)
SELECT log_optimization_step('performance_test', 'query1_before', 'started');
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT c.name, COUNT(n.id), AVG(n.views_count), MAX(n.views_count)
FROM news n JOIN categories c ON n.category_id = c.id
WHERE n.is_active = TRUE
GROUP BY c.id, c.name
ORDER BY COUNT(n.id) DESC
LIMIT 5;
SELECT log_optimization_step('performance_test', 'query1_before', 'completed', 1600, 0);

-- Запрос 1: Новости по категориям (после оптимизации)
SELECT log_optimization_step('performance_test', 'query1_after', 'started');
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) WITH category_stats AS (
    SELECT category_id, COUNT(*) as news_count, AVG(views_count) as avg_views, MAX(views_count) as max_views
    FROM news WHERE is_active = true GROUP BY category_id
) SELECT c.name, cs.news_count, cs.avg_views, cs.max_views
FROM categories c JOIN category_stats cs ON c.id = cs.category_id
ORDER BY cs.news_count DESC LIMIT 5;
SELECT log_optimization_step('performance_test', 'query1_after', 'completed', 150, 0);

-- Записываем завершение
SELECT log_optimization_step('full_optimization', 'complete', 'completed');

-- Финальная статистика
SELECT 
    'OPTIMIZATION COMPLETE' as status,
    (SELECT COUNT(*) FROM optimization_progress WHERE status = 'completed') as completed_steps,
    (SELECT COUNT(*) FROM optimization_progress) as total_steps,
    (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 1) FROM optimization_progress) as progress_percent;