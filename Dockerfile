FROM postgres:15

# Копируем SQL-дамп
COPY complete_news_database.sql /docker-entrypoint-initdb.d/

# Устанавливаем переменные окружения для настроек PostgreSQL
ENV POSTGRES_DB=new_bd
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=password

# Предустановленные параметры PostgreSQL
ENV PG_MAINTENANCE_WORK_MEM=128MB
ENV PG_MAX_CONNECTIONS=200

# Создаем скрипт для дополнительных настроек
COPY postgres-config.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/postgres-config.sh
