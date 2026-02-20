from neo4j import GraphDatabase
from datetime import datetime

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password123")
driver = GraphDatabase.driver(URI, auth=AUTH)

def run(query):
    with driver.session() as session:
        return list(session.run(query))

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

print(f"\n🖥️  NEO4J MONITORING REPORT")
print(f"📅  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

# ── 1. ОБЩАЯ СТАТИСТИКА ГРАФА ──────────────────────────────
section("📊 СТАТИСТИКА ГРАФА")
results = run("""
    CALL apoc.meta.stats()
    YIELD labels, relTypesCount, propertyKeyCount
    RETURN labels, relTypesCount, propertyKeyCount
""")
r = results[0]
labels = r["labels"]
rels = r["relTypesCount"]
print(f"\n  Узлы:")
for label, count in sorted(labels.items(), key=lambda x: -x[1]):
    print(f"    {label:<15} {count} шт.")
print(f"\n  Связи:")
for rel, count in sorted(rels.items(), key=lambda x: -x[1]):
    print(f"    {rel:<20} {count} шт.")
print(f"\n  Всего свойств: {r['propertyKeyCount']}")

# ── 2. ОБЩЕЕ КОЛИЧЕСТВО УЗЛОВ И СВЯЗЕЙ ────────────────────
section("🔢 ИТОГО В БАЗЕ")
nodes = run("MATCH (n) RETURN count(n) AS count")[0]["count"]
rels_count = run("MATCH ()-[r]->() RETURN count(r) AS count")[0]["count"]
print(f"\n  Всего узлов:  {nodes}")
print(f"  Всего связей: {rels_count}")

# ── 3. НАСТРОЙКИ ПАМЯТИ ────────────────────────────────────
section("💾 НАСТРОЙКИ ПАМЯТИ")
results = run("""
    CALL dbms.listConfig()
    YIELD name, value
    WHERE name IN [
        'server.memory.heap.initial_size',
        'server.memory.heap.max_size',
        'server.memory.pagecache.size'
    ]
    RETURN name, value
""")
if results:
    for r in results:
        print(f"  {r['name']:<45} {r['value']}")
else:
    print("  heap.initial_size:  512m (из docker-compose)")
    print("  heap.max_size:      1G   (из docker-compose)")

# ── 4. АКТИВНЫЕ ТРАНЗАКЦИИ ────────────────────────────────
section("⚡ АКТИВНЫЕ ТРАНЗАКЦИИ")
results = run("SHOW TRANSACTIONS")
print(f"\n  Активных транзакций: {len(results)}")
for r in results:
    print(f"  - {dict(r)}")

# ── 5. ИНДЕКСЫ ИCONSTRAINTЫ ──────────────────────────────
section("🔍 ИНДЕКСЫ")
results = run("SHOW INDEXES YIELD name, state, type, labelsOrTypes, properties")
for r in results:
    state = "✅" if r["state"] == "ONLINE" else "⚠️"
    print(f"  {state} {r['name']:<30} {r['type']:<10} {str(r['labelsOrTypes'])}")

section("🔒 ОГРАНИЧЕНИЯ (CONSTRAINTS)")
results = run("SHOW CONSTRAINTS YIELD name, type, labelsOrTypes, properties")
for r in results:
    print(f"  ✅ {r['name']:<30} {r['type']}")

# ── 6. ТОП СТАТЕЙ ПО ПРОСМОТРАМ ───────────────────────────
section("📈 ТОП-5 СТАТЕЙ ПО ПРОСМОТРАМ")
results = run("""
    MATCH (a:Article)
    RETURN a.title AS title, a.views AS views, a.category AS category
    ORDER BY views DESC LIMIT 5
""")
for i, r in enumerate(results, 1):
    print(f"  {i}. [{r['category']}] {r['title'][:45]} — {r['views']} views")

# ── 7. САМЫЕ АКТИВНЫЕ АВТОРЫ ──────────────────────────────
section("✍️  ТОП-5 АВТОРОВ ПО КОЛИЧЕСТВУ СТАТЕЙ")
results = run("""
    MATCH (a:Author)-[:WROTE]->(art:Article)
    RETURN a.name AS author, count(art) AS articles, avg(art.views) AS avg_views
    ORDER BY articles DESC, avg_views DESC
    LIMIT 5
""")
for i, r in enumerate(results, 1):
    print(f"  {i}. {r['author']:<30} {r['articles']} статей, avg views: {int(r['avg_views'])}")

# ── 8. ЗДОРОВЬЕ БД ────────────────────────────────────────
section("🏥 СОСТОЯНИЕ БАЗЫ ДАННЫХ")
results = run("SHOW DATABASES")
for r in results:
    d = dict(r)
    status = "✅" if d.get("currentStatus") == "online" else "⚠️"
    print(f"  {status} БД: {d.get('name'):<15} Статус: {d.get('currentStatus')}")

driver.close()
print(f"\n{'='*60}")
print(f"✅ Мониторинг завершён: {datetime.now().strftime('%H:%M:%S')}")
print(f"{'='*60}\n")