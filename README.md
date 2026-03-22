# Portugal Vivo

**Descubra a alma de Portugal** — aplicação móvel e web para explorar o património, cultura, natureza e mobilidade de Portugal.

---

## Visão Geral

O Portugal Vivo é uma plataforma completa de turismo cultural que combina:

- Descoberta de POIs (pontos de interesse) com narrativas geradas por IA
- IQ Engine com 19 módulos de enriquecimento semântico e scoring
- Sistema de gamificação com conquistas, streaks e leaderboard
- Modo offline com sincronização inteligente
- Guias de áudio, previsão de surf/marés, câmeras de praia
- Transportes públicos (CP, GTFS) e mobilidade em tempo real
- Multi-tenant com suporte a múltiplas regiões
- i18n em PT, EN, ES e FR

---

## Estrutura do Projeto

```
Portugal-Vivo/
├── backend/                  # FastAPI + MongoDB
│   ├── server.py             # Ponto de entrada (67 routers, 260+ endpoints)
│   ├── iq_engine_base.py     # IQ Engine — orquestrador dos 19 módulos
│   ├── iq_module_m1_*.py     # M1-M19: semântico, cognitivo, imagem, slug,
│   │   ...                   #   endereço, dedup, scoring, enriquecimento,
│   │                         #   descrição, temático, routing e outros
│   ├── models/               # Modelos Pydantic / MongoDB schemas
│   ├── services/             # 20 serviços externos (IPMA, GBIF, CP, GTFS,
│   │                         #   Cloudinary, Fogos.pt, ICNF, Overpass…)
│   ├── tests/                # Suite de testes (44 ficheiros pytest)
│   └── requirements.txt
│
├── frontend/                 # React Native + Expo SDK 54
│   ├── app/                  # 51 ecrãs (Expo Router file-based)
│   │   ├── (tabs)/           # Tabs principais: mapa, descobrir, experienciar,
│   │   │                     #   transportes, planeador, eventos, coleções, praia
│   │   ├── heritage/         # Detalhe de patrimônio
│   │   ├── route/            # Detalhe de rota
│   │   ├── category/[id]     # Categoria de POI
│   │   ├── evento/[id]       # Detalhe de evento
│   │   ├── encyclopedia/     # Enciclopédia cultural
│   │   ├── settings/         # Idioma + modo offline
│   │   └── ...
│   ├── src/
│   │   ├── components/       # 42+ componentes reutilizáveis
│   │   ├── services/         # API, gamification, geofencing, offline,
│   │   │                     #   audioGuide, pushNotifications, PWA
│   │   ├── context/          # AuthContext, ThemeContext
│   │   ├── i18n/             # Traduções PT, EN, ES, FR
│   │   ├── theme/            # Design system (cores, tipografia)
│   │   ├── config/           # Configuração da API
│   │   ├── types/            # TypeScript types globais
│   │   └── utils/            # Monitorização (Sentry), helpers
│   └── package.json
│
├── e2e/                      # Testes end-to-end
│   ├── playwright/           # Testes web (Playwright)
│   └── maestro/              # Testes mobile (Maestro)
│
├── scripts/                  # Geocodificação em batch e utilitários
├── tests/                    # Testes de integração adicionais
└── docker-compose.yml
```

---

## Stack Técnica

### Backend
| Componente | Tecnologia |
|---|---|
| Framework | FastAPI 0.135.1 |
| Base de dados | MongoDB 6.x (Motor async) |
| Cache / Leaderboard | Redis (aioredis) |
| Autenticação | JWT + Google OAuth2 + sessões |
| IA / LLM | GPT-4o (narrativas culturais, IQ Engine) |
| Imagens | Cloudinary |
| Monitorização | Sentry + structured logging |
| Segurança | CSRF, rate limiting, security headers, CORS |
| Infra | Docker multi-stage, multi-tenant por região |

### Frontend
| Componente | Tecnologia |
|---|---|
| Framework | React Native + Expo SDK 54.0.33 |
| Navegação | Expo Router (file-based) |
| Mapas | Leaflet (web) + react-native-maps (mobile) |
| Estado | Zustand + React Query (TanStack) |
| i18n | i18next + react-i18next (PT/EN/ES/FR) |
| Offline | AsyncStorage + cache inteligente |
| Notificações | expo-notifications |
| Áudio | expo-av (guias de áudio) |
| Ficheiros | expo-document-picker (upload GPX nativo) |
| Geofencing | expo-task-manager + expo-location |
| PWA | Service Worker + Web App Manifest |
| Monitorização | @sentry/react |

---

## Funcionalidades Principais

### Descoberta e Exploração
- Feed de descoberta personalizado com scoring de relevância
- Mapa interativo com 8 modos: Camadas, Heatmap, Trilhos, Épocas, Timeline, Proximidade, Noturno, Satélite
- Upload de ficheiros GPX — web (`<input>`) e nativo iOS/Android (`expo-document-picker`)
- Trilhos com polyline + marcadores de partida/chegada + perfil de elevação + stats (distância, desnível, tempo)
- Modo "Explorador Noturno" e filtros de proximidade GPS
- Enciclopédia cultural com universos temáticos
- Câmeras de praia em tempo real

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
- **M13–M19** Routing inteligente e planeamento

### Mobilidade
- Horários CP (comboios) em tempo real
- Transportes públicos (GTFS)
- Planeador de rotas com múltiplos modos de transporte
- Rotas inteligentes com sugestões adaptativas

### Trilhos e GPX

| Endpoint | Descrição |
|---|---|
| `POST /api/trails/upload` | Upload `.gpx` → calcula distância, desnível, tempo estimado |
| `GET /api/trails` | Listar todos os trilhos (sem pontos, para performance) |
| `GET /api/trails/{id}` | Detalhe com todos os pontos GPS |
| `GET /api/trails/{id}/pois` | POIs próximos do trilho (raio configurável) |
| `GET /api/trails/elevation/{id}` | Perfil de elevação para gráfico |

O mapa entra no modo Trilhos, carrega a lista da API e auto-selecciona o primeiro trilho disponível. O utilizador pode alternar entre trilhos via chips ou fazer upload de um novo ficheiro GPX (suporta GPX 1.0 e 1.1).

### Natureza e Mar
- Previsão de surf e condições de onda (IPMA)
- Previsão de marés e informação marinha
- Trilhos e fauna (integração GBIF + ICNF)
- Alertas de fogos (Fogos.pt)
- Widget de clima

### Gamificação
- Sistema de pontos, badges e conquistas
- Streaks diários
- Leaderboard regional com Redis
- Prémios premium

### Conteúdo e Comunidade
- Calendário de eventos
- Reviews e avaliações
- Partilha social (rotas, POIs)
- Newsletter
- Upload e moderação de imagens

### Gestão (Admin)
- Dashboard IQ com métricas de enriquecimento
- Importador Excel v19 (POIs, eventos, rotas)
- Painel multi-tenant por região
- Analytics e monitorização

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
npx expo start            # web: pressionar W | iOS: I | Android: A
```

### Docker (recomendado)

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

# IA
OPENAI_API_KEY=...              # GPT-4o para narrativas e IQ Engine

# Imagens
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Cache / Leaderboard
REDIS_URL=redis://localhost:6379

# Monitorização
SENTRY_DSN=...

# CORS
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081
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
pytest tests/ -v
```

Suite com 44 ficheiros cobrindo: auth, gamification, leaderboard, offline, surf, transportes, IQ Engine, upload, reviews, routes, map, encyclopedia, e2e críticos, e mais.

### Frontend (Jest)

```bash
cd frontend
npm test
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

O pipeline GitHub Actions executa automaticamente em cada push:

| Job | O que verifica |
|---|---|
| `backend-tests` | pytest com MongoDB + Redis reais |
| `frontend-tests` | Jest + TypeScript type check |
| `docker-build` | Build multi-stage com target `production` |
| `secret-scan` | Gitleaks — nenhum segredo no repositório |

---

## IQ Engine — Admin

Aceda ao painel de administração em `/iq-dashboard` para:

- Ver métricas de enriquecimento por módulo
- Monitorizar qualidade dos POIs (IQ Score)
- Executar importações em batch
- Gerir multi-tenant por região

---

## Bundle Identifiers (Mobile)

| Plataforma | Identificador |
|---|---|
| iOS | `pt.portugalvivo` |
| Android | `pt.portugalvivo` |

---

## Licença

Propriedade de Portugal Vivo. Todos os direitos reservados.
