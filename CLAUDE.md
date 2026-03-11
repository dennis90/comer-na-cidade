# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint

npm run db:generate  # Generate Drizzle migrations from schema changes
npm run db:migrate   # Apply migrations to Turso DB
npm run db:studio    # Open Drizzle Studio (DB GUI)
npm run db:seed:cities      # Seed ~5570 Brazilian cities from municipios.csv
npm run db:seed:categories  # Seed 12 food categories
```

No test framework is configured.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:
- `DATABASE_URL` + `DATABASE_AUTH_TOKEN` — Turso/libsql credentials
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_RESEND_KEY` — Resend API key for magic link emails
- `NEXT_PUBLIC_APP_URL` — app root URL (used in auth email links)
- R2 vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `NEXT_PUBLIC_R2_PUBLIC_URL`) — Cloudflare R2 for image uploads

## Architecture

### Stack
- **Next.js 16** (App Router + Turbopack) + **React 19** + **TypeScript**
- **Drizzle ORM** + **Turso** (libsql) — SQLite-compatible, edge-ready
- **Auth.js v5** (NextAuth beta) — magic link via Resend, no passwords
- **Tailwind v4** + **shadcn/ui v4** — oklch colors, CSS variables, Radix primitives
- **Cloudflare R2** — image storage via S3 presigned URLs

### Path Alias
`@/*` maps to `src/*`.

### Routing & Auth
- `/dashboard/*` is protected via `src/middleware.ts` which checks `req.auth` (Auth.js session) and redirects to `/login?callbackUrl=...`
- Auth handler: `src/app/api/auth/[...nextauth]/route.ts`
- Session type is extended in `src/types/next-auth.d.ts` to include `user.id`

### Dashboard (owner-facing)
Server components fetch data directly from DB; client components handle mutations via fetch to API routes.

| Route | Purpose |
|---|---|
| `/dashboard` | Completeness indicator + publish toggle |
| `/dashboard/perfil` | Commerce profile (name, logo, address, categories, modalities) |
| `/dashboard/cardapio` | Markdown menu editor |
| `/dashboard/horarios` | Weekly operating hours (7-day grid) |

### Public Catalog
- `/comercio/[slug]` — individual commerce page
- `/restaurantes/[estado]/[cidade]/[categoria]` — browse by state/city/category

### API Routes (`src/app/api/`)
All routes authenticate via `auth()` from `src/auth.ts` and return `{ error }` with appropriate status on failure.

| Route | Methods | Purpose |
|---|---|---|
| `/api/commerce` | POST, PATCH | Create/update commerce profile |
| `/api/commerce/hours` | GET, PUT | Replace all operating hours (array of 7, nulls = closed) |
| `/api/menu` | GET, PUT | Get/replace markdown menu |
| `/api/cities/search` | GET | Autocomplete city search |
| `/api/upload/logo` | POST | Presigned R2 URL for logo |
| `/api/upload/menu-image` | POST | Presigned R2 URL for menu image |

### Database Schema (`src/db/schema.ts`)
Key domain tables:
- `commerces` — one per owner; has `ownerId`, `cityId`, `slug`, `published`, logo/contact fields
- `commerceCategories` — many-to-many (commerce ↔ category)
- `commerceModalities` — delivery/dine_in/takeout with optional delivery radius
- `operatingHours` — `dayOfWeek` 0–6, `opensAt`/`closesAt` as `HH:MM` strings
- `menus` — single markdown `content` field per commerce
- `cities` + `categories` — reference data, seeded via npm scripts

Auth.js tables (`users`, `accounts`, `sessions`, `verificationTokens`) are also in the same schema file.

### UI Conventions
- shadcn components live in `src/components/ui/` — use `sonner` for toasts (the `toast` component is deprecated in shadcn v4)
- Dashboard-specific components: `src/components/dashboard/`
- `cn()` utility in `src/lib/utils.ts` (clsx + tailwind-merge)
- `slugify()` in `src/lib/slugify.ts` (NFD normalization for Brazilian city/commerce names)

### Task Docs
`docs/TASK_1.md` through `docs/TASK_10.md` define the full build plan with code snippets and verification checklists. `docs/SPEC.md` is the full product specification. Always verify prerequisites listed at the top of each task file before implementing it.
