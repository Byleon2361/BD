#!/bin/bash

LAB_DIR="./5labscript"

if [ ! -d "$LAB_DIR" ]; then
    echo "Ошибка: Папка $LAB_DIR не найдена!"
    exit 1
fi

echo "Копирование всех JS-скриптов в контейнер..."

for file in "$LAB_DIR"/*.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "Копируем: $filename"
        docker cp "$file" bd-mongos-1:/tmp/
    fi
done

echo "=== ВЫПОЛНЕНИЕ СКРИПТОВ В ПРАВИЛЬНОМ ПОРЯДКЕ ==="

# 1. Инициализация (пользователи, индексы БЕЗ валидации)
docker exec bd-mongos-1 mongosh /tmp/mongo-init.js

# 2. Сид данных (заполняет коллекцию news)
docker exec bd-mongos-1 mongosh /tmp/mongo-seed.js

# 3. Применяем валидацию ПОСЛЕ того, как коллекция создана и зашардирована
echo "Применяем schema validation..."
docker exec bd-mongos-1 mongosh /tmp/apply-validation.js

# 4. Остальные скрипты (опционально)
if [ -f "/tmp/create-index.js" ]; then
    docker exec bd-mongos-1 mongosh /tmp/create-index.js
fi

if [ -f "/tmp/data-mart.js" ]; then
    docker exec bd-mongos-1 mongosh /tmp/data-mart.js
fi

# 5. Запускаем валидацию
echo "Запуск теста валидации..."
docker exec bd-mongos-1 mongosh /tmp/validation-test.js

echo "ВСЁ ГОТОВО! Проверь вывод выше — должны быть все ✅ в validation-test.js"