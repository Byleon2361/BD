#!/bin/bash
# run-mongodb-tests.sh

echo "=== Running MongoDB Tests ==="
echo ""

# Проверяем запущен ли контейнер с тестами
if ! docker ps | grep -q "mongodb-tests"; then
    echo "Starting test container..."
    docker-compose up -d mongodb-tests
    sleep 10
fi

echo "Running tests in mongodb-tests container..."
echo ""

# Запускаем тесты последовательно
docker exec mongodb-tests bash -c "
    echo '=== 1. Testing Relationships ==='
    if [ -f /app/5labscript/mongodb-relationships.js ]; then
        node /app/5labscript/mongodb-relationships.js
    else
        echo 'SKIP: File not found'
    fi
    
    echo ''
    echo '=== 2. Testing Transactions ==='
    if [ -f /app/5labscript/mongodb-transactions.js ]; then
        node /app/5labscript/mongodb-transactions.js
    else
        echo 'SKIP: File not found'
    fi
    
    echo ''
    echo '=== 3. Testing Bulk Operations ==='
    if [ -f /app/5labscript/mongodb-bulk-operations.js ]; then
        node /app/5labscript/mongodb-bulk-operations.js
    else
        echo 'SKIP: File not found'
    fi
    
    echo ''
    echo '=== 4. Testing Schema Validation ==='
    if [ -f /app/5labscript/schema-validation.js ]; then
        node /app/5labscript/schema-validation.js
    else
        echo 'SKIP: File not found'
    fi
    
    echo ''
    echo '=== 5. Testing Advanced Aggregations ==='
    if [ -f /app/5labscript/advanced-aggregations.js ]; then
        node /app/5labscript/advanced-aggregations.js
    else
        echo 'SKIP: File not found'
    fi
    
    echo ''
    echo '=== 6. Testing Query Optimization ==='
    if [ -f /app/5labscript/query-optimization.js ]; then
        node /app/5labscript/query-optimization.js
    else
        echo 'SKIP: File not found'
    fi
    
    echo ''
    echo '=== 7. Testing Sharding ==='
    if [ -f /app/5labscript/sharding-setup.js ]; then
        node /app/5labscript/sharding-setup.js
    else
        echo 'SKIP: File not found'
    fi
    
    echo ''
    echo '=== 8. Testing Caching ==='
    if [ -f /app/5labscript/caching-strategy.js ]; then
        node /app/5labscript/caching-strategy.js
    else
        echo 'SKIP: File not found'
    fi
    
    echo ''
    echo '=== ALL TESTS COMPLETED ==='
"

echo ""
echo "✅ Tests completed!"
echo ""
echo "To view logs: docker-compose logs mongodb-tests"
echo "To stop test container: docker-compose stop mongodb-tests"