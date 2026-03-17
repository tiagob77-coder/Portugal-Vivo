# Portugal-Vivo
App oficial Portugal Vivo - Descubra a alma de Portugal

## Estrutura do Projeto

```
Portugal-Vivo/
├── backend/          # FastAPI + MongoDB
├── frontend/         # React Native + Expo SDK 53
├── e2e/              # Testes end-to-end (Playwright + Maestro)
├── scripts/          # Utilitários de geocodificação
├── tests/            # Testes unitários Python
└── .emergent/        # Configuração da plataforma Emergent
```

## Stack Técnica

- **Frontend:** React Native com Expo SDK 53
- **Backend:** FastAPI 0.100+ com Motor (MongoDB async)
- **Base de dados:** MongoDB 6.x
- **Autenticação:** Emergent Auth (session-based)
- **IA:** Emergent LLM (GPT-4o) para narrativas culturais
- **Mapas:** Google Maps API v3

## Setup Rápido

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
npm install
npx expo start
```

## Variáveis de Ambiente

**Backend** (`backend/.env`):
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=portugal_vivo
EMERGENT_LLM_KEY=...
GOOGLE_MAPS_API_KEY=...
ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081
```

**Frontend** (`frontend/.env`):
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```
