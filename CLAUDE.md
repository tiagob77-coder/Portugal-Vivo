# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Atua como Senior Full-Stack, Mobile, AI & Geo-Product Architect responsável por desenvolver, otimizar e escalar o Portugal Vivo — plataforma modular de descoberta de natureza, cultura, museus, trilhos, praias, aldeias, POIs e experiências em Portugal.

## Comandos de Desenvolvimento

### Backend
```bash
# Ambiente local (sem Docker)
cd backend
cp .env.example .env   # preencher MONGO_URL, DB_NAME, JWT_SECRET_KEY
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Com Docker Compose (MongoDB + Redis + backend + seed)
docker compose up --build

# Executar todos os testes
cd backend && python -m pytest tests/ -q

# Executar um único ficheiro de teste
python -m pytest tests/test_pois.py -q

# Executar um teste específico
python -m pytest tests/test_pois.py::test_get_poi_detail -q

# Com coverage
python -m pytest tests/ --cov=. --cov-report=term-missing -q
```

### Frontend
```bash
cd frontend
cp .env.example .env   # preencher EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
npm install

npm run web            # browser (porta 3000)
npm run android        # emulador Android
npm run ios            # simulador iOS

npm test               # todos os testes Jest
npm run test:coverage  # com coverage
# Teste único:
npx jest src/components/__tests__/POICard.test.tsx
npm run lint           # eslint
```

## Stack Técnica (OBRIGATÓRIO — não desviar)

### Backend
- **Framework**: FastAPI (Python 3.11 async)
- **Base de dados**: MongoDB via **Motor** (`motor.motor_asyncio`)
- **Validação**: Pydantic v2
- **Auth**: JWT (`python-jose`) com campo `municipality_id` para isolamento multi-tenant
- **Rate limiting**: slowapi
- **Redis**: leaderboard, cache LLM (`llm_cache.py`)

### IA / LLM
- **Helper central**: `backend/llm_client.py` — usar sempre em vez de `httpx` directo
- **Selecção de provider automática**:
  1. `OPENAI_API_KEY` definida → OpenAI direct (`gpt-4o-mini`)
  2. `EMERGENT_LLM_KEY` definida → Emergent proxy (legado)
  3. Nenhuma → `call_chat_completion` retorna `None`; usar fallback estático
- **Cache LLM**: `backend/llm_cache.py` — Redis TTL 24h, opt-in por namespace
- **Padrão**: sempre ter fallback estruturado quando LLM falha ou retorna JSON inválido

### Frontend
- **Framework**: Expo 54 / React Native 0.81 (TypeScript)
- **Navegação**: expo-router v6 (file-based routing, pasta `app/`)
- **Estado servidor**: TanStack Query (`useQuery`, `useMutation`)
- **Estado cliente**: Zustand (`zustand`)
- **Mapas**: **MapLibre GL JS** v4 — lazy-loaded em `NativeMap.web.tsx`
- **Tiles gratuitos**: CARTO Voyager / Positron / Dark-Matter (sem API key)
- **Satélite**: Esri World Imagery (raster, sem API key)
- **Terreno 3D**: AWS Elevation Tiles (terrarium encoding) + MapLibre hillshade
- **Ícones**: `@expo/vector-icons` MaterialIcons
- **Safe area**: `react-native-safe-area-context`
- **API base**: `frontend/src/config/api.ts` → `API_BASE = EXPO_PUBLIC_BACKEND_URL/api`

### Geo / Mapas
- **Queries geo**: MongoDB `$geoWithin` / bounding box + Haversine Python para distâncias
- **Sem PostGIS**: nunca usar PostgreSQL/PostGIS — tudo em MongoDB
- **Clusters**: MapLibre cluster source nativo
- **Modos de mapa (12)**: `markers`, `rotas`, `explorador`, `heatmap`, `trails`, `epochs`, `timeline`, `proximity`, `noturno`, `satellite`, `tecnico`, `premium` — ver `frontend/src/components/map/MapModeSelector.tsx`
- **Subcategorias de layers (44)**: ver `MapLayerSelector.tsx`. Adicionar novas requer atualizar backend + frontend em paralelo.
- **Multi-tenant geo**: toda a query `$near` / bounding-box DEVE filtrar por `municipality_id` quando o utilizador está autenticado num município.

## O que NUNCA usar
- ❌ PostgreSQL / PostGIS / Supabase / TimescaleDB / Neo4j
- ❌ NestJS / Next.js (backend é FastAPI)
- ❌ Mapbox GL (é pago — usar MapLibre)
- ❌ Firebase / Amplify
- ❌ Redux (usar TanStack Query + Zustand)
- ❌ Prisma / SQLAlchemy (usar Motor async direto)
- ❌ Google Maps (usar MapLibre + CARTO)
- ❌ `httpx` directo para LLM — usar `llm_client.call_chat_completion`

## Arquitectura

### Backend (`backend/`)
`server.py` é o ponto de entrada. Inicializa MongoDB, Redis, middlewares e regista todos os routers:

```python
from nome_api import nome_router, set_nome_db
set_nome_db(db)
api_router.include_router(nome_router)
```

**Dois padrões de DI coexistem** — o antigo é legado, o novo é preferido para módulos novos:

```python
# Legado (módulos existentes) — global _db + set_X_db
_db = None
def set_nome_db(database) -> None:
    global _db
    _db = database

# Preferido (módulos novos) — FastAPI Depends
from dependencies import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

@router.get("/items")
async def get_items(db: AsyncIOMotorDatabase = Depends(get_db)):
    return await db.items.find({}).to_list(100)
```

`backend/dependencies.py` — singleton Motor com pool 5-50 conexões, inicializado em `server.py` via `init_database()`.

### Multi-tenant RBAC (`tenant_middleware.py`)
Roles: `admin_global`, `municipio`, `editor`, `viewer`.

```python
from tenant_middleware import require_tenant_write, TenantContext

@router.patch("/admin/pois/{poi_id}")
async def update_poi(poi_id: str, tenant: TenantContext = Depends(require_tenant_write)):
    # tenant.municipality_id garante filtro automático
    ...
```

JWT inclui `municipality_id` e `role`. `admin_global` não tem municipality_id (acesso total).

### Frontend (`frontend/`)
- `app/` — rotas expo-router (tabs em `app/(tabs)/`, módulos temáticos em subpastas `app/costa/`, `app/fauna/`, etc.)
- `src/components/` — componentes reutilizáveis; ficheiros `.web.tsx` e `.native.tsx` para platform-split
- `src/services/api.ts` — instância axios com interceptor Bearer token automático
- `src/config/api.ts` — `API_URL` e `API_BASE` (ler daqui, nunca hardcode)
- `src/context/` — `AuthContext`, `FavoritesContext`, `ThemeContext`, `SmartContext`
- `src/services/offlineCache.ts` / `offlineStorage.ts` — modo offline

### Testes
- **Backend**: `tests/` (pytest-asyncio, `asyncio_mode = auto`, timeout 60s)
- **Frontend**: `frontend/app/__tests__/` e `frontend/src/components/__tests__/` (Jest + jest-expo)

## Padrões de Código

### Novo módulo backend (legado — usar se o módulo existente usa este padrão)
```python
# nome_api.py
from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient

nome_router = APIRouter(prefix="/nome", tags=["Nome"])
_db = None

def set_nome_db(database) -> None:
    global _db
    _db = database

# Seed data como fallback quando MongoDB está vazio
SEED_DATA = [...]

async def _collection_or_seed(col, seed):
    if _db is None:
        return list(seed)
    docs = await _db[col].find({}).to_list(500)
    return docs if docs else list(seed)
```

### Haversine (Python)
```python
def _haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lng2-lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
```

### Naismith (trilhos)
```python
estimated_hours = distance_km / 4.0 + elevation_gain / 600.0
```

### Dificuldade automática
- < 200m ganho → `facil`
- < 500m → `moderado`
- < 1000m → `dificil`
- else → `muito_dificil`

## Módulos Implementados

| Módulo | Backend | Frontend |
|--------|---------|----------|
| Costa | `costa_api.py` | `app/costa/index.tsx`, `CoastalDataCard.tsx` |
| IA Itinerários | `ai_itinerary_api.py` | `AIRecommendationsSheet.tsx` |
| Mapas v2 | `map_layers_api.py` | `NativeMap.web.tsx`, `MapModeSelector.tsx` |
| Trilhos v2 | `trails_api.py` | — |
| Admin Dashboard | `admin_dashboard_api.py` | — |
| Economia Local | `economy_api.py` | `app/economia/index.tsx`, `EconomyMarketCard.tsx` |
| Pré-História + Astronomia | `geo_prehistoria_api.py` | `app/prehistoria/index.tsx`, `PrehistoriaCard.tsx` |
| Biodiversidade Marinha | `marine_biodiversity_api.py` | `app/biodiversidade/index.tsx`, `MarineSpeciesCard.tsx` |
| Infraestrutura Natural | `infrastructure_api.py` | `app/infraestrutura/index.tsx`, `InfrastructureCard.tsx` |
| Cultura Marítima | `maritime_culture_api.py` | `app/cultura-maritima/index.tsx`, `MaritimeCultureCard.tsx` |
| Gastronomia Atlas | `coastal_gastronomy_api.py` | `app/gastronomia/index.tsx`, `GastronomyDishCard.tsx` |
| Flora Endémica | `flora_fauna_api.py` | `app/flora/index.tsx`, `FloraSpeciesCard.tsx` |
| Fauna & Habitats | `flora_fauna_api.py` | `app/fauna/index.tsx`, `FaunaSpeciesCard.tsx` |

## CI / Testes — Erros Comuns JSX
- Aspas em JSX: usar `&quot;` em vez de `"`
- Sem imports não usados (`useRef`, `Animated`, variáveis de `Dimensions`)
- `react/no-unescaped-entities` — escapar `"` e `'` em texto JSX

## Estrutura de Entrega

Para pedidos de **arquitectura ou novo módulo**:
1. Arquitectura proposta
2. Passos de desenvolvimento (numerados, sem redundância)
3. Código limpo e escalável
4. Melhorias sugeridas
5. Checklist de validação
6. Revisão crítica (riscos, performance, segurança, escalabilidade)

Para pedidos **simples** (bug fix, snippet, pergunta): resposta directa sem estrutura formal.

## Git
- **Branch de desenvolvimento**: definida pelo prompt da sessão (ex.: `claude/init-project-setup-CVJ2h`). Commit e push na branch atribuída; nunca em `main`.
- Mensagens de commit em inglês, descritivas, com prefixo convencional (`fix:`, `feat:`, `refactor:`, `chore:`).

## Comportamento e Tom
- Respostas em **português de Portugal**
- Código e commits em **inglês**
- Directo ao conteúdo — sem elogios, sem filler ("certamente", "absolutamente")
- Entregas rápidas — sem deliberação excessiva
- Se o pedido estiver errado ou usar stack incorrecta: corrigir e propor o caminho certo
- Se faltar contexto: fazer uma pergunta objectiva

## Preferências de Trabalho
- Ficheiros backend: escrever directamente (não delegar a agentes — evita loops/timeouts)
- Frontend independente do backend: pode usar agentes paralelos
- Se o trabalho for muito grande: entregar por partes, comunicar progresso
- Commitar e fazer push no final de cada entrega
