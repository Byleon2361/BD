// performance-benchmark.js

print("=== MONGODB QUERY PERFORMANCE BENCHMARK ===");

// Функция для красивого вывода статистики
function printStats(explainResult, queryName) {
    const stats = explainResult.executionStats;
    print(`\n📊 ${queryName}`);
    print(`----------------------------------------`);
    print(`Execution Time: ${stats.executionTimeMillis} ms`);
    print(`Documents Examined: ${stats.totalDocsExamined}`);
    print(`Documents Returned: ${stats.nReturned}`);
    print(`Index Used: ${stats.executionStages?.stage || 'COLLSCAN'}`);
    print(`Index Name: ${stats.executionStages?.indexName || 'None'}`);
}

// УДАЛЯЕМ ВСЕ ИНДЕКСЫ ДЛЯ ЧИСТОГО ТЕСТА "ДО"
print("\n🗑️ Removing all indexes for clean 'BEFORE' test...");
db.news.dropIndexes();

// ТЕСТ 1: ЗАПРОС ПО КАТЕГОРИИ И ДАТЕ
print("\n🔍 TEST 1: Query by Category and Date");

print("\n📝 BEFORE INDEXES:");
const query1 = {
    "category": "technology",
    "metadata.publishDate": { $gte: new Date("2024-01-01") }
};
const explainBefore1 = db.news.find(query1).explain("executionStats");
printStats(explainBefore1, "Category + Date Query (BEFORE)");

// ТЕСТ 2: ЗАПРОС С СОРТИРОВКОЙ ПО ПРОСМОТРАМ
print("\n🔍 TEST 2: Query with Views Sorting");

print("\n📝 BEFORE INDEXES:");
const query2 = {
    "metadata.isActive": true,
    "metrics.views": { $gt: 1000 }
};
const explainBefore2 = db.news.find(query2).sort({ "metrics.views": -1 }).explain("executionStats");
printStats(explainBefore2, "Active Articles by Views (BEFORE)");

// ТЕСТ 3: ЗАПРОС ПО ТЕГАМ (МАССИВ)
print("\n🔍 TEST 3: Query by Tags (Array)");

print("\n📝 BEFORE INDEXES:");
const query3 = {
    "metadata.tags": "ai"
};
const explainBefore3 = db.news.find(query3).explain("executionStats");
printStats(explainBefore3, "Tag Search (BEFORE)");

// СОЗДАЕМ ИНДЕКСЫ
print("\n⚡ CREATING INDEXES...");

// Индекс для теста 1
db.news.createIndex({ 
    "category": 1, 
    "metadata.publishDate": -1 
});
print("✅ Created index: { category: 1, publishDate: -1 }");

// Индекс для теста 2
db.news.createIndex({
    "metadata.isActive": 1,
    "metrics.views": -1
});
print("✅ Created index: { isActive: 1, views: -1 }");

// Индекс для теста 3
db.news.createIndex({ "metadata.tags": 1 });
print("✅ Created index: { tags: 1 }");

// ТЕСТИРУЕМ ПОСЛЕ СОЗДАНИЯ ИНДЕКСОВ
print("\n🔍 AFTER INDEXES:");

// Тест 1 после индексов
const explainAfter1 = db.news.find(query1).explain("executionStats");
printStats(explainAfter1, "Category + Date Query (AFTER)");

// Тест 2 после индексов
const explainAfter2 = db.news.find(query2).sort({ "metrics.views": -1 }).explain("executionStats");
printStats(explainAfter2, "Active Articles by Views (AFTER)");

// Тест 3 после индексов
const explainAfter3 = db.news.find(query3).explain("executionStats");
printStats(explainAfter3, "Tag Search (AFTER)");

// ВЫВОД РЕЗУЛЬТАТОВ
print("\n🎯 PERFORMANCE COMPARISON RESULTS:");
print("===================================");

// Сравнение Test 1
const improvement1 = explainBefore1.executionStats.executionTimeMillis - explainAfter1.executionStats.executionTimeMillis;
print(`\n📈 Test 1 Improvement: ${improvement1}ms faster`);
print(`   Documents examined: ${explainBefore1.executionStats.totalDocsExamined} → ${explainAfter1.executionStats.totalDocsExamined}`);

// Сравнение Test 2
const improvement2 = explainBefore2.executionStats.executionTimeMillis - explainAfter2.executionStats.executionTimeMillis;
print(`\n📈 Test 2 Improvement: ${improvement2}ms faster`);
print(`   Documents examined: ${explainBefore2.executionStats.totalDocsExamined} → ${explainAfter2.executionStats.totalDocsExamined}`);

// Сравнение Test 3
const improvement3 = explainBefore3.executionStats.executionTimeMillis - explainAfter3.executionStats.executionTimeMillis;
print(`\n📈 Test 3 Improvement: ${improvement3}ms faster`);
print(`   Documents examined: ${explainBefore3.executionStats.totalDocsExamined} → ${explainAfter3.executionStats.totalDocsExamined}`);

print("\n✅ BENCHMARK COMPLETED!");