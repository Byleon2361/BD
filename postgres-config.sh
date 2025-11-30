#!/bin/bash
set -e

# Файл: postgres-config.sh
# Этот файл выполнится при инициализации основного PostgreSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replica_pass';
    SELECT pg_reload_conf();
EOSQL

echo "host replication replicator all md5" >> /var/lib/postgresql/data/pg_hba.conf