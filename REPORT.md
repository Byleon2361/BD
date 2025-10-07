# Файлы в проекте

   • agregatorCreate.py — генератор SQL-дампа complete_news_database_postgres.sql. Создаёт таблицы categories, sources, authors, news, добавляет индексы и триггер. По умолчанию генерирует 3 000 000 записей (через INSERT batch по 10k).
   Важно: генератор не создаёт таблицы tags, news_tags, comments — но они используются в запросах.

	•	complete_news_database_postgres.sql — (создаётся скриптом) дамп базы, который монтируется в контейнер и инициализирует БД при первом запуске контейнера.
	•	business_queries_postgres.sql — (по описанию) тестовые запросы; коллега генерил два SQL-файла (дамп + тесты).
	•	docker-compose.yml — сервис postgres (image postgres:15), экспорт порта 5432, монтирует complete_news_database_postgres.sql и postgres-config.sh в /docker-entrypoint-initdb.d/. Переменная POSTGRES_DB: new_bd.
	•	Dockerfile — альтернативный способ собрать образ, копирует дамп и postgres-config.sh в образ; задаёт POSTGRES_DB=new_bd.
	•	postgres-config.sh — запускается при инициализации: ALTER SYSTEM для нескольких параметров и попытка инициализировать pgbench — но в текущем виде содержит ошибки (см. ниже).
	•	postgresql.conf — заранее прописанные настройки (maintenance_work_mem, max_connections и т.д.).
	•	fullTests.sh (или Fulltest.py по содержимому) — bash-скрипт для бенчмарка (pgbench): настраивает параметры, инициализирует pgbench, выполняет тесты, создаёт «блоат», VACUUM FULL, REINDEX, симулирует crash и recovery и т.п. Скрипт ожидает контейнер bd-postgres-1 и базу demo_big.
	•	aggregating_queries.sql — 5 агрегирующих запросов (COUNT, SUM, AVG, GROUP BY) — 5 штук, хорошо.
	•	window_functions.sql — 5 оконных запросов — хорошо.
	•	queries_with_joined_tables.sql — набор запросов с объединениями. Сейчас: 2 запроса на 2 таблицы, 3 запроса на 3 таблицы, 1 запрос на 4 таблицы, 1 запрос на 5 таблиц → итог 7 запросов, а задание требует 8 (см. ниже).
	•	другие файлы: REPORT.md, tasks/*, demo-big-20170815.sql — вспомогательные.



## Что сделано
### Этап 1 - настройки репликации

Репликация это копия основной бд, которая принимает все ее изменения.

В докере теперь:
Контейнер                  Роль                        Порт     Назначение
bd-postgres-1              Primary (главный сервер)    5432    Принимает все запросы на запись
bd-postgres-replica        Replica (вторичный сервер)  5433    Только чтение, синхронизируется с главным


1.	Подготовили Primary-сервер (bd-postgres-1)
	•	включили wal_level = replica — чтобы PostgreSQL записывал изменения в WAL (Write-Ahead Log), который читает реплика;
	•	задали max_wal_senders = 5 — разрешили до 5 подключений реплик;
	•	wal_keep_size = 64MB — оставляем журнал изменений для синхронизации;
	•	listen_addresses = '*' — позволяем подключение снаружи;
	•	создали роль replicator с правом REPLICATION.
2.	Настроили доступ реплики
	•	добавили строку в pg_hba.conf:
   host replication replicator 0.0.0.0/0 md5 — это позволило логиниться для репликации;
	•	перегрузили конфигурацию (pg_reload_conf).
3.	Создали Volume для реплики (postgres_replica_data), куда скопировали данные с Primary через pg_basebackup.
4.	Создали конфигурацию подключения (primary_conninfo) — указали, как реплика связывается с главным сервером.
5.	Запустили реплику (bd-postgres-replica) на порту 5433.