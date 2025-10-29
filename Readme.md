## На всякий для запуска если не будет работать то можно провести ряд действий
> docker-compose down
> docker volume prune -f
> docker system prune -a -f
> sudo service docker restart
> docker-compose up -d

**Все готово**

Если хотите то можно запустить тест того что все работает
> bash fullTests.sh

## Использование

Для начала нужно заполнить бд
> python agregatorCreate.py

если не запущено то запустить 
> docker-compose up -d

и использовать секретную команду для создания (пототм баш будет)
> sudo docker exec -it bd-postgres-1 psql -U postgres -d news_aggregator -c "
  CREATE TABLE IF NOT EXISTS test_replication (id SERIAL PRIMARY KEY, data TEXT, created_at TIMESTAMP DEFAULT NOW());
  INSERT INTO test_replication (data) VALUES ('test data from primary');

чтобы вывести что то то юзаем
> sudo docker exec -it bd-postgres-replica psql -U postgres -d news_aggregator -c "SELECT * FROM test_replication;"

а чтобы удалить какую то базу нам надо (надо поменять id)
> sudo docker exec -it bd-postgres-1 psql -U postgres -d news_aggregator -c "DELETE FROM test_replication WHERE id = 34;"