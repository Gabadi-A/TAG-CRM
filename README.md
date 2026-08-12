# TAG CRM

CRM + proposal builder for The Abadi Group. Built the same way as TAG Financials:
**Next.js 16 · React 19 · TypeScript · Tailwind 4 · Prisma (Postgres) · NextAuth v5**,
deployed on **Vercel**.

The CRM is the **money-and-status ledger** — the numbers layer on top of Basecamp (files
and comms stay in Basecamp). It tracks every quote, what it's worth, and where it stands.

## What's inside

- **Dashboard** — open pipeline, weighted forecast, won, win rate, and a curated
  **Where to focus** board: admins pin the opportunities the team should chase (falls back to
  auto-ranking by closing probability when nothing is pinned). Plus value by stage, top
  contractors (existing clients flagged), and open pipeline by trade.
- **Quotes** — every trade quote as its own line (`project·trade·version`) with its own
  status (draft / ready / sent / in-revision / on-hold / won / lost) and value. One project
  can be part-won and part-lost. Searchable, filterable, sortable.
- **Opportunities** — the master project list, sorted by closing probability so the best bets
  sit on top; star to pin to the focus board. Detail page per project (stage, quotes,
  takeoffs, proposals, notes).
- **Contractors** — the land-and-expand scoreboard: open pipeline, won-to-date, and win rate
  per builder, with clients vs. prospects.
- **Follow-ups** — every deal with no contact in 30+ days, one-click "log contact today".
- **Proposals** — the two-layer proposal/PDF engine (Summary + per-trade Scope pages,
  alternates, package discount, versioned quote numbers). Available per project; kept off the
  main nav for now.

## Roles

Email/password auth (NextAuth). Two roles: **ADMIN** curates (edit stage, log contact, pin to
focus, create proposals) and **MEMBER** is read-only — "you curate, the team views." Role is
set on the `User` record (`ADMIN` | `MEMBER`); the seed makes `SEED_ADMIN_EMAIL` an admin and
the rest of the team members.

## Local development

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and AUTH_SECRET
npx prisma db push            # create the tables
npm run seed                  # load contractors, projects, team logins, sample proposal
npm run dev                   # http://localhost:3000
```

Generate an `AUTH_SECRET` with: `openssl rand -base64 32`.

## Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. In Vercel, **Add New → Project** and import the repo.
3. Add a Postgres database (Vercel **Storage → Postgres**, or Neon / Supabase). Copy its connection string.
4. Set **Environment Variables** in Vercel:
   - `DATABASE_URL` — the Postgres connection string
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `ANTHROPIC_API_KEY` — for the proposal drafting helper (optional to start)
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — for the first login
5. Deploy. The build runs `scripts/deploy-db.mjs` (pushes the schema) then `next build`.
6. Load your data once — from your machine, pointed at the same `DATABASE_URL`:
   ```bash
   npm run seed
   ```

## Logins

Seeded users (change passwords after first login):

- Admin: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
- Team (Rocío, Gerardo, Samantha, Cristina, Julieta, Sam, Javier): `first@theabadigroup.com` / `tag-temp-2026`

## Data model (Prisma)

`Project` (+ `focus` pin) ← `Contractor` (+ `Contact`), with `Quote` (per trade — version,
value, status), `Takeoff` (per trade + progress status), and `Proposal`
→ `SummaryLine`, `Alternate`, `ScopeSection` → `ScopeProduct` / `ScopeMaterial`. See
`prisma/schema.prisma`.

> After pulling schema changes, run `npx prisma db push` (or let the Vercel build's
> `deploy-db.mjs` do it) and re-run `npm run seed` to materialize quotes for existing projects.

## Notes / next steps

- **Excel import**: `exceljs` is included so we can import your current Google Sheet /
  Excel proposals to bulk-seed projects and pricing.
- **Claude drafting**: `@anthropic-ai/sdk` is wired for generating scope language and
  summarizing notes.
- **Pricing sub-sheets**: the trade pricing layer (qty × unit + shipping/delivery/install/
  hardware adders, like the Cabinetry/Countertop sheets) can be expanded into full editable
  calc tables feeding each summary line.
