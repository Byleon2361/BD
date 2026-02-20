from neo4j import GraphDatabase

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password123")
driver = GraphDatabase.driver(URI, auth=AUTH)

def run(title, sql, cypher_query):
    print(f"\n{'='*60}")
    print(f"📌 {title}")
    print(f"\n🐘 PostgreSQL:\n{sql}")
    print(f"\n🔵 Cypher:")
    with driver.session() as session:
        results = list(session.run(cypher_query))
        if not results:
            print("  (нет результатов)")
        for r in results:
            print(" ", dict(r))
        print(f"  Найдено записей: {len(results)}")

# ── ЗАПРОС 1: Авторы и количество их статей ─────────────────
run(
    "Авторы и статистика по статьям (2 таблицы)",
    """
    SELECT a.first_name, a.last_name,
           COUNT(n.id) as articles_count,
           AVG(n.views_count) as avg_views
    FROM authors a
    LEFT JOIN news n ON a.id = n.author_id
    GROUP BY a.id, a.first_name, a.last_name
    ORDER BY articles_count DESC
    LIMIT 10;
    """,
    """
    MATCH (a:Author)-[:WROTE]->(art:Article)
    RETURN a.name AS author,
           count(art) AS articles_count,
           avg(art.views) AS avg_views
    ORDER BY articles_count DESC
    LIMIT 10
    """
)

# ── ЗАПРОС 2: Статьи с категорией и источником (3 таблицы) ──
run(
    "Статьи с категориями и источниками (3 таблицы)",
    """
    SELECT n.title, c.name as category, s.name as source, n.publish_date
    FROM news n
    JOIN categories c ON n.category_id = c.id
    JOIN sources s ON n.source_id = s.id
    ORDER BY n.publish_date DESC
    LIMIT 15;
    """,
    """
    MATCH (art:Article)-[:IN_CATEGORY]->(c:Category),
          (art)-[:PUBLISHED_IN]->(s:Source)
    RETURN art.title AS title,
           c.name AS category,
           s.name AS source,
           art.publishDate AS publish_date
    ORDER BY publish_date DESC
    LIMIT 15
    """
)

# ── ЗАПРОС 3: Автор + статья + категория + теги (4 таблицы) ─
run(
    "Полная информация: автор, статья, категория, теги (4 таблицы)",
    """
    SELECT n.title, n.views_count,
           c.name as category,
           s.name as source,
           a.first_name || ' ' || a.last_name as author,
           STRING_AGG(DISTINCT t.name, ', ') as tags
    FROM news n
    JOIN categories c ON n.category_id = c.id
    JOIN sources s ON n.source_id = s.id
    JOIN authors a ON n.author_id = a.id
    LEFT JOIN news_tags nt ON n.id = nt.news_id
    LEFT JOIN tags t ON nt.tag_id = t.id
    GROUP BY n.id, n.title, n.views_count, c.name, s.name, a.first_name, a.last_name
    ORDER BY n.views_count DESC
    LIMIT 10;
    """,
    """
    MATCH (a:Author)-[:WROTE]->(art:Article)-[:IN_CATEGORY]->(c:Category),
          (art)-[:PUBLISHED_IN]->(s:Source)
    OPTIONAL MATCH (art)-[:HAS_TAG]->(t:Tag)
    RETURN art.title AS title,
           art.views AS views,
           c.name AS category,
           s.name AS source,
           a.name AS author,
           collect(DISTINCT t.name) AS tags
    ORDER BY views DESC
    LIMIT 10
    """
)

driver.close()
print("\n✅ Сравнение выполнено!")