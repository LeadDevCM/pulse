@AGENTS.md

# Pulse — Mending Minds Post-Session Survey Platform

HIPAA-compliant SMS survey platform for Mending Minds Therapy (Cedar City, UT).

## Tech Stack
- **Framework**: Next.js 14+ (App Router, React Server Components)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 with custom theme tokens in `globals.css`
- **Data**: Vercel KV (Redis) with AES-256-GCM encryption for all PHI
- **Auth**: NextAuth.js v4 (credentials provider, JWT sessions, 30min timeout)
- **SMS**: Telnyx (HIPAA tier, toll-free)
- **Automation**: n8n (self-hosted) for batch scheduling and auto-purge cron
- **Charts**: Recharts
- **Icons**: Tabler Icons + Phosphor Icons only (never Lucide/Feather/Heroicons/emoji)

## Project Structure
```
src/
  app/           — Next.js App Router pages and API routes
    (auth)/      — Authenticated pages (dashboard, admin) with sidebar layout
    (public)/    — Public pages (survey form)
    api/         — REST API routes
    login/       — Login page
  components/    — React components (ui/, survey/, dashboard/, admin/, layout/, auth/)
  lib/           — Core libraries (encryption, audit, auth-guard, telnyx, tokens, seed)
  types/         — TypeScript types and NextAuth augmentation
```

## Key Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `POST /api/seed` — Seed database (dev only)

## HIPAA Rules
- All PHI (client names, phones, survey answers) MUST be encrypted via `lib/encryption.ts` before storage
- Never log PHI — audit logs contain only resource IDs and action metadata
- All PHI access MUST call `logAudit()` from `lib/audit.ts`
- Survey responses auto-purge at 90 days (KV TTL + n8n cron backup)
- Audit logs retained 6 years
- No PHI in URLs, cookies, or browser storage

## Roles
- **owner**: Full access (Kendra Jones, Chelsee Jackson)
- **clinician**: Own responses and trends only
- **office_manager**: Client roster, send/schedule surveys, aggregate stats (no individual responses)
