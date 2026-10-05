@AGENTS.md

# Zeke — working notes

- Next.js 16 (App Router, `proxy.ts` not middleware; `params`/`searchParams`/`cookies()` are async). Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Layers: pages/components → server actions (`features/*/actions.ts`) or `/api/v1` route handlers → services (`features/*/services`) → repositories → Drizzle. Never query the DB from components.
- Every service takes a `ServiceContext` and calls `assertPermission`; every repository query filters by `organizationId`.
- Pure business logic lives in `features/*/domain` with colocated `*.test.ts`. Config/constants live in `src/config`.
- Design tokens are in `src/app/globals.css` (prototype palette, AA-checked). Use token classes (`text-foreground-faint`, `bg-violet-tint`, `text-at-risk`…), never raw hex in components. Chart colors come from `components/charts/palette.ts`.
- Checks: `npm run typecheck && npm run lint && npm test && npm run test:integration`.
- `npm run db:seed` wipes the database in `DATABASE_URL`.
