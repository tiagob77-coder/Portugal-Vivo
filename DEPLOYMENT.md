# 🚀 Portugal Vivo — Guia de Deployment

**Versão**: 3.0.0  
**Última atualização**: Agosto 2025

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Preparação do Servidor](#2-preparação-do-servidor)
3. [Configuração DNS](#3-configuração-dns)
4. [Deploy do Backend (Docker)](#4-deploy-do-backend-docker)
5. [Certificados SSL](#5-certificados-ssl)
6. [Arranque de Produção](#6-arranque-de-produção)
7. [Build do Frontend (Expo/EAS)](#7-build-do-frontend-expoeas)
8. [Deploy PWA](#8-deploy-pwa)
9. [Verificação Pós-Deploy](#9-verificação-pós-deploy)
10. [Manutenção e Operações](#10-manutenção-e-operações)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Pré-requisitos

### Servidor (VPS / Cloud)
- **SO**: Ubuntu 22.04+ ou Debian 12+
- **RAM**: 2GB mínimo (4GB recomendado)
- **CPU**: 2 vCPUs mínimo
- **Disco**: 20GB+ SSD
- **Portas abertas**: 80, 443
- **Docker**: 24+ com Docker Compose v2

### Domínio
- Domínio registado (ex: `portugalvivo.pt`)
- Acesso ao DNS para criar registos A

### Contas (opcional mas recomendado)
- **Cloudinary** — upload de imagens ([cloudinary.com](https://cloudinary.com))
- **Stripe** — pagamentos premium ([stripe.com](https://stripe.com))
- **Sentry** — monitoring de erros ([sentry.io](https://sentry.io))
- **Expo/EAS** — builds mobile ([expo.dev](https://expo.dev))
- **Google Cloud** — Maps API + OAuth ([console.cloud.google.com](https://console.cloud.google.com))

---

## 2. Preparação do Servidor

```bash
# Instalar Docker e Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar ferramentas úteis
sudo apt update && sudo apt install -y git curl htop

# Clonar repositório
git clone <repo-url> /opt/portugal-vivo
cd /opt/portugal-vivo
```

---

## 3. Configuração DNS

Criar os seguintes registos A no seu fornecedor DNS:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | `portugalvivo.pt` | `<IP_DO_SERVIDOR>` | 300 |
| A | `www.portugalvivo.pt` | `<IP_DO_SERVIDOR>` | 300 |
| A | `api.portugalvivo.pt` | `<IP_DO_SERVIDOR>` | 300 |

> ⏳ Aguardar propagação DNS (5-30 min) antes de prosseguir para SSL.

Verificar propagação:
```bash
dig +short portugalvivo.pt
dig +short api.portugalvivo.pt
```

---

## 4. Deploy do Backend (Docker)

### 4.1. Configurar variáveis de ambiente

```bash
cd /opt/portugal-vivo/backend

# Copiar template de produção
cp .env.production.example .env

# Editar e preencher TODOS os valores
nano .env
```

**Variáveis OBRIGATÓRIAS:**

```bash
# Gerar passwords fortes
python3 -c "import secrets; print('MONGO_ROOT_PASSWORD=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('MONGO_APP_PASSWORD=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))"
```

### 4.2. Exportar variáveis para Docker Compose

O `docker-compose.prod.yml` usa variáveis de ambiente para o MongoDB.
Criar ficheiro `.env` na raiz do projeto:

```bash
cd /opt/portugal-vivo
cat > .env << 'EOF'
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=<copiar_de_backend/.env>
MONGO_APP_PASSWORD=<copiar_de_backend/.env>
DOCKERHUB_USERNAME=<seu_username>
EOF
```

### 4.3. Build da imagem (se não usar Docker Hub)

```bash
cd /opt/portugal-vivo
docker compose -f docker-compose.prod.yml build backend
```

---

## 5. Certificados SSL

### Primeira vez (obter certificados)

```bash
# Parar nginx temporariamente se estiver a correr
docker compose -f docker-compose.prod.yml down nginx 2>/dev/null

# Obter certificados Let's Encrypt
CERTBOT_EMAIL=ops@portugalvivo.pt bash ops/ssl-init.sh
```

> ℹ️ Os certificados renovam automaticamente via container `certbot`.

---

## 6. Arranque de Produção

```bash
cd /opt/portugal-vivo

# Arrancar todo o stack
docker compose -f docker-compose.prod.yml up -d

# Verificar estado dos containers
docker compose -f docker-compose.prod.yml ps

# Verificar logs
docker compose -f docker-compose.prod.yml logs -f backend
```

### Verificação rápida

```bash
# Health check
curl -s https://api.portugalvivo.pt/api/health | python3 -m json.tool

# Stats
curl -s https://api.portugalvivo.pt/api/stats | python3 -m json.tool
```

Deve retornar:
```json
{
  "status": "healthy",
  "database": "connected",
  "cache": "connected"
}
```

---

## 7. Build do Frontend (Expo/EAS)

### 7.1. Instalar EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 7.2. Configurar variáveis de produção

O `eas.json` já define `EXPO_PUBLIC_BACKEND_URL=https://api.portugalvivo.pt` para builds de produção.

### 7.3. Preencher credenciais de submissão

Editar `frontend/eas.json` → secção `submit.production`:

**iOS:**
```json
"ios": {
  "appleId": "seu@email.apple",
  "ascAppId": "1234567890",
  "appleTeamId": "ABCDE12345"
}
```

**Android:**
```json
"android": {
  "serviceAccountKeyPath": "./google-services.json",
  "track": "production"
}
```

### 7.4. Build e submissão

```bash
cd frontend

# Build iOS
eas build --platform ios --profile production

# Build Android
eas build --platform android --profile production

# Submeter às lojas
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

## 8. Deploy PWA

A PWA é servida pelo Nginx no domínio `portugalvivo.pt`.

### 8.1. Gerar build web estático

```bash
cd frontend
npx expo export --platform web
```

### 8.2. Copiar para o servidor

```bash
# No servidor, criar diretório
mkdir -p /var/www/pwa

# Copiar output do expo export
scp -r dist/* server:/var/www/pwa/

# Ou montar volume no docker-compose.prod.yml:
# volumes:
#   - /var/www/pwa:/var/www/pwa:ro
```

O Nginx já está configurado para servir a PWA com:
- Cache de 1 ano para assets estáticos
- Fallback SPA (`try_files $uri /index.html`)
- Security headers (HSTS, CSP, X-Frame-Options)

---

## 9. Verificação Pós-Deploy

### Checklist

```bash
# 1. Backend health
curl -s https://api.portugalvivo.pt/api/health

# 2. Stats (deve mostrar 5678+ POIs)
curl -s https://api.portugalvivo.pt/api/stats | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'POIs: {d.get(\"total_items\",0)}, Routes: {d.get(\"total_routes\",0)}')"

# 3. SSL válido
curl -I https://portugalvivo.pt 2>/dev/null | head -5
curl -I https://api.portugalvivo.pt 2>/dev/null | head -5

# 4. Redirect www → non-www
curl -I https://www.portugalvivo.pt 2>/dev/null | grep -i location

# 5. Redirect HTTP → HTTPS
curl -I http://portugalvivo.pt 2>/dev/null | grep -i location

# 6. Security headers
curl -I https://api.portugalvivo.pt/api/health 2>/dev/null | grep -iE 'x-frame|x-content|strict-transport|x-xss'

# 7. CORS
curl -s -H "Origin: https://portugalvivo.pt" -I https://api.portugalvivo.pt/api/health 2>/dev/null | grep -i access-control
```

### Testes de Carga (opcional)

```bash
# Instalar hey (load tester)
go install github.com/rakyll/hey@latest

# 200 requests, 10 concurrent
hey -n 200 -c 10 https://api.portugalvivo.pt/api/health
hey -n 200 -c 10 https://api.portugalvivo.pt/api/heritage?limit=10
```

---

## 10. Manutenção e Operações

### Backup MongoDB

```bash
# Backup manual
docker compose -f docker-compose.prod.yml exec mongodb \
  mongodump --db portugal_vivo --out /data/db/backup-$(date +%Y%m%d)

# Copiar backup do container
docker compose -f docker-compose.prod.yml cp mongodb:/data/db/backup-$(date +%Y%m%d) ./backups/
```

### Atualizar Backend

```bash
cd /opt/portugal-vivo
git pull origin main

# Rebuild e restart (zero-downtime com healthcheck)
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend

# Verificar logs
docker compose -f docker-compose.prod.yml logs -f --tail=50 backend
```

### Renovar SSL (automático)

O container `certbot` renova automaticamente a cada 12h.
Para forçar renovação manual:

```bash
docker compose -f docker-compose.prod.yml exec certbot \
  certbot renew --force-renewal

# Reload nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Monitorização

```bash
# Estado dos containers
docker compose -f docker-compose.prod.yml ps

# Uso de recursos
docker stats

# Logs em tempo real
docker compose -f docker-compose.prod.yml logs -f backend

# Verificar MongoDB
docker compose -f docker-compose.prod.yml exec mongodb \
  mongosh portugal_vivo --eval 'db.heritage_items.countDocuments({})'
```

---

## 11. Troubleshooting

### Backend não arranca

```bash
# Verificar logs detalhados
docker compose -f docker-compose.prod.yml logs backend

# Erro "CORS_ORIGINS must be set"
# → Adicionar CORS_ORIGINS ao backend/.env

# Erro "Cannot connect to MongoDB"
# → Verificar MONGO_URL e se o container mongodb está healthy
docker compose -f docker-compose.prod.yml ps mongodb
```

### SSL não funciona

```bash
# Verificar que os domínios apontam para o servidor
dig +short portugalvivo.pt

# Verificar certificados
ls -la ops/certbot/letsencrypt/live/

# Re-obter certificados
CERTBOT_EMAIL=ops@portugalvivo.pt bash ops/ssl-init.sh
```

### MongoDB lento

```bash
# Verificar índices
docker compose -f docker-compose.prod.yml exec mongodb \
  mongosh portugal_vivo --eval 'db.heritage_items.getIndexes()'

# Os índices são criados automaticamente no startup do backend
# Para forçar: docker compose exec backend python create_indexes.py
```

### Memória esgotada

```bash
# O backend está limitado a 1GB no docker-compose.prod.yml
# Para ajustar, editar deploy.resources.limits.memory

# Verificar uso atual
docker stats --no-stream
```

---

## Arquitetura de Produção

```
                    ┌──────────────┐
    Internet ──────►│   Nginx      │
    (80/443)        │  (SSL + RP)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Backend  │ │ PWA      │ │ Certbot  │
        │ FastAPI  │ │ (static) │ │ (SSL)    │
        │ :8001    │ │ /var/www │ │          │
        └────┬─────┘ └──────────┘ └──────────┘
             │
        ┌────┴────┐
        │         │
   ┌────▼───┐ ┌───▼───┐
   │MongoDB │ │ Redis │
   │ :27017 │ │ :6379 │
   └────────┘ └───────┘
```

---

## Variáveis de Ambiente — Referência Rápida

| Variável | Obrigatória | Onde |
|----------|-------------|------|
| `ENVIRONMENT` | ✅ | backend/.env |
| `MONGO_URL` | ✅ | backend/.env |
| `DB_NAME` | ✅ | backend/.env |
| `JWT_SECRET_KEY` | ✅ | backend/.env |
| `CORS_ORIGINS` | ✅ | backend/.env |
| `REDIS_URL` | ✅ | backend/.env |
| `MONGO_ROOT_USER` | ✅ | .env (raiz) |
| `MONGO_ROOT_PASSWORD` | ✅ | .env (raiz) |
| `MONGO_APP_PASSWORD` | ✅ | .env (raiz) + backend/.env |
| `GOOGLE_MAPS_API_KEY` | ⚠️ | backend/.env |
| `EMERGENT_LLM_KEY` | ⚠️ | backend/.env |
| `CLOUDINARY_*` | ⚠️ | backend/.env |
| `STRIPE_*` | ❌ (demo ok) | backend/.env |
| `SENTRY_DSN` | ❌ (opcional) | backend/.env |
| `GOOGLE_CLIENT_ID` | ❌ (opcional) | backend/.env |
| `EXPO_PUBLIC_BACKEND_URL` | ✅ (build) | eas.json |
| `EXPO_PUBLIC_SENTRY_DSN` | ❌ (opcional) | frontend/.env |

✅ = Obrigatória | ⚠️ = Funcionalidade degradada sem ela | ❌ = Opcional

---

*Gerado automaticamente — Portugal Vivo v3.0.0*
