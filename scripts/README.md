Utility scripts and notes for Deco


# Commands

## Create a backup of local db

Create a new Docker volume and container:
```
sh ./create-docker-db.sh <db-name>
```

Create backup of your existing database:
```
PGPASSWORD="password" pg_dump -h localhost -p 5432 -U user deco > deco-db-backup.sql 
```

Import the backup into your new container:
```
PGPASSWORD="password" psql -h localhost -d deco -U user -p 5433 < deco-db-backup.sql
```
