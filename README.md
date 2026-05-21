# Database Bak

> **Database Backup & Sync Dashboard** — manage backups, snapshots, and sync schedules across PostgreSQL, MongoDB, and SQLite databases.

## Features

- **Multi-database support** — PostgreSQL, MongoDB, SQLite
- **Scheduled backups** — cron-based job scheduling with BullMQ
- **Snapshot management** — create, download, and restore snapshots
- **Storage providers** — S3-compatible storage for backups
- **Encryption at rest** — database credentials encrypted with AES-256
- **Job monitoring** — real-time queue monitoring dashboard
- **Dashboard analytics** — backup stats, storage usage, job history

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, Zustand |
| Backend | NestJS 11, TypeORM, BullMQ |
| Database | Turso (libSQL) for config, PostgreSQL/MongoDB for backups |
| Queue | Redis + BullMQ |
| Container | Docker Compose, GHCR |
| CI/CD | GitHub Actions |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- [Docker](https://docker.com) + [Docker Compose](https://docs.docker.com/compose/)

### Local Development

```bash
# Install dependencies
bun install

# Start Redis (required for job queue)
docker compose up -d redis

# Start API (port 3000) and Webapp (port 7100)
bun run dev
```

Set up environment variables (see `.env`):
```
TURSO_DB_URL=libsql://...
TURSO_AUTH_TOKEN=...
ENCRYPTION_KEY=...
```

### Docker Compose

```bash
docker compose up -d --build
```

## Deployment

### Dokploy

1. Set your environment variables in the Dokploy dashboard:
   - `TURSO_DB_URL`, `TURSO_AUTH_TOKEN`, `ENCRYPTION_KEY`
   - `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD` (optional auth)
   - `AUTH_SECRET` (optional session secret)

2. Pre-built images are published to GHCR:
   - `ghcr.io/l3lackcurtains/database-bak/api:latest`
   - `ghcr.io/l3lackcurtains/database-bak/webapp:latest`

3. Update CORS origins in `apps/api/src/main.ts` to include your domain.

### GitHub Container Registry

Images are automatically built and pushed on every push to `main`:
- `ghcr.io/l3lackcurtains/database-bak/api`
- `ghcr.io/l3lackcurtains/database-bak/webapp`

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌────────┐
│  Next.js 16 │────▶│  NestJS 11  │────▶│ Redis  │
│  (webapp)   │     │  (api)      │     │ (bull) │
│  :7100      │     │  :3000      │     │        │
└─────────────┘     └──────┬──────┘     └────────┘
                           │
                    ┌──────┴──────┐
                    │    Turso    │
                    │   (libSQL)  │
                    │  (config)   │
                    └─────────────┘
```

## License

MIT
