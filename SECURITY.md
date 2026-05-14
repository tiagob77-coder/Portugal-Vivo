# Política de Segurança

Este documento descreve como reportar problemas de segurança que afectem o
Portugal Vivo e o que esperar em resposta.

## Reportar uma vulnerabilidade

**Não abra um issue público no GitHub.** Detalhes técnicos de uma falha de
segurança não devem ser visíveis enquanto a correção não estiver entregue.

Em alternativa:

- E-mail: `security@portugalvivo.pt`
- Assunto: `[SECURITY] Resumo curto da falha`
- Inclua, se possível:
  - Versão / commit afectado.
  - Passos exactos para reproduzir.
  - Impacto observado (leak de dados, escalada de privilégios, etc.).
  - Sugestão de correcção (opcional).

Comprometemo-nos a:

1. **Acusar receção em 48 horas úteis.**
2. **Confirmar a falha (ou explicar porque não é uma falha) em 5 dias úteis.**
3. **Publicar correcção dentro de 30 dias** para vulnerabilidades de gravidade
   alta ou crítica; média/baixa entram no ciclo de releases normal.
4. **Notificar a CNPD em 72 horas** no caso de violação de dados pessoais com
   risco para os utilizadores, conforme art.º 33.º do RGPD.

## Versões suportadas

| Versão | Suporte de segurança |
|---|---|
| `main` (HEAD) | Sim |
| `v1.x` (último minor) | Sim |
| Versões anteriores | Apenas para falhas críticas |

## Âmbito

Estão **dentro de âmbito**:

- Vulnerabilidades nas APIs `*.portugalvivo.pt` (REST e web).
- Falhas no código alojado em `tiagob77-coder/Portugal-Vivo`.
- Más-configurações do compose / nginx / Dockerfiles deste repositório.

Estão **fora de âmbito**:

- Vulnerabilidades em serviços de terceiros (Stripe, Cloudinary, MongoDB
  Atlas, Sentry, Nominatim, OpenAI). Reporte directamente ao fornecedor.
- DoS por volume / força bruta — temos rate-limit por IP/utilizador; relatos
  de "consegui fazer 1000 reqs/s" sem amplificador real não são tratados.
- Vulnerabilidades que requerem acesso físico ao dispositivo do utilizador.
- Engenharia social a colaboradores ou utilizadores.

## Práticas internas

- **Auth**: bcrypt para passwords, política mínima de 8 caracteres + blocklist
  das mais comuns, sessões opacas com TTL de 7 dias, recusa de login em
  contas tombstoned.
- **CSRF**: double-submit cookie em produção, exempções explícitas para o
  exchange OAuth e endpoints de login.
- **Rate limiting**: duas camadas — global por IP/utilizador e específica por
  endpoint de auth, com backend Redis ZSET (sliding window) e fallback
  in-memory.
- **Uploads**: validação por magic bytes (Pillow), limites de tamanho (5 MB)
  e dimensão (16–8192 px), MIME canónico vs reivindicado guardado para
  forensics.
- **Segredos**: nunca committed; `gitleaks` corre no CI; defaults externos
  removidos (`AUTH_BACKEND_URL`).
- **Stripe**: webhook só processa pedidos com assinatura válida; recusa
  arrancar em produção sem `STRIPE_WEBHOOK_SECRET`.
- **RGPD**: páginas de privacidade/termos disponíveis, endpoints de export e
  delete-account com tombstone de 30 dias e log de auditoria.

## Programa de recompensas

Ainda não temos bug bounty formal. Reportes de qualidade são reconhecidos
publicamente (com permissão) no `CHANGELOG.md` e com agradecimentos por
e-mail.
