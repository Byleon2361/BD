#!/bin/bash
# setup-mongodb.sh - Скрипт для настройки MongoDB в Docker

echo "=== MongoDB Setup Script ==="
echo ""

# Проверяем запущены ли контейнеры
if ! docker ps | grep -q "bd-mongodb"; then
    echo "❌ MongoDB контейнер не запущен"
    echo "Запустите: docker-compose up -d mongodb mongodb-init"
    exit 1
fi

echo "✅ MongoDB контейнер запущен"
echo ""

# Ждем инициализации MongoDB
echo "Waiting for MongoDB to be ready..."
until docker exec bd-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    sleep 2
    echo "Waiting for MongoDB..."
done

echo "✅ MongoDB is ready!"
echo ""

# Проверяем наличие необходимых скриптов
echo "Checking for MongoDB scripts..."
if [ ! -d "5labscript" ]; then
    echo "❌ Directory 5labscript not found"
    echo "Please create it and add MongoDB scripts"
    exit 1
fi

echo "✅ 5labscript directory found"
echo ""

# Запускаем скрипты инициализации
echo "=== Running MongoDB Initialization ==="
echo ""

# 1. Запускаем скрипт связей
if [ -f "5labscript/mongodb-relationships.js" ]; then
    echo "1. Setting up relationships..."
    docker exec mongodb-tests node /app/5labscript/mongodb-relationships.js 2>/dev/null || echo "⚠️  Relationships script failed or already executed"
else
    echo "⚠️  mongodb-relationships.js not found"
fi

echo ""

# 2. Запускаем скрипт валидации
if [ -f "5labscript/schema-validation.js" ]; then
    echo "2. Setting up schema validation..."
    docker exec mongodb-tests node /app/5labscript/schema-validation.js 2>/dev/null || echo "⚠️  Validation script failed or already executed"
else
    echo "⚠️  schema-validation.js not found"
fi

echo ""

# 3. Проверяем API
echo "3. Testing API..."
sleep 5
if curl -s http://localhost:3000/api/health | grep -q "success"; then
    echo "✅ API is working!"
else
    echo "⚠️  API might not be ready yet"
    echo "Run: docker-compose logs mongodb-api"
fi

echo ""
echo "=== Setup Summary ==="
echo ""
echo "📊 Services:"
echo "   MongoDB:          http://localhost:27017"
echo "   MongoDB API:      http://localhost:3000"
echo "   Mongo Express UI: http://localhost:8081"
echo "   Grafana:          http://localhost:3001"
echo "   Prometheus:       http://localhost:9090"
echo ""
echo "🔑 Mongo Express credentials: admin/admin"
echo ""
echo "📝 To run all tests:"
echo "   docker exec mongodb-tests bash -c 'cd /app && npm test'"
echo ""
echo "✅ Setup complete!"