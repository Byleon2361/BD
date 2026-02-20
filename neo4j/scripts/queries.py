from neo4j import GraphDatabase

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password123")
driver = GraphDatabase.driver(URI, auth=AUTH)

def run(title, query):
    print(f"\n{'='*60}")
    print(f"📌 {title}")
    print('='*60)
    with driver.session() as session:
        results = session.run(query)
        records = list(results)
        if not records:
            print("  (нет результатов)")
        for r in records:
            print(" ", dict(r))
    print(f"  Найдено записей: {len(records)}")

# П.3 — Простые запросы с фильтрацией
run("Запрос 1 — Статьи категории technology","""
    MATCH (a:Article)-[:IN_CATEGORY]->(c:Category {name: 'technology'})
    RETURN a.title AS title, a.views AS views, a.likes AS likes
""")

run("Запрос 2 — Авторы из USA с рейтингом > 8.0","""
    MATCH (a:Author)
    WHERE a.country = 'USA' AND a.rating > 8.0
    RETURN a.name AS name, a.rating AS rating, a.country AS country
""")

run("Запрос 3 — Статьи с тегом ai","""
    MATCH (a:Article)-[:HAS_TAG]->(t:Tag {name: 'ai'})
    RETURN a.title AS title, a.category AS category
""")

run("Запрос 4 — Источники с надёжностью 9","""
    MATCH (s:Source)
    WHERE s.reliability = 9
    RETURN s.name AS name, s.country AS country
""")

run("Запрос 5 — Статьи опубликованные в Reuters","""
    MATCH (a:Article)-[:PUBLISHED_IN]->(s:Source {name: 'Reuters'})
    RETURN a.title AS title, a.category AS category, a.views AS views
""")

run("Запрос 6 — Авторы работающие в источниках из UK","""
    MATCH (a:Author)-[:WORKS_FOR]->(s:Source)
    WHERE s.country = 'UK'
    RETURN a.name AS name, a.rating AS rating, s.name AS source
""")

# П.4 — Цепочки связей и переменная длина пути
run("Запрос 7 — Авторы связанные через общие теги (цепочка 2 шага)","""
    MATCH (a1:Author)-[:WROTE]->(art1:Article)-[:HAS_TAG]->(t:Tag)<-[:HAS_TAG]-(art2:Article)<-[:WROTE]-(a2:Author)
    WHERE a1 <> a2
    RETURN DISTINCT a1.name AS author1, a2.name AS author2, t.name AS common_tag
    LIMIT 10
""")

run("Запрос 8 — Цепочка переменной длины: от автора до тега через 2-4 шага","""
    MATCH path = (a:Author)-[*2..4]->(t:Tag)
    RETURN a.name AS author, t.name AS tag, length(path) AS steps
    LIMIT 10
""")

# П.5 — Агрегационные запросы
run("Запрос 9 — Количество статей по категориям (COUNT + ORDER BY)","""
    MATCH (a:Article)-[:IN_CATEGORY]->(c:Category)
    RETURN c.name AS category, count(a) AS articles
    ORDER BY articles DESC
""")

run("Запрос 10 — Топ-5 авторов по среднему рейтингу","""
    MATCH (a:Author)-[:WORKS_FOR]->(s:Source)
    RETURN s.name AS source, count(a) AS authors, avg(a.rating) AS avg_rating
    ORDER BY avg_rating DESC
    LIMIT 5
""")

run("Запрос 11 — Теги и список статей с этим тегом (COLLECT)","""
    MATCH (a:Article)-[:HAS_TAG]->(t:Tag)
    RETURN t.name AS tag, count(a) AS count, collect(a.title) AS articles
    ORDER BY count DESC
    LIMIT 5
""")

run("Запрос 12 — Источники и суммарные просмотры их статей","""
    MATCH (a:Article)-[:PUBLISHED_IN]->(s:Source)
    RETURN s.name AS source, count(a) AS articles, sum(a.views) AS total_views
    ORDER BY total_views DESC
""")

run("Запрос 13 — Категории с avg просмотров > 20000","""
    MATCH (a:Article)-[:IN_CATEGORY]->(c:Category)
    WITH c.name AS category, avg(a.views) AS avg_views
    WHERE avg_views > 20000
    RETURN category, round(avg_views) AS avg_views
    ORDER BY avg_views DESC
""")

# П.7 — Общие соседи
run("Запрос 14 — Авторы с общими тегами (сортировка по кол-ву общих связей)","""
    MATCH (a1:Author)-[:WROTE]->(art1:Article)-[:HAS_TAG]->(t:Tag)<-[:HAS_TAG]-(art2:Article)<-[:WROTE]-(a2:Author)
    WHERE a1 <> a2
    RETURN a1.name AS author1, a2.name AS author2, count(DISTINCT t) AS common_tags
    ORDER BY common_tags DESC
    LIMIT 10
""")

# П.8 — Комбинированный запрос
run("Запрос 15 — Топ источников: цепочка автор→статья→источник с фильтрацией и агрегацией","""
    MATCH (a:Author)-[:WROTE]->(art:Article)-[:PUBLISHED_IN]->(s:Source)
    WHERE a.rating > 7.0 AND art.views > 15000
    RETURN s.name AS source,
           count(art) AS articles,
           avg(art.views) AS avg_views,
           collect(DISTINCT a.name) AS authors
    ORDER BY avg_views DESC
    LIMIT 5
""")

driver.close()
print("\n✅ Все запросы выполнены!")