# QA & Profiling Mobile — Otimizações de Performance

Guião para validar **no dispositivo** as otimizações mobile-first (PRs #198–#201).
As mudanças de interação nativa não são validáveis em CI — só com app real.

## 1. Setup

```bash
cd frontend
# Dev build (NÃO Expo Go — geofencing/notificações/clustering precisam de build nativo)
npx expo run:android   # ou: npx expo run:ios
```

- **Hermes**: confirmar que está ativo (já é o default em RN 0.81). `j` no Metro → DevTools.
- **Perf Monitor** (in-app): shake → "Show Perf Monitor". Observar **JS FPS** e **UI FPS** (queremos ~60/60; quedas = jank).
- **Android low-end**: testar também num device fraco (2–3 GB RAM) ou emulador com CPU/RAM limitados — é onde os ganhos se notam.

## 2. Métricas a capturar (antes/depois, se possível)

| Métrica | Como medir | Alvo |
|---|---|---|
| **TTI** (Descobrir/arranque) | cronometrar splash → conteúdo interativo | menor que baseline |
| **JS FPS** durante scroll/loading | Perf Monitor | sem quedas abaixo de ~50 |
| **UI FPS** no pan/zoom do mapa | Perf Monitor | ~60 |
| **Memória** (Android Studio Profiler) | pico em listas densas | sem crescimento descontrolado |
| **Bateria/rede** (geofencing) | Android Battery Historian / contador de pedidos | menos wakeups GPS / menos fetches parado |

## 3. Checklist por mudança

### Mapa — clustering nativo (#200)
- [ ] Selecionar categoria densa (ex.: gastronomia). **Não** deve aparecer "chuva" de milhares de pins nem travar.
- [ ] Zoom out → bolhas de cluster com número; zoom in → separam-se em markers individuais.
- [ ] Tocar num cluster → faz **zoom-in** suave para a área.
- [ ] Tocar num marker individual → Callout + navegação para detalhe (como antes).
- [ ] Pan/zoom mantém ~60 UI FPS (sem stutter).

### Descobrir — defer abaixo da dobra (#199)
- [ ] Ecrã pinta o hero/quick-actions rapidamente.
- [ ] Ao fazer scroll, "Explorar em Profundidade" e "Toolkit IA" aparecem (≤1s após arranque).
- [ ] Sem "salto" de layout perturbador ao montarem.

### Geofencing por módulo (#196/#198)
- [ ] Definições → "Módulos de interesse": selecionar p.ex. Gastronomia + Miradouros.
- [ ] Com localização ativa, aproximar-se de um POI desses módulos → **notificação local nativa** + banner com ícone/cor/etiqueta do módulo.
- [ ] Sem módulos selecionados → comportamento anterior (alertas IQ).
- [ ] Parado no mesmo sítio: confirmar que **não** há fetches repetidos (throttle 75 m / 30 s).
- [ ] App em segundo plano: sem poll do orchestrator (2 min) a drenar dados.

### Listas (#198/#201)
- [ ] `category/[id]`: scroll de lista longa fluido; itens **não** ficam em branco ao entrar no ecrã.
- [ ] Economia → tab Mercados: render inicial limitado; "Ver mais" carrega +24; mudar de tab repõe.

### Jank de loading (#198)
- [ ] Durante loading, o shimmer dos skeletons não causa quedas de JS FPS (native driver).

## 4. Como fazer A/B fiável
1. Medir baseline no commit anterior ao lote (`git stash`/checkout) **ou** comparar com a versão em produção.
2. Mesmo device, mesma rede, app reiniciada (não medir o primeiro cold start após install).
3. Repetir 3× e tirar mediana.

## 5. Se algo regredir
- Mapa lento mesmo com clustering → reduzir `gridDivisions` (mais agregação) em `src/utils/clusterMarkers.ts` ou baixar `CLUSTER_INPUT_CAP` em `mapa.tsx`.
- Secções diferidas a aparecer tarde → baixar o fallback de 800 ms em `descobrir.tsx`.
- Alertas de geofencing a mais/menos → afinar `MIN_MOVE_M` / `MODULE_ALERT_RADIUS_M` em `geofencing.ts`.
