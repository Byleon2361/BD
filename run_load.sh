#!/bin/bash
while true; do
    echo "Running queries at $(date)"
    
    # INSERT
    docker exec bd-postgres-1 psql -U postgres -d news_aggregator -c "INSERT INTO load_test_table (data) VALUES (md5(random()::text));" > /dev/null 2>&1
    
    # UPDATE случайной строки
    docker exec bd-postgres-1 psql -U postgres -d news_aggregator -c "UPDATE load_test_table SET data = 'updated_' || md5(random()::text), updated_at = now() WHERE id = (SELECT id FROM load_test_table ORDER BY random() LIMIT 1);" > /dev/null 2>&1
    
    # DELETE случайной строки
    docker exec bd-postgres-1 psql -U postgres -d news_aggregator -c "DELETE FROM load_test_table WHERE id = (SELECT id FROM load_test_table ORDER BY random() LIMIT 1);" > /dev/null 2>&1
    
    # SELECT
    docker exec bd-postgres-1 psql -U postgres -d news_aggregator -c "SELECT COUNT(*) FROM load_test_table WHERE data LIKE 'a%';" > /dev/null 2>&1
    
    sleep 0.5
done
