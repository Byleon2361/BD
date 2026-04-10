-- Kafka Connect: таблица для JDBC Sink (analytics данные из топика)
CREATE TABLE IF NOT EXISTS kafka_article_stats (
    article_id  BIGINT PRIMARY KEY,
    view_count  BIGINT  DEFAULT 0,
    like_count  BIGINT  DEFAULT 0,
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Kafka Streams: оконные агрегаты по категориям
CREATE TABLE IF NOT EXISTS kafka_category_windows (
    id            SERIAL PRIMARY KEY,
    category_id   INT,
    category_name VARCHAR(100),
    window_count  BIGINT DEFAULT 0,
    window_type   VARCHAR(50),
    window_end    TIMESTAMP,
    recorded_at   TIMESTAMP DEFAULT NOW()
);

-- DLQ лог: сюда пишет Kafka Connect через JDBC Sink с топика news.events.dlq
CREATE TABLE IF NOT EXISTS kafka_dlq_log (
    id             SERIAL PRIMARY KEY,
    original_topic VARCHAR(255),
    original_key   VARCHAR(255),
    error_message  TEXT,
    payload        TEXT,
    failed_at      TIMESTAMP,
    recorded_at    TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_kafka_stats_updated ON kafka_article_stats(updated_at);
CREATE INDEX IF NOT EXISTS idx_kafka_windows_cat   ON kafka_category_windows(category_id);
CREATE INDEX IF NOT EXISTS idx_kafka_windows_end   ON kafka_category_windows(window_end);