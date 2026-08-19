# LiveScanner — Agent Guide

Real-time NSE market scanner. React 19 SPA + Express server, TypeScript throughout.

## Commands

```bash
npm run dev          # dev server on http://localhost:3100 (frontend + API)
npm run lint         # type-check only (tsc --noEmit)
npm run build        # vite build + esbuild server bundle → dist/
npm start            # run production bundle (NODE_ENV=production)
npm run format       # prettier --write "src/**/*.{ts,tsx,css,json}"
```

Note: `dev` hardcodes `PORT=3100` (not 3000 from `.env.example`).

## Architecture

- **Single Express server** (`server.ts`) serves both the SPA and REST API. No separate frontend server in dev — Vite runs as middleware.
- **Server-side logic** lives in `src/server/`:
  - `smartapi/` — Angel One WebSocket feed, scrip master, F&O intelligence
  - `fyers/` — Fyers polling fallback
  - `indices.ts` — universe/index membership (Nifty 50, Bank Nifty, F&O, etc.)
  - `constants.ts` — hardcoded ticker lists
- **Frontend** (`src/pages/`, `src/components/`) — React Router SPA. Entry: `src/main.tsx` → `src/App.tsx`.
- **Path alias**: `@/` resolves to repo root (configured in both `tsconfig.json` and `vite.config.ts`).
- **No database** — all state is in-memory (`Map` objects in `stream.ts`).

## Data Feed Priority

1. **Angel One SmartAPI** (WebSocket) — requires `ANGEL_API_KEY`, `ANGEL_CLIENT_CODE`, `ANGEL_PASSWORD`, `ANGEL_TOTP_SECRET` in `.env`
2. **Fyers** (polling, 3s) — requires `FYERS_ACCESS_TOKEN`
3. **Simulated** (random-walk mock) — automatic fallback when no broker creds

Active source exposed at `GET /api/status/data-source` (`ANGEL` | `FYERS` | `SAMPLE`).

## Environment

Copy `.env.example` → `.env` and fill in credentials. Without any broker creds, the app runs on simulated data. The `.cache/` dir holds the Angel One Scrip Master (auto-downloaded on first run).

## Important Conventions

- **ESM throughout** (`"type": "module"`). Server imports use `.js` extensions even for `.ts` source files (e.g., `import './src/server/smartapi/stream.js'`).
- **No test suite** exists. `npm run lint` is the only verification step.
- **Node engine**: `^22.14.0`. Do not use features requiring newer Node.
- **Tailwind CSS v4** — configured via `@tailwindcss/vite` plugin, not `tailwind.config.js`.
- **Angel WebSocket prices are ×100** — divided by 100 on receipt (`stream.ts:498-499`).
- **Rate limit**: SmartAPI allows 3 req/s — `fetchIntradayBases` enforces 350ms delays.
