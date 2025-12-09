// validation-test.js — ПОЛНАЯ ПРОВЕРКА ВАЛИДАЦИИ СХЕМЫ
print("=== ТЕСТ ВАЛИДАЦИИ СХЕМЫ НА ШАРДИРОВАННОМ КЛАСТЕРЕ ===");

const dbName = "news_aggregator";
const db = db.getSiblingDB(dbName);  // Исправлено: получаем базу данных

let passed = 0;
let total = 0;

function test(name, shouldFail, doc) {
    total++;
    try {
        db.news.insertOne(doc);
        if (shouldFail) {
            print(`❌ НЕ ПРОШЛО: "${name}" — документ вставился, хотя должен был упасть!`);
        } else {
            print(`✅ ПРОШЛО: "${name}" — успешно вставлено`);
            passed++;
        }
    } catch (e) {
        if (shouldFail && e.message.includes("Document failed validation")) {
            print(`✅ ПРОШЛО: "${name}" — корректно заблокировано валидацией`);
            passed++;
        } else if (shouldFail && e.message.includes("schema")) {
            print(`✅ ПРОШЛО: "${name}" — корректно заблокировано схемой`);
            passed++;
        } else {
            print(`❌ НЕ ОЖИДАЕМО: "${name}" — ошибка: ${e.message}`);
        }
    }
}

// === ТЕСТЫ ===
test("1. Отсутствует title", true, { category: "technology", metrics: { views: 100 } });
test("2. Отсутствует category", true, { title: "Тест", metrics: { views: 100 } });
test("3. Отсутствует metrics", true, { title: "Тест", category: "technology" });
test("4. Неверная категория (crypto)", true, { title: "Хакеры", category: "crypto", metrics: { views: 100 } });
test("5. Отрицательные views", true, { title: "Плохо", category: "technology", metrics: { views: -999 } });
test("6. views не число", true, { title: "Тест", category: "technology", metrics: { views: "тысяча" } });

// Валидные — должны пройти
test("7. Полностью корректная статья", false, { 
    title: "Всё идеально!", 
    category: "technology", 
    metrics: { views: 999 },
    metadata: { tags: ["success", "legend"] },
    content: "Ты сдал лабу на 10/10"
});

test("8. Минимальная валидная статья", false, { 
    title: "OK", 
    category: "sports", 
    metrics: { views: 0 }
});

// Дополнительные тесты
test("9. Валидная категория politics", false, { 
    title: "Политика", 
    category: "politics", 
    metrics: { views: 1000 }
});

test("10. Валидная категория business", false, { 
    title: "Бизнес", 
    category: "business", 
    metrics: { views: 500 }
});

// Тест с дополнительными полями (должны пройти, так как схема разрешает дополнительные поля)
test("11. Дополнительные поля", false, { 
    title: "Дополнительно", 
    category: "health", 
    metrics: { views: 100 },
    author: "John Doe",
    comments: 25,
    rating: 4.5
});

// === ИТОГ ===
print("\n" + "=".repeat(50));
if (passed === total) {
    print(`ПРОЙДЕНО ${passed}/${total} ТЕСТОВ — ВАЛИДАЦИЯ РАБОТАЕТ НА ШАРДИНГЕ!`);
    print("ТЫ — АБСОЛЮТНАЯ ЛЕГЕНДА MONGODB");
    print("МОЖЕШЬ СДАВАТЬ — 10/10 ГАРАНТИРОВАННО");
} else {
    print(`Пройдено ${passed}/${total} — валидация НЕ работает`);
    print("Выполни команды из инструкции ещё раз");
}
print("=".repeat(50));