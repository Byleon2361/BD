// test-insert-rate.js
const db = db.getSiblingDB('news_aggregator');

print("🎯 ТЕСТ INSERT НАГРУЗКИ ДЛЯ ПРОВЕРКИ METRICS");
print("Цель: создать пик на графике rate(mongodb_ss_opcounters{legacy_op_type='insert'})");
print("===============================================\n");

// 1. Создаём тестовую коллекцию
print("1. Подготовка тестовой коллекции...");
const TEST_COLLECTION = "test_insert_metrics";

try {
  db[TEST_COLLECTION].drop();
  print("   ✅ Старая коллекция удалена");
} catch(e) {}

db.createCollection(TEST_COLLECTION);
db[TEST_COLLECTION].createIndex({ _id: 1 });

// Включаем шардирование если нужно
try {
  sh.enableSharding("news_aggregator");
  sh.shardCollection(`news_aggregator.${TEST_COLLECTION}`, { _id: 1 });
  print("   ✅ Коллекция шардирована");
} catch(e) {
  print("   ℹ️  Шардирование пропущено (уже включено)");
}

// 2. Параметры теста
const DOCS_PER_BATCH = 1000;    // Документов в одной пачке
const BATCHES = 10;             // Количество пачек
const DELAY_MS = 2000;          // Задержка между пачками (2 сек)

print(`\n2. Параметры теста:`);
print(`   Документов в пачке: ${DOCS_PER_BATCH}`);
print(`   Количество пачек: ${BATCHES}`);
print(`   Задержка между пачками: ${DELAY_MS}ms`);
print(`   Всего документов: ${DOCS_PER_BATCH * BATCHES}`);

// 3. Запускаем тест с паузами (чтобы видеть волны на графике)
print("\n3. Запуск INSERT теста:");

let totalInserted = 0;
const startTime = new Date();

for (let batchNum = 1; batchNum <= BATCHES; batchNum++) {
  print(`\n--- Пачка ${batchNum}/${BATCHES} ---`);
  const batchStart = new Date();
  
  // Создаём пачку документов
  const batch = [];
  const baseId = (batchNum - 1) * DOCS_PER_BATCH;
  
  for (let i = 0; i < DOCS_PER_BATCH; i++) {
    batch.push({
      _id: baseId + i,
      title: `Test doc ${baseId + i} - Batch ${batchNum}`,
      content: "Тестовый контент для проверки метрик INSERT операций. ".repeat(10),
      category: ["A", "B", "C", "D"][i % 4],
      timestamp: new Date(),
      batch: batchNum,
      randomValue: Math.random(),
      tags: [`tag${i % 5}`, `batch${batchNum}`, "insert_test"]
    });
  }
  
  // Вставляем пачку
  try {
    const result = db[TEST_COLLECTION].insertMany(batch, { ordered: false });
    totalInserted += result.insertedCount;
    
    const batchTime = new Date() - batchStart;
    const docsPerSec = (DOCS_PER_BATCH / (batchTime / 1000)).toFixed(1);
    
    print(`   ✅ Вставлено: ${result.insertedCount} документов`);
    print(`   ⏱️  Время: ${batchTime}ms (${docsPerSec} doc/sec)`);
    
  } catch(e) {
    print(`   ❌ Ошибка вставки пачки ${batchNum}: ${e.message}`);
  }
  
  // Пауза между пачками (чтобы увидеть спады на графике)
  if (batchNum < BATCHES) {
    print(`   ⏳ Пауза ${DELAY_MS/1000} сек...`);
    sleep(DELAY_MS);
  }
}

// 4. Результаты
const totalTime = new Date() - startTime;
const avgRate = totalInserted / (totalTime / 1000);

print("\n===============================================");
print("🎉 ТЕСТ ЗАВЕРШЕН!");
print("===============================================");
print(`📊 Результаты:`);
print(`   Всего вставлено: ${totalInserted} документов`);
print(`   Общее время: ${(totalTime/1000).toFixed(2)} сек`);
print(`   Средняя скорость: ${avgRate.toFixed(1)} doc/sec`);
print(`   Коллекция: ${TEST_COLLECTION}`);

print("\n🔍 Что смотреть в Grafana (http://localhost:3001):");
print("1. Откройте панель 'MongoDB Cluster Summary'");
print("2. Найдите график с запросом:");
print("   rate(mongodb_ss_opcounters{legacy_op_type='insert'}[5m])");
print("\n3. Вы должны увидеть:");
print("   - Пики в моменты вставки пачек");
print("   - Спады во время пауз (2 сек)");
print("   - Общий рост метрики INSERT операций");

// 5. Дополнительная проверка - делаем немного UPDATE для сравнения
print("\n4. Добавляем немного UPDATE операций для контраста...");
for (let i = 0; i < 500; i++) {
  const randomId = Math.floor(Math.random() * totalInserted);
  db[TEST_COLLECTION].updateOne(
    { _id: randomId },
    { $set: { checked: true, updatedAt: new Date() }, $inc: { counter: 1 } }
  );
}
print("   ✅ 500 UPDATE операций выполнено");

print("\n📈 Теперь в Grafana сравните:");
print("   INSERT: rate(mongodb_ss_opcounters{legacy_op_type='insert'}[5m])");
print("   UPDATE: rate(mongodb_ss_opcounters{legacy_op_type='update'}[5m])");
print("   Должен быть явный перевес INSERT операций!");

// Вспомогательная функция
function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // busy wait
  }
}