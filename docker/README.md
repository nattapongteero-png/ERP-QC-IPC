# Docker Deployment Guide

This guide explains how to run Herbal Medicine ERP using Docker.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+

## Quick Start (SQLite)

The simplest way to run the application with SQLite database:

```bash
# Clone the repository
git clone https://github.com/manoi-bms/herbal-medicine-erp.git
cd herbal-medicine-erp

# Copy environment file
cp .env.example .env

# Build and run
docker-compose up -d

# View logs
docker-compose logs -f app
```

The application will be available at http://localhost:3000

## Production with MySQL

For production environments, you can use MySQL instead of SQLite:

```bash
# Start with MySQL profile
docker-compose --profile mysql up -d

# The app with MySQL will be available at http://localhost:3001
```

## Development Mode

For development with hot-reload:

```bash
# Build and run development container
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app-dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `DB_TYPE` | Database type (`sqlite` or `mysql`) | `sqlite` |
| `JWT_SECRET` | Secret key for JWT tokens | (required) |
| `DATABASE_URL` | Database connection string | (auto-configured) |
| `MYSQL_ROOT_PASSWORD` | MySQL root password | `rootpassword` |
| `MYSQL_USER` | MySQL user | `herbal_user` |
| `MYSQL_PASSWORD` | MySQL password | `herbal_password` |

## Docker Commands

### Build

```bash
# Build production image
docker-compose build

# Build with no cache
docker-compose build --no-cache
```

### Run

```bash
# Start in background
docker-compose up -d

# Start with logs
docker-compose up

# Start specific service
docker-compose up -d app
```

### Stop

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
```

### Database

```bash
# Access SQLite database (inside container)
docker exec -it herbal-erp-app sh
# Then: sqlite3 /app/data/sqlite.db

# Access MySQL database
docker exec -it herbal-erp-mysql mysql -u herbal_user -p herbal_erp
```

## Health Check

The application exposes a health check endpoint:

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-17T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

## Volumes

| Volume | Description |
|--------|-------------|
| `app_data` | SQLite database and application data |
| `mysql_data` | MySQL database files |

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 3000 | app | Main application (SQLite) |
| 3001 | app-mysql | Application with MySQL |
| 3306 | mysql | MySQL database |

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs app

# Check container status
docker-compose ps
```

### Database connection issues

```bash
# Verify database is running
docker-compose ps mysql

# Check MySQL logs
docker-compose logs mysql
```

### Permission issues

```bash
# Fix volume permissions
sudo chown -R 1001:1001 ./data
```

## Security Notes

1. **Change JWT_SECRET** in production
2. **Change MySQL passwords** in production
3. Use **HTTPS** in production (configure reverse proxy)
4. Regularly **backup** your data volumes

## Backup

### SQLite Backup

```bash
# Backup SQLite database
docker cp herbal-erp-app:/app/data/sqlite.db ./backup/sqlite.db
```

### MySQL Backup

```bash
# Backup MySQL database
docker exec herbal-erp-mysql mysqldump -u herbal_user -p herbal_erp > backup.sql
```
