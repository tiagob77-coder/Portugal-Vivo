# Portugal Vivo API — Preços e Condições para Parceiros

> Para operadores de turismo, hotéis, agências e plataformas que queiram integrar
> conteúdo cultural português nas suas aplicações e serviços.

---

## O que está disponível na API

| Endpoint | Descrição |
|---|---|
| `GET /heritage` | Lista de POIs com coordenadas, categoria, região e metadados |
| `GET /heritage/{id}` | Detalhe de um POI com narrativa completa gerada por IA |
| `GET /routes` | Rotas temáticas curadas (trilhos, gastronómicas, históricas) |
| `GET /routes/{id}` | Rota com GPX, perfil de elevação e POIs ao longo do percurso |
| `GET /narratives/{poi_id}` | Narrativa em formato texto + áudio (URL) para um POI |
| `GET /map/items` | POIs filtrados por região/categoria para integração em mapas |
| `GET /weather/{region}` | Condições meteorológicas actuais e previsão (via IPMA) |
| `GET /events` | Eventos culturais e festivais por região e data |

**Formato:** JSON
**Autenticação:** API Key por header (`X-API-Key`)
**Rate limit:** por plano (ver abaixo)

---

## Planos

### Explorador — Gratuito
*Para projectos pessoais, startups em fase de validação e investigação académica*

- 500 pedidos/mês
- Acesso a heritage, routes, map/items
- Sem SLA
- Sem narrativas de áudio
- **Custo: €0**

---

### Parceiro — €49/mês
*Para agências, guias turísticos e pequenos operadores*

- 10.000 pedidos/mês
- Acesso a todos os endpoints excepto áudio
- SLA 99% uptime
- Suporte por email (resposta em 2 dias úteis)
- Badge "Powered by Portugal Vivo" obrigatório
- **Custo: €49/mês** (faturação anual: €39/mês · -20%)

---

### Pro — €149/mês
*Para plataformas de reservas, operadores regionais e hotéis*

- 100.000 pedidos/mês
- Acesso completo incluindo narrativas de áudio
- White-label disponível (sem badge obrigatório)
- SLA 99,5% uptime
- Suporte prioritário (resposta em 1 dia útil)
- Dashboard de utilização
- **Custo: €149/mês** (faturação anual: €119/mês · -20%)

---

### Enterprise — Preço sob consulta
*Para grandes plataformas, OTAs e municipalidades*

- Pedidos ilimitados
- SLA personalizado com penalizações contratuais
- Integração dedicada + onboarding técnico
- Co-desenvolvimento de endpoints personalizados
- Contrato anual com opção de multi-ano
- **Custo: a partir de €500/mês**

---

## Casos de uso típicos

**Operador de trilhos**
> Integra `GET /routes` e `GET /heritage` para enriquecer automaticamente as páginas
> de cada percurso com POIs próximos e respectivas narrativas culturais.

**Hotel boutique**
> Usa `GET /heritage?region=alentejo` para criar uma página "Descobrir a região"
> no seu website, sem equipa editorial.

**Agência de viagens**
> Integra `GET /narratives/{poi_id}` para fornecer áudio guias digitais incluídos
> nos pacotes de viagem, sem infraestrutura própria.

**App de mobilidade**
> Usa `GET /events` e `GET /heritage` para sugerir destinos culturais próximos
> das paragens de transportes.

---

## Condições de uso

- O conteúdo é licenciado para uso comercial mediante subscrição activa
- Atribuição "Conteúdo Portugal Vivo" nos planos Parceiro e Pro (white-label no Enterprise)
- Os dados de utilização da API são partilhados de forma agregada e anónima
- Proibida a revenda directa do conteúdo sem acordo específico

---

## Como começar

1. **Pedir acesso antecipado:** enviar email para [api@portugavivo.pt]
2. **Receber API key** de teste (plano Explorador gratuito por 30 dias)
3. **Integrar e validar** com os vossos dados reais
4. **Activar plano pago** quando prontos para produção

---

## FAQ

**Posso testar antes de pagar?**
Sim. O plano Explorador é gratuito para sempre para volumes baixos. Para um período de teste
alargado no plano Pro, contacte-nos.

**Os dados são actualizados com que frequência?**
POIs e rotas: actualizados semanalmente. Eventos: diariamente. Meteorologia: a cada hora.

**Há SDK disponível?**
Estamos a preparar SDKs para JavaScript/TypeScript e Python. Entretanto, a API REST funciona
com qualquer linguagem.

**Posso usar conteúdo offline nas minhas apps?**
Sim, no plano Pro e Enterprise é possível fazer cache local mediante acordo de licenciamento.
