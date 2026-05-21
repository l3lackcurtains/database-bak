# Database Bak

Database Bak is an open-source stateful workspace for human + agent collaboration. It keeps important app data, task state, snapshots, and operational context durable across sessions so agents and people can pick up exactly where they left off.

## What It Does

- Persist shared workspace state for humans and agents
- Keep databases, jobs, snapshots, and storage config durable
- Create and restore database snapshots
- Schedule backups with cron-based jobs
- Verify snapshot integrity before restore
- Run with Turso/libSQL or local SQLite

## Stack

- Frontend: Next.js 16, React 19, Tailwind CSS v4, shadcn/ui
- Backend: NestJS 11, BullMQ
- Storage: Turso/libSQL or local SQLite for app data
- Queue: Redis
- Delivery: Docker Compose, GHCR, GitHub Actions

## Why It Exists

Most agent workflows lose context between runs. Database Bak keeps the workspace state durable so a human can return later, an agent can resume safely, and the application data behind that collaboration stays consistent.

## Quick Start

### Development

```bash
bun install
docker compose up -d redis
bun run dev
```

### Environment

Turso/libSQL:
```env
DATABASE_MODE=turso
TURSO_DB_URL=libsql://...
TURSO_AUTH_TOKEN=...
ENCRYPTION_KEY=...
```

Local SQLite:
```env
DATABASE_MODE=sqlite
SQLITE_PATH=./data/database-bak.sqlite
ENCRYPTION_KEY=...
```

Optional auth:
```env
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=changeme
AUTH_SECRET=some-long-secret
```

### Docker

```bash
docker compose up -d --build
```

## Deployment

The project publishes images to GHCR on `main`:
- `ghcr.io/l3lackcurtains/database-bak/server`
- `ghcr.io/l3lackcurtains/database-bak/ui`

For Dokploy or other container hosts, set the env vars above and point CORS to your UI origin in `apps/api/src/main.ts`.

## Repository Topics

Suggested GitHub topics:
- `database-backup`
- `database-restore`
- `postgresql`
- `mongodb`
- `sqlite`
- `nestjs`
- `nextjs`
- `bullmq`
- `docker`
- `ghcr`

## License

MIT
