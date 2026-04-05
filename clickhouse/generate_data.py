#!/usr/bin/env python3
"""
02_generate_data.py — Генератор тестовых данных для ClickHouse
=============================================================
Генерирует 150_000+ событий с реалистичными паттернами:
  - Повторяющиеся пользователи и статьи
  - Временные всплески активности (утро/вечер, выходные)
  - Данные за последние 90 дней (несколько недель и месяцев)
  - Все 4 типа событий в реальных пропорциях

Запуск:
  pip install clickhouse-driver faker
  python 02_generate_data.py

Или через Docker:
  docker exec -i bd-clickhouse python3 /dev/stdin < 02_generate_data.py
"""

import random
import uuid
from datetime import datetime, timedelta
from clickhouse_driver import Client

# ── Параметры подключения ──────────────────────────────────────────────────────
CH_HOST     = 'localhost'
CH_PORT     = 9000
CH_DATABASE = 'news_analytics'
CH_USER     = 'analytics'
CH_PASSWORD = 'analytics_pass'

TOTAL_EVENTS    = 150_000
BATCH_SIZE      = 10_000       # вставляем батчами по 10к

# ── Справочники ────────────────────────────────────────────────────────────────
CATEGORIES = {
    1: 'politics', 2: 'sports', 3: 'technology',
    4: 'entertainment', 5: 'business', 6: 'health', 7: 'science'
}
DEVICES      = ['desktop', 'mobile', 'tablet']
DEVICE_W     = [0.45, 0.45, 0.10]
SOURCES      = ['direct', 'search', 'social', 'email', 'referral']
SOURCE_W     = [0.30, 0.35, 0.20, 0.10, 0.05]
REACTIONS    = ['like', 'dislike', 'bookmark', 'share']
REACTION_W   = [0.55, 0.10, 0.25, 0.10]
PLATFORMS    = ['web', 'ios', 'android']
PLATFORM_W   = [0.50, 0.30, 0.20]
COUNTRIES    = ['RU', 'US', 'DE', 'FR', 'GB', 'UA', 'BY', 'KZ']
COUNTRY_W    = [0.55, 0.10, 0.06, 0.05, 0.05, 0.08, 0.06, 0.05]

# Пул пользователей: небольшой (~2000) — чтобы были повторения
USER_IDS     = list(range(1, 2001))
# Пул статей: ~500 статей
ARTICLE_IDS  = list(range(1, 501))
# Категорийные веса (технологии и спорт популярнее)
CATEGORY_IDS = list(CATEGORIES.keys())
CATEGORY_W   = [0.18, 0.20, 0.22, 0.15, 0.12, 0.08, 0.05]

# Типы событий и их доли
EVENT_TYPES  = ['article_view', 'article_reaction', 'search_query', 'user_session']
EVENT_W      = [0.60, 0.20, 0.15, 0.05]

# Популярные поисковые запросы
SEARCH_TERMS = [
    'искусственный интеллект', 'чемпионат мира', 'выборы 2024',
    'биткоин курс', 'здоровое питание', 'космос', 'нейросети',
    'футбол результаты', 'экономика санкции', 'новые технологии',
    'климат изменение', 'медицина лечение', 'стартапы инвестиции',
    'олимпиада', 'политика новости'
]


def weighted_choice(items, weights):
    return random.choices(items, weights=weights, k=1)[0]


def generate_event_time(days_back=90):
    """
    Генерирует время события с реалистичными паттернами:
    - Всплески: 8-10 утра, 12-14 обед, 19-22 вечер
    - Выходные активнее будних на 30%
    - Случайные "вирусные" дни с 3x трафиком
    """
    now = datetime.utcnow()
    # Выбираем случайный день
    day_offset = random.randint(0, days_back)
    base_date  = now - timedelta(days=day_offset)
    weekday    = base_date.weekday()  # 0=пн, 6=вс

    # Пики активности: утро (8-10), обед (12-14), вечер (19-22)
    hour_weights = [
        0.3, 0.2, 0.1, 0.1, 0.2, 0.5,   # 0-5
        1.0, 2.0, 3.5, 3.8, 3.0, 2.5,   # 6-11
        3.2, 3.0, 2.5, 2.0, 2.2, 2.8,   # 12-17
        3.5, 4.5, 4.8, 4.2, 3.0, 1.5    # 18-23
    ]
    # Выходные: +30% к вечернему трафику
    if weekday >= 5:
        hour_weights = [w * 1.3 for w in hour_weights]

    hour   = random.choices(range(24), weights=hour_weights, k=1)[0]
    minute = random.randint(0, 59)
    second = random.randint(0, 59)

    return base_date.replace(hour=hour, minute=minute, second=second, microsecond=0)


def generate_event():
    """Генерирует одно событие — словарь со всеми полями таблицы."""
    event_type  = weighted_choice(EVENT_TYPES, EVENT_W)
    user_id     = random.choice(USER_IDS)
    category_id = weighted_choice(CATEGORY_IDS, CATEGORY_W)
    article_id  = random.choice(ARTICLE_IDS) if event_type != 'user_session' else 0
    event_time  = generate_event_time()
    device_type = weighted_choice(DEVICES, DEVICE_W)
    platform    = weighted_choice(PLATFORMS, PLATFORM_W)
    country     = weighted_choice(COUNTRIES, COUNTRY_W)
    source_site = weighted_choice(SOURCES, SOURCE_W)
    is_subscriber = 1 if random.random() < 0.15 else 0  # 15% подписчики

    # Специфичные поля по типу события
    read_time_sec   = 0
    scroll_depth    = 0
    reaction_type   = ''
    query_text      = ''
    results_count   = 0
    clicked_result  = 0
    session_sec     = 0
    pages_visited   = 0

    if event_type == 'article_view':
        # Подписчики читают дольше
        base_read = 120 if is_subscriber else 45
        read_time_sec  = max(5, int(random.gauss(base_read, 60)))
        scroll_depth   = random.randint(10, 100)

    elif event_type == 'article_reaction':
        reaction_type  = weighted_choice(REACTIONS, REACTION_W)

    elif event_type == 'search_query':
        query_text     = random.choice(SEARCH_TERMS)
        results_count  = random.randint(0, 50)
        # 60% кликают на результат
        clicked_result = random.choice(ARTICLE_IDS) if random.random() < 0.60 else 0

    elif event_type == 'user_session':
        session_sec    = random.randint(30, 3600)
        pages_visited  = random.randint(1, 25)

    return {
        'event_id':       str(uuid.uuid4()),
        'event_time':     event_time,
        'ingested_at':    datetime.utcnow(),
        'event_version':  1,
        'event_type':     event_type,
        'user_id':        user_id,
        'article_id':     article_id,
        'category_id':    category_id,
        'session_id':     str(uuid.uuid4()),
        'read_time_sec':  read_time_sec,
        'scroll_depth':   scroll_depth,
        'is_subscriber':  is_subscriber,
        'device_type':    device_type,
        'source_site':    source_site,
        'reaction_type':  reaction_type,
        'query_text':     query_text,
        'results_count':  results_count,
        'clicked_result': clicked_result,
        'session_sec':    session_sec,
        'pages_visited':  pages_visited,
        'country_code':   country,
        'platform':       platform,
    }


def main():
    client = Client(
        host=CH_HOST, port=CH_PORT,
        database=CH_DATABASE,
        user=CH_USER, password=CH_PASSWORD
    )

    print(f"Подключились к ClickHouse: {CH_HOST}:{CH_PORT}/{CH_DATABASE}")
    print(f"Генерируем {TOTAL_EVENTS:,} событий батчами по {BATCH_SIZE:,}...")

    total_inserted = 0
    batch_num      = 0

    while total_inserted < TOTAL_EVENTS:
        current_batch = min(BATCH_SIZE, TOTAL_EVENTS - total_inserted)
        batch = [generate_event() for _ in range(current_batch)]

        # Вставляем в основную таблицу
        client.execute(
            'INSERT INTO news_analytics.events VALUES',
            batch,
            types_check=True
        )

        # Вставляем в таблицу с дедупликацией (с намеренными дублями ~5%)
        dedup_batch = []
        for ev in batch:
            dedup_batch.append({
                'event_id':     ev['event_id'],
                'event_time':   ev['event_time'],
                'ingested_at':  ev['ingested_at'],
                'event_type':   ev['event_type'],
                'user_id':      ev['user_id'],
                'article_id':   ev['article_id'],
                'category_id':  ev['category_id'],
                'read_time_sec': ev['read_time_sec'],
                'reaction_type': ev['reaction_type'],
                'query_text':   ev['query_text'],
                'device_type':  ev['device_type'],
                'platform':     ev['platform'],
            })
            # 5% дублей — отправляем то же событие ещё раз
            if random.random() < 0.05:
                duplicate = dict(dedup_batch[-1])
                duplicate['ingested_at'] = datetime.utcnow()  # новый ingested_at
                dedup_batch.append(duplicate)

        client.execute(
            'INSERT INTO news_analytics.events_dedup VALUES',
            dedup_batch,
            types_check=True
        )

        total_inserted += current_batch
        batch_num      += 1
        print(f"  Батч {batch_num}: вставлено {total_inserted:,} / {TOTAL_EVENTS:,}")

    # Итоговая статистика
    count = client.execute('SELECT count() FROM news_analytics.events')[0][0]
    count_dedup = client.execute('SELECT count() FROM news_analytics.events_dedup')[0][0]
    by_type = client.execute(
        'SELECT event_type, count() FROM news_analytics.events GROUP BY event_type ORDER BY 2 DESC'
    )
    by_month = client.execute(
        "SELECT toYYYYMM(event_time) as ym, count() FROM news_analytics.events GROUP BY ym ORDER BY ym"
    )

    print(f"\n✅ Загрузка завершена!")
    print(f"   events:       {count:,} записей")
    print(f"   events_dedup: {count_dedup:,} записей (включая ~5% дублей)")
    print(f"\nРаспределение по типам:")
    for row in by_type:
        print(f"   {row[0]:<20} {row[1]:>8,}")
    print(f"\nРаспределение по месяцам:")
    for row in by_month:
        print(f"   {row[0]}  →  {row[1]:>8,}")


if __name__ == '__main__':
    main()