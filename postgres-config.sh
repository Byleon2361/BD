#!/bin/bash
set -e

# Применяем настройки PostgreSQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "ALTER SYSTEM SET maintenance_work_mem = '128MB';"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "ALTER SYSTEM SET max_connections = 200;"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "SELECT pg_reload_conf();"

# Проверяем, создана ли схема pgbench
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pgbench_accounts'
    ) THEN
        RAISE NOTICE 'Initializing pgbench schema...';
        PERFORM system('pgbench -h localhost -U postgres -i -s 50 demo_big');
    ELSE
        RAISE NOTICE 'pgbench schema already exists.';
    END IF;
END \$\$;
"