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
        docker cp "$file" bd-mongodb:/tmp/
    fi
done
# Выполняем скрипт инициализации (если есть)
if [ -f "$LAB_DIR/mongo-init.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongodb mongosh /tmp/mongo-init.js
fi

if [ -f "$LAB_DIR/mongo-seed.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongodb mongosh /tmp/mongo-seed.js
fi

if [ -f "$LAB_DIR/create-index.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongodb mongosh /tmp/create-index.js
fi
if [ -f "$LAB_DIR/data-mart.js" ]; then
    echo "Выполняем инициализацию..."
    docker exec bd-mongodb mongosh /tmp/data-mart.js
fi


# Выполняем валидацию (если есть)
if [ -f "$LAB_DIR/comprehensive-validation.js" ]; then
    echo "Выполняем валидацию..."
    docker exec bd-mongodb mongosh /tmp/comprehensive-validation.js
fi


echo "Готово!"