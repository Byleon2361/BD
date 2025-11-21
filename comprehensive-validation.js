// comprehensive-validation.js
db = db.getSiblingDB('news_aggregator');

print('=== COMPREHENSIVE MONGODB NEWS AGGREGATOR VALIDATION ===');

let validationResults = {};

// 1. ПРОВЕРКА БАЗОВЫХ СТРУКТУР
print('\n📁 1. DATABASE STRUCTURE CHECK:');

// Коллекции
const collections = db.getCollectionNames();
validationResults.collections = collections.length >= 3; // news + 2 другие
print(`   ✅ Collections: ${collections.join(', ')}`);

// Документы в основных коллекциях
const newsCount = db.news.countDocuments();
const authorsStatsCount = db.authors_stats.countDocuments();
const categoriesCount = db.categories.countDocuments();
const commentsCount = db.comments.countDocuments();

validationResults.documentsCount = (newsCount + authorsStatsCount + categoriesCount + commentsCount) >= 500;
print(`   📰 News: ${newsCount} documents`);
print(`   👤 Authors Stats: ${authorsStatsCount} documents`);
print(`   📂 Categories: ${categoriesCount} documents`);
print(`   💬 Comments: ${commentsCount} documents`);
print(`   🎯 TOTAL: ${newsCount + authorsStatsCount + categoriesCount + commentsCount} documents`);

// 2. ПРОВЕРКА ИНДЕКСОВ
print('\n🔍 2. INDEXES CHECK:');

const newsIndexes = db.news.getIndexes();
validationResults.indexes = newsIndexes.length > 1; // Должен быть минимум _id + другие

print(`   News indexes: ${newsIndexes.length}`);
newsIndexes.forEach(idx => {
    print(`     - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(unique)' : ''} ${idx.expireAfterSeconds ? `(TTL: ${idx.expireAfterSeconds}s)` : ''}`);
});

// Проверяем специфические индексы
const hasTextIndex = newsIndexes.some(idx => idx.textIndexVersion);
const hasUniqueIndex = newsIndexes.some(idx => idx.unique);
const hasTTLIndex = newsIndexes.some(idx => idx.expireAfterSeconds);
const hasArrayIndex = newsIndexes.some(idx => idx.key && idx.key["metadata.tags"]);
const hasPartialIndex = newsIndexes.some(idx => idx.partialFilterExpression);
validationResults.specialIndexes = hasTextIndex && hasUniqueIndex && hasTTLIndex && hasArrayIndex && hasPartialIndex;
print(`   ✅ Text Index: ${hasTextIndex}`);
print(`   ✅ Unique Index: ${hasUniqueIndex}`);
print(`   ✅ TTL Index: ${hasTTLIndex}`);
print(`   ✅ Array Index: ${hasArrayIndex}`);
print(`   ✅ Partial Index: ${hasPartialIndex}`);
const hashIndex = newsIndexes.find(idx => idx.key && idx.key.hash);
if (hashIndex) {
    print(`   🔍 Hash Index Details: ${hashIndex.unique ? 'UNIQUE' : 'non-unique'} ${hashIndex.sparse ? 'SPARSE' : ''}`);
} else {
    print(`   ❌ Hash Index: NOT FOUND (deduplication will not work)`);
}
// 3. ПРОВЕРКА БАЗОВЫХ ОПЕРАЦИЙ
print('\n⚡ 3. BASIC OPERATIONS CHECK:');

try {
    // INSERT
    const testDoc = {
        title: "Validation Test Article",
        content: "Test content for validation",
        hash: "validation_test_" + Date.now(),
        category: "technology",
        author: { firstName: "Test", lastName: "User", email: "test@test.com" },
        metrics: { views: 0, likes: 0, shares: 0 },
        metadata: { publishDate: new Date(), isActive: true, tags: ["test"] }
    };
    
    const insertResult = db.news.insertOne(testDoc);
    print('   ✅ insertOne: OK');
    
    // UPDATE с $set
    db.news.updateOne(
        { _id: insertResult.insertedId },
        { $set: { "metrics.views": 100, "metadata.isFeatured": true } }
    );
    print('   ✅ updateOne with $set: OK');
    
    // UPDATE с $inc
    db.news.updateOne(
        { _id: insertResult.insertedId },
        { $inc: { "metrics.views": 50 } }
    );
    print('   ✅ updateOne with $inc: OK');
    
    // UPDATE с $push
    db.news.updateOne(
        { _id: insertResult.insertedId },
        { $push: { "metadata.tags": "validation" } }
    );
    print('   ✅ updateOne with $push: OK');
    
    // SEARCH с фильтрами
    const searchResults = db.news.find({
        $and: [
            { category: { $in: ["technology", "science"] } },
            { "metrics.views": { $gt: 10 } }
        ]
    }).limit(1).count();
    print('   ✅ Search with $and/$in/$gt: OK');
    
    // PROJECTION
    const projected = db.news.find(
        { _id: insertResult.insertedId },
        { title: 1, category: 1, "metrics.views": 1, _id: 0 }
    ).toArray();
    print('   ✅ Projection: OK');
    
    // DELETE
    db.news.deleteOne({ _id: insertResult.insertedId });
    print('   ✅ deleteOne: OK');
    
    validationResults.basicOperations = true;
} catch (e) {
    validationResults.basicOperations = false;
    print(`   ❌ Basic operations failed: ${e.message}`);
}

// 4. ПРОВЕРКА AGGRECATION PIPELINES
print('\n🔄 4. AGGREGATION PIPELINES CHECK:');

try {
    // Простой pipeline с обязательными стадиями
    const pipeline1 = [
        { $match: { "metadata.isActive": true } },
        { $unwind: "$metadata.tags" },
        { $group: { _id: "$metadata.tags", count: { $sum: 1 } } },
        { $project: { tag: "$_id", count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ];
    
    const result1 = db.news.aggregate(pipeline1).toArray();
    print(`   ✅ Basic pipeline with all required stages: ${result1.length} results`);
    
    // Pipeline с $lookup
    const pipeline2 = [
        { $match: { "metadata.isActive": true } },
        { $group: { 
            _id: "$author.email", 
            authorName: { $first: { $concat: ["$author.firstName", " ", "$author.lastName"] } },
            articlesCount: { $sum: 1 } 
        }},
        { $lookup: {
            from: "authors_stats",
            localField: "authorName", 
            foreignField: "authorName",
            as: "authorStats"
        }},
        { $unwind: { path: "$authorStats", preserveNullAndEmptyArrays: true } },
        { $project: { 
            authorName: 1, 
            articlesCount: 1,
            totalViews: "$authorStats.totalViews"
        }},
        { $sort: { articlesCount: -1 } },
        { $limit: 3 }
    ];
    
    const result2 = db.news.aggregate(pipeline2).toArray();
    print(`   ✅ Pipeline with $lookup: ${result2.length} results`);
    
    validationResults.aggregations = result1.length > 0 && result2.length > 0;
} catch (e) {
    validationResults.aggregations = false;
    print(`   ❌ Aggregations failed: ${e.message}`);
}

print('\n🎯 5. SPECIAL FEATURES CHECK:');

// Текстовый поиск
try {
    const textResults = db.news.find(
        { $text: { $search: "technology" } },
        { score: { $meta: "textScore" } }
    ).limit(1).toArray();
    validationResults.textSearch = textResults.length > 0;
    print(`   ✅ Text search: ${textResults.length > 0 ? 'Working' : 'No results'}`);
} catch (e) {
    validationResults.textSearch = false;
    print(`   ❌ Text search: ${e.message}`);
}

// ПРАВИЛЬНАЯ ПРОВЕРКА ДЕДУПЛИКАЦИИ
try {
    // 1. Сначала проверяем, что существует уникальный индекс на поле hash
    const hashIndex = newsIndexes.find(idx => 
        idx.key && idx.key.hash && idx.unique
    );
    
    if (!hashIndex) {
        validationResults.deduplication = false;
        print('   ❌ Deduplication: No unique index on hash field');
    } else {
        print('   ✅ Unique index on hash field: Found');
        
        // 2. Проверяем, что нет существующих дубликатов
        const existingDuplicates = db.news.aggregate([
            { $group: { _id: "$hash", count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $limit: 1 }
        ]).toArray();
        
        if (existingDuplicates.length > 0) {
            validationResults.deduplication = false;
            print(`   ❌ Deduplication: Found ${existingDuplicates.length} existing duplicate groups`);
        } else {
            print('   ✅ No existing duplicates found');
            
            // 3. Тестируем механизм дедупликации, пытаясь вставить дубликат
            const testHash = "dedup_test_" + Date.now();
            const testDoc1 = {
                title: "Deduplication Test 1",
                content: "Test content 1",
                hash: testHash,
                category: "technology",
                author: { firstName: "Test", lastName: "User" },
                metadata: { publishDate: new Date() }
            };
            
            const testDoc2 = {
                title: "Deduplication Test 2", 
                content: "Test content 2",
                hash: testHash, // Тот же hash!
                category: "technology",
                author: { firstName: "Test", lastName: "User" },
                metadata: { publishDate: new Date() }
            };
            
            // Вставляем первый документ
            const firstInsert = db.news.insertOne(testDoc1);
            print('   ✅ First document inserted successfully');
            
            // Пытаемся вставить второй документ с тем же hash
            try {
                db.news.insertOne(testDoc2);
                validationResults.deduplication = false;
                print('   ❌ Deduplication FAILED: Second document with same hash was inserted');
            } catch (e) {
                if (e.code === 11000) { // MongoDB duplicate key error
                    validationResults.deduplication = true;
                    print('   ✅ Deduplication WORKING: Second document correctly rejected (duplicate key error)');
                } else {
                    validationResults.deduplication = false;
                    print(`   ❌ Deduplication: Unexpected error: ${e.message}`);
                }
            }
            
            // Убираем тестовые документы
            db.news.deleteOne({ _id: firstInsert.insertedId });
        }
    }
} catch (e) {
    validationResults.deduplication = false;
    print(`   ❌ Deduplication check failed: ${e.message}`);
}


// 6. ПРОВЕРКА ВИТРИНЫ ДАННЫХ
print('\n📊 6. DATA MART CHECK:');

const dataMartExists = collections.includes('authors_daily_stats') || collections.includes('daily_stats');
if (dataMartExists) {
    const dataMartName = collections.includes('authors_daily_stats') ? 'authors_daily_stats' : 'daily_stats';
    const dataMartCount = db[dataMartName].countDocuments();
    validationResults.dataMart = dataMartCount > 0;
    print(`   ✅ Data mart "${dataMartName}": ${dataMartCount} records`);
} else {
    validationResults.dataMart = false;
    print('   ❌ No data mart found');
}

// 7. ПРОВЕРКА EXPLAIN И ПРОИЗВОДИТЕЛЬНОСТИ
print('\n⚡ 7. PERFORMANCE CHECK:');

try {
    const explainResult = db.news.find({ category: "technology" }).explain("executionStats");
    validationResults.explain = true;
    print(`   ✅ Explain works: ${explainResult.executionStats.executionTimeMillis}ms`);
    print(`   ✅ Documents examined: ${explainResult.executionStats.totalDocsExamined}`);
} catch (e) {
    validationResults.explain = false;
    print(`   ❌ Explain failed: ${e.message}`);
}

// 8. ИТОГОВАЯ СТАТИСТИКА
print('\n📋 VALIDATION SUMMARY:');
print('=====================');

const requirements = [
    { name: 'Database Structure', result: validationResults.collections },
    { name: '500+ Documents', result: validationResults.documentsCount },
    { name: 'Indexes Created', result: validationResults.indexes },
    { name: 'Special Indexes', result: validationResults.specialIndexes },
    { name: 'Basic Operations', result: validationResults.basicOperations },
    { name: 'Aggregation Pipelines', result: validationResults.aggregations },
    { name: 'Text Search', result: validationResults.textSearch },
    { name: 'Deduplication', result: validationResults.deduplication },
    { name: 'Data Mart', result: validationResults.dataMart },
    { name: 'Performance Analysis', result: validationResults.explain }
];

let passed = 0;
requirements.forEach(req => {
    const status = req.result ? '✅' : '❌';
    print(`   ${status} ${req.name}`);
    if (req.result) passed++;
});

print(`\n🎯 RESULTS: ${passed}/${requirements.length} requirements passed`);

if (passed === requirements.length) {
    print('\n🎉 ALL REQUIREMENTS COMPLETED SUCCESSFULLY!');
    print('=========================================');
    print('🚀 MongoDB News Aggregator is fully operational!');
} else {
    print('\n⚠️  SOME REQUIREMENTS NEED ATTENTION');
    print('=================================');
    print('Check the failed items above and run the corresponding scripts.');
}

// 9. ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ REST API (если нужно)
print('\n🌐 8. REST API READINESS CHECK:');

// Проверяем наличие необходимых данных для API endpoints
const apiReadiness = {
    topNews: db.news.countDocuments({ "metadata.isActive": true }) > 0,
    categories: db.categories.countDocuments() > 0,
    authors: db.authors_stats.countDocuments() > 0,
    search: db.news.countDocuments({ $text: { $search: "technology" } }) > 0
};

print(`   ✅ Top news endpoint: ${apiReadiness.topNews ? 'Ready' : 'No data'}`);
print(`   ✅ Categories endpoint: ${apiReadiness.categories ? 'Ready' : 'No data'}`);
print(`   ✅ Authors endpoint: ${apiReadiness.authors ? 'Ready' : 'No data'}`);
print(`   ✅ Search endpoint: ${apiReadiness.search ? 'Ready' : 'No data'}`);

print('\n=== VALIDATION COMPLETED ===');