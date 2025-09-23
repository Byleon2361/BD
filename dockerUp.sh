#!/bin/sh

# Собираем образ
docker-compose build

# Запускаем контейнер
docker-compose up -d
