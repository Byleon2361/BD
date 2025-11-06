// fix-all-indexes.js
db = db.getSiblingDB('news_aggregator');

// 1. TEXT INDEX (взвешенный)
db.news.createIndex(
  { 
    title: "text", 
    content: "text", 
    "metadata.tags": "text", 
    "seo.keywords": "text" 
  },
  { 
    name: "text_search_full", 
    weights: { title: 10, "seo.keywords": 5, "metadata.tags": 3, content: 1 },
    default_language: "english"
  }
);

// 2. UNIQUE INDEX по hash
db.news.createIndex(
  { hash: 1 },
  { unique: true, name: "hash_unique" }
);

// 3. TTL INDEX (30 дней)
db.news.createIndex(
  { "metadata.publishDate": 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, name: "ttl_30days" }
);

// 4. ARRAY INDEX (multikey) по тегам
db.news.createIndex(
  { "metadata.tags": 1 },
  { name: "tags_multikey" }
);

// 5. PARTIAL INDEX (только активные статьи)
db.news.createIndex(
  { "metrics.views": 1 },
  { 
    partialFilterExpression: { "metadata.isActive": true },
    name: "partial_active_views"
  }
);

print("All 5 required indexes created!");