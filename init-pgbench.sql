-- init-pgbench.sql
DO $$
BEGIN
    -- Ждем завершения основной инициализации
    PERFORM pg_sleep(5);
    
    RAISE NOTICE '=== ШАГ 3: Инициализация pgbench ===';
    
    -- Инициализируем pgbench
    PERFORM FROM public.pgbench_accounts;
    EXCEPTION WHEN undefined_table THEN
        PERFORM FROM public.pgbench_branches;
        EXCEPTION WHEN undefined_table THEN
            -- Таблицы pgbench не существуют, инициализируем
            PERFORM FROM public.pgbench_history;
            EXCEPTION WHEN undefined_table THEN
                CALL system('pgbench -i -s 10 demo_big');
END $$;

RAISE NOTICE '=== ШАГ 4: Первый нагрузочный тест ===';
CALL system('pgbench -c 5 -j 2 -T 10 demo_big');

RAISE NOTICE '=== ШАГ 5: Создаем блоттинг ===';
UPDATE pgbench_accounts SET abalance = abalance WHERE aid % 100 = 0;

RAISE NOTICE '=== ШАГ 6: Второй нагрузочный тест ===';
CALL system('pgbench -c 5 -j 2 -T 10 demo_big');

RAISE NOTICE '=== ЗАДАНИЕ ВЫПОЛНЕНО ===';