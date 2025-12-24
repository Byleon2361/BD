// test-active-cursors.js
const db = db.getSiblingDB('test_cursors');

print("🧪 Создаем активные курсоры для теста");

// Очищаем старые данные
db.cursors_test.drop();

// Заполняем данными
for (let i = 0; i < 500; i++) {
  db.cursors_test.insertOne({
    index: i,
    data: "X".repeat(500),
    timestamp: new Date(),
    value: Math.random() * 1000
  });
}

print("500 документов создано");

// Создаем несколько долгих курсоров
const cursors = [];
for (let i = 0; i < 5; i++) {
  const cursor = db.cursors_test.find({index: {$lt: 100}}).batchSize(5);
  cursors.push(cursor);
  
  // Читаем немного, но не закрываем
  cursor.next();
  cursor.next();
  
  print(`Курсор ${i} создан (2 документа прочитано)`);
}

print("\n✅ 5 активных курсоров создано");
print("Они будут открыты ~30 секунд...");
print("Проверьте в Grafana:");
print("1. mongodb_mongod_metrics_cursor_open{state='total'} - должно увеличиться");
print("2. mongodb_mongod_metrics_cursor_open{state='pinned'} - может увеличиться");

// Держим курсоры открытыми 30 секунд
sleep(30000);

// Закрываем курсоры
cursors.forEach(c => c.close());
print("\nКурсоры закрыты");

function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {}
}