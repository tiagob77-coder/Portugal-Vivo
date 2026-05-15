# Operations runbook

What to do when something goes wrong in production. Keep it short and
copy-paste-friendly.

## Health checks

```bash
# Backend liveness (no DB hit)
curl -fsS https://api.portugalvivo.pt/api/health

# Detailed (includes DB + Redis)
curl -fsS https://api.portugalvivo.pt/api/health/detailed

# Prometheus metrics
curl -fsS https://api.portugalvivo.pt/api/metrics | head -20
```

## Common incidents

### 1. 5xx spike

```bash
# Sentry will already have an issue — open it and skim the request_id.
# To grep the host logs by request_id:
docker compose -f docker-compose.prod.yml logs backend | grep '"request_id":"<id>"'
```

If the trace mentions `Database not initialized` → check
`docker compose ps mongodb`, then `docker compose logs mongodb | tail -50`.

If the trace mentions LLM → set the offending provider's key env var to
empty (forces fallback) and redeploy.

### 2. 429 surge

Most likely the global rate limit is too tight for an event/campaign.
The Redis-backed sliding window is shared across backend workers, so:

```bash
# Inspect current keys
docker compose -f docker-compose.prod.yml exec redis redis-cli --scan --pattern 'rate-limit:*' | head -20

# Per-endpoint limits live in backend/rate_limiter.py ENDPOINT_LIMITS.
# Auth bucket: AUTH_RATE_LIMIT / AUTH_RATE_WINDOW in server.py.
```

To flush a specific bucket (use sparingly):

```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli DEL <key>
```

### 3. Mongo at the edge of disk / memory

`mongo:6` ships with sensible defaults but no hard cap. To inspect:

```bash
docker compose -f docker-compose.prod.yml exec mongodb mongosh --quiet --eval \
  'db.adminCommand({ serverStatus: 1 }).mem'
docker compose -f docker-compose.prod.yml exec mongodb \
  du -sh /data/db
```

The biggest single risk is the `uploaded_images` collection (base64
fallback when Cloudinary is not configured). If it crosses 1 GiB:

```bash
# Sample size
docker compose -f docker-compose.prod.yml exec mongodb mongosh portugal_vivo --quiet --eval \
  'db.uploaded_images.estimatedDocumentCount()'

# Drop oldest 30 days
docker compose -f docker-compose.prod.yml exec mongodb mongosh portugal_vivo --quiet --eval \
  'db.uploaded_images.deleteMany({created_at: {$lt: ISODate("2025-01-01")}})'
```

Plan: enable Cloudinary properly (`CLOUDINARY_CLOUD_NAME` /
`CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` in `.env`) and re-deploy
so future uploads bypass Mongo entirely.

## Deploy

CI workflow `deploy.yml` is approval-gated. Manual deploy is via SSH
from the GitHub Actions runner; rollback is automatic on health-check
failure (90 s window).

To redeploy manually:

```bash
# On the host
cd /srv/portugalvivo
git pull
docker compose -f docker-compose.prod.yml pull backend
docker compose -f docker-compose.prod.yml up -d backend
```

## Backups

See [`BACKUP.md`](BACKUP.md). Short version:

```bash
# Activate the backup service (one-off, requires `--profile backup`)
docker compose -f docker-compose.prod.yml --profile backup up -d backup

# Force an out-of-cycle dump
docker compose -f docker-compose.prod.yml --profile backup run --rm backup

# List dumps
docker compose -f docker-compose.prod.yml --profile backup exec backup ls -lh /backups
```

## Geocoding GPS for new POIs

When the editorial team uploads a new Excel master:

```bash
# 1. Audit + propose coordinates without touching the master
cd backend
python -m scripts.correct_gps_excel \
  --input ../data/PortugalVivo_BaseDados_POI_v19.xlsx \
  --output-prefix v19 \
  --user-agent "PortugalVivo/1.0 (+contacto@portugalvivo.pt)"

# 2. Editor reviews v19_audit.csv and v19_corrected.xlsx,
#    merges the GPS_RESOLVED column into the master.
# 3. Re-run the import flow.
```

## Credentials rotation

- **Atlas** — Database Access → user → "Edit Password". Update
  `.env`, restart compose.
- **Stripe** — Stripe dashboard → keys → roll. Update `STRIPE_SECRET_KEY`
  and `STRIPE_WEBHOOK_SECRET` in `.env`, restart compose. Confirm the
  webhook still authenticates by sending a test event from the Stripe
  dashboard.
- **JWT_SECRET_KEY** — `python -c "import secrets; print(secrets.token_hex(64))"`.
  Note that rotating invalidates every active session.
- **GitHub** — Settings → Secrets → rotate. `EXPO_TOKEN`, S3 keys, etc.

## Useful one-liners

```bash
# Tail nginx errors
docker compose -f docker-compose.prod.yml logs --tail=100 -f nginx

# Tail backend JSON logs (jq for pretty)
docker compose -f docker-compose.prod.yml logs --tail=100 backend | jq .

# Re-run the smoke workflow
gh workflow run smoke-test.yml --field base_url=https://api.portugalvivo.pt
```
