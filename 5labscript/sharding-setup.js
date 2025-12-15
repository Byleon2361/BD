// sharding-setup.js (run via mongosh -f sharding-setup.js --host mongos:27017)
sh.enableSharding("news_aggregator");
db.adminCommand({ shardCollection: "news_aggregator.news", key: { _id: "hashed" } });  // Шардинг по category (hashed для равномерности)
db.adminCommand({ shardCollection: "news_aggregator.authors_stats", key: { _id: "hashed" } });  // Добавлено для шардирования stats
db.adminCommand({ shardCollection: "news_aggregator.comments", key: { _id: "hashed" } });  // Добавлено для шардирования comments
print('✅ Sharding enabled on news, authors_stats, comments collections');

// Тесты запросов
print('\n=== SHARDING TESTS ===');
print('Query with shard key (category=technology):');
printjson(db.news.find({ category: "technology" }).explain());

print('Query without shard key (all active):');
printjson(db.news.find({ "metadata.isActive": true }).explain());