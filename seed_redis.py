import json
import redis
from datetime import datetime

# Подключение к Redis (с хоста)
r = redis.Redis(host='localhost', port=6379, db=0)

# Актуальные праздничные изображения (обновлённые ссылки на декабрь 2025)
image_urls = [
    "https://img.freepik.com/premium-photo/happy-new-year-2025-christmas-2025-christmas-gifts-placed-festive-atmosphere_1205-14698.jpg",  # Рождественские подарки
    "https://i.ytimg.com/vi/ZvIwMN16CHA/hq720.jpg",  # Фейерверки Новый год
    "https://c8.alamy.com/comp/2YD62FC/2025-written-in-the-snow-winter-holidays-landscape-greeting-card-2YD62FC.jpg",  # Зимний пейзаж 2025
    "https://www.sheknows.com/wp-content/uploads/2024/12/sk-best-holiday-gifts-2025-Sept-Refresh-FI.jpg?w=1440",  # Топ подарков 2025
    "https://cdn.vectorstock.com/i/1000v/43/85/2026-new-year-text-with-fireworks-on-night-sky-vector-59004385.jpg",  # Фейерверки 2026
    "https://www.dbackdrop.com/cdn/shop/files/MRR10-10.jpg?v=1760083595",  # Яркие фейерверки
    "https://thumbs.dreamstime.com/b/festive-christmas-ornament-bright-hangs-tree-adorned-colorful-lights-creating-joyful-holiday-atmosphere-341026144.jpg",  # Ёлка с украшениями
    "https://www.asiakingtravel.com/cuploads/files/N%E1%BB%99i%20dung%20%C4%91o%E1%BA%A1n%20v%C4%83n%20b%E1%BA%A3n%20c%E1%BB%A7a%20b%E1%BA%A1n%20(68).png",  # Рождество в Азии
    "https://www.widdop.co.uk/media/newblogs/x25/x25_banner.png",  # Тренды подарков
    "https://www.shutterstock.com/image-photo/2025-written-snow-winter-holidays-260nw-2535579575.jpg"  # 2025 в снегу
]

# 10 тестовых новостей (тематика Рождество/Новый год 2025–2026)
news_items = [
    {"title": "Мир празднует Рождество 2025: миллионы людей в атмосфере волшебства", "category": "holidays"},
    {"title": "Новый год 2026 приближается: лучшие места для салюта и фейерверков", "category": "holidays"},
    {"title": "Зимние праздники 2025: снежные пейзажи и семейные традиции", "category": "lifestyle"},
    {"title": "Топ подарков на Рождество 2025: что дарят в этом году", "category": "lifestyle"},
    {"title": "SeaWorld Orlando открывает рождественское шоу 2025", "category": "entertainment"},
    {"title": "Disney представляет Mickey's Very Merry Christmas Party 2025", "category": "entertainment"},
    {"title": "Глобальное потепление: необычно тёплая зима в Европе декабре 2025", "category": "science"},
    {"title": "Лучшие рецепты рождественского ужина 2025", "category": "food"},
    {"title": "Фейерверки над Сиднеем: как встретить 2026 год", "category": "holidays"},
    {"title": "Рождественские рынки Европы: магия 2025 года", "category": "travel"},
]

print("Заполняем Redis тестовыми данными для новостного агрегатора...\n")

for i, item in enumerate(news_items, start=1):
    # Кэш полной статьи (как JSON) с TTL 1 час
    article_key = f"article:{i}"
    article_data = {
        "id": i,
        "title": item["title"],
        "category": item["category"],
        "image_url": image_urls[i-1],
        "published_at": datetime(2025, 12, 20 + (i % 5), 12, 0, 0).isoformat(),
        "views": 0
    }
    r.set(article_key, json.dumps(article_data, ensure_ascii=False), ex=3600)

    # Отдельный счётчик просмотров
    r.set(f"article:{i}:views", 0)

    # Сортированный набор для топа по просмотрам (zset)
    r.zadd("top_articles", {i: 0})

    print(f"Добавлена в кэш: article:{i} — {item['title']}")

print("\nГотово! Redis заполнен:")
print("- 10 статей в кэше (ключи article:1 ... article:10)")
print("- Счётчики просмотров (article:1:views и т.д.)")
print("- Топ статей (zset top_articles)")

print("\nПроверь сам:")
print("docker exec -it bd-redis redis-cli")
print("Внутри выполни:")
print("  KEYS *                  # все ключи")
print("  GET article:1           # пример статьи")
print("  ZRANGE top_articles 0 -1 WITHSCORES  # топ")