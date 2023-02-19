#!/bin/bash

if [[ -z "$1" ]]; then
  echo "Usage: ./create-docker-db.sh <name>"
  exit 1
fi

TIME=$(date +%s)
CONTAINER_NAME="deco_db_""$1"_"$TIME"

echo "Creating volume: ""$CONTAINER_NAME"

docker volume create "$CONTAINER_NAME"

echo "Creating container: ""$CONTAINER_NAME"

docker run -d \
  -v "$CONTAINER_NAME":/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=user \
  -e POSTGRES_DB=deco \
  --publish 5433:5432 \
  --name="$CONTAINER_NAME" \
  postgres

