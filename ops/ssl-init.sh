#!/bin/bash
# =============================================================================
# Portugal Vivo — Obter certificados SSL (primeira vez)
# Correr UMA vez no servidor antes de iniciar o stack de produção
# Pré-requisitos: domínios a apontar para o servidor, porta 80 aberta
#
# Uso:
#   CERTBOT_EMAIL=ops@exemplo.com bash ops/ssl-init.sh
# =============================================================================

set -e

DOMAINS=(
  "portugalvivo.pt"
  "www.portugalvivo.pt"
  "api.portugalvivo.pt"
)

# Email obrigatório via variável de ambiente
if [ -z "${CERTBOT_EMAIL}" ]; then
  echo "❌ Erro: variável CERTBOT_EMAIL não definida."
  echo "   Uso: CERTBOT_EMAIL=ops@exemplo.com bash ops/ssl-init.sh"
  exit 1
fi

EMAIL="${CERTBOT_EMAIL}"
echo "A obter certificados Let's Encrypt para: ${DOMAINS[*]}"
echo "Email de notificação: ${EMAIL}"

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
