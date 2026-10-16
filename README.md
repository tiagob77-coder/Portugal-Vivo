# Portugal Vivo

**Descubra a alma de Portugal** — plataforma imersiva e inteligente de descoberta cultural, natureza, trilhos, praias, gastronomia e experiências em Portugal.

---

## Visão Geral

O Portugal Vivo é uma aplicação viva que guia o utilizador por Portugal através de:

- **Descoberta geolocalizada** — POIs "perto de mim" com mapa interativo e clusters
- **IQ Engine** — 19 módulos de enriquecimento semântico e scoring de conteúdo
- **Narrativas por IA** — conteúdo em 4 profundidades (snackable, história, enciclopédico, crianças) com 6 perfis cognitivos
- **11 módulos temáticos** — biodiversidade marinha, flora, fauna, gastronomia, cultura marítima, infraestrutura natural, economia local, pré-história, costa, música tradicional e rotas culturais
- **Rotas inteligentes** — planeamento com waypoints, sugestões por IQ score, integração com todos os módulos
- **Gamificação** — pontos, badges, streaks, leaderboard regional
- **Premium com Stripe** — 3 tiers (Explorador/Descobridor/Guardião), MB Way e Multibanco
- **Enciclopédia cultural** — 6 universos temáticos com artigos enriquecidos
- **+300 eventos 2026** — agenda viral com integração de fontes externas
- **Beachcams** — câmeras de praia em tempo real com condições marinhas
- **Dark mode completo** — suporte light/dark/system com tokens semânticos, daltonismo (3 modos) e accents regionais
- **Modo offline** — pacotes de região descarregáveis (POIs, rotas, categorias) usados automaticamente sem rede, cache de 24 h por pedido e fila de ações pendentes; service worker com cache-first de tiles
- **Audio guides** — TTS com 9 vozes e 6 idiomas (premium)
- **i18n** — PT, EN, ES, FR
- **Multi-tenant** — isolamento por município com JWT (filtro automático em geo / list queries)
- **8 modos de mapa** e **44 subcategorias de layers** (markers, rotas, explorador, heatmap, trails, proximity, noturno, satellite) — botão flutuante "TEC" dentro do mapa expõe terrain + coord HUD

---

## Stack Técnica

### Backend
| Componente | Tecnologia |
|---|---|
| Framework | FastAPI (Python async) |
| Base de dados | MongoDB Atlas via Motor (async) |
| Cache / Leaderboard / Rate limit | Redis (cache LLM com TTL + sliding-window distribuído ZSET) |
| Autenticação | JWT (python-jose) + Google OAuth2 |
| IA / LLM | Cliente central `llm_client.py` com auto-select OpenAI direct → Emergent fallback (`gpt-4o-mini`) |
| Imagens | Cloudinary CDN |
| Pagamentos | Stripe (Card, PayPal, MB Way, Multibanco) |
| Rate Limiting | Sliding window Redis (per-user + per-endpoint), fail-open in-memory |
| Observabilidade | Sentry + Prometheus (`/api/metrics`) + structured JSON logs com `request_id` |
| Segurança | CSRF, rate limiting, security headers, CORS, multi-tenant `municipality_id` |
| Infra | Docker multi-stage, multi-tenant por município |

### Frontend
| Componente | Tecnologia |
|---|---|
| Framework | React Native + Expo SDK 54.0.33 |
| Navegação | Expo Router (file-based routing) |
| Mapas (web / PWA) | MapLibre GL JS 4.7.1 + CARTO tiles (grátis, sem API key) |
| Mapas (iOS / Android) | `react-native-maps` 1.20.1 (Apple Maps / Google Maps nativos) |
| Terreno 3D | AWS Elevation Tiles (terrarium encoding) + hillshade |
| Estado servidor | TanStack Query (`useQuery`, `useMutation`) |
| i18n | i18next (PT/EN/ES/FR) |
| Offline | Pacotes de região em ficheiro (`expo-file-system`, nativo) ou AsyncStorage (web); cache 24 h por pedido; service worker com cache de tiles (LRU 4000); fila de ações |
| Notificações | expo-notifications |
| Áudio | expo-av + expo-speech |
| Geofencing | expo-task-manager + expo-location |
| Imagens | expo-image com blurhash + cache memory-disk |
| Ícones | @expo/vector-icons MaterialIcons |
| Safe area | react-native-safe-area-context |
| Monitorização | @sentry/react |
| Builds | EAS via GitHub Action manual (cloud builds, sem máquina local) |

---

## Estrutura do Projeto

```
Portugal-Vivo/
├── backend/                     # FastAPI + MongoDB Atlas
│   ├── server.py                # Ponto de entrada (90 routers, 496 endpoints)
│   ├── iq_engine_base.py        # IQ Engine — orquestrador dos 19 módulos
│   ├── iq_module_m1_*.py        # M1–M19: semântico, cognitivo, imagem, slug,
│   │   ...                      #   endereço, dedup, scoring, enriquecimento,
│   │                            #   descrição, temático, routing
│   ├── content_strategy_api.py  # Narrativas IA: 4 profundidades, 6 perfis cognitivos
│   ├── narratives_api.py        # CRUD narrativas culturais com credibilidade
│   ├── premium_api.py           # Stripe, tiers, feature gating
│   ├── agenda_api.py            # +300 eventos 2026, agenda viral
│   ├── beachcam_api.py          # Câmeras de praia em tempo real
│   ├── rate_limiter.py          # Rate limiting per-user e per-endpoint
│   ├── models/                  # Modelos Pydantic / MongoDB schemas
│   ├── services/                # 24 serviços (IPMA, GBIF, CP, GTFS, Cloudinary,
│   │                            #   Fogos.pt, ICNF, Overpass, TTS, tradução…)
│   ├── tests/                   # 43 ficheiros pytest (176 testes)
│   └── requirements.txt
│
├── frontend/                    # React Native + Expo SDK 54
│   ├── app/                     # 78 ecrãs (Expo Router file-based)
│   │   ├── (tabs)/              # Tabs: descobrir, mapa, experienciar, profile
│   │   ├── heritage/[id]        # Detalhe de POI (imagens, narrativas, áudio, 360°)
│   │   ├── route/[id]           # Detalhe de rota
│   │   ├── itinerary/[id]       # Itinerário guardado (timeline, budget, equipa)
│   │   ├── encyclopedia/        # Enciclopédia cultural (6 universos)
│   │   ├── biodiversidade/      # Vida marinha portuguesa
│   │   ├── flora/               # Flora endémica
│   │   ├── fauna/               # Fauna e habitats
│   │   ├── gastronomia/         # Atlas gastronómico costeiro
│   │   ├── cultura-maritima/    # Cultura e tradições marítimas
│   │   ├── infraestrutura/      # Infraestrutura natural
│   │   ├── economia/            # Economia local e mercados
│   │   ├── prehistoria/         # Pré-história e astronomia
│   │   ├── costa/               # Litoral e zonas costeiras
│   │   └── ...
│   ├── src/
│   │   ├── components/          # 110 componentes reutilizáveis
│   │   ├── services/            # API, gamification, geofencing, offline,
│   │   │                        #   audioGuide, pushNotifications
│   │   ├── context/             # AuthContext, ThemeContext, SmartContext
│   │   ├── i18n/                # Traduções PT, EN, ES, FR
│   │   ├── theme/               # Design system centralizado (11 paletas temáticas)
│   │   ├── config/              # Configuração da API
│   │   ├── types/               # TypeScript types globais
│   │   └── utils/               # Monitorização (Sentry), helpers
│   └── package.json
│
├── e2e/                         # Testes end-to-end
│   ├── playwright/              # Testes web (Playwright)
│   └── maestro/                 # Testes mobile (Maestro)
│
├── scripts/                     # Geocodificação em batch e utilitários
└── docker-compose.yml
```

---

## Módulos Temáticos

| Módulo | Frontend | Backend | Dados |
|--------|----------|---------|-------|
| Biodiversidade Marinha | `app/biodiversidade/` | `marine_biodiversity_api.py` | 12 espécies seed |
| Flora Endémica | `app/flora/` | `flora_fauna_api.py` | Espécies + habitats |
| Fauna & Habitats | `app/fauna/` | `flora_fauna_api.py` | Espécies + habitats |
| Gastronomia Costeira | `app/gastronomia/` | `coastal_gastronomy_api.py` | Pratos regionais |
| Cultura Marítima | `app/cultura-maritima/` | `maritime_culture_api.py` | Tradições + artes |
| Infraestrutura Natural | `app/infraestrutura/` | `infrastructure_api.py` | Infraestruturas verdes |
| Economia Local | `app/economia/` | `economy_api.py` | Mercados + produtores |
| Pré-História + Astronomia | `app/prehistoria/` | `geo_prehistoria_api.py` | Sítios + observatórios |
| Costa & Litoral | `app/costa/` | `costa_api.py` | Zonas costeiras |
| Música Tradicional | `app/musica/` | `music_api.py` | Fado, folclore, instrumentos |
| Rotas Culturais | `app/rotas-culturais/` | `cultural_routes_api.py` | Rotas musicais, dança, festas |

Todos os módulos usam o **design system centralizado** com paletas temáticas via `getModuleTheme()`.

---

## Design System

### Paleta de Cores (inspirada na paisagem portuguesa)

| Escala | Uso principal |
|--------|---------------|
| `forest` | Cor primária — verde floresta do Norte |
| `mint` | Natureza, trilhos, sucesso |
| `terracotta` | Accent — tons quentes do Alentejo |
| `ocean` | Cor secundária — azul atlântico |
| `rust` | Alertas, CTAs fortes |
| `gray` | Texto, fundos, superfícies |

### Tokens Semânticos

O ThemeContext fornece `colors` com tokens light/dark:

- **Core**: `primary`, `secondary`, `accent`
- **Surfaces**: `background`, `surface`, `surfaceAlt`, `card`
- **Text**: `textPrimary`, `textSecondary`, `textMuted`, `textOnPrimary`
- **Borders**: `border`, `borderLight`
- **Status**: `success`, `warning`, `error`, `info`

### Acessibilidade

- **Daltonismo**: 3 modos (deuteranopia, protanopia, tritanopia) com override automático de cores problemáticas
- **Accents regionais**: 7 regiões (Norte, Centro, Lisboa, Alentejo, Algarve, Açores, Madeira) com cor de accent personalizada
- **Contraste**: tokens diferenciados entre surfaces, borders e cards para visibilidade em dark mode
- **Declaração de Acessibilidade** em `/acessibilidade` (`frontend/app/acessibilidade.tsx`): estado *parcialmente conforme* com WCAG 2.1 AA e limitações conhecidas (contraste do tema claro, botões só com ícone sem nome acessível, imagens sem texto alternativo, campos sem etiqueta, mapa sem alternativa para leitor de ecrã além das listas, vídeos sem legendas). Ao corrigir uma limitação, retirá-la da declaração e atualizar a data

### Padrões de Componentes

- **borderRadius**: 14px standard em todos os cards
- **Shadows**: `shadows.sm/md/lg/xl` do theme
- **Spacing**: grid de 4px (`spacing[1]=4, spacing[2]=8, spacing[4]=16`)
- **Typography**: 10 tamanhos (xs:10 → 5xl:40), 4 pesos (normal → bold)

---

## Funcionalidades Principais

### Descoberta e Exploração
- Feed de descoberta personalizado com scoring de relevância
- Mapa interativo com MapLibre: 7 modos (light, dark, terrain, satellite, premium, technical, 3D)
- 39+ camadas de mapa (património, miradouros, praias, museus, trilhos, gastronomia, eventos…)
- Geolocalização "perto de mim" com raio configurável (10/25/50/100 km)
- Clusters nativos MapLibre com zoom interativo
- Enciclopédia cultural com 6 universos temáticos
- Pesquisa global com filtros por região, categoria e tipo

### Narrativas por IA (Emergent LLM)
- **4 profundidades**: snackable (30-60s), história (3-5min), enciclopédico (7-12min), crianças (1-2min)
- **6 perfis cognitivos**: gourmet, família, arquitectura, natureza radical, história profunda, crianças
- Micro-histórias contextuais (sazonais + trigger-based)
- Cache dedicado em MongoDB (`narrative_cache`)
- Camada de credibilidade (fonte, confiança, verificação, revisor)

### IQ Engine (19 módulos)
- **M1** Enriquecimento semântico (embeddings + categorização)
- **M2** Perfilagem cognitiva do utilizador
- **M3** Análise e optimização de imagens
- **M4** Geração de slugs SEO
- **M5** Validação e normalização de endereços
- **M6** Deduplicação de POIs
- **M7/M8** Scoring de POIs e rotas
- **M9** Enriquecimento de metadados
- **M11** Geração de descrições com LLM
- **M12** Agrupamento temático
- **M13–M19** Routing inteligente (tempo, dificuldade, perfil, meteo, hora do dia, multi-dia, optimizador)

### Rotas e Planeamento
- Planeador inteligente com 4 modos: viagem rápida, fim-de-semana, road trip, temático
- Geração de rotas por IQ Engine scores
- Waypoints com sugestões de POIs
- Itinerários guardados com timeline, budget e colaboração
- Partilha de rotas (link, QR, WhatsApp, share nativo)
- Narrativas walking-tour com trigger geo (50m)

### Trilhos e GPX
- Upload GPX (web + nativo iOS/Android)
- Cálculo automático: distância, desnível, tempo estimado (Naismith)
- Perfil de elevação
- POIs próximos do trilho
- Classificação de dificuldade automática

### Praias, Mar e Costa
- Beachcams em tempo real
- Condições de surf e marés (IPMA)
- Dados de praias (qualidade água, bandeira azul)
- Módulo costa com zonas costeiras

### Eventos e Agenda
- +300 eventos para 2026
- Agenda viral com agregação de fontes externas
- Filtros por data, região, categoria
- Detalhe de evento com localização e partilha

### Pagamentos Premium (Stripe)
- **Explorador** (grátis): 3 rotas/dia, funcionalidades base
- **Descobridor** (4,99€/mês): IA ilimitada, áudio, offline, rotas ilimitadas
- **Guardião** (39,99€/ano): tudo + early access, rotas custom, exportação
- Checkout Stripe com trial 7 dias
- MB Way + Multibanco (métodos portugueses)
- Portal de gestão de subscrição
- Feature gating em todos os endpoints premium

### Mobilidade
- Horários CP (comboios) em tempo real
- Transportes públicos (GTFS)
- Planeador de rotas multi-modal

### Gamificação
- Sistema de pontos, badges e conquistas
- Streaks diários
- Leaderboard regional com Redis
- Check-in em POIs

### Offline e Performance
- **Pacotes de região** (Definições → Offline): `GET /api/offline/package/{região}` traz POIs, rotas, eventos e categorias da região
  - No nativo ficam num ficheiro JSON por região em `documentDirectory/offline-packages/` (o AsyncStorage do Android não lê entradas acima de ~2 MB); no web, em AsyncStorage
  - Sem rede, `cachedGet` (`src/services/api/client.ts`) tenta por esta ordem: API → cache de 24 h do pedido → pacotes descarregados. As respostas a partir dos pacotes estão em `src/services/offlinePackQueries.ts` (lista e detalhe de POIs, mapa, perto de mim, rotas, POIs de uma rota, categorias)
  - Sem rede, os POIs aparecem no conteúdo original (PT); um POI apagado no servidor continua visível até a região ser atualizada
- OfflineBanner animado com detecção NetInfo
- Fila de ações pendentes (visitas, favoritos, contributos) sincronizada ao voltar a rede
- Imagens optimizadas com blurhash e cache memory-disk
- Warm cache de favoritos no login
- **PWA**: service worker com cache-first de tiles MapLibre (CARTO + AWS DEM), LRU 4000 entries (~40 MB), 504 graceful quando offline

### Performance & Cache (Fase 3-5)
- **LLM cache** Redis (TTL 7 dias) em todos os endpoints LLM (pairing, identify, narrative, hoje) — colapsa chamadas duplicadas
- **Rate limiter distribuído** Redis ZSET sliding window (substitui counter in-memory por-worker)
- **Search relevance** com `$text` + `textScore` (Portuguese stemming) em `/api/search` e `/api/search/global`
- **Bulk content metrics** via `$facet` (5 round-trips → 1)
- **Mongo `name_normalised`** indexado para dedup POI sem regex scan

---

## Multi-Tenant

Cada utilizador autenticado pode ter `municipality_id` no documento `users`. Quando presente:
- Queries geo (`$near`, bounding-box) e listagens (POIs, trilhos, narrativas, contribuições, eventos) são automaticamente filtradas por município
- Anonymous traffic mantém-se sem filtro (descoberta pública)
- Utilizadores com `is_admin=true` vêem global
- Header `X-Municipality-Id` (TenantMiddleware) tem prioridade quando presente

Helper central em `backend/shared_utils.py::apply_municipality_filter(query, user)`. Wired em `proximity_api`, `map_layers_api`, `trails_api`, `narratives_api`, `community_api`, `discover_feed_api`.

---

## Observabilidade

Pilares prontos a ligar (basta DSN/scraper):

- **Sentry** — SDK iniciado em backend (`monitoring.py`) e frontend (`utils/monitoring.ts`). Falta apenas `SENTRY_DSN` em env
- **Prometheus** — `/api/metrics` expõe 9 contadores: `http_requests_total`, `http_request_duration_seconds`, `http_5xx_errors_total`, `http_status_alerts_total`, `llm_cache_{hits,misses,errors}_total`, `rate_limit_triggered_total`, `llm_calls_total`
- **Grafana dashboard** — `ops/grafana/portugal-vivo-dashboard.json` (8 painéis prontos a importar)
- **Health checks**: `/api/health`, `/api/health/detailed`, `/api/health/deep` (probes Mongo+Redis+LLM)
- **Structured logs** — JSON com `request_id` propagado via ContextVar (activar com `LOG_FORMAT=json`)
- **Smoke test pós-deploy** — `python scripts/verify_observability.py --base-url <url>`

---

## Conformidade Legal

- **Entidade responsável** — `frontend/src/config/legalEntity.ts` é a fonte única dos dados do titular (nome, forma jurídica, NIF, domicílio profissional, contactos, EPD). A Política de Privacidade (RGPD, art. 13.º), os Termos de Utilização (DL 7/2004, art. 10.º) e a Declaração de Acessibilidade leem daqui. Ao alterar um valor, atualizar a data `LAST_UPDATED` das páginas
- **Páginas** — `/privacy`, `/terms` e `/acessibilidade`, ligadas a partir do Perfil, partilham o layout `src/components/legal/LegalPage.tsx` (contraste ≥ 4,5:1, títulos marcados como cabeçalhos, botão de voltar com nome acessível)
- **Reclamações** — os Termos indicam o CNIACC (resolução alternativa de litígios) e o Livro de Reclamações Eletrónico
- **Estado** — ambos os documentos estão marcados como sujeitos a revisão jurídica antes do lançamento público

---

## Setup Rápido

### Pré-requisitos
- Python 3.11+
- Node.js 20+
- MongoDB 6.x
- Redis 7.x

### Backend

```bash
cd backend
cp .env.example .env      # preencher variáveis
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npx expo start            # web: W | iOS: I | Android: A
```

### Docker

```bash
docker-compose up -d
```

---

## Variáveis de Ambiente

### Backend (`backend/.env`)

```env
# Base de dados
MONGO_URL=mongodb://localhost:27017
DB_NAME=portugal_vivo

# Autenticação
JWT_SECRET_KEY=your-secret-key
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# IA / LLM
# O cliente central (backend/llm_client.py) escolhe ao boot:
#   1. OPENAI_API_KEY definido → OpenAI directo (recomendado)
#   2. Senão EMERGENT_LLM_KEY → proxy Emergent (fallback / staging)
# Override explícito: LLM_PROVIDER=openai|emergent
OPENAI_API_KEY=
EMERGENT_LLM_KEY=
LLM_PROVIDER=

# Imagens
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Pagamentos
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Cache / Leaderboard
REDIS_URL=redis://localhost:6379

# Monitorização
SENTRY_DSN=...
```

### Frontend (`frontend/.env`)

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_SENTRY_DSN=...
EXPO_PUBLIC_GOOGLE_MAPS_KEY=...
```

`EXPO_PUBLIC_BACKEND_URL` é **obrigatória em builds de produção** — sem ela a app falha ao arrancar (`src/config/api.ts`). As variáveis `EXPO_PUBLIC_*` são embutidas no bundle pelo Metro: depois de as alterar, exportar com `--clear`, senão fica a versão em cache.

### Versão web (PWA)

```bash
cd frontend
EXPO_PUBLIC_BACKEND_URL=https://api.portugalvivo.pt npx expo export --platform web --clear
```

A exportação é estática (`web.output: "static"` em `app.json`): cada rota sai como HTML com o conteúdo e o `<head>` já renderizados. Para isso a raiz (`app/_layout.tsx`) não espera pelas traduções na web — o i18n arranca de forma síncrona em PT e muda depois para a língua guardada ou do dispositivo. No nativo mantém-se o ecrã de arranque até a língua ser lida.

---

## Testes

Checklist antes de abrir um PR (ver `CONTRIBUTING.md`):

```bash
cd backend && python -m pytest tests/ -q
cd frontend && npm test && npx tsc --noEmit && npm run lint
```

### Backend (pytest)

145 ficheiros de teste. Sem MongoDB local, os testes de integração marcados `@requires_db` são ignorados (≈1 980 correm, ≈880 ignorados); no CI corre tudo contra MongoDB e Redis.

### Frontend (Jest)

118 ficheiros de teste (≈1 400 testes) em `frontend/app/__tests__/` e `frontend/src/**/__tests__/`. Os testes correm em PT (`src/i18n/testing.ts`); um teste pode mudar de língua com `changeLanguage`.

### End-to-end

```bash
# Playwright (web)
cd e2e && npm test

# Maestro (mobile)
maestro test e2e/maestro/
```

---

## CI/CD

Pipeline `ci.yml` em cada push e pull request:

| Job | Verificação |
|---|---|
| `backend-tests` | pytest com cobertura contra MongoDB 6 + Redis 7 |
| `frontend-tests` | `tsc --noEmit`, lint e Jest |
| `frontend-build` | Exportação web estática (`expo export`) |
| `docker-build` | Build multi-stage production + health check |
| `secrets-scan` | Gitleaks — zero segredos no repo |

O MongoDB e o Redis do `backend-tests` arrancam com `.github/scripts/start-ci-services.sh`, que tenta vários espelhos das imagens oficiais (mirror.gcr.io → ECR Public → Docker Hub) — os `services:` do GitHub desistem ao fim de três tentativas ao mesmo registo e falhavam o job com `toomanyrequests`. As instalações `pip`/`npm` repetem em caso de falha de rede.

### Workflows manuais e agendados

Os workflows de dados (seed, enriquecimento, CAOP, traduções, geometria de trilhos, cache do "Hoje") escrevem na base de dados de produção (`MONGO_URL` nos secrets). Os manuais correm a partir de **Actions → Run workflow**.

| Workflow | Quando | O que faz |
|---|---|---|
| CD — Deploy para Produção | manual | CI, build e push da imagem, aprovação, deploy por SSH com a tag `commit-<sha7>` e rollback automático |
| Seed Events 2026 | manual | Sincroniza eventos (curados, Excel, dados.gov.pt) |
| Enrich POI Images (Wikimedia) | manual | Preenche `image_url` em falta |
| CAOP Ingest | manual | Distritos, concelhos e freguesias (DGT) a partir de uma release |
| Cultural Routes Enrichment | diário 04:00 UTC | Cruza rotas culturais com POIs, eventos e trilhos |
| Translate POI sheets (EN/ES/FR) | manual | Traduz fichas de POI |
| Hoje em Portugal — Daily Cache Warmup | diário 05:00 UTC | Pré-aquece a cache do "Hoje" |
| Trail Geometry Backfill / Bake Trail Geometry | manual | Geometria de trilhos a partir do OSM |
| EAS Build / EAS Update | manual / push | Builds iOS/Android e atualizações OTA |
| Smoke Test | manual / após outro workflow | Verificações pós-deploy |

---

## Módulos Estratégicos (Motor Inteligente)

| Módulo | Ficheiro | Endpoints |
|--------|----------|-----------|
| Knowledge Graph Universal | `knowledge_graph_api.py` | `/graph/traverse`, `/graph/search`, `/graph/summary` |
| Temporal Context Orchestrator | `temporal_context_api.py` | `/temporal/context`, `/temporal/enrich`, `/temporal/calendar`, `/temporal/best-time` |
| Narrative Layer Global | `narrative_layer_api.py` | `/narrative-layer/generate`, `/narrative-layer/get`, `/narrative-layer/invalidate`, `/narrative-layer/stats`, `/narrative-layer/personas` |

### Knowledge Graph Universal
- 10 tipos de nó: rotas culturais, património, gastronomia, flora, fauna, pré-história, cultura marítima, biodiversidade marinha, trilhos, eventos
- Ligações por: tags partilhadas, município, região, estatuto UNESCO, proximidade geo (Haversine)
- BFS limitado: max 60 nós, 3 hops de profundidade

### Temporal Context Orchestrator
- Contexto sazonal automático (inverno/primavera/verão/outono)
- Fase lunar calculada matematicamente (sem API externa)
- Enriquecimento temporal de entidades de qualquer módulo
- Calendário mensal de eventos e janelas de fauna/flora

### Narrative Layer Global
- Narrativas LLM (gpt-4o-mini) para qualquer entidade de qualquer módulo
- 7 personas (família, estudante, viajante, fotógrafo, gastrónomo, académico)
- 7 moods, 5 línguas (PT, EN, ES, FR, DE)
- Cache Mongo com TTL 30 dias + fallback determinístico

---

## Rotas Culturais Hub (Entrega 3)

Ecrã hub completo em `app/rotas-culturais/index.tsx`:
- **Mapa interativo** com 6 camadas toggleáveis (rotas, património, eventos, trilhos, UNESCO, gastronomia)
- **Calendário Cultural** — strip mensal com densidade de actividade por mês
- **Playlists Temáticas** — colecções curadas (Rota UNESCO, Norte Profundo, Fim de Semana, Músicas de Portugal, Grande Viagem)
- **Filtros** por família (6 categorias) e região

---

## Números

| Métrica | Valor |
|---|---|
| Ecrãs frontend | 88 |
| Componentes React Native | 97 |
| Módulos backend (API) | 90+ |
| Routers registados | 93+ |
| Endpoints REST | 520+ |
| Serviços externos | 24 |
| Ficheiros de teste | 263 (145 backend, 118 frontend) |
| Testes | ≈4 300 (≈2 860 backend, ≈1 400 frontend) |
| Módulos IQ Engine | 19 |
| Módulos temáticos | 11 |
| Módulos motor inteligente | 3 |
| Idiomas in-app | 4 (PT, EN, ES, FR) — narrativas LLM em 5 incl. DE |
| Camadas de mapa | 44 |
| Modos de mapa | 11 |
| Contadores Prometheus | 9 |

---

## Mobile Release (EAS)

Os builds iOS / Android correm na cloud da Expo via GitHub Action — não é preciso máquina pessoal:

1. **Setup uma vez**: token EAS pessoal em `Settings → Secrets → EXPO_TOKEN`
2. **Lançar build**: GitHub → **Actions** → **EAS Build (iOS / Android)** → Run workflow → escolher `platform`, `profile`, `submit`
3. **Acompanhar**: https://expo.dev/accounts/[user]/projects/portugal-vivo/builds

Pré-build sanity check local: `./scripts/eas_prebuild_check.sh production`.

### Validar no telemóvel

Guia passo-a-passo em **[README-validar.md](./README-validar.md)** — Expo Go (dev server), build EAS `preview` (APK instalável sem dev server) e EAS Update OTA.

Canais EAS Update configurados em `eas.json` (`development` / `preview` / `production`) com `runtimeVersion` por `appVersion` (`app.json`). Iterar sem rebuild: `eas update --branch preview`.

### Privacy Manifest (App Store mandatory desde Maio 2024)

`frontend/PrivacyInfo.xcprivacy` declara required-reason API uses (UserDefaults, FileTimestamp, DiskSpace, SystemBootTime) e collected data types (email, location, crash data — todos não-tracking). É copiado para `ios/<AppName>/PrivacyInfo.xcprivacy` durante prebuild via plugin `frontend/plugins/withPrivacyManifest.js`.

### Bundle Identifiers

| Plataforma | Identificador |
|---|---|
| iOS | `pt.portugalvivo` |
| Android | `pt.portugalvivo` |

### Permissões Android (justificadas)

`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (proximity), `CAMERA` (AR Time Travel), `VIBRATE` (haptics), `POST_NOTIFICATIONS` (push reminders).

---

## Licença

© Tiago Nuno Ramalho de Brito Beato (Portugal Vivo). Todos os direitos reservados. Identificação completa do titular em `frontend/src/config/legalEntity.ts` e na Política de Privacidade da app.
