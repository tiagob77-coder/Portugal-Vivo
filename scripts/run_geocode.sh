#!/bin/bash
# ============================================================
# Portugal Vivo — Geocodificação Completa (One-Click)
# ============================================================
# Uso:
#   ./scripts/run_geocode.sh              # Dry run (default)
#   ./scripts/run_geocode.sh --execute    # Executar geocodificação
#   ./scripts/run_geocode.sh --google     # Com fallback Google Maps
# ============================================================

set -euo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERRO]${NC} $*"; }

MODE="dry-run"
GOOGLE_FLAG=""
for arg in "$@"; do
    case $arg in
        --execute) MODE="execute" ;;
        --google)  GOOGLE_FLAG="--google-fallback" ;;
        --help)
            echo "Uso: $0 [--execute] [--google]"
            echo "  --execute  Executar geocodificação (default: dry-run)"
            echo "  --google   Usar Google Maps como fallback (requer GOOGLE_MAPS_API_KEY)"
            exit 0
            ;;
    esac
done

info "Verificando MongoDB..."

MONGO_URL_ENV=${MONGO_URL:-"mongodb://localhost:27017"}
info "Usando MONGO_URL: $MONGO_URL_ENV"

POI_COUNT=$(python3 -c "
from pymongo import MongoClient
import os
c = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db_name = os.environ.get('DB_NAME', 'patrimonio_vivo')
db = c[db_name]
print(db.heritage_items.count_documents({}))
" 2>/dev/null || echo "0")

info "Base de dados: $POI_COUNT POIs"

if [ -n "$GOOGLE_FLAG" ]; then
    if [ -z "${GOOGLE_MAPS_API_KEY:-}" ]; then
        error "GOOGLE_MAPS_API_KEY não definida. Defina com:"
        echo "  export GOOGLE_MAPS_API_KEY='sua-chave-aqui'"
        exit 1
    fi
    info "Google Maps fallback ativo (key: ${GOOGLE_MAPS_API_KEY:0:8}...)"
fi

echo ""
echo "============================================"
if [ "$MODE" = "dry-run" ]; then
    info "MODO: DRY RUN (sem alterações)"
    echo "============================================"
    echo ""
    python3 scripts/batch_geocode.py --dry-run --limit 0 $GOOGLE_FLAG
    echo ""
    info "Para executar: $0 --execute"
else
    info "MODO: EXECUÇÃO (vai alterar coordenadas na DB)"
    echo "============================================"
    echo ""
    warn "A iniciar geocodificação de todos os POIs..."
    warn "Nominatim: ~1 POI/segundo (grátis)"
    [ -n "$GOOGLE_FLAG" ] && warn "Google fallback activo (~\$5/1000 requests)"
    echo ""
    python3 scripts/batch_geocode.py --limit 0 $GOOGLE_FLAG
fi

echo ""
info "Concluído!"
