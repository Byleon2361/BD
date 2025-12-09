#!/bin/bash

# Папка с файлами лабы
LAB_DIR="./5labscript"

# Проверяем существование папки
if [ ! -d "$LAB_DIR" ]; then
    echo "Ошибка: Папка $LAB_DIR не найдена!"
    exit 1
fi

echo "Копирование файлов из $LAB_DIR в контейнер..."

# Копируем все JS файлы из папки в контейнер
for file in "$LAB_DIR"/*.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "Копируем: $filename"
        docker cp "$file" bd-mongos-1:/tmp/
    fi
done
# Выполняем скрипт инициализации (если есть)
if [ -f "$LAB_DIR/mongo-init.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongos-1 mongosh /tmp/mongo-init.js
fi

if [ -f "$LAB_DIR/mongo-seed.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongos-1 mongosh /tmp/mongo-seed.js
fi
if [ -f "$LAB_DIR/sharding-setup.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongos-1 mongosh /tmp/sharding-setup.js
fi
if [ -f "$LAB_DIR/transactions.js.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongos-1 mongosh /tmp/transactions.js
fi
if [ -f "$LAB_DIR/create-index.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongos-1 mongosh /tmp/create-index.js
fi
docker exec bd-mongos-1 mongosh /tmp/data-mart-with-cache.js &   # Запускаем в фоне!
CACHE_PID=$!
if [ -f "$LAB_DIR/data-mart.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongos-1 mongosh /tmp/data-mart.js
fi


# Выполняем валидацию (если есть)
if [ -f "$LAB_DIR/comprehensive-validation.js" ]; then
    echo "Выполняем валидацию..."
    docker exec bd-mongos-1 mongosh /tmp/comprehensive-validation.js
fi


echo "Готово!"