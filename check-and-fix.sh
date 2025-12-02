#!/bin/bash
# check-and-fix.sh

echo "=== Проверка и исправление MongoDB инфраструктуры ==="
echo ""

# 1. Проверяем запущенные контейнеры
echo "1. Проверяем запущенные контейнеры:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# 2. Проверяем mongodb
echo "2. Проверяем MongoDB:"
if docker ps | grep -q bd-mongodb; then
    echo "✅ MongoDB контейнер запущен"
    echo "Проверяем подключение к MongoDB..."
    if docker exec bd-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        echo "✅ MongoDB отвечает"
    else
        echo "❌ MongoDB не отвечает"
    fi
else
    echo "❌ MongoDB контейнер не запущен"
fi
echo ""

# 3. Проверяем mongodb-api
echo "3. Проверяем MongoDB API:"
if docker ps | grep -q mongodb-api; then
    echo "✅ MongoDB API контейнер запущен"
    echo "Проверяем API..."
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "✅ API доступен"
    else
        echo "❌ API недоступен"
        echo "Логи mongodb-api:"
        docker logs mongodb-api --tail 20
    fi
else
    echo "❌ MongoDB API контейнер не запущен"
    echo "Запускаем mongodb-api..."
    docker-compose up -d mongodb-api
    sleep 5
fi
echo ""

# 4. Проверяем наличие скриптов
echo "4. Проверяем наличие скриптов в 5labscript:"
if [ -d "5labscript" ]; then
    echo "✅ Папка 5labscript существует"
    echo "Содержимое:"
    ls -la 5labscript/*.js 2>/dev/null | head -10 || echo "Нет .js файлов"
else
    echo "❌ Папка 5labscript не существует"
    mkdir -p 5labscript
    echo "Создана пустая папка 5labscript"
fi
echo ""

# 5. Проверяем app.js
echo "5. Проверяем app.js:"
if [ -f "app.js" ]; then
    echo "✅ app.js существует"
    echo "Первые 5 строк:"
    head -5 app.js
else
    echo "❌ app.js не существует"
    echo "Создаю минимальный app.js..."
    cat > app.js << 'EOF'
const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'MongoDB API is running!' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
EOF
fi
echo ""

# 6. Запускаем простой тест
echo "6. Запускаем простой тест подключения к MongoDB:"
docker exec mongodb-tests node -e "
const { MongoClient } = require('mongodb');
async function test() {
    try {
        const client = new MongoClient('mongodb://news_user:news_password123@mongodb:27017/news_aggregator?authSource=news_aggregator');
        await client.connect();
        const db = client.db('news_aggregator');
        const collections = await db.listCollections().toArray();
        console.log('✅ Подключение успешно!');
        console.log('Доступные коллекции:', collections.map(c => c.name).join(', '));
        await client.close();
    } catch (err) {
        console.log('❌ Ошибка подключения:', err.message);
    }
}
test();
"
echo ""

echo "=== Проверка завершена ==="
echo "Если есть проблемы, проверьте:"
echo "1. docker-compose logs mongodb-api"
echo "2. docker-compose logs mongodb-init"
echo "3. Убедитесь что все скрипты в папке 5labscript/"