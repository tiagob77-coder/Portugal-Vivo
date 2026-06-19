# Validar no telemóvel

Guia para abrir o **Portugal Vivo** num dispositivo e validar alterações (ex.: a renovação de design). Escolhe **uma** das opções abaixo.

> Nota: o ambiente de CI/sandbox **não** serve a app ao teu telemóvel (rede de saída restrita e sem deploy público acessível). Estes passos correm na **tua máquina**, com a tua conta Expo. Está tudo em `main`.

---

## Resumo rápido

| Quero… | Opção | Precisa de |
|--------|-------|------------|
| Ver já, mexer no código | **1 · Expo Go** | Node + Expo Go no telemóvel |
| Um APK instalável (sem dev server) | **2 · EAS Build `preview`** | Conta Expo |
| Atualizar JS sem rebuild | **3 · EAS Update (OTA)** | Um build do passo 2 |
| Ver no browser do telemóvel | **4 · Web (mesma rede)** | Node |

---

## 1 · Expo Go (dev server)

```bash
git pull origin main
cd frontend
npm install
npx expo start --tunnel      # QR no terminal → escaneia com a app Expo Go
```

- Mesmo Wi-Fi no PC e no telemóvel? Podes dispensar `--tunnel`.
- Redes diferentes? Usa `--tunnel` (cria um URL público temporário).

---

## 2 · EAS Build — APK instalável (recomendado para validar sem dev server)

O perfil `preview` já existe em `eas.json`. Gera um build *standalone* com o estado atual de `main`.

```bash
cd frontend
npm install
npx eas-cli login                                   # a tua conta Expo
npx eas-cli init                                     # vincula o projectId (escreve no app.json)
npx eas-cli build --profile preview --platform android
```

No fim, o EAS dá um **link/QR de instalação** → abre no Android → instala o APK → app com a identidade nova.
*(iOS requer conta Apple Developer para instalar em device; em alternativa usa o simulador.)*

---

## 3 · EAS Update — OTA por cima de um build

**Importante:** o EAS Update entrega JavaScript *over-the-air* a um app que **já tenha `expo-updates`** (um build dos passos acima). **Não chega ao Expo Go genérico.**

```bash
cd frontend
npx expo install expo-updates
npx eas-cli update:configure                         # completa o app.json (updates.url)
npx eas-cli update --branch preview --message "Renovacao de design"
```

O build instalado a partir do canal `preview` apanha o update ao reabrir.

Canais configurados em `eas.json`: `development`, `preview`, `production`. `runtimeVersion` por `appVersion` (`app.json`).

---

## 4 · Web no telemóvel (mesma rede Wi-Fi)

```bash
cd frontend
npm install
npm run web                  # serve na porta 3000
```

No browser do telemóvel: `http://<IP-do-teu-PC>:3000` (é PWA, dá para instalar no ecrã inicial).

---

## Resolução de problemas

- **`expo start --tunnel` não liga** → confirma que tens saída para a internet; tenta sem `--tunnel` no mesmo Wi-Fi.
- **`eas` pede projectId** → corre `npx eas-cli init` (faz login primeiro).
- **iOS não instala o APK** → o iOS não usa APK; usa o simulador (`--profile preview` com `"simulator": true`) ou um build com conta Apple Developer.
- **App abre mas sem as mudanças** → confirma que fizeste `git pull origin main` antes do build/start.
