// mongo-init.js
db = db.getSiblingDB('news_aggregator');

print('=== MONGODB INITIALIZATION - INDEXES & USERS ===');

// 1. СОЗДАЕМ ПОЛЬЗОВАТЕЛЯ ПРИЛОЖЕНИЯ
db.createUser({
  user: 'news_user',
  pwd: 'news_password123',
  roles: [
    { role: 'readWrite', db: 'news_aggregator' },
    { role: 'dbAdmin', db: 'news_aggregator' }
  ]
});
print('✅ Application user created');

// 2. СОЗДАЕМ ИНДЕКСЫ
print('Creating indexes...');

// Основная коллекция: news
db.news.createIndex({ "hash": 1 }, { unique: true });
db.news.createIndex({ "category": 1, "metadata.publishDate": -1 });
db.news.createIndex({ "metadata.publishDate": -1 });
db.news.createIndex({ "source.name": 1 });
db.news.createIndex({ "author.email": 1 });
db.news.createIndex({ "metrics.views": -1 });
// Текстовый индекс для полнотекстового поиска
db.news.createIndex({ 
    "title": "text", 
    "content": "text",
    "metadata.tags": "text"
});

// Коллекция авторов: authors_stats
db.authors_stats.createIndex({ "authorName": 1 }, { unique: true });
db.authors_stats.createIndex({ "totalViews": -1 });

// Вспомогательная: categories
db.categories.createIndex({ "name": 1 }, { unique: true });

print('✅ All indexes created successfully');
print('🚀 MongoDB is ready for seed data');