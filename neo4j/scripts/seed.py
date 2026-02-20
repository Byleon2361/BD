from neo4j import GraphDatabase

URI = "bolt://localhost:7687"
AUTH = ("neo4j", "password123")

driver = GraphDatabase.driver(URI, auth=AUTH)

def run(query, params=None):
    with driver.session() as session:
        session.run(query, params or {})

# ── КАТЕГОРИИ ──────────────────────────────────────────────
categories = [
    {"name": "politics",       "description": "Politics news",       "featured": True},
    {"name": "sports",         "description": "Sports news",         "featured": True},
    {"name": "technology",     "description": "Technology news",     "featured": True},
    {"name": "entertainment",  "description": "Entertainment news",  "featured": False},
    {"name": "business",       "description": "Business news",       "featured": False},
    {"name": "health",         "description": "Health news",         "featured": False},
    {"name": "science",        "description": "Science news",        "featured": False},
]
for c in categories:
    run("MERGE (c:Category {name: $name}) SET c.description=$description, c.featured=$featured", c)
print("✅ Categories done")

# ── ИСТОЧНИКИ ──────────────────────────────────────────────
sources = [
    {"name": "Reuters",          "website": "https://reuters.com",      "country": "International", "reliability": 9},
    {"name": "BBC News",         "website": "https://bbc.com",          "country": "UK",            "reliability": 9},
    {"name": "CNN",              "website": "https://cnn.com",          "country": "USA",           "reliability": 8},
    {"name": "Al Jazeera",       "website": "https://aljazeera.com",    "country": "Qatar",         "reliability": 8},
    {"name": "Associated Press", "website": "https://apnews.com",       "country": "USA",           "reliability": 9},
    {"name": "The Guardian",     "website": "https://theguardian.com",  "country": "UK",            "reliability": 8},
]
for s in sources:
    run("MERGE (s:Source {name: $name}) SET s.website=$website, s.country=$country, s.reliability=$reliability", s)
print("✅ Sources done")

# ── ТЕГИ ───────────────────────────────────────────────────
tags = ["ai","innovation","digital","football","championship",
        "election","policy","economy","finance","movies",
        "awards","medicine","research","space","climate","breaking","analysis"]
for t in tags:
    run("MERGE (:Tag {name: $name})", {"name": t})
print("✅ Tags done")

# ── АВТОРЫ ─────────────────────────────────────────────────
import random
countries = ["USA","UK","Germany","France","Japan","Canada","Australia","Brazil","India"]
source_names = [s["name"] for s in sources]

authors = []
for i in range(1, 26):
    authors.append({
        "email":   f"author{i}@news.com",
        "name":    f"Author_{i} LastName_{i}",
        "rating":  round(random.uniform(6.5, 9.5), 1),
        "country": random.choice(countries),
    })
for a in authors:
    run("MERGE (a:Author {email: $email}) SET a.name=$name, a.rating=$rating, a.country=$country", a)

# Авторы работают в источниках
roles = ["senior", "staff", "freelance"]
for i, a in enumerate(authors):
    run("""
        MATCH (a:Author {email: $email}), (s:Source {name: $source})
        MERGE (a)-[:WORKS_FOR {since: $since, role: $role}]->(s)
    """, {
        "email":  a["email"],
        "source": source_names[i % len(source_names)],
        "since":  random.randint(2015, 2022),
        "role":   random.choice(roles),
    })
print("✅ Authors done")

# ── СТАТЬИ ─────────────────────────────────────────────────
cat_tags = {
    "politics":      ["election", "policy", "breaking", "analysis"],
    "sports":        ["football", "championship", "breaking"],
    "technology":    ["ai", "innovation", "digital"],
    "entertainment": ["movies", "awards"],
    "business":      ["economy", "finance", "analysis"],
    "health":        ["medicine", "research"],
    "science":       ["space", "research", "climate"],
}
cat_list = [c["name"] for c in categories]
style = ["Breaking", "Exclusive", "Latest", "Special"]
kind  = ["Report", "Analysis", "Coverage", "Update"]

articles = []
for i in range(1, 51):
    cat = cat_list[(i - 1) % len(cat_list)]
    articles.append({
        "id":          f"art{i}",
        "title":       f"{cat.capitalize()} News {i}: {random.choice(style)} {random.choice(kind)}",
        "category":    cat,
        "views":       random.randint(5000, 60000),
        "likes":       random.randint(200, 4000),
        "shares":      random.randint(50, 1200),
        "publishDate": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
    })

for art in articles:
    run("""
        MERGE (a:Article {id: $id})
        SET a.title=$title, a.category=$category,
            a.views=$views, a.likes=$likes,
            a.shares=$shares, a.publishDate=$publishDate
    """, art)
print("✅ Articles done")

# ── СВЯЗИ: WROTE ───────────────────────────────────────────
for i, art in enumerate(articles):
    author_email = authors[i % len(authors)]["email"]
    run("""
        MATCH (a:Author {email: $email}), (art:Article {id: $id})
        MERGE (a)-[:WROTE {publishedAt: $date}]->(art)
    """, {"email": author_email, "id": art["id"], "date": art["publishDate"]})
print("✅ WROTE relations done")

# ── СВЯЗИ: PUBLISHED_IN ────────────────────────────────────
sections = ["world", "sport", "tech", "business", "health", "science", "culture"]
for i, art in enumerate(articles):
    run("""
        MATCH (art:Article {id: $id}), (s:Source {name: $source})
        MERGE (art)-[:PUBLISHED_IN {section: $section}]->(s)
    """, {
        "id":      art["id"],
        "source":  source_names[i % len(source_names)],
        "section": sections[i % len(sections)],
    })
print("✅ PUBLISHED_IN relations done")

# ── СВЯЗИ: IN_CATEGORY ─────────────────────────────────────
for art in articles:
    run("""
        MATCH (art:Article {id: $id}), (c:Category {name: $cat})
        MERGE (art)-[:IN_CATEGORY]->(c)
    """, {"id": art["id"], "cat": art["category"]})
print("✅ IN_CATEGORY relations done")

# ── СВЯЗИ: HAS_TAG ─────────────────────────────────────────
for art in articles:
    for tag in random.sample(cat_tags[art["category"]], k=min(2, len(cat_tags[art["category"]]))):
        run("""
            MATCH (art:Article {id: $id}), (t:Tag {name: $tag})
            MERGE (art)-[:HAS_TAG]->(t)
        """, {"id": art["id"], "tag": tag})
print("✅ HAS_TAG relations done")

driver.close()
print("\n🎉 Seed complete!")