# Court Scheduler

Weekly court-slot scheduling for a basketball club. The admin assigns coaches
to fixed training slots; each coach gets a personal link (shared over WhatsApp)
where they confirm, cancel or request a swap for their slots. No passwords for
coaches. Slots nobody confirms in time are released and can be claimed by
another coach.

## Features

**Admin panel** (`/admin`, protected by an admin password)
- Manage coaches and assign each one to fixed weekly slots
- Generate a permanent personal access link per coach, or links for everyone at once
- Week-by-week view of confirmed / pending / cancelled / swap-requested slots
- Usage statistics across recent weeks

**Coach view** (`/entrar?t=<token>`)
- Mobile-first page opened straight from WhatsApp, no login
- Confirm, cancel or ask to swap each slot, with an optional note
- Navigate up to two weeks ahead
- Claim slots another coach lost after the confirmation deadline

**Public calendar** (`/calendar`)
- Seven-day grid of who is on court, readable on a phone without scrolling sideways

## Tech stack

| | |
|---|---|
| Framework | Next.js 14 (App Router, Route Handlers), TypeScript |
| Database | Supabase (Postgres) — all access goes through server routes with the service key; the anon role has no table access |
| Styling | Tailwind CSS + custom CSS |
| Auth | Admin password header for `/api/admin/*`; random UUID tokens for coaches |

Data model: `tecnicos` (coaches) → `horarios` (fixed weekly slots) → `confirmacoes`
(one row per slot per week, status `pendente | confirmado | cancelado | troca`),
plus `tokens_acesso` for coach links. See `supabase/migrations/001_schema.sql`.

## Running locally

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase keys, app URL, admin password, club name
npm run dev
```

Apply the schema by running `supabase/migrations/001_schema.sql` in the Supabase SQL editor.

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side database access (never exposed to the browser) |
| `NEXT_PUBLIC_APP_URL` | Base URL used in coach links |
| `ADMIN_PASSWORD` | Password for the admin panel |
| `NEXT_PUBLIC_CLUB_NAME`, `NEXT_PUBLIC_CLUB_SHORT_NAME` | Club branding shown in the UI (optional) |

## Roadmap

- Automatic WhatsApp delivery of links via Twilio (currently links are shared manually)
