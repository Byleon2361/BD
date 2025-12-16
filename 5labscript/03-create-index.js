// create-partial-index.js
db = db.getSiblingDB('news_aggregator');

print('=== CREATING PARTIAL INDEX ===');

// Проверяем существующие индексы
const existingIndexes = db.news.getIndexes();
const existingIndexNames = existingIndexes.map(idx => idx.name);

print('Existing indexes: ' + existingIndexNames.join(', '));

// Проверяем есть ли поле metadata.isActive в документах
const sampleDoc = db.news.findOne({"metadata.isActive": {$exists: true}});
print('Sample document with isActive: ' + JSON.stringify(sampleDoc?.metadata?.isActive));

// Считаем документы с isActive = true
const activeCount = db.news.countDocuments({"metadata.isActive": true});
const totalCount = db.news.countDocuments();
print(`Active documents: ${activeCount}/${totalCount}`);

// Создаем partial index если его нет
if (!existingIndexNames.includes("partial_active_views")) {
    try {
        db.news.createIndex(
            { "metrics.views": -1 },
            { 
                name: "partial_active_views",
                partialFilterExpression: { "metadata.isActive": true },
                background: true
            }
        );
        print('✅ Partial index created successfully');
    } catch (e) {
        print('❌ Failed to create partial index: ' + e.message);
        
        // Альтернативная попытка с другим полем
        print('Trying alternative partial index...');
        try {
            db.news.createIndex(
                { "category": 1, "metrics.views": -1 },
                { 
                    name: "partial_category_views",
                    partialFilterExpression: { "metrics.views": { $gt: 100 } },
                    background: true
                }
            );
            print('✅ Alternative partial index created');
        } catch (e2) {
            print('❌ Alternative also failed: ' + e2.message);
        }
    }
} else {
    print('⚠️  Partial index already exists');
}

// Проверяем результат
const finalIndexes = db.news.getIndexes();
const hasPartial = finalIndexes.some(idx => idx.partialFilterExpression);
print('Partial Index exists: ' + hasPartial);

if (hasPartial) {
    const partialIndex = finalIndexes.find(idx => idx.partialFilterExpression);
    print('Partial index details: ' + JSON.stringify(partialIndex.partialFilterExpression));
}