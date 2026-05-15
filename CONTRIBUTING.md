# Contributing

Short, practical guide for getting a change from your laptop into `main`.
Long-form architecture lives in [`ARCHITECTURE.md`](ARCHITECTURE.md);
coding conventions live in [`CLAUDE.md`](CLAUDE.md).

## TL;DR

1. Branch from `main` with a descriptive name (`feature/...`,
   `fix/...`, `claude/...`).
2. Run the suite locally **before** pushing:
   ```bash
   cd backend && python -m pytest tests/ -q
   cd frontend && npm test -- --passWithNoTests && npx tsc --noEmit && npm run lint
   ```
3. Open a draft PR. CI runs Backend Tests, Frontend Tests, Frontend Web
   Build, Docker Build, Scan de Segredos. Codex review fires
   automatically.
4. Address Codex comments (use `pull_request_review_write`'s
   `resolve_thread` once the fix is in).
5. Mark Ready for Review when CI is green.

## Local setup

### Backend

```bash
cd backend
cp .env.example .env       # fill MONGO_URL, DB_NAME, JWT_SECRET_KEY (64+ chars)
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Or, with Docker Compose:

```bash
docker compose up --build       # starts mongo + redis + backend + seed
```

### Frontend

```bash
cd frontend
cp .env.example .env       # fill EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
npm install
npm run web                # browser, port 3000
npm run android            # emulator
npm run ios                # simulator
```

## Conventions worth knowing

- **PT-PT in product strings**, but commit messages, PR titles/bodies and
  code identifiers are **English**.
- **No emojis in code or commits** unless the user explicitly asks for
  them.
- **Branch protection**: `main` only accepts merges via PR. Don't push
  directly.
- **Commit titles**: imperative mood, Conventional Commits prefix:
  `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, `sec:`,
  `ops:`. Keep under ~70 chars; details go in the body.
- **Tests are mandatory** for new backend modules. Pure-function tests
  are preferred (they run on every machine without Mongo / Redis); use
  `@requires_db` only when an integration test genuinely needs the
  service.
- **Don't add `any`** in TypeScript. Use `unknown`, a concrete type, or
  one of `Json` / `AnyRecord` / `ApiParams` from `src/types/index.ts`.
- **Don't `console.log` in app code.** Use `logger` from
  `src/utils/logger`. The `__DEV__` gate filters it out of production
  bundles.

## Working with Codex review

Every PR gets a Codex review pass. Treat its `P1` comments as blockers
and `P2` as strong suggestions. Reply to each thread either with a
commit reference (`Fixed in <sha>`) or a justification for why the
suggestion does not apply. The audit history of PR #156, #162 has good
examples.

## What goes where

| You changed... | Pick the right home |
|---|---|
| API endpoint | `backend/<name>_api.py`. Register in `server.py`. |
| Shared DB helper | `backend/shared_utils.py` if it can be reused. |
| Frontend screen | `frontend/app/<route>.tsx` (expo-router). |
| Reusable UI | `frontend/src/components/`. Split `.web.tsx` / `.native.tsx` when behaviour diverges. |
| Doc you're going to read once a year | `docs/`. |
| Doc someone needs at first contact | root (`README`, `CHANGELOG`, `SECURITY`, `CLAUDE`). |
| Ops runbook | `ops/`. |
| Audit report | `docs/audits/`. |

## Reporting security issues

See [`SECURITY.md`](SECURITY.md). Never open a public issue for a
vulnerability — e-mail `security@portugalvivo.pt`.
