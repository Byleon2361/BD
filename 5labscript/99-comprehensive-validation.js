// comprehensive-validation-sha256-fixed.js
db = db.getSiblingDB('news_aggregator');
print("Waiting 10 seconds for seed data to load...");
sleep(10000); // 10 секунд — с запасом
print("Starting validation...");

print('=== COMPREHENSIVE MONGODB NEWS AGGREGATOR VALIDATION ===');

let validationResults = {};

// Функция для создания хеша заголовка (упрощенная версия)
function generateTitleHash(title) {
    // Простая хеш-функция для демонстрации
    // В продакшене лучше использовать криптографические библиотеки на стороне
    // приложения
    let hash = 0;
    const normalizedTitle = title.toLowerCase().trim();

    for (let i = 0; i < normalizedTitle.length; i++) {
        const char = normalizedTitle.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
}

// Альтернативная функция для проверки существующих хешей
function checkExistingHashType() {
    const sampleDoc =
        db.news.findOne({titleHash : {$exists : true}}, {titleHash : 1});
    if (sampleDoc && sampleDoc.titleHash) {
        return {
            length : sampleDoc.titleHash.length,
            type : sampleDoc.titleHash.length === 32   ? 'MD5'
                   : sampleDoc.titleHash.length === 64 ? 'SHA256'
                                                       : 'Custom'
        };
    }
    return null;
}

// 1. ПРОВЕРКА БАЗОВЫХ СТРУКТУР
print('\n1. DATABASE STRUCTURE CHECK:');

// Коллекции
const collections = db.getCollectionNames();
validationResults.collections = collections.length >= 3;
print('   Collections: ' + collections.join(', '));

// Документы в основных коллекциях
const newsCount = db.news.countDocuments();
const authorsStatsCount = db.authors_stats.countDocuments();
const categoriesCount = db.categories.countDocuments();
const commentsCount = db.comments.countDocuments();

validationResults.documentsCount =
    (newsCount + authorsStatsCount + categoriesCount + commentsCount) >= 500;
print('   News: ' + newsCount + ' documents');
print('   Authors Stats: ' + authorsStatsCount + ' documents');
print('   Categories: ' + categoriesCount + ' documents');
print('   Comments: ' + commentsCount + ' documents');
print('   TOTAL: ' +
      (newsCount + authorsStatsCount + categoriesCount + commentsCount) +
      ' documents');

// 2. ПРОВЕРКА ИНДЕКСОВ
print('\n2. INDEXES CHECK:');

const newsIndexes = db.news.getIndexes();
validationResults.indexes = newsIndexes.length > 1;

print('   News indexes: ' + newsIndexes.length);
newsIndexes.forEach(idx => {
    print('     - ' + idx.name + ': ' + JSON.stringify(idx.key) +
          (idx.unique ? ' (unique)' : '') +
          (idx.expireAfterSeconds ? ' (TTL: ' + idx.expireAfterSeconds + 's)'
                                  : ''));
});

// Проверяем специфические индексы
const hasTextIndex = newsIndexes.some(idx => idx.textIndexVersion);
const hasUniqueIndex = newsIndexes.some(idx => idx.unique);
const hasTTLIndex = newsIndexes.some(idx => idx.expireAfterSeconds);
const hasArrayIndex =
    newsIndexes.some(idx => idx.key && idx.key["metadata.tags"]);
const hasPartialIndex = newsIndexes.some(idx => idx.partialFilterExpression);
validationResults.specialIndexes = hasTextIndex && hasUniqueIndex &&
                                   hasTTLIndex && hasArrayIndex &&
                                   hasPartialIndex;
print('   Text Index: ' + hasTextIndex);
print('   Unique Index: ' + hasUniqueIndex);
print('   TTL Index: ' + hasTTLIndex);
print('   Array Index: ' + hasArrayIndex);
print('   Partial Index: ' + hasPartialIndex);

// Проверяем наличие titleHash индекса
const titleHashIndex = newsIndexes.find(idx => idx.key && idx.key.titleHash);
if (titleHashIndex) {
    print('   TitleHash Index: ' +
          (titleHashIndex.unique ? 'UNIQUE' : 'non-unique'));
    validationResults.titleHashIndex = titleHashIndex.unique;

    // Проверяем тип существующих хешей
    const hashInfo = checkExistingHashType();
    if (hashInfo) {
        print('   Existing hash length: ' + hashInfo.length + ' chars');
        print('   🔍 Hash type: ' + hashInfo.type);

        // Если хеши уже есть и они 64 символа, считаем что SHA256 работает
        if (hashInfo.length === 64) {
            validationResults.existingSha256Hashes = true;
        }
    }
} else {
    print('   TitleHash Index: NOT FOUND');
    validationResults.titleHashIndex = false;
}

// 3. ПРОВЕРКА БАЗОВЫХ ОПЕРАЦИЙ
print('\n3. BASIC OPERATIONS CHECK:');

try {
    // INSERT с упрощенным хешем
    const testTitle = "Validation Test Article " + Date.now();
    const testDoc = {
        title : testTitle,
        content : "Test content for validation",
        hash : "validation_test_" + Date.now(),
        titleHash : generateTitleHash(testTitle),
        category : "technology",
        author :
            {firstName : "Test", lastName : "User", email : "test@test.com"},
        metrics : {views : 0, likes : 0, shares : 0},
        metadata :
            {publishDate : new Date(), isActive : true, tags : [ "test" ]}
    };

    const insertResult = db.news.insertOne(testDoc);
    print('   insertOne: OK');
    print('   Generated hash: ' + testDoc.titleHash);

    // UPDATE с $set
    db.news.updateOne(
        {_id : insertResult.insertedId},
        {$set : {"metrics.views" : 100, "metadata.isFeatured" : true}});
    print('   updateOne with $set: OK');

    // UPDATE с $inc
    db.news.updateOne({_id : insertResult.insertedId},
                      {$inc : {"metrics.views" : 50}});
    print('   updateOne with $inc: OK');

    // UPDATE с $push
    db.news.updateOne({_id : insertResult.insertedId},
                      {$push : {"metadata.tags" : "validation"}});
    print('   updateOne with $push: OK');

    // SEARCH с фильтрами
    const searchResults =
        db.news
            .find({
                $and : [
                    {category : {$in : [ "technology", "science" ]}},
                    {"metrics.views" : {$gt : 10}}
                ]
            })
            .limit(1)
            .count();
    print('   Search with $and/$in/$gt: OK');

    // PROJECTION
    const projected = db.news
                          .find({_id : insertResult.insertedId}, {
                              title : 1,
                              category : 1,
                              "metrics.views" : 1,
                              titleHash : 1,
                              _id : 0
                          })
                          .toArray();
    print('   Projection: OK');

    // DELETE
    db.news.deleteOne({_id : insertResult.insertedId});
    print('   deleteOne: OK');

    validationResults.basicOperations = true;
} catch (e) {
    validationResults.basicOperations = false;
    print('   Basic operations failed: ' + e.message);
}

// 4. ПРОВЕРКА AGGRECATION PIPELINES
print('\n4. AGGREGATION PIPELINES CHECK:');

try {
    // Простой pipeline с обязательными стадиями
    const pipeline1 = [
        {$match : {"metadata.isActive" : true}}, {$unwind : "$metadata.tags"},
        {$group : {_id : "$metadata.tags", count : {$sum : 1}}},
        {$project : {tag : "$_id", count : 1, _id : 0}}, {$sort : {count : -1}},
        {$limit : 5}
    ];

    const result1 = db.news.aggregate(pipeline1).toArray();
    print('   Basic pipeline with all required stages: ' + result1.length +
          ' results');

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
    print('   Pipeline with $lookup: ' + result2.length + ' results');

    validationResults.aggregations = result1.length > 0 && result2.length > 0;
} catch (e) {
    validationResults.aggregations = false;
    print('   Aggregations failed: ' + e.message);
}

// 5. ПРОВЕРКА ДЕДУПЛИКАЦИИ ПО TITLE HASH
print('\n5. TITLE DEDUPLICATION CHECK:');

try {
    if (!validationResults.titleHashIndex) {
        print('   ❌ UNIQUE INDEX titleHash NOT FOUND');
        print(
            '   Run: db.news.createIndex({ titleHash: 1 }, { unique: true, name: "uniq_title_hash" })');
        validationResults.deduplication = false;
    } else {
        print('   ✅ UNIQUE INDEX titleHash: Found');

        // Проверяем существующие дубликаты по titleHash
        const existingTitleDuplicates =
            db.news
                .aggregate([
                    {$group : {_id : "$titleHash", count : {$sum : 1}}},
                    {$match : {count : {$gt : 1}}}, {$limit : 1}
                ])
                .toArray();

        if (existingTitleDuplicates.length > 0) {
            print('   ⚠️  Found ' + existingTitleDuplicates.length +
                  ' existing title duplicate groups');
            validationResults.deduplication = false;
        } else {
            print('   ✅ No existing title duplicates found');

            // ТЕСТ ДЕДУПЛИКАЦИИ
            const testTitle = "Test Deduplication Article " + Date.now();
            const testTitleHash = generateTitleHash(testTitle);

            const testDoc1 = {
                title : testTitle,
                content : "Test content for deduplication",
                hash : "test_hash_" + Date.now(),
                titleHash : testTitleHash,
                category : "technology",
                author : {firstName : "Test", lastName : "User"},
                metadata : {publishDate : new Date()}
            };

            const testDoc2 = {
                title : testTitle, // Тот же заголовок!
                content : "Different content but same title",
                hash : "test_hash_" + (Date.now() + 1),
                titleHash : testTitleHash, // Тот же titleHash!
                category : "technology",
                author : {firstName : "Test", lastName : "User"},
                metadata : {publishDate : new Date()}
            };

            // Вставляем первый документ
            const firstInsert = db.news.insertOne(testDoc1);
            print('   ✅ First document inserted successfully');

            // Пытаемся вставить второй документ с тем же titleHash
            try {
                db.news.insertOne(testDoc2);
                validationResults.deduplication = false;
                print(
                    '   ❌ Deduplication FAILED: Second document with same titleHash was inserted');
            } catch (e) {
                if (e.code === 11000) {
                    validationResults.deduplication = true;
                    print(
                        '   ✅ Title-based deduplication WORKING: Second document correctly rejected');
                } else {
                    validationResults.deduplication = false;
                    print('   ❌ Unexpected error: ' + e.message);
                }
            }

            // Очищаем тестовый документ
            db.news.deleteOne({_id : firstInsert.insertedId});
        }

        // Проверяем заполненность поля titleHash
        const docsWithoutTitleHash =
            db.news.countDocuments({titleHash : {$exists : false}});
        if (docsWithoutTitleHash > 0) {
            print('   ⚠️  Found ' + docsWithoutTitleHash +
                  ' documents without titleHash field');
            print('   Run this script to fix:');
            print(`
            db.news.find({titleHash: {$exists: false}}).forEach(function(doc) {
                var newTitleHash = doc.title.toLowerCase().trim();
                // В продакшене здесь должна быть настоящая SHA256 функция
                db.news.updateOne(
                    {_id: doc._id},
                    {$set: {titleHash: newTitleHash}}
                );
            });
            `);
        } else {
            print('   ✅ All documents have titleHash field');

            // Если все документы имеют хеши и они 64 символа, считаем SHA256
            // активным
            if (validationResults.existingSha256Hashes) {
                validationResults.sha256Active = true;
                print('   🔒 SHA256-like hashes detected (64 chars)');
            }
        }
    }
} catch (e) {
    validationResults.deduplication = false;
    print('   ❌ Deduplication check failed: ' + e.message);
}

print('\n6. SPECIAL FEATURES CHECK:');

// Текстовый поиск
try {
    const textResults = db.news
                            .find({$text : {$search : "technology"}},
                                  {score : {$meta : "textScore"}})
                            .limit(1)
                            .toArray();
    validationResults.textSearch = textResults.length > 0;
    print('   Text search: ' +
          (textResults.length > 0 ? 'Working' : 'No results'));
} catch (e) {
    validationResults.textSearch = false;
    print('   Text search: ' + e.message);
}

// 7. ПРОВЕРКА ВИТРИНЫ ДАННЫХ
print('\n7. DATA MART CHECK:');

const dataMartExists = collections.includes('authors_daily_stats') ||
                       collections.includes('daily_stats');
if (dataMartExists) {
    const dataMartName = collections.includes('authors_daily_stats')
                             ? 'authors_daily_stats'
                             : 'daily_stats';
    const dataMartCount = db[dataMartName].countDocuments();
    validationResults.dataMart = dataMartCount > 0;
    print('   Data mart "' + dataMartName + '": ' + dataMartCount + ' records');

    // Если витрина пустая, предлагаем заполнить
    if (dataMartCount === 0) {
        print('   💡 Run data-mart.js to populate the data mart');
    }
} else {
    validationResults.dataMart = false;
    print('   No data mart found');
}

// 8. ПРОВЕРКА EXPLAIN И ПРОИЗВОДИТЕЛЬНОСТИ
print('\n8. PERFORMANCE CHECK:');

try {
    const explainResult =
        db.news.find({category : "technology"}).explain("executionStats");
    validationResults.explain = true;
    print('   Explain works: ' +
          explainResult.executionStats.executionTimeMillis + 'ms');
    print('   Documents examined: ' +
          explainResult.executionStats.totalDocsExamined);
} catch (e) {
    validationResults.explain = false;
    print('   Explain failed: ' + e.message);
}

// 9. ИТОГОВАЯ СТАТИСТИКА
print('\nVALIDATION SUMMARY:');
print('=====================');

const requirements = [
    {name : 'Database Structure', result : validationResults.collections},
    {name : '500+ Documents', result : validationResults.documentsCount},
    {name : 'Indexes Created', result : validationResults.indexes},
    {name : 'Special Indexes', result : validationResults.specialIndexes},
    {name : 'Basic Operations', result : validationResults.basicOperations},
    {name : 'Aggregation Pipelines', result : validationResults.aggregations}, {
        name : 'Deduplication by Title Hash',
        result : validationResults.deduplication
    },
    {name : 'Text Search', result : validationResults.textSearch},
    {name : 'Data Mart', result : validationResults.dataMart},
    {name : 'Performance Analysis', result : validationResults.explain}
];

let passed = 0;
requirements.forEach(req => {
    const status = req.result ? 'PASS' : 'FAIL';
    print('   ' + status + ' ' + req.name);
    if (req.result)
        passed++;
});

print('\nRESULTS: ' + passed + '/' + requirements.length +
      ' requirements passed');

if (passed === requirements.length) {
    print('\n🎉 ALL REQUIREMENTS COMPLETED SUCCESSFULLY!');
    print('=========================================');
    print('MongoDB News Aggregator is fully operational!');

    // Дополнительная информация о SHA256
    if (validationResults.sha256Active) {
        print(
            '🔒 SHA256-like hashing is active (64-character hashes detected)');
    }
} else {
    print('\n⚠️  SOME REQUIREMENTS NEED ATTENTION');
    print('=================================');

    if (!validationResults.titleHashIndex) {
        print('\n🔧 FIX REQUIRED:');
        print('   Run this command ONCE:');
        print(
            '   db.news.createIndex({ titleHash: 1 }, { unique: true, name: "uniq_title_hash" })');
    }

    if (!validationResults.deduplication && validationResults.titleHashIndex) {
        print('\n🔧 FIX REQUIRED:');
        print('   Ensure all documents have titleHash field');
    }

    if (!validationResults.dataMart) {
        print('\n🔧 FIX REQUIRED:');
        print('   Run data-mart.js to populate data mart');
    }

    print('\nCheck the failed items above and run the corresponding scripts.');
}

// 10. ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ REST API
print('\n9. REST API READINESS CHECK:');

const apiReadiness = {
    topNews : db.news.countDocuments({"metadata.isActive" : true}) > 0,
    categories : db.categories.countDocuments() > 0,
    authors : db.authors_stats.countDocuments() > 0,
    search : db.news.countDocuments({$text : {$search : "technology"}}) > 0,
    deduplication : validationResults.deduplication
};

print('   Top news endpoint: ' +
      (apiReadiness.topNews ? '✅ Ready' : '❌ No data'));
print('   Categories endpoint: ' +
      (apiReadiness.categories ? '✅ Ready' : '❌ No data'));
print('   Authors endpoint: ' +
      (apiReadiness.authors ? '✅ Ready' : '❌ No data'));
print('   Search endpoint: ' +
      (apiReadiness.search ? '✅ Ready' : '❌ No data'));
print('   Deduplication: ' +
      (apiReadiness.deduplication ? '✅ Active' : '❌ Inactive'));

// Информация о хешах
const hashInfo = checkExistingHashType();
if (hashInfo) {
    print('   Hash type: ' + hashInfo.type + ' (' + hashInfo.length +
          ' chars)');
}

print('\n=== VALIDATION COMPLETED ===');