// 03-create-index.js
db = db.getSiblingDB('news_aggregator');

print('=== CREATING INDEXES FOR NEWS AGGREGATOR ===');

// Получаем список существующих индексов
const existingIndexes = db.news.getIndexes();
const existingIndexNames = existingIndexes.map(idx => idx.name);

print('Existing indexes: ' + existingIndexNames.join(', '));

// 1. Partial index для сортировки активных новостей по просмотрам
if (!existingIndexNames.includes("partial_active_views")) {
    try {
        db.news.createIndex({"metrics.views" : -1}, {
            name : "partial_active_views",
            partialFilterExpression : {"metadata.isActive" : true},
            background : true
        });
        print('✅ Partial index "partial_active_views" created');
    } catch (e) {
        print('❌ Failed to create partial index: ' + e.message);
    }
} else {
    print('⚠️ Partial index "partial_active_views" already exists');
}

// 2. Unique index по titleHash для дедупликации
if (!existingIndexNames.includes("uniq_title_hash")) {
    try {
        db.news.createIndex(
            {titleHash : 1},
            {name : "uniq_title_hash", unique : true, background : true});
        print('✅ Unique index "uniq_title_hash" created');
    } catch (e) {
        print('❌ Failed to create unique titleHash index: ' + e.message);
    }
} else {
    print('⚠️ Unique index "uniq_title_hash" already exists');
}

// 3. Text search index для поиска по title, content, excerpt и tags
if (!existingIndexNames.includes("text_search_index")) {
    try {
        db.news.createIndex(
            {
                title : "text",
                content : "text",
                excerpt : "text",
                "metadata.tags" : "text"
            },
            {
                name : "text_search_index",
                weights :
                    {title : 10, content : 5, excerpt : 3, "metadata.tags" : 2},
                default_language : "english",
                background : true
            });
        print('✅ Text search index "text_search_index" created');
    } catch (e) {
        print('❌ Failed to create text search index: ' + e.message);
    }
} else {
    print('⚠️ Text search index "text_search_index" already exists');
}

// 4. Дополнительные полезные индексы (по категории, дате, автору)
if (!existingIndexNames.includes("category_1")) {
    db.news.createIndex({category : 1}, {background : true});
    print('✅ Index on category created');
}

if (!existingIndexNames.includes("publishDate_-1")) {
    db.news.createIndex({"metadata.publishDate" : -1}, {background : true});
    print('✅ Index on publishDate created');
}

if (!existingIndexNames.includes("author.email_1")) {
    db.news.createIndex({"author.email" : 1}, {background : true});
    print('✅ Index on author.email created');
}

// Финальная проверка
const finalIndexes = db.news.getIndexes();
print('\nFinal list of indexes:');
finalIndexes.forEach(idx => {
    let details = idx.name;
    if (idx.unique)
        details += ' (unique)';
    if (idx.partialFilterExpression)
        details += ' (partial)';
    if (idx.textIndexVersion)
        details += ' (text)';
    print('   - ' + details);
});

print('\n🎉 All indexes created successfully!');