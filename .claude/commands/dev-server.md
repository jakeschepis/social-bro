Start the full local development environment for social-bro.

## Steps

### 1. Check Docker is running

Verify Docker daemon is available:

```
docker info > /dev/null 2>&1
```

If Docker is not running, launch it with `open -a "Docker Desktop"` and poll until `docker info` succeeds (up to 60s).

### 2. Start PostgreSQL container

```
docker compose up -d postgres
```

Wait for the database to be healthy. Confirm container `social-bro-db` is running and port `5435` is mapped.

### 3. Install dependencies (if needed)

Check if `node_modules` exists. If not, run `npm install`.

### 4. Generate Prisma client

IMPORTANT: The npm scripts unset DATABASE_URL which causes failures. Always run Prisma commands directly with DATABASE_URL set:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/social_bro" npx prisma generate
```

### 5. Run database migrations

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/social_bro" npx prisma migrate dev
```

If migrations fail due to drift, fall back to `db push` to sync without resetting data:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5435/social_bro" npx prisma db push
```

### 6. Start Next.js dev server

```
npm run dev
```

Run this in the background so the conversation can continue.

### 7. Verify

Read the server output to confirm it started on `http://localhost:3000`.

## Argument Handling

- `--db-only`: Only start Docker PostgreSQL, skip the Next.js server.
- `--app-only`: Skip Docker, only start Next.js (assumes DB is already running).
- `--fresh`: Tear down existing containers and volumes first (`docker compose down -v`), then start everything clean.

If `$ARGUMENTS` contains one of these flags, adjust the steps above accordingly.

## Troubleshooting

- If port 5435 is in use: `docker compose down` then retry.
- If port 3000 is in use: find and report the process using `lsof -i :3000`.
- If Prisma migration fails: check that `.env` has the correct `DATABASE_URL` (`postgresql://postgres:postgres@localhost:5435/social_bro`).
