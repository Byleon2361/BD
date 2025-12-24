// query-optimization.js — ИСПРАВЛЕННАЯ ВЕРСИЯ (работает в mongosh)

print("=== ОПТИМИЗАЦИЯ ЗАПРОСОВ В MONGODB ===");
db = db.getSiblingDB('news_aggregator');

const coll = db.news;

// Вспомогательная функция для explain
function runExplain(query, projection = null, sort = null, hint = null, name) {
    print(`\n🔍 ${name}`);
    
    let cursor = coll.find(query);
    if (projection) cursor = coll.find(query, projection);
    if (sort) cursor = cursor.sort(sort);
    if (hint) cursor = cursor.hint(hint);
    
    const explain = cursor.explain("executionStats");
    const stats = explain.executionStats;
    const winningPlan = explain.queryPlanner.winningPlan;
    
    print(`   Время выполнения: ${stats.executionTimeMillis} мс`);
    print(`   Документов просмотрено: ${stats.totalDocsExamined}`);
    print(`   Документов возвращено: ${stats.nReturned}`);
    print(`   Основной этап: ${winningPlan.stage}`);
    print(`   Индекс: ${winningPlan.indexName || 'COLLSCAN (полное сканирование)'}`);
    
    return stats;
}

// === УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЬСКИХ ИНДЕКСОВ ДЛЯ "ДО" ===
print("\n🗑️ Удаляем пользовательские индексы (оставляем только _id и hashed shard key)...");
coll.getIndexes().forEach(idx => {
    if (!["_id_", "_id_hashed"].includes(idx.name)) {
        try {
            coll.dropIndex(idx.name);
            print(`   Удалён: ${idx.name}`);
        } catch (e) { print(`   Ошибка удаления ${idx.name}: ${e}`); }
    }
});

// === ЗАПРОСЫ ДО ОПТИМИЗАЦИИ ===
print("\n=== ЗАПРОСЫ ДО ОПТИМИЗАЦИИ ===");

const before1 = runExplain(
    {
        "metadata.isActive": true,
        "category": "technology",
        "metadata.publishDate": { $gte: new Date("2023-01-01") }
    },
    null,
    { "metrics.views": -1 },
    null,  // без hint, но после dropIndexes будет COLLSCAN
    "1. Топ статей technology по views за 2023+ год"
);

const before2 = runExplain(
    {
        "metadata.isActive": true,
        "metadata.tags": "ai"
    },
    { title: 1, "metrics.views": 1, "metadata.publishDate": 1, _id: 0 },
    { "metrics.views": -1 },
    null,
    "2. Статьи с тегом 'ai' + проекция + сортировка по views"
);

const before3 = runExplain(
    {
        "author.email": { $regex: /^author1[0-9]@news\.com$/ },
        "metrics.views": { $gt: 15000 }
    },
    { title: 1, "metrics.views": 1, "author.name": 1, _id: 0 },
    { "metadata.publishDate": -1 },
    null,
    "3. Статьи авторов author10–19 с views > 15000 + сортировка по дате"
);

// === СОЗДАНИЕ ИНДЕКСОВ ===
print("\n⚡ СОЗДАНИЕ ОПТИМИЗИРУЮЩИХ ИНДЕКСОВ...");

coll.createIndex({ "metadata.isActive": 1, "category": 1, "metadata.publishDate": 1, "metrics.views": -1 });
print("✅ Составной индекс для запроса 1 (ESR: equality + sort + range)");

coll.createIndex({ "metadata.tags": 1, "metrics.views": -1 });
print("✅ Multikey индекс для тегов + views (для запроса 2)");

coll.createIndex({ "author.email": 1, "metrics.views": -1, "metadata.publishDate": -1 });
print("✅ Индекс для email + views + дата (для запроса 3)");

// === ЗАПРОСЫ ПОСЛЕ ОПТИМИЗАЦИИ ===
print("\n=== ЗАПРОСЫ ПОСЛЕ ОПТИМИЗАЦИИ ===");

const after1 = runExplain(
    {
        "metadata.isActive": true,
        "category": "technology",
        "metadata.publishDate": { $gte: new Date("2023-01-01") }
    },
    null,
    { "metrics.views": -1 },
    null,
    "1. Топ статей technology по views за 2023+ год"
);

const after2 = runExplain(
    {
        "metadata.isActive": true,
        "metadata.tags": "ai"
    },
    { title: 1, "metrics.views": 1, "metadata.publishDate": 1, _id: 0 },
    { "metrics.views": -1 },
    null,
    "2. Статьи с тегом 'ai' + проекция + сортировка по views"
);

const after3 = runExplain(
    {
        "author.email": { $regex: /^author1[0-9]@news\.com$/ },
        "metrics.views": { $gt: 15000 }
    },
    { title: 1, "metrics.views": 1, "author.name": 1, _id: 0 },
    { "metadata.publishDate": -1 },
    null,
    "3. Статьи авторов author10–19 с views > 15000 + сортировка по дате"
);

// === СРАВНЕНИЕ ===
print("\n🎯 РЕЗУЛЬТАТЫ ОПТИМИЗАЦИИ:");

function showImprovement(before, after, name) {
    const timeImp = before.executionTimeMillis - after.executionTimeMillis;
    const timePerc = before.executionTimeMillis > 0 ? Math.round((timeImp / before.executionTimeMillis) * 100) : 0;
    const docsImp = before.totalDocsExamined - after.totalDocsExamined;
    const docsPerc = before.totalDocsExamined > 0 ? Math.round((docsImp / before.totalDocsExamined) * 100) : 0;
    
    print(`\n📊 ${name}`);
    print(`   Время: ${before.executionTimeMillis} мс → ${after.executionTimeMillis} мс (-${timeImp} мс, ${timePerc}%)`);
    print(`   Docs examined: ${before.totalDocsExamined} → ${after.totalDocsExamined} (-${docsImp}, ${docsPerc}%)`);
}

showImprovement(before1, after1, "Запрос 1");
showImprovement(before2, after2, "Запрос 2");
showImprovement(before3, after3, "Запрос 3");

print("\n✅ Готово! Копируй весь вывод в отчёт.");
print("Применённые методы:");
print(" • Составные индексы по правилу ESR (Equality — Sort — Range)");
print(" • Multikey-индекс для массива tags");
print(" • Индексы на часто фильтруемые/сортируемые поля");