# Команды по ходу работы
## Команды для созания ролей:

1) 
```cypher
CREATE USER reader SET PASSWORD 'reader123' SET PASSWORD CHANGE NOT REQUIRED; // make reader
CREATE USER publisher SET PASSWORD 'publisher123' SET PASSWORD CHANGE NOT REQUIRED; // make publisher

// не работает в комьюитит эдишн. почему меня это должно волновать?
GRANT ROLE reader TO reader;
GRANT ROLE publisher TO publisher;

// 
```

2) from BD - для перемещения csv в нужный volme
docker cp neo4j/import/tags.csv bd-neo4j:/var/lib/neo4j/import/tags.csv 

3) в веб-интерфейсе
```
LOAD CSV WITH HEADERS FROM 'file:///tags.csv' AS row
MERGE (t:Tag {name: row.name})
SET t.color = row.color;
```

## Ограничения и индексы

1) Ограничение уникальности на Article:
```
CREATE CONSTRAINT article_id_unique FOR (a:Article) REQUIRE a.id IS UNIQUE;
```

2) Ограничение уникальности на Author:
```
CREATE CONSTRAINT author_email_unique FOR (a:Author) REQUIRE a.email IS UNIQUE;
```

3) Ограничение уникальности на Category:
```
CREATE CONSTRAINT category_name_unique FOR (c:Category) REQUIRE c.name IS UNIQUE;
```

4) Создаём индекс на views для быстрого поиска популярных статей:
```
CREATE INDEX article_views FOR (a:Article) ON (a.views);
```

5) Создаём индекс на rating авторов:
```
CREATE INDEX author_rating FOR (a:Author) ON (a.rating);
```

6) проверка:
```
SHOW CONSTRAINTS;
SHOW INDEXES;
```

Далее по администрированию п4 + п7 Data - производительность. 

7) EXPLAIN — показывает план запроса без выполнения:
-  MATCEXPLAINH (a:Article) WHERE a.views > 30000 RETURN a.title, a.views;

8) PROFILE — выполняет запрос и показывает реальную статистику:
- PROFILE MATCH (a:Article) WHERE a.views > 30000 RETURN a.title, a.views;

***
EXPLAIN (второй скриншот) — показал план без выполнения. Видно что Neo4j использует NodeIndexSeekByRange — то есть нашёл данные через индекс article_views который мы создали, а не перебирал все записи. Это хорошо.

PROFILE (первый скриншот) — то же самое но с реальными цифрами. Нашёл 32 статьи, сделал 33 обращения к базе. Очень быстро и эффективно именно благодаря индексу.
*** Скриншоты находятся внутри Downloads

## работа с данными, п3 - 6 простых запросов с фильтрацией. 

_Запустить скрипт queries.py внутри /scripts_ или выполнить в ручную. 

- Запрос 1 — все статьи категории technology:
cypherMATCH (a:Article)-[:IN_CATEGORY]->(c:Category {name: 'technology'})
RETURN a.title, a.views, a.likes;

- Запрос 2 — авторы из USA:
cypherMATCH (a:Author)
WHERE a.country = 'USA' AND a.rating > 8.0
RETURN a.name, a.rating, a.country;

- Запрос 3 — статьи с тегом 'ai':
cypherMATCH (a:Article)-[:HAS_TAG]->(t:Tag {name: 'ai'})
RETURN a.title, a.category;

- Запрос 4 — источники с надёжностью 9:
cypherMATCH (s:Source)
WHERE s.reliability = 9
RETURN s.name, s.country, s.website;

- Запрос 5 — статьи опубликованные в Reuters:
cypherMATCH (a:Article)-[:PUBLISHED_IN]->(s:Source {name: 'Reuters'})
RETURN a.title, a.category, a.views;

- Запрос 6 — авторы которые работают в источниках из UK:
cypherMATCH (a:Author)-[:WORKS_FOR]->(s:Source)
WHERE s.country = 'UK'
RETURN a.name, a.rating, s.name AS source;

### Результаты выполнения:
П.3 (запросы 1-6) — простая фильтрация работает. Например, в Reuters опубликовано 9 статей, в UK работают 8 авторов, только 1 автор из USA с рейтингом выше 8.
П.4 (запросы 7-8) — цепочки работают. Запрос 7 нашёл авторов связанных через общие теги (например Author_22 и Author_1 оба писали статьи с тегом 'analysis'). Запрос 8 показал путь от автора до тега через 2 шага.
П.5 (запросы 9-13) — агрегации работают. Самая популярная категория по просмотрам — sports (50042 avg), тег 'research' встречается в 12 статьях, Associated Press набрал больше всего суммарных просмотров.
П.7 (запрос 14) — общие соседи найдены. Author_2 и Author_16 имеют 4 общих тега — это максимум.
П.8 (запрос 15) — комбинированный запрос работает. BBC News показывает лучший средний показатель просмотров среди статей от авторов с рейтингом > 7.


##  Работа с данными П.6 
Найти сценарии Postgres/Mongo с join/lookup и переписать на Cypher используя Match. Описать, какой и
запросов проще/нагляднее:

Взято из queries_with_joined_tables.sql:/
Необходимо запустить neo4j/scripts/postgres_vs_cypher.py

***
- Запрос 1 (2 таблицы в SQL → 1 паттерн в Cypher) — в SQL нужно JOIN авторов с новостями через общий ключ author_id. В Cypher просто пишем (a:Author)-[:WROTE]->(art:Article) — связь уже встроена в граф, никаких ключей.

- Запрос 2 (3 таблицы в SQL → Cypher) — в SQL два JOIN через category_id и source_id. В Cypher одна строка с запятой: (art)-[:IN_CATEGORY]->(c), (art)-[:PUBLISHED_IN]->(s) — читается почти как обычный текст.

- Запрос 3 (4 таблицы + LEFT JOIN в SQL → Cypher) — самый показательный. В SQL громоздкий GROUP BY и STRING_AGG для тегов. В Cypher теги собираются через collect(DISTINCT t.name) — компактно и понятно.

Cypher выигрывает когда много связей между сущностями — запрос читается как описание графа. SQL выигрывает для простых табличных выборок и числовых вычислений.
***

## Мониторинг
Вроде как CE не поддерживает метрики для Progmeteus. Хотя заготовка есть я хз. 
Вместо этого использваоть встроенные функции мониторинга которые использует скрипт neo4j/scripts/monitoring.py. 

***
Граф — 105 узлов, 275 связей, всё на месте как мы загружали. Самый популярный тип связи HAS_TAG (100 штук).
Память — Neo4j использует 512MB heap на старте, максимум 1GB, плюс 512MB для pagecache. Это настройки которые мы задали в docker-compose.
Транзакции — видна 1 активная транзакция, это сам запрос SHOW TRANSACTIONS который мы выполняем. Показывает кто подключён, с какого адреса и когда.
Индексы — все 5 наших индексов в статусе ONLINE, работают нормально.
Состояние БД — обе базы (neo4j и системная system) online.
***

## Админ. п5 - резервное копирование. 
docker exec bd-neo4j neo4j stop
docker exec bd-neo4j neo4j-admin database dump neo4j --to-path=/tmp/
docker cp bd-neo4j:/tmp/neo4j.dump neo4j/backup/neo4j.dump
docker exec bd-neo4j neo4j start

## Админ. п8 - Отказоустойчивость. Останови контейнер Neo4j:
- docker stop bd-neo4j
Попробуй подключиться (должно упасть):
- python3 monitoring.py
Потом подними обратно:
- docker start bd-neo4j
И снова проверь что всё работает:
- python3 monitoring.py
Это демонстрирует поведение при отказе в режиме standalone — база недоступна пока контейнер не запущен.