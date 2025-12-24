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

### Этап 2 - дампы
1) Создал скрипт backup.sh, который выполняет дамп всех баз и настроек PostgreSQL через pg_dumpall.
2) Проверил его работу — дамп успешно создаётся в папке backups.
3) Настроил volume и скрипт так, что можно запускать вручную в любое время.

Поскольку в задании было указано: «нужен дамп не только данных, но и настроек БД», а pg_dumpall вместе с файлами конфигурации покрывает эти требования, этот пункт считается выполненным.



# new - 7
# Отчёт по лабораторной работе: Разработка новостного агрегатора с использованием Docker, MongoDB и PostgreSQL

## Цель работы
Разработать контейнеризированное приложение — новостной агрегатор, включающее:
- Две базы данных: MongoDB (основная для новостей) и PostgreSQL (с репликацией).
- REST API на Node.js с несколькими эндпоинтами для работы с данными.
- Автоматическую инициализацию баз данных (seed, индексы, витрина данных).
- Мониторинг с использованием Prometheus и Grafana.
- Полную оркестрацию через Docker Compose.

## Архитектура системы
Система состоит из 9 сервисов в `docker-compose.yml`:
- PostgreSQL primary и replica.
- MongoDB.
- news-api (Node.js приложение).
- mongo-express (веб-интерфейс для MongoDB).
- postgres-exporter, node-exporter, prometheus, grafana (мониторинг).

## Основные выполненные задачи

### 1. Настройка PostgreSQL с репликацией
- Primary-сервис с автоматической настройкой репликации (wal_level = replica, создание пользователя replicator, pg_hba.conf).
- Replica-сервис с pg_basebackup для копирования данных.
- Импорт схемы и данных из SQL-дампа.

### 2. Настройка MongoDB
- Официальный образ `mongo:7.0`.
- Авторизация через root-пользователя.
- Монтирование папки `./5labscript` в `/docker-entrypoint-initdb.d` для автоматического выполнения скриптов при первом запуске.
- Скрипты с префиксами (01-, 02-...) для правильного порядка:
  - `01-mongo-init.js` — создание пользователя `news_user`.
  - `02-mongo-seed.js` — загрузка ~520 новостей.
  - `03-create-index.js` — создание индексов (partial, unique по titleHash, text index для поиска).
  - `04-data-mart.js` — витрина данных.
  - Другие — проверки и бенчмарки.

### 3. Разработка REST API (news-api)
- Node.js приложение с подключением к MongoDB через авторизованного пользователя.
- 6 эндпоинтов с агрегациями и фильтрами.

### 4. Мониторинг
- Exporters, Prometheus и Grafana для метрик.

### 5. Ключевые дополнения в docker-compose.yml
Для стабильной работы добавлены важные конфигурации:

#### Сервис mongodb:
```yaml
mongodb:
  image: mongo:7.0
  ...
  healthcheck:  # Проверка готовности MongoDB (ping)
    test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
    interval: 10s
    timeout: 5s
    retries: 12
    start_period: 40s  # Время на выполнение seed и индексов
```
- **Описание**: `healthcheck` проверяет, отвечает ли MongoDB на ping. `start_period: 40s` даёт время на инициализацию (seed 520 документов + индексы). Это предотвращает ранний запуск зависимых сервисов.

#### Сервис news-api:
```yaml
news-api:
  ...
  depends_on:
    mongodb:
      condition: service_healthy  # Запуск только после полной готовности MongoDB
```
- **Описание**: API стартует только когда MongoDB прошла healthcheck. Это устраняет race condition — подключение не падает из-за незавершённой инициализации.

#### Сервис mongo-express (опционально улучшен):
```yaml
mongo-express:
  ...
  environment:
    ME_CONFIG_MONGODB_URL: "mongodb://root:rootpass@mongodb:27017"
    ME_CONFIG_MONGODB_ADMINUSERNAME: root
    ME_CONFIG_MONGODB_ADMINPASSWORD: rootpass
  depends_on:
    mongodb:
      condition: service_healthy
```
- **Описание**: Подключение с root-пользователем (авторизация включена). `service_healthy` ждёт готовности MongoDB.

Эти изменения обеспечили стабильный запуск: MongoDB полностью инициализируется перед стартом API и mongo-express.

## Как получаем ответы от API
- API работает на `http://localhost:3000`.
- Запросы через `curl` (или браузер/Postman).
- Ответы в JSON:
  - Агрегации из MongoDB (например, топ новостей — сортировка по `metrics.views`).
  - Данные из витрины (data mart).
  - Статистика формируется на лету или из агрегированных коллекций.
- Примеры ответов (из реального запуска):
  - Главная: список эндпоинтов.
  - `/api/news/top?limit=5`: топ-5 новостей по просмотрам.
  - `/api/stats/categories`: статистика по категориям (статей, просмотров, engagement rate).
  - `/api/stats/daily`: детальные записи из витрины.
  - `/api/authors/top`: топ авторов с метриками.
  - `/api/health`: статус БД и количество документов.

Поиск (`/api/news/search`) требует text index (добавлен в `03-create-index.js`).

## Ключевые проблемы и решения
- Порядок скриптов: переименование файлов (01-, 02-...).
- Race condition при подключении: healthcheck + condition: service_healthy.
- Текстовый поиск: добавление text index.
- Стабильность репликации PostgreSQL: автоматическая настройка.

## Результаты
- Полностью рабочий стек одной командой `docker-compose up`.
- API возвращает реальные данные из MongoDB.
- Система готова к демонстрации и масштабированию.

