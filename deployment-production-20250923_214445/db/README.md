# @teleplatform/db

- Prisma schema and client
- Run `cp .env.example .env` and set `DATABASE_URL`
- Generate client: `pnpm --filter @teleplatform/db prisma:generate`
- Create migration: `pnpm --filter @teleplatform/db prisma:migrate`
