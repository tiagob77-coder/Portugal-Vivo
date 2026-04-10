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
- **Modo offline** — cache inteligente com sincronização e fila de ações pendentes
- **Audio guides** — TTS com 9 vozes e 6 idiomas (premium)
- **i18n** — PT, EN, ES, FR
- **Multi-tenant** — isolamento por município com JWT

---

## Stack Técnica

### Backend
| Componente | Tecnologia |
|---|---|
| Framework | FastAPI (Python async) |
| Base de dados | MongoDB Atlas via Motor (async) |
| Cache / Leaderboard | Redis |
| Autenticação | JWT (python-jose) + Google OAuth2 |
| IA / LLM | Emergent LLM — gpt-4o-mini via `emergentintegrations` |
| Imagens | Cloudinary CDN |
| Pagamentos | Stripe (Card, PayPal, MB Way, Multibanco) |
| Rate Limiting | slowapi + middleware custom per-endpoint |
| Monitorização | Sentry + structured logging |
| Segurança | CSRF, rate limiting, security headers, CORS |
| Infra | Docker multi-stage, multi-tenant por região |

### Frontend
| Componente | Tecnologia |
|---|---|
| Framework | React Native + Expo SDK 54.0.33 |
| Navegação | Expo Router (file-based routing) |
| Mapas (web) | MapLibre GL JS 4.7.1 + CARTO tiles (grátis, sem API key) |
| Mapas (native) | Leaflet via WebView |
| Terreno 3D | AWS Elevation Tiles (terrarium encoding) + hillshade |
| Estado servidor | TanStack Query (useQuery, useMutation) |
| i18n | i18next (PT/EN/ES/FR) |
| Offline | AsyncStorage + cache 24h com fila de ações |
| Notificações | expo-notifications |
| Áudio | expo-av + expo-speech |
| Geofencing | expo-task-manager + expo-location |
| Imagens | expo-image com blurhash + cache memory-disk |
| Ícones | @expo/vector-icons MaterialIcons |
| Safe area | react-native-safe-area-context |
| Monitorização | @sentry/react |

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
- OfflineBanner animado com detecção NetInfo
- Cache 24h com fila de ações pendentes
- Imagens optimizadas com blurhash e cache memory-disk
- Warm cache de favoritos no login

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

# IA / LLM (Emergent — motor principal)
EMERGENT_LLM_KEY=...

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

---

## Testes

### Backend (pytest)

```bash
cd backend
pytest tests/ -v --timeout=30
```

43 ficheiros de teste, 176 testes cobrindo: auth, gamification, leaderboard, offline, surf, transportes, IQ Engine, upload, reviews, routes, map, encyclopedia, e2e.

### Frontend (Jest)

```bash
cd frontend
npm test -- --passWithNoTests
```

### End-to-end

```bash
# Playwright (web)
cd e2e && npm test

# Maestro (mobile)
maestro test e2e/maestro/
```

---

## CI/CD

Pipeline GitHub Actions em cada push:

| Job | Verificação |
|---|---|
| `backend-tests` | pytest + MongoDB + Redis |
| `frontend-tests` | Jest + TypeScript type check |
| `docker-build` | Build multi-stage production |
| `secret-scan` | Gitleaks — zero segredos no repo |

Retry automático para ECONNRESET (3 tentativas com backoff).

---

## Números

| Métrica | Valor |
|---|---|
| Ecrãs frontend | 78 |
| Componentes React Native | 110 |
| Módulos backend (API) | 87 |
| Routers registados | 90 |
| Endpoints REST | 496 |
| Serviços externos | 24 |
| Ficheiros de teste | 43 |
| Testes unitários | 176 |
| Módulos IQ Engine | 19 |
| Módulos temáticos | 11 |
| Idiomas | 4 (PT, EN, ES, FR) |
| Camadas de mapa | 39+ |
| Modos de mapa | 7 |

---

## Bundle Identifiers (Mobile)

| Plataforma | Identificador |
|---|---|
| iOS | `pt.portugalvivo` |
| Android | `pt.portugalvivo` |

---

## Licença

Propriedade de Portugal Vivo. Todos os direitos reservados.
