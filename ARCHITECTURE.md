# Architecture

This document is the short overview new contributors read first.
For deep dives go to:

- `CLAUDE.md` — coding conventions and the stack the project is *required* to follow.
- `docs/TECH_STACK.md` — fuller tech stack with rationale per choice.
- `docs/API_DOCUMENTATION.md` — endpoint catalogue.

## Components

```
┌───────────────────┐     ┌───────────────────┐
│  PWA / Mobile     │     │  Editorial team   │
│  (Expo + MapLibre)│     │  (Excel master)   │
└───────┬───────────┘     └────────┬──────────┘
        │ HTTPS / SSE              │ scripts/correct_gps_excel.py
        ▼                          ▼
┌─────────────────────────────────────────────┐
│   nginx (TLS, security headers, sitemap     │
│          proxy, rate-limit zone)            │
└────────────────────┬────────────────────────┘
                     │ proxy_pass http://backend
                     ▼
┌─────────────────────────────────────────────┐
│  FastAPI (Python 3.11, async, Motor)        │
│  - auth (bcrypt, sessions)                  │
│  - 92 *_api.py routers                      │
│  - rate limiter (Redis ZSET)                │
│  - CSRF middleware                          │
│  - Sentry + Prometheus + JSON logs          │
└──┬─────────────┬──────────────┬─────────────┘
   │             │              │
   ▼             ▼              ▼
┌──────┐    ┌──────┐    ┌────────────────┐
│Mongo │    │Redis │    │ Optional:      │
│Atlas │    │      │    │ OpenAI/Emergent│
│ +TLS │    │      │    │ Cloudinary     │
│      │    │      │    │ Stripe         │
└──────┘    └──────┘    └────────────────┘
```

## Backend conventions

- **Dependency injection** — every router resolves the database through
  `dependencies.get_db()` (the legacy `_db = None / set_X_db()` pattern
  has been migrated for all 30 routers under ARCH-002; the setters are
  kept as no-op shims pending a final removal sweep).
- **Tenancy** — multi-tenant by `municipality_id`. `tenant_middleware`
  exposes `require_tenant_read/write/delete` and `TenantContext.mongo_filter()`
  produces the right Mongo filter for the current role.
- **Auth** — session token (not JWT). bcrypt for new accounts, silent
  PBKDF2→bcrypt migration on login for legacy hashes. CSRF double-submit
  in production.
- **Rate limit** — Redis sliding-window ZSET with in-memory fallback.
  Auth endpoints have their own bucket; trusted proxies (`TRUSTED_PROXIES`
  env var) are the only senders whose `X-Forwarded-For` we trust.
- **LLM** — never call providers directly. Use `llm_client.call_chat_completion`;
  it picks OpenAI when `OPENAI_API_KEY` is set, falls back to Emergent
  proxy when `EMERGENT_LLM_KEY` is set, returns `None` otherwise.
- **Geo** — Mongo `$geoWithin` + `$nearSphere`. No PostGIS. CAOP-backed
  validation in `geo_validator.py`.

## Frontend conventions

- **Routing** — expo-router v6 (file-based, `app/`).
- **Server state** — TanStack Query (`useQuery`, `useMutation`).
- **Client state** — Zustand stores; Context only for cross-cutting
  concerns (auth, theme, favourites).
- **Logging** — never `console.*` directly. Use `src/utils/logger`:
  `logger.debug/info` is gated on `__DEV__`, `logger.warn/error` flows
  through to Sentry breadcrumbs.

## Where things live

| Concern | Location |
|---|---|
| Public routes / screens | `frontend/app/` (expo-router file-based) |
| Shared components | `frontend/src/components/` |
| API client | `frontend/src/services/api.ts` |
| Backend entrypoint | `backend/server.py` |
| Backend routers | `backend/*_api.py` |
| DB dependency | `backend/dependencies.py` |
| Multi-tenant gate | `backend/tenant_middleware.py` |
| Geo validator + CAOP | `backend/geo_validator.py`, `backend/services/caop_*` |
| LLM client | `backend/llm_client.py` |
| LLM cache | `backend/llm_cache.py` |
| Rate limiter | `backend/rate_limiter.py` |
| Tests | `backend/tests/`, `frontend/src/components/__tests__/` |
| E2E | `e2e/` (Playwright + Maestro) |
| Ops / Compose | `docker-compose.prod.yml`, `ops/` |
| Audit reports | `docs/audits/` |

## Boundaries that are sacred

Some choices are non-negotiable because they protect tenants or compliance:

- **Never call LLM via raw `httpx`** — bypasses provider failover, retries
  and prompt-cache hits. Always use `llm_client`.
- **Never query Mongo without the tenant filter** for routes that operate
  on tenant-owned data. Use `apply_municipality_filter()` or `Depends(require_tenant_*)`.
- **Never fabricate GPS coordinates** in the import pipeline. POIs without
  a verified coordinate are skipped + logged, not synthesized.
- **Never log PII to console / Sentry**. The Sentry SDK has `send_default_pii=False`
  for this reason.
