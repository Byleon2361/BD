-- ============================================================
-- 01_ddl.sql — Схема таблиц ClickHouse для новостного агрегатора
-- ============================================================

-- Создаём базу данных
CREATE DATABASE IF NOT EXISTS news_analytics;

USE news_analytics;

-- ============================================================
-- РАЗДЕЛ 1: ТИПЫ СОБЫТИЙ
-- ============================================================
-- Определяем 3 типа событий (+ бонусный 4й):
--
-- 1. article_view    — пользователь открыл статью
--    Поля: user_id, article_id, category_id, source,
--          read_time_seconds, is_subscriber, device_type
--    Аналитика: популярность статей/категорий, глубина чтения,
--               трафик по устройствам, удержание подписчиков
--
-- 2. article_reaction — пользователь поставил реакцию (лайк/дизлайк/закладка)
--    Поля: user_id, article_id, reaction_type, category_id
--    Аналитика: вовлечённость, топ статей по реакциям,
--               соотношение позитив/негатив
--
-- 3. search_query    — пользователь выполнил поиск
--    Поля: user_id, query_text, category_filter, results_count,
--          clicked_result_id
--    Аналитика: популярные запросы, конверсия поиска → клик,
--               пустые выдачи (что ищут но не находят)
--
-- 4. user_session    — сессия пользователя (вход/выход)
--    Поля: user_id, session_duration_seconds, pages_visited,
--          entry_page, exit_page
--    Аналитика: DAU/MAU, среднее время на сайте, bounce rate

-- ============================================================
-- РАЗДЕЛ 2: ОСНОВНАЯ ТАБЛИЦА СОБЫТИЙ
-- ============================================================

CREATE TABLE IF NOT EXISTS news_analytics.events
(
    -- Служебные поля
    event_id        UUID            DEFAULT generateUUIDv4() COMMENT 'Уникальный ID события',
    event_time      DateTime        COMMENT 'Время события (UTC)',
    event_date      Date            MATERIALIZED toDate(event_time) COMMENT 'Дата (для партиционирования)',
    ingested_at     DateTime        DEFAULT now() COMMENT 'Время загрузки в ClickHouse',
    event_version   UInt8           DEFAULT 1 COMMENT 'Версия схемы события',

    -- Тип события
    event_type      LowCardinality(String) COMMENT 'article_view | article_reaction | search_query | user_session',

    -- Идентификаторы сущностей
    user_id         UInt32          COMMENT 'ID пользователя (0 = аноним)',
    article_id      UInt32          DEFAULT 0 COMMENT 'ID статьи (0 если не применимо)',
    category_id     UInt8           DEFAULT 0 COMMENT 'ID категории',
    session_id      UUID            DEFAULT generateUUIDv4() COMMENT 'ID сессии',

    -- Поля для article_view
    read_time_sec   UInt16          DEFAULT 0 COMMENT 'Время чтения в секундах',
    scroll_depth    UInt8           DEFAULT 0 COMMENT 'Глубина прокрутки 0-100%',
    is_subscriber   UInt8           DEFAULT 0 COMMENT '1 = подписчик',
    device_type     LowCardinality(String) DEFAULT '' COMMENT 'desktop | mobile | tablet',
    source_site     LowCardinality(String) DEFAULT '' COMMENT 'Источник трафика: direct | search | social',

    -- Поля для article_reaction
    reaction_type   LowCardinality(String) DEFAULT '' COMMENT 'like | dislike | bookmark | share',

    -- Поля для search_query
    query_text      String          DEFAULT '' COMMENT 'Текст поискового запроса',
    results_count   UInt16          DEFAULT 0 COMMENT 'Количество результатов поиска',
    clicked_result  UInt32          DEFAULT 0 COMMENT 'ID кликнутой статьи (0 = не кликнул)',

    -- Поля для user_session
    session_sec     UInt32          DEFAULT 0 COMMENT 'Длительность сессии в секундах',
    pages_visited   UInt16          DEFAULT 0 COMMENT 'Количество страниц за сессию',

    -- Гео и технические
    country_code    LowCardinality(String) DEFAULT '' COMMENT 'Код страны ISO-2',
    platform        LowCardinality(String) DEFAULT '' COMMENT 'web | ios | android'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
-- ^ Партиционируем по месяцу:
--   - Аналитика обычно запрашивает данные за месяц/квартал
--   - При TTL удаление идёт по целым партициям (эффективно)
--   - Не слишком мелко (не по дням) — нет миллионов партиций
ORDER BY (event_type, event_date, user_id, article_id)
-- ^ ORDER BY определяет физический порядок на диске (sparse index):
--   - event_type первым: запросы часто фильтруют по типу события
--   - event_date вторым: диапазонные запросы по дате очень быстрые
--   - user_id: cohort-анализ, запросы по конкретному пользователю
--   - article_id: агрегация статистики по статьям
TTL event_time + INTERVAL 12 MONTH DELETE
-- ^ Данные хранятся 12 месяцев.
-- Обоснование: год — стандартный период для бизнес-аналитики
-- (год к году, сезонность). Старше года — в data warehouse/архив.
SETTINGS index_granularity = 8192
COMMENT 'Основная таблица событий новостного агрегатора';


-- ============================================================
-- РАЗДЕЛ 3: АГРЕГИРОВАННАЯ ВИТРИНА — просмотры по статьям
-- ============================================================

-- Целевая таблица для материализованного представления
CREATE TABLE IF NOT EXISTS news_analytics.mv_article_daily_stats
(
    event_date      Date,
    article_id      UInt32,
    category_id     UInt8,
    total_views     UInt64,
    unique_users    AggregateFunction(uniq, UInt32),   -- точный HyperLogLog
    avg_read_sec    AggregateFunction(avg, UInt16),
    total_likes     UInt64,
    total_bookmarks UInt64,
    subscriber_views UInt64
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, article_id)
TTL event_date + INTERVAL 24 MONTH DELETE
COMMENT 'Витрина: ежедневная статистика статей';

-- Материализованное представление: автоматически заполняет витрину
CREATE MATERIALIZED VIEW IF NOT EXISTS news_analytics.mv_article_daily_stats_fill
TO news_analytics.mv_article_daily_stats
AS
SELECT
    toDate(event_time)                          AS event_date,
    article_id,
    category_id,
    countIf(event_type = 'article_view')        AS total_views,
    uniqState(user_id)                          AS unique_users,
    avgState(read_time_sec)                     AS avg_read_sec,
    countIf(reaction_type = 'like')             AS total_likes,
    countIf(reaction_type = 'bookmark')         AS total_bookmarks,
    countIf(event_type = 'article_view'
            AND is_subscriber = 1)              AS subscriber_views
FROM news_analytics.events
WHERE article_id > 0
GROUP BY event_date, article_id, category_id;


-- ============================================================
-- РАЗДЕЛ 4: ВИТРИНА — почасовая активность
-- ============================================================

CREATE TABLE IF NOT EXISTS news_analytics.mv_hourly_activity
(
    hour            DateTime,
    event_type      LowCardinality(String),
    category_id     UInt8,
    event_count     UInt64,
    unique_users    AggregateFunction(uniq, UInt32)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, event_type, category_id)
TTL hour + INTERVAL 6 MONTH DELETE
COMMENT 'Витрина: почасовая активность по типам событий';

CREATE MATERIALIZED VIEW IF NOT EXISTS news_analytics.mv_hourly_activity_fill
TO news_analytics.mv_hourly_activity
AS
SELECT
    toStartOfHour(event_time)   AS hour,
    event_type,
    category_id,
    count()                     AS event_count,
    uniqState(user_id)          AS unique_users
FROM news_analytics.events
GROUP BY hour, event_type, category_id;


-- ============================================================
-- РАЗДЕЛ 5: ТАБЛИЦА ДЛЯ ДЕДУПЛИКАЦИИ
-- ============================================================
-- Сценарий: producer может прислать одно и то же событие дважды
-- (exactly-once не гарантирован). Используем ReplacingMergeTree
-- по event_id — дубли будут схлопнуты при следующем merge.

CREATE TABLE IF NOT EXISTS news_analytics.events_dedup
(
    event_id        UUID,
    event_time      DateTime,
    event_date      Date MATERIALIZED toDate(event_time),
    ingested_at     DateTime DEFAULT now(),
    event_type      LowCardinality(String),
    user_id         UInt32,
    article_id      UInt32 DEFAULT 0,
    category_id     UInt8 DEFAULT 0,
    read_time_sec   UInt16 DEFAULT 0,
    reaction_type   LowCardinality(String) DEFAULT '',
    query_text      String DEFAULT '',
    device_type     LowCardinality(String) DEFAULT '',
    platform        LowCardinality(String) DEFAULT ''
)
ENGINE = ReplacingMergeTree(ingested_at)
-- ^ ReplacingMergeTree(ingested_at):
--   При появлении дублей с одинаковым ORDER BY
--   оставляет запись с МАКСИМАЛЬНЫМ ingested_at (самую свежую).
--   Дедупликация происходит лениво при merge — для точных
--   запросов используем FINAL: SELECT ... FROM events_dedup FINAL
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_type, event_date, event_id)
TTL event_time + INTERVAL 12 MONTH DELETE
SETTINGS index_granularity = 8192
COMMENT 'Таблица событий с дедупликацией через ReplacingMergeTree';