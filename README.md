# Zeke AI — Customer Success Platform

A multi-tenant B2B SaaS for customer-success teams: account intelligence, explainable health scoring,
segmentation, AI-assisted recommendations and agent-based workflow automation.

Built from the product prototype in [`docs/prototype.html`](docs/prototype.html) — the prototype is the
design and product specification; this codebase re-implements it with a production architecture.

## Quick start

Requirements: Node 20.9+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env            # set DATABASE_URL, AUTH_SECRET (openssl rand -base64 48)
npm run db:migrate              # apply migrations
npm run db:seed                 # 36 accounts, 9 agents, runs, work items, audiences… (wipes data)
npm run dev                     # http://localhost:3000
```

Sign in with any seeded user — password `zeke-demo-2026`:

| Email | Role | Notes |
|---|---|---|
| `alex.rivera@zeke.dev` | Owner | everything |
| `maya.chen@zeke.dev` | Admin | the prototype's "current user"; owns accounts |
| `priya.nair@zeke.dev` | CS Manager | scorecards, agent management, audit |
| `diego.ruiz@zeke.dev` | CSM | restricted to SMB + Mid-Market accounts |
| `riley.park@zeke.dev` | Viewer | read-only |
| `elena.petrova@northstar.dev` | Owner of a **second tenant** | proves tenant isolation |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm test` | unit tests (pure domain logic, no DB) |
| `npm run test:integration` | service-level tests against `TEST_DATABASE_URL` (wiped each run) |
| `npm run test:e2e` | Playwright against a production build + `E2E_DATABASE_URL` (default `zeke_e2e`) — run `npm run build` first |
| `npm run db:generate` / `db:migrate` / `db:seed` | Drizzle migrations and seed |

## Architecture

```
UI (Server Components, client islands)
 ↓  Server Actions (mutations) · Route Handlers /api/v1 (client queries via TanStack Query)
Service layer        src/features/*/services   — authorisation, validation, orchestration, audit
 ↓
Repositories         src/features/*/repositories — tenant-scoped Drizzle queries only
 ↓
PostgreSQL           src/lib/db/schema           — normalised, indexed, FK-constrained
```

* **Domain logic is pure and unit-tested** (`src/features/*/domain`): `calculateHealthScore`, `getHealthBand`,
  `calculatePredictiveRisk`, `findWeakestHealthSignal`, `validateWeights`, `evaluateAudience`,
  `getRiskCandidates`, `getExpansionCandidates`, `checkAgentConflict`, `checkAgentCooldown`,
  `checkAgentEligibility`, `calculateAgentLift`, `spliceBranch`…
* **Configuration is centralised** in `src/config` — health sources, sub-metrics, lifecycle weightings, band
  thresholds, risk/expansion types, navigation, email templates, the default agent library.
* **Tenant isolation**: every service receives a `ServiceContext` built server-side from the session
  (`src/lib/auth/session.ts`); every repository query filters by `organization_id`. Members can also be
  scoped to segments (enforced in the account repository). Organisation IDs never come from the client.
* **Permissions** (`src/lib/permissions`): Owner, Admin, CS Manager, CSM, Viewer → `accounts.read`,
  `accounts.write`, `scorecards.manage`, `audiences.manage`, `agents.launch`, `agents.manage`,
  `work.manage`, `integrations.manage`, `users.manage`, `audit.read`, `settings.manage`. Checked in services;
  the UI only hides controls.
* **Audit log** on every state change (who, what, entity, before/after, IP, user agent).

### Feature map

| Route | Module |
|---|---|
| `/dashboard` | KPIs, health distribution, accounts table, renewal forecast |
| `/accounts`, `/accounts/[id]` | server-paginated account table; account 360 (overview, health, activity, contacts, opportunities, tasks, notes, timeline) |
| `/score-dashboard` | "Why is this score 62?" — portfolio and account deep-dive across sources, sub-metrics and 12-month history |
| `/scorecards` | 12 lifecycle × segment scorecards; versioned weights, thresholds and effective dates |
| `/outcomes` | risk groups and expansion opportunities: observed signal → AI inference → recommended action |
| `/my-work` | work queue fed by manual tasks and agent runs (tasks, approvals, decisions) |
| `/audiences` | nested AND/OR builder, AI audience builder, live vs static snapshot audiences |
| `/agents` | agent library, visual builder, analytics, run detail |
| `/admin` | users & roles, integrations, audit log, workspace settings |

### Agent execution engine

`launchAgent` → eligibility (status, lifecycle, max attempts) → duplicate/conflict check → cooldown →
run created on the agent's current immutable version → automatic steps execute (email, API, automatic
conditions) until a human step (task, approval, manual decision) creates a work item, or a wait schedules
a resume. Completing the work item resumes the run; condition branches are spliced into the run.
Elapsed waits are resumed by `POST /api/cron/agents` (`Authorization: Bearer $CRON_SECRET`) — schedule it
every few minutes in production. Managers can skip a wait or stop a run.

### AI

`src/features/ai` defines an `AIProvider` (`parseAudience`, `generateAgentWorkflow`, `explainHealthScore`,
`generateRootCause`, `recommendAction`, `summarizeAccount`, `answerQuestion`). With `AI_API_KEY` set it uses
Claude (`claude-opus-5-5`) with schema-validated structured outputs; otherwise — or on any error/refusal —
a deterministic rule-based provider. AI output is always a proposal: filters and workflows are shown for
review, and nothing is saved or launched without explicit confirmation.

### Honest limitations of this environment

* **Integrations run in demo mode.** Connection state, schedules and sync runs are real records, but no
  external API is called. Email steps are logged to the timeline rather than delivered; outbound API steps
  are logged, not sent.
* **Invites**: email delivery isn't configured, so admins get a one-time invite link to share.
* **Rate limiting** is in-memory (single instance). Use a shared store (e.g. Redis) when scaling out.
* Revenue figures for expansion and renewal win probability are labelled illustrative defaults.

## Security notes

Server-side authorisation and tenant scoping in every service; Zod validation on every input; hashed
session tokens (SHA-256) in HTTP-only, SameSite=Lax cookies; bcrypt password hashes; CSRF origin checks on
mutating route handlers (Server Actions have built-in origin checks); rate limits on sign-in, sign-up and AI
endpoints; CSV exports neutralise formula injection; secrets only in environment variables.
