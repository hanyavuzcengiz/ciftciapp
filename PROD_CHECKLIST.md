# Production Checklist

## 1) Environment
- Copy `.env.example` to `.env` and set secure values (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_API_KEY`, `REQUEST_SIGNING_SECRET`).
- Set `NEXT_PUBLIC_API_URL` to API gateway public URL.
- Set `NEXT_PUBLIC_ENABLE_MOCK_DATA=false` for production.
- Set `EXPO_PUBLIC_ENABLE_MOCK_DATA=false` for production mobile builds.
- Configure `OPENAI_API_KEY` and `GOOGLE_MAPS_API_KEY` if features are enabled.

## 2) Database & Migrations
- Run user-service migrations:
  - `pnpm db:user:migrate`
- Run listing-service migrations:
  - `pnpm db:listing:migrate`
- (Optional) demo seed only in staging:
  - `pnpm db:seed:live`

## 3) Service Health
- Start services:
  - `pnpm dev:services`
- Run smoke checks:
  - `pnpm smoke:prod`
  - `pnpm smoke:prod:json` (CI-friendly structured output)
- Verify gateway routes:
  - listings, search, listing category spec, health endpoints.

## 4) Web App (admin-panel)
- Start web:
  - `pnpm --filter @agromarket/admin-panel dev`
- Verify:
  - `/` dashboard cards + widget modal
  - `/listings/new` multi-step form + media + map + submit
  - `/profile` stats + tables + charts
- Confirm auth header simulation works from top nav inputs (`x-user-id`, token).

## 5) Mobile App
- Start mobile:
  - `pnpm --filter @agromarket/mobile dev -- --clear --host lan --port 8081`
- Validate:
  - Home feed render
  - Search filters and skeletons
  - Post flow + AI suggest + publish
  - Push registration does not crash app when `projectId` unavailable.

## 6) Release Gates
- `pnpm typecheck`
- `pnpm test`
- Ensure no local mock flags are left enabled in production env.
- Verify API fallback behaviors are intentional and monitored.

## 7) CI Gates
- General CI:
  - `.github/workflows/ci.yml`
- Smoke CI (services + migration + endpoint checks):
  - `.github/workflows/ci-smoke.yml`
- For CI parsing:
  - `pnpm smoke:prod:json`

## 8) Payment/PSP Go-Live Gates
- Confirm `payment-service` production boot **fails** if `PAYMENT_ALLOW_INMEMORY=true` (no in-memory fallback in prod).
- Enable and verify signed callback/webhook validation end-to-end (`REQUEST_SIGNING_SECRET` rotation plan included).
- Verify idempotency strategy for `intent`, `confirm`, `refund` flows (same request id / provider id -> single financial outcome).
- Ensure reconciliation source exists (provider settlement export or API) and daily mismatch alerting is defined.
- Define operational limits: max retry attempts, timeout budget, and failure escalation path (on-call + incident channel).
