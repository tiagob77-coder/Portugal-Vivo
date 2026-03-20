#!/bin/bash
# =============================================================================
# Portugal Vivo — Obter certificados SSL (primeira vez)
# Correr UMA vez no servidor antes de iniciar o stack de produção
# Pré-requisitos: domínios a apontar para o servidor, porta 80 aberta
# =============================================================================

set -e

DOMAINS=(
  "portugalvivo.pt"
  "www.portugalvivo.pt"
  "api.portugalvivo.pt"
)
EMAIL="tiago@portugalvivo.pt"   # alterar para email real

echo "A obter certificados Let's Encrypt..."

for DOMAIN in "${DOMAINS[@]}"; do
  docker run --rm \
    -v "$(pwd)/ops/certbot/letsencrypt:/etc/letsencrypt" \
    -v "$(pwd)/ops/certbot/www:/var/www/certbot" \
    -p 80:80 \
    certbot/certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email "$EMAIL" \
      -d "$DOMAIN"
  echo "✅ Certificado obtido para $DOMAIN"
done

echo ""
echo "Certificados prontos. Agora correr:"
echo "  docker compose -f docker-compose.prod.yml up -d"
