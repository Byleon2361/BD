#!/bin/bash

# Папка для бэкапов - замените на свою
BACKUP_DIR="/Users/ilyasuharenko/Documents/BD/backups"
mkdir -p "$BACKUP_DIR"

# Текущая дата
DATE=$(date +%F_%H-%M-%S)

# Дамп всех данных и настроек (pg_dumpall включает роли, базы, настройки)
docker exec -i bd-postgres-1 pg_dumpall -U postgres > "$BACKUP_DIR/full_dump_$DATE.sql"

# Уведомление
echo "Backup completed: $BACKUP_DIR/full_dump_$DATE.sql"