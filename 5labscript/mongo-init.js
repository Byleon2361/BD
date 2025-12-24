db = db.getSiblingDB('news_aggregator');

print('=== MONGODB INITIALIZATION - INDEXES & USERS ===');

// 1. User
db.createUser({
  user: 'news_user',
  pwd: 'news_password123',
  roles: [{ role: 'readWrite', db: 'news_aggregator' }, { role: 'dbAdmin', db: 'news_aggregator' }]
});
print('✅ Application user created');

// 2. Indexes (БЕЗ unique на hash — он конфликтует с hashed shard key)
print('Creating indexes...');

db.news.createIndex({ "category": 1, "metadata.publishDate": -1 });
db.news.createIndex({ "metadata.publishDate": -1 });
db.news.createIndex({ "source.name": 1 });
db.news.createIndex({ "author.email": 1 });
db.news.createIndex({ "metrics.views": -1 });

// Текстовый индекс — обязателен для $text поиска
db.news.createIndex({
    title: "text",
    content: "text",
    "metadata.tags": "text"
}, { name: "text_search_index" });

db.authors_stats.createIndex({ "authorName": 1 }, { unique: true });
db.authors_stats.createIndex({ "totalViews": -1 });

db.categories.createIndex({ "name": 1 }, { unique: true });

print('✅ All required indexes created');

// 3. Schema validation — УСИЛЕННАЯ
print('\n=== SETTING UP SCHEMA VALIDATION ===');

db.runCommand({
    collMod: "news",
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["title", "category", "metrics"],
            properties: {
                title: { bsonType: "string" },
                category: {
                    enum: ["politics", "sports", "technology", "entertainment", "business", "health", "science"]
                },
                metrics: {
                    bsonType: "object",
                    required: ["views"],
                    properties: {
                        views: { bsonType: ["int", "long", "double", "decimal"], minimum: 0 }
                    }
                },
                "metadata.tags": {
                    bsonType: "array",
                    items: { bsonType: "string" }
                }
            }
        }
    },
    validationLevel: "strict",
    validationAction: "error"
});

print('✅ Schema validation applied (required fields, enum category, views >= 0, tags array of strings)');