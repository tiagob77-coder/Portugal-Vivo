# Compras na app (App Store / Google Play)

As apps iOS e Android vendem o Premium pelas lojas, como a Apple (diretriz
3.1.1) e a Google (política de pagamentos do Play) exigem para subscrições
digitais. A web continua com Stripe (cartão, PayPal, MB Way, Multibanco).
As duas vias escrevem na mesma coleção `subscriptions`, por isso o estado
Premium e as funcionalidades pagas funcionam igual em todo o lado.

## Como funciona

1. A app pede `GET /api/iap/products`: IDs dos produtos e, com sessão
   iniciada, um token da conta (UUID) que vai na compra
   (`appAccountToken` no iOS, `obfuscatedAccountId` no Android).
2. A loja processa o pagamento; a app envia o resultado para
   `POST /api/iap/verify`:
   - iOS: a transação assinada (JWS do StoreKit 2), verificada com a
     biblioteca oficial da Apple (`app-store-server-library`) contra os
     certificados raiz da Apple;
   - Android: o purchase token, lido na Google Play Developer API
     (`purchases.subscriptionsv2`) com a conta de serviço.
3. Só depois de o servidor confirmar é que a app conclui a transação
   (no Android isto também a "reconhece"; sem isso a Google reembolsa ao fim
   de 3 dias).
4. Renovações, cancelamentos, reembolsos e expirações chegam por:
   - App Store Server Notifications V2 → `POST /api/iap/apple/notifications`
   - Google Play RTDN (Pub/Sub push) → `POST /api/iap/google/rtdn?token=…`
5. Ao iniciar sessão, a app volta a enviar as compras que a loja ainda tem —
   cobre uma verificação falhada ou uma notificação perdida.

Uma transação com o token de outra conta, ou já associada a outra conta, é
recusada (409): uma transação copiada não dá Premium a terceiros.

## Configuração (uma vez)

### App Store Connect
- Criar o grupo de subscrições e os produtos auto-renováveis
  `pt.portugalvivo.premium.monthly` (4,99 €) e `pt.portugalvivo.premium.annual`
  (39,99 €). Opcional: oferta introdutória de 7 dias (equivalente ao trial da web).
- App Information → App Store Server Notifications → URL de produção e de
  sandbox: `https://api.portugalvivo.pt/api/iap/apple/notifications`, versão 2.
- Backend: `APPLE_APP_ID` (Apple ID numérico da app) e `APPLE_ROOT_CERTS_DIR`
  com os certificados raiz descarregados de apple.com/certificateauthority.

### Google Play Console
- Monetizar → Subscrições: os mesmos dois IDs, cada um com um plano base
  (mensal e anual).
- Google Cloud: conta de serviço com acesso à app na Play Console
  (permissão "Ver dados financeiros" e "Gerir encomendas e subscrições");
  JSON em `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` ou `_FILE`.
- Monetização → Configuração de monetização → notificações em tempo real:
  tópico Pub/Sub com subscrição push para
  `https://api.portugalvivo.pt/api/iap/google/rtdn?token=<GOOGLE_RTDN_TOKEN>`.

### Verificar
`GET /api/iap/status` (admin) diz que lojas o servidor consegue verificar.

## Testar
- iOS: build de desenvolvimento ou TestFlight com uma conta sandbox
  (as compras de teste renovam de 5 em 5 minutos).
- Android: build na faixa de teste interno com uma conta de "license tester".
- Não funciona no Expo Go: é preciso um development build (`eas build --profile development`).

## Preços e comissões
As lojas ficam com 15% no Small Business Program (receita < 1 M$/ano) e
convertem o preço para cada país; a app mostra o preço que a loja devolve.
