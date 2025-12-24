// 5labscript/apply-validation.js
// Применение schema validation ПОСЛЕ шардирования

db = db.getSiblingDB('news_aggregator');

print("=== ПРИМЕНЕНИЕ SCHEMA VALIDATION НА ШАРДИРОВАННОЙ КОЛЛЕКЦИИ ===");

const result = db.runCommand({
    collMod: "news",
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["title", "category", "metrics"],
            properties: {
                title: {
                    bsonType: "string",
                    description: "must be a string and is required"
                },
                category: {
                    enum: ["politics", "sports", "technology", "entertainment", "business", "health", "science"],
                    description: "must be one of the allowed categories"
                },
                metrics: {
                    bsonType: "object",
                    required: ["views"],
                    properties: {
                        views: {
                            bsonType: ["int", "long", "double", "decimal"],
                            minimum: 0,
                            description: "views must be a non-negative number"
                        }
                    },
                    additionalProperties: true
                },
                "metadata.tags": {
                    bsonType: "array",
                    items: {
                        bsonType: "string"
                    }
                }
            },
            additionalProperties: true
        }
    },
    validationLevel: "strict",
    validationAction: "error"
});

if (result.ok === 1) {
    print("✅ Schema validation УСПЕШНО применена к коллекции news");
} else {
    printjson(result);
    print("❌ Ошибка при применении валидации");
}

// Дополнительно: проверяем, что валидация действительно активна
const collInfo = db.getCollectionInfos({ name: "news" })[0];
if (collInfo.options.validator) {
    print("✅ Валидация подтверждена в метаданных коллекции");
} else {
    print("❌ Валидация НЕ найдена в метаданных коллекции!");
}

print("=== ГОТОВО ===");