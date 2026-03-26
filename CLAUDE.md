# Portugal Vivo — Instruções para Claude Code

## Stack Técnica (OBRIGATÓRIO)

### Backend
- **Framework**: FastAPI (Python async)
- **Base de dados**: MongoDB Atlas via **Motor** (driver async — `motor.motor_asyncio`)
- **Padrão de injeção de BD**: sempre usar `set_X_db(database)` + `_db` global
- **Validação**: Pydantic v2
- **Auth**: JWT (python-jose) com campo `municipality_id` para isolamento multi-tenant
- **Rate limiting**: slowapi
- **HTTP client**: httpx.AsyncClient (para chamadas LLM e APIs externas)

### IA / LLM
- **API**: Emergent LLM — `https://llm.lil.re.emergentmethods.ai/v1/chat/completions`
- **Modelo**: `gpt-4o-mini`
- **Chave**: variável de ambiente `EMERGENT_LLM_KEY`
- **Padrão**: sempre ter fallback estruturado quando LLM falha ou retorna JSON inválido

### Frontend
- **Framework**: Expo / React Native (TypeScript)
- **Navegação**: expo-router (file-based routing)
- **Estado servidor**: TanStack Query (`useQuery`, `useMutation`)
- **Mapas**: **MapLibre GL JS** (gratuito, sem API key)
- **Tiles gratuitos**: CARTO Voyager / Positron / Dark-Matter (sem API key)
- **Terreno 3D**: AWS Elevation Tiles (terrarium encoding) + MapLibre hillshade
- **Ícones**: `@expo/vector-icons` MaterialIcons
- **Safe area**: `react-native-safe-area-context`

### Geo / Mapas
- **Queries geo**: MongoDB `$geoWithin` / bounding box + Haversine em Python para distâncias precisas
- **Sem PostGIS**: nunca usar PostgreSQL/PostGIS — tudo em MongoDB
- **Clusters**: MapLibre cluster source nativo

## O que NUNCA usar
- ❌ PostgreSQL / PostGIS / Supabase / TimescaleDB / Neo4j
- ❌ NestJS / Next.js (backend é FastAPI)
- ❌ Mapbox GL (é pago — usar MapLibre)
- ❌ Firebase / Amplify
- ❌ Redux (usar TanStack Query)
- ❌ Prisma / SQLAlchemy (usar Motor async direto)

## Padrões de Código

### Novo módulo backend
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

### Registar em server.py
```python
from nome_api import nome_router, set_nome_db
set_nome_db(db)
api_router.include_router(nome_router)
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

## Git
- **Branch de desenvolvimento**: `claude/analyze-database-improvements-ATr3a`
- Sempre commitar e fazer push no final de cada módulo
- Mensagens de commit em inglês, descritivas
- Nunca push para `main` sem autorização

## CI / Testes
- Testes frontend: `cd frontend && npm test -- --passWithNoTests --coverage`
- Erros comuns a evitar:
  - Aspas em JSX: usar `&quot;` em vez de `"`
  - Sem imports não usados (`useRef`, `Animated`, variáveis de `Dimensions`)
  - `react/no-unescaped-entities` — escapar `"` e `'` em texto JSX

## Preferências do Utilizador
- Entregas directas e rápidas — sem deliberação excessiva
- Usar agentes paralelos para frontend quando o backend está a ser escrito
- Para ficheiros backend: escrever directamente (não usar agentes — evita loops)
- Se o trabalho for muito grande: entregar por partes, comunicar progresso
- Idioma de comunicação: Português
- Código e commits: Inglês
