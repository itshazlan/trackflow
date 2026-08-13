# TrackFlow

Web project management & desktop time tracker. pnpm monorepo managed with Turborepo.

## Structure

- `apps/backend` — NestJS API. Drizzle ORM + PostgreSQL, better-auth for auth, Socket.io for realtime, S3 for uploads.
- `apps/web` — Next.js 16 (App Router) frontend, port 3001. Shadcn UI + Tailwind v4, TanStack Query, target quality bar is "setara Linear/Plane" — see `linear-plane-design-system` skill before touching UI.
- `apps/desktop` — Tauri v2 + React desktop time tracker app.
- `packages/shared-types` — types shared between backend and web (`@trackflow/shared-types`, workspace dep).
- `packages/ui` — shared UI components (`@trackflow/ui`).
- `packages/config` — shared tsconfig base.

Root-level docs: `PRD_Lean_Internal.md` and `SDD_Lean_Internal.md` hold product/design intent — check these before large feature work, they're not derivable from code.

## Commands

Run from repo root (Turborepo fans out to the right app):
```bash
pnpm dev          # all apps
pnpm build
pnpm lint
pnpm db:migrate   # backend drizzle migrations
pnpm db:seed
```
Backend-specific (`apps/backend`): `pnpm test`, `pnpm test:e2e`, `pnpm db:generate` (drizzle-kit generate after schema changes).
Desktop (`apps/desktop`): `pnpm tauri dev` / `pnpm tauri build`.

## Backend conventions

- Feature modules live in `apps/backend/src/modules/<name>` (controller/service/dto/module per feature — standard Nest structure).
- DB schema is hand-authored per table in `apps/backend/src/db/schema/*.ts`, barrel-exported via `index.ts`. After editing a schema file, run `db:generate` to produce a migration, then `db:migrate`. Migrations must be idempotent (`IF NOT EXISTS` etc.) — production deploys have broken before on non-idempotent migrations.
- Auth is `better-auth`, configured in `modules/auth/better-auth.config.ts`.
- Realtime updates go through `gateways/` (Socket.io) — check here before adding polling for something that could push live.
- `scratch-*.ts` files at the backend root are throwaway manual test scripts, not part of the app — ignore them when exploring structure, don't treat as examples of conventions.

## Web conventions

- Route groups: `(dashboard)` is the authenticated app shell; `login`/`register`/`auth` are pre-auth pages.
- UI components: prefer `@trackflow/ui` (shared) or `src/components/ui` (Shadcn primitives) over new one-offs.
- Load the `linear-plane-design-system` skill before building or reviewing any screen/component — it's the house UI/UX bar for this app.

## Known gotchas

- Avatar/image updates need explicit cache-busting — browsers and HTTP cache aggressively cache profile images by URL.
- Screenshot widget (desktop) must not steal window focus when it appears.
- Preserve scroll position across navigation in the main dashboard container — users lose place otherwise on back-navigation.
