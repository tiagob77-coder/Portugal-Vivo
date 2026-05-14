# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · versões
[semver](https://semver.org/).

## [Unreleased]

### Security
- **AUTH_BACKEND_URL** deixa de ter default para `demobackend.emergentagent.com`;
  `/auth/session` responde 503 quando a variável não está configurada (SEC-001).
- Password mínima sobe de 6 → 8 caracteres + blocklist das 11 mais comuns (SEC-002).
- Stripe webhook recusa pedidos quando `STRIPE_WEBHOOK_SECRET` não está definido;
  startup em produção falha de forma audível sem o secret (CFG-001).
- Uploads validados por magic bytes (Pillow) com limites de dimensão (16-8192 px);
  content-type do cliente passa a advisory, MIME canónico decidido pelos bytes
  reais (SEC-010).
- Rate limit dos endpoints de auth movido para sliding-window Redis ZSET com
  fallback in-memory; deixa de perder contagens entre workers (SEC-012).
- Login recusa contas tombstoned (RGPD post-erase).

### Added
- **RGPD**: páginas de Privacidade (`/privacy`) e Termos (`/terms`) (LEGAL-001/002).
- **RGPD**: `GET /api/auth/export-data` retorna JSON com perfil (sem hash de
  password) e todas as colecções por utilizador (LEGAL-005).
- **RGPD**: `POST /api/auth/delete-account` com double-confirm, re-prompt de
  password, tombstone de 30 dias e registo em `audit_log` (LEGAL-003).
- UI no Profile tab: exportar dados, eliminar conta, links Privacidade/Termos
  (visíveis também antes do login).
- `backend/scripts/correct_gps_excel.py` — classifica e geocodifica POIs do
  Excel master via Nominatim com rate-limit; gera audit CSV + workbook
  anotado com coluna `GPS_RESOLVED` (não modifica o original).
- Serviço Compose `backup` (profile `backup`): mongodump diário com retenção
  7d/4w/3m, S3 opcional (OPS-006).
- `frontend/public/robots.txt` (SEO-001).
- `tests/test_imports_smoke.py` — todos os `*_api.py` importam sem erro.
- 235 testes pure-function (auth, tenant, RGPD, uploads, constantes, logging,
  context vars, shared utils).
- `SECURITY.md` (esta versão), `CHANGELOG.md` (este ficheiro), `ops/BACKUP.md`.

### Changed
- CI `--cov-fail-under` 8 → 20 com plano para 40 conforme os integration
  tests crescem (TEST-001).
- 4 ocorrências de `to_list(None)` / `to_list(10000)` substituídas por
  paginação (endpoint) ou cursor streaming (scripts de manutenção) (DB-001).
- Modos de mapa: docs (`CLAUDE.md`, `README.md`) alinhadas a 12 (incluindo
  `rotas` que estava em falta na documentação) (MAP-001).
- PWA `manifest.json` shortcuts deixam de usar a sintaxe Expo-router
  `/(tabs)/mapa` (não é uma URL HTTP) e passam a `/mapa` / `/descobrir`
  (MAP-003).
- `import_excel_real.py` deixa de fabricar coordenadas com `random.uniform`;
  agora salta e regista linhas sem GPS, rejeita coordenadas fora do envelope
  PT (GEO-001).
- `enrich_gps_routes.py` deixa de adicionar jitter ±0.01° a coordenadas reais.

### Removed
- `seed_data.get_coords(region, variation)` (não usada).
- `model.patch` órfão no root (GIT-001).
- Linhas duplicadas e markers `-e` no `.gitignore` (GIT-006).
- Default externo do `AUTH_BACKEND_URL`.
- Caminho "skip webhook signature verification" no Stripe.

### Fixed
- `seo_api.py:372` tinha lixo de um merge antigo; o ficheiro era inparseável.
  O servidor iniciava porque o módulo era importado lazy, mas qualquer
  pedido a `/api/seo/sitemap.xml` faria 500 em produção.
- `heritage_api`: `print()` solto substituído por `logger.warning` para que
  falhas no count de categorias apareçam nos logs estruturados (SEC-014).

---

## [1.0.0] — pre-public

Versão inicial pré-pública. Histórico anterior está no log do Git.
