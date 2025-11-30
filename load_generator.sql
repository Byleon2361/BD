CREATE TABLE IF NOT EXISTS load_test_table (
    id SERIAL PRIMARY KEY,
    data TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Вставим начальные данные
INSERT INTO load_test_table (data) 
SELECT md5(random()::text) 
FROM generate_series(1, 1000);

-- Бесконечный цикл нагрузки
DO $$
DECLARE
    i INTEGER;
    random_id INTEGER;
    sleep_time FLOAT;
BEGIN
    WHILE true LOOP
        -- Случайное действие (1=INSERT, 2=UPDATE, 3=DELETE, 4=SELECT, 5=COMPLEX_QUERY)
        i := floor(random() * 5) + 1;
        
        -- Случайная задержка между 0.1 и 1 секунд
        sleep_time := random() * 0.9 + 0.1;
        
        CASE i
            WHEN 1 THEN
                -- INSERT
                INSERT INTO load_test_table (data) 
                VALUES (md5(random()::text));
                
            WHEN 2 THEN
                -- UPDATE случайной строки
                SELECT id INTO random_id FROM load_test_table 
                ORDER BY random() LIMIT 1;
                IF random_id IS NOT NULL THEN
                    UPDATE load_test_table 
                    SET data = 'updated_' || md5(random()::text),
                        updated_at = now()
                    WHERE id = random_id;
                END IF;
                
            WHEN 3 THEN
                -- DELETE случайной строки
                SELECT id INTO random_id FROM load_test_table 
                ORDER BY random() LIMIT 1;
                IF random_id IS NOT NULL THEN
                    DELETE FROM load_test_table WHERE id = random_id;
                END IF;
                
            WHEN 4 THEN
                -- SELECT с разными условиями
                PERFORM COUNT(*) FROM load_test_table 
                WHERE data LIKE 'a%' OR created_at > now() - interval '1 hour';
                
            WHEN 5 THEN
                -- Сложный запрос
                PERFORM COUNT(*) FROM load_test_table t1, load_test_table t2 
                WHERE t1.id <> t2.id AND t1.data = t2.data;
                
        END CASE;
        
        -- Задержка
        PERFORM pg_sleep(sleep_time);
        
    END LOOP;
END $$;