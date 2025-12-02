#!/bin/bash
# check-mongodb.sh

echo "=== Checking MongoDB Status ==="

# Проверяем контейнеры
echo "1. Docker containers:"
docker-compose ps | grep -E "(mongodb|api)"

echo ""
echo "2. MongoDB logs:"
docker-compose logs --tail=20 mongodb

echo ""
echo "3. MongoDB init logs:"
docker-compose logs --tail=10 mongodb-init

echo ""
echo "4. MongoDB API logs:"
docker-compose logs --tail=20 mongodb-api

echo ""
echo "5. Checking MongoDB connection:"
docker exec bd-mongodb mongosh --eval "
  try {
    rs.status();
    print('✅ Replica set is active');
  } catch(e) {
    print('❌ Replica set error:', e.message);
  }
  
  try {
    db = connect('mongodb://news_user:news_password123@localhost:27017/news_aggregator?authSource=news_aggregator');
    print('✅ Database connection successful');
    print('Collections:', db.getCollectionNames());
  } catch(e) {
    print('❌ Database connection error:', e.message);
  }
"

echo ""
echo "6. Testing API (if available):"
curl -s http://localhost:3000/api/health 2>/dev/null || echo "API not available on port 3000"