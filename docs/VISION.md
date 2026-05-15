# Portugal Vivo — Visão Focada

> **Missão:** Ser a plataforma de referência para descobrir Portugal com profundidade — não um agregador de pontos no mapa, mas um guia vivo que conta histórias, conecta pessoas ao território e facilita o movimento.

---

## O Problema que Resolvemos

Os turistas e residentes chegam a Portugal sem conseguir ir além do circuito óbvio (Torre de Belém, Sintra, Alfama). Não faltam apps de mapas — falta **contexto, narrativa e descoberta genuína**.

Do outro lado, câmaras municipais e operadores locais têm património valioso e invisível, sem canal digital para o colocar na mão das pessoas.

---

## A Proposta de Valor

| Para o utilizador | Para o território |
|---|---|
| Descobre o que os guias não mostram | POIs locais ganham visibilidade digital |
| Entende o contexto histórico e cultural | Municípios têm painel de gestão próprio |
| Planeia a viagem com transportes reais | Dados de visita e interesse agregados |
| Ganha recompensas por explorar | Narrativas geradas por IA reduzem custos editoriais |

---

## Os 3 Fluxos Críticos

Tudo o resto é secundário. Estes três têm de funcionar **impecavelmente** no lançamento:

### 1. Descoberta → POI → Áudio
```
Mapa/Feed → Seleccionar POI → Ler narrativa → Ouvir guia de áudio
```
É o loop central. O utilizador abre a app, encontra algo interessante perto de si, lê uma história bem escrita e ouve a narração enquanto caminha. Se isto for mágico, tudo o resto pode esperar.

### 2. Trilho → GPX → Percurso
```
Explorar trilhos → Ver perfil de elevação + POIs próximos → Navegar
```
O utilizador de natureza/caminhada que carrega um GPX ou escolhe um trilho curado e parte com contexto do que vai encontrar no caminho.

### 3. Planeador → Transporte → Evento
```
Escolher destino → Ver horários CP/autocarro → Adicionar evento ao dia
```
Combina mobilidade real com agenda cultural. A diferença entre uma app turística e uma app útil.

---

## Estratégia de Lançamento

### Fase 1 — Piloto Municipal (meses 1–3)
**Parceiro único, conteúdo rico, execução perfeita.**

- Escolher **1 município** com massa crítica de POIs interessantes (ex: Évora, Guimarães, Setúbal)
- Importar e enriquecer todos os POIs com o IQ Engine
- Gravar guias de áudio para os 20 POIs mais relevantes
- Lançar app com o município como caso de estudo e parceiro de comunicação
- Métricas: sessões médias, POIs visitados por sessão, retenção D7

**Porquê um só município?** Foco editorial. Melhor ter 200 POIs excelentes do que 2000 medíocres.

### Fase 2 — Expansão Regional (meses 4–9)
- Replicar o modelo com 3–5 municípios adicionais
- Activar multi-tenant: cada município gere o seu conteúdo
- Abrir gamificação regional (leaderboard por distrito)
- Parcerias com operadores de turismo para rotas temáticas pagas

### Fase 3 — Escala Nacional (mês 10+)
- Conteúdo gerado pela comunidade com moderação IA
- API pública para integradores (agências de viagem, guias turísticos)
- Modelo freemium: app gratuita, conteúdo premium e rotas exclusivas

---

## Prioridades Técnicas para o Lançamento

### Imprescindível (deve estar pronto)
- [ ] Fluxo de descoberta → POI → áudio sem falhas
- [ ] Modo offline funcional para a região piloto
- [ ] Performance do mapa com 200+ POIs carregados
- [ ] Autenticação estável (JWT + Google OAuth)
- [ ] Upload de imagens moderado

### Importante mas pode iterar
- [ ] Gamificação completa (streaks, badges)
- [ ] Enciclopédia cultural
- [ ] Câmeras de praia em tempo real
- [ ] Leaderboard regional

### Pode esperar
- [ ] Todos os 8 modos de mapa
- [ ] API pública
- [ ] Dashboard admin completo
- [ ] Alertas de fogos e surf

---

## Conteúdo é Produto

A tecnologia já existe. O diferenciador real é **a qualidade das narrativas**.

Cada POI precisa de:
1. **Título** que desperta curiosidade (não "Igreja de X", mas "A igreja onde D. Afonso I terá rezado antes de Ourique")
2. **Narrativa curta** (150–200 palavras) — história, contexto, curiosidade
3. **Áudio** (60–90 segundos) — narrado, não texto-para-voz
4. **3–5 fotografias** de qualidade
5. **IQ Score** ≥ 70 para aparecer no feed de destaque

O IQ Engine automatiza o enriquecimento semântico, mas a curadoria editorial é trabalho humano no início.

---

## Stack Resumida

```
Backend     FastAPI + MongoDB + Redis + GPT-4o
Frontend    React Native / Expo SDK 54 (iOS, Android, Web)
IA          IQ Engine 19 módulos + narrativas GPT-4o
Infra       Docker + multi-tenant por região
```

Setup completo no [README técnico](./README.md).

---

## O que Não Somos

- **Não somos o TripAdvisor** — não nos interessa acumular reviews. Interessa-nos profundidade.
- **Não somos o Google Maps** — não competimos em navegação turn-by-turn.
- **Não somos uma agenda de eventos** — os eventos existem para contextualizar a visita, não para ser o produto.
- **Não somos uma rede social** — a comunidade é um amplificador, não o core.

---

## Métrica Norte

> **Percentagem de utilizadores que visita fisicamente um POI após o descobrir na app.**

Tudo o resto (sessões, DAU, downloads) é contexto. Esta métrica diz se estamos a fazer a diferença no mundo real.

---

## Próximos 30 Dias

1. **Fechar parceria com município piloto** — protocolo assinado, dados partilhados
2. **Enriquecer 100 POIs** com o IQ Engine e validar qualidade editorial
3. **Gravar 20 guias de áudio** — os POIs âncora do piloto
4. **Correr o fluxo crítico #1** com 10 utilizadores reais e iterar
5. **Definir métricas de sucesso** do piloto com o parceiro municipal

---

*Portugal tem 5.000 anos de histórias para contar. A tecnologia já está construída. Agora é entregar.*
