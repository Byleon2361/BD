-- init-settings.sql
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();