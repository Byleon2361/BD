-- Таблица для отслеживания выполнения оптимизаций
CREATE TABLE IF NOT EXISTS optimization_progress (
    id SERIAL PRIMARY KEY,
    optimization_name VARCHAR(100) NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('started', 'completed', 'failed')),
    execution_time_ms INTEGER,
    records_affected BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Функция для записи прогресса
CREATE OR REPLACE FUNCTION log_optimization_step(
    p_optimization_name VARCHAR,
    p_step_name VARCHAR, 
    p_status VARCHAR,
    p_execution_time INTEGER DEFAULT NULL,
    p_records_affected BIGINT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO optimization_progress 
    (optimization_name, step_name, status, execution_time_ms, records_affected)
    VALUES (p_optimization_name, p_step_name, p_status, p_execution_time, p_records_affected);
END;
$$ LANGUAGE plpgsql;

-- Представление для метрик оптимизации
CREATE OR REPLACE VIEW optimization_metrics AS
SELECT 
    optimization_name,
    COUNT(*) as total_steps,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_steps,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_steps,
    AVG(execution_time_ms) as avg_execution_time,
    SUM(records_affected) as total_records_affected
FROM optimization_progress
GROUP BY optimization_name;