-- logged_unlogged_test.sql
-- Сравнение производительности LOGGED vs UNLOGGED таблиц

-- 1. Создаем тестовые таблицы
CREATE TABLE IF NOT EXISTS test_logged (
    id SERIAL PRIMARY KEY,
    data TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNLOGGED TABLE IF NOT EXISTS test_unlogged (
    id SERIAL PRIMARY KEY,
    data TEXT, 
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Очищаем таблицы перед тестом
TRUNCATE test_logged, test_unlogged;

-- 3. Тест 1: Вставка по одной записи (1000 записей)
-- Включаем замер времени
\timing on

-- Вставка в LOGGED таблицу
DO $$
BEGIN
    FOR i IN 1..1000 LOOP
        INSERT INTO test_logged (data) VALUES ('logged_data_' || i);
    END LOOP;
END $$;

-- Вставка в UNLOGGED таблицу  
DO $$
BEGIN
    FOR i IN 1..1000 LOOP
        INSERT INTO test_unlogged (data) VALUES ('unlogged_data_' || i);
    END LOOP;
END $$;

-- 4. Тест 2: Вставка группой (batch insert)
INSERT INTO test_logged (data) 
SELECT 'logged_batch_' || generate_series(1001, 2000);

INSERT INTO test_unlogged (data)
SELECT 'unlogged_batch_' || generate_series(1001, 2000);

-- 5. Тест 3: Чтение данных
SELECT COUNT(*) FROM test_logged;
SELECT COUNT(*) FROM test_unlogged;

-- 6. Тест 4: Удаление по одной записи
DO $$
BEGIN
    FOR i IN 1..500 LOOP
        DELETE FROM test_logged WHERE id = i;
    END LOOP;
END $$;

DO $$
BEGIN
    FOR i IN 1..500 LOOP
        DELETE FROM test_unlogged WHERE id = i;
    END LOOP;
END $$;

-- 7. Тест 5: Удаление группой
DELETE FROM test_logged WHERE id BETWEEN 501 AND 1000;
DELETE FROM test_unlogged WHERE id BETWEEN 501 AND 1000;

-- Выключаем замер времени
\timing off

-- 8. Показываем финальную статистику
SELECT 'logged' as table_type, COUNT(*) as remaining_rows FROM test_logged
UNION ALL
SELECT 'unlogged' as table_type, COUNT(*) as remaining_rows FROM test_unlogged;

-- 9. Очищаем тестовые таблицы (опционально)
-- DROP TABLE test_logged;
-- DROP TABLE test_unlogged;