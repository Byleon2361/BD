// sharding-setup.js (run via mongosh -f sharding-setup.js --host mongos:27017)
sh.enableSharding("news_aggregator");
db.adminCommand({ shardCollection: "news_aggregator.news", key: { category: "hashed" } });  // Шардинг по category (hashed для равномерности)
print('✅ Sharding enabled on news collection by category');

// Тесты запросов
print('\n=== SHARDING TESTS ===');
print('Query with shard key (category=technology):');
printjson(db.news.find({ category: "technology" }).explain());

print('Query without shard key (all active):');
printjson(db.news.find({ "metadata.isActive": true }).explain());