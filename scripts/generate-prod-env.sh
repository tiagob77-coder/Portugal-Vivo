#!/usr/bin/env bash
# Portugal Vivo — Gerador de .env de produção
#
# Cria, com secrets fortes gerados automaticamente:
#   1. backend/.env   — a partir de backend/.env.example (ENVIRONMENT=production,
#                       passwords Mongo, JWT, CORS de produção, MONGO_URL com auth)
#   2. .env (raiz)    — variáveis interpoladas pelo docker-compose.prod.yml
#                       (MONGO_ROOT_USER/PASSWORD, MONGO_APP_PASSWORD, DOCKERHUB_USERNAME)
#
# NUNCA sobrescreve ficheiros existentes — apaga-os primeiro se quiseres regenerar.
#
# Uso (no servidor de produção, na raiz do repositório):
#   ./scripts/generate-prod-env.sh
#
# Env opcional:
#   DOMAIN               — domínio principal (default: portugalvivo.pt)
#   API_DOMAIN           — domínio da API (default: api.$DOMAIN)
#   DOCKERHUB_USERNAME   — username Docker Hub (default: tiagob77)
#
# Depois de correr, rever backend/.env e preencher as chaves opcionais
# (OPENAI_API_KEY, STRIPE_*, CLOUDINARY_*, SENTRY_DSN, ...).

set -euo pipefail

cd "$(dirname "$0")/.."

DOMAIN="${DOMAIN:-portugalvivo.pt}"
API_DOMAIN="${API_DOMAIN:-api.$DOMAIN}"
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-tiagob77}"

BACKEND_ENV="backend/.env"
ROOT_ENV=".env"

if [ -f "$BACKEND_ENV" ]; then
  echo "❌ $BACKEND_ENV já existe — não vou sobrescrever." >&2
  echo "   Apaga-o primeiro se quiseres regenerar (perde os secrets atuais!)." >&2
  exit 1
fi
if [ -f "$ROOT_ENV" ]; then
  echo "❌ $ROOT_ENV já existe — não vou sobrescrever." >&2
  exit 1
fi
if [ ! -f "backend/.env.example" ]; then
  echo "❌ backend/.env.example não encontrado — correr a partir da raiz do repo." >&2
  exit 1
fi

gen_secret() {
  python3 -c "import secrets; print(secrets.token_urlsafe($1))"
}

echo "→ A gerar secrets fortes..."
MONGO_ROOT_PASSWORD=$(gen_secret 32)
MONGO_APP_PASSWORD=$(gen_secret 32)
JWT_SECRET_KEY=$(gen_secret 64)
ADMIN_SECRET=$(gen_secret 32)

echo "→ A criar $BACKEND_ENV a partir de backend/.env.example..."
cp backend/.env.example "$BACKEND_ENV"

# sed -i portável (GNU); valores token_urlsafe não contêm caracteres especiais de sed
set_var() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$BACKEND_ENV"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$BACKEND_ENV"
  else
    echo "${key}=${value}" >> "$BACKEND_ENV"
  fi
}

set_var ENVIRONMENT "production"
set_var MONGO_URL "mongodb://pv_app:${MONGO_APP_PASSWORD}@mongodb:27017/portugal_vivo?authSource=portugal_vivo"
set_var DB_NAME "portugal_vivo"
set_var REDIS_URL "redis://redis:6379"
set_var MONGO_ROOT_USER "admin"
set_var MONGO_ROOT_PASSWORD "$MONGO_ROOT_PASSWORD"
set_var MONGO_APP_PASSWORD "$MONGO_APP_PASSWORD"
set_var JWT_SECRET_KEY "$JWT_SECRET_KEY"
set_var ADMIN_SECRET "$ADMIN_SECRET"
set_var CORS_ORIGINS "https://${DOMAIN},https://www.${DOMAIN},https://app.${DOMAIN}"
set_var APP_BASE_URL "https://${DOMAIN}"
set_var API_BASE_URL "https://${API_DOMAIN}"
set_var FRONTEND_URL "https://${DOMAIN}"
set_var LOG_FORMAT "json"

chmod 600 "$BACKEND_ENV"

echo "→ A criar $ROOT_ENV (interpolação do docker-compose.prod.yml)..."
cat > "$ROOT_ENV" <<EOF
# Gerado por scripts/generate-prod-env.sh — usado pelo docker-compose.prod.yml
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
MONGO_APP_PASSWORD=${MONGO_APP_PASSWORD}
DOCKERHUB_USERNAME=${DOCKERHUB_USERNAME}
EOF
chmod 600 "$ROOT_ENV"

echo ""
echo "✅ Ficheiros criados:"
echo "   - $BACKEND_ENV (chmod 600)"
echo "   - $ROOT_ENV (chmod 600)"
echo ""
echo "Próximos passos:"
echo "  1. Rever $BACKEND_ENV e preencher chaves opcionais:"
echo "     OPENAI_API_KEY (IA), STRIPE_* (pagamentos), CLOUDINARY_* (imagens),"
echo "     SENTRY_DSN (monitorização), UNSPLASH_ACCESS_KEY, STORMGLASS_API_KEY"
echo "  2. Primeiro arranque SSL:  ./ops/ssl-init.sh"
echo "  3. Arrancar:               docker compose -f docker-compose.prod.yml up -d"
echo "  4. Verificar:              BASE_URL=https://${API_DOMAIN} ./scripts/pre-deploy-check.sh"
