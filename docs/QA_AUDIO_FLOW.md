# QA — Fluxo Crítico #1: Descoberta → POI → Narrativa → Áudio

Guião manual reproduzível para validar o loop central da app num dispositivo real.
Não é automatizável no CI (requer Expo Go + interação humana + chaves de TTS).

> Contexto: a auditoria de Março marcou o mobile como ⚠️ parcial ("aguarda teste
> em Expo Go"). Este é o passo que confirma se o loop é "mágico" no terreno.

---

## Pré-requisitos

- Backend a correr (local ou staging) com MongoDB + Redis e POIs que tenham
  `description` ou `ai_narrative` (≥ 20 caracteres).
- Conta **premium** (o guia de áudio é feature premium — `audio_guides`), ou um
  utilizador com essa feature ativa.
- App aberta em **Expo Go** (iOS/Android) — a web serve para um primeiro smoke,
  mas o objetivo é o dispositivo.

---

## Matriz de provider TTS — validar os 3 cenários

A correção de áudio (PR #230) faz auto-select de provider, igual ao `llm_client`.
Validar cada caminho mudando apenas o ambiente do backend e reiniciando:

| Cenário | Env backend | Resultado esperado no botão "Ouvir" |
|---|---|---|
| **A — OpenAI direto** | `OPENAI_API_KEY` definida | áudio mp3 narrado (resposta `tts_provider: "openai"`) |
| **B — Emergent (legado)** | só `EMERGENT_LLM_KEY` definida | áudio mp3 narrado (`tts_provider: "emergent"`) |
| **C — Sem chave** | nenhuma das duas | **fallback on-device**: backend devolve `success:false`, `fallback:"device"`, `text`; a app lê a narração com a voz do dispositivo (`expo-speech`) |

O essencial do cenário C: **o botão "Ouvir" nunca fica morto**, mesmo sem TTS remoto.

---

## Passos do fluxo

1. Abrir a app → tab **Descobrir**.
2. A partir de **POI do dia** / **Surpreende-me** / feed, abrir o detalhe de um POI
   (rota `/heritage/[id]`).
3. **Narrativa**: confirmar que aparece texto. Premium gera via LLM; sem LLM, cai
   no fallback estático — **nunca deve dar erro 500** (PR #230).
4. Tocar **"Ouvir"**:
   - Se não for premium → deve redirecionar para `/premium`.
   - Cenário A/B → áudio mp3 começa em ~2–3 s.
   - Cenário C → a voz do dispositivo lê a narração (sem mp3).
5. Tocar **"Ouvir"** de novo → deve **parar** (toggle), tanto o mp3 como a voz do
   dispositivo.
6. Sair do ecrã a meio da reprodução → não deve haver crash (cleanup de áudio +
   `Speech.stop()`).

---

## Checklist de aceitação

- [ ] O botão "Ouvir" nunca fica inerte (toca mp3, lê com o dispositivo, ou
      redireciona a premium).
- [ ] Pronúncia **PT-PT** (não brasileira) — ver `_prepare_text_for_tts`.
- [ ] Stop funciona em ambos os modos (remoto e dispositivo).
- [ ] Sem crash ao abandonar o ecrã durante a reprodução.
- [ ] Narrativa nunca devolve 500 (com ou sem LLM configurado).

---

## Verificação rápida pelo backend (sem app)

```bash
# Com token premium no header Authorization: Bearer <jwt>
# A/B → success:true + audio_base64 ; C → success:false + fallback:"device" + text
curl -s -H "Authorization: Bearer <JWT_PREMIUM>" \
  "$API/api/audio/guide/<POI_ID>" | python3 -m json.tool

# Narrativa nunca deve dar 500 (premium)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Authorization: Bearer <JWT_PREMIUM>" -H "Content-Type: application/json" \
  -d '{"item_id":"<POI_ID>","style":"storytelling"}' "$API/api/narrative"
```

---

## Notas de produção

- O cache de áudio fica em `AUDIO_CACHE_DIR` (default `/tmp/audio_guides`). Em
  produção, apontar para um volume persistente para não re-gerar a cada redeploy.
- Para o cenário A em produção, basta `OPENAI_API_KEY` — não é preciso instalar
  `emergentintegrations`.
