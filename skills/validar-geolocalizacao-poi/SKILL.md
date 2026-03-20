---
name: validar-geolocalizacao-poi
description: "Valida, corrige e normaliza coordenadas GPS dos POIs do Portugal Vivo."
activation:
  - "validar coordenadas"
  - "corrigir gps"
  - "verificar geolocalização"
  - "limpar coordenadas"
  - "gps poi"
---

## Objetivo
Garantir que todos os POIs têm coordenadas válidas, coerentes e dentro dos limites de Portugal, corrigindo erros comuns e devolvendo um POI limpo e normalizado.

## Quando esta skill é ativada:
1. Lê os campos `latitude` e `longitude` do POI.
2. Verifica:
   - Se estão no formato decimal.
   - Se não estão invertidos (lon/lat).
   - Se não são (0,0) ou valores impossíveis.
   - Se estão dentro dos limites geográficos de Portugal Continental, Açores ou Madeira.
3. Corrige automaticamente:
   - Inversão lat/lon.
   - Arredondamento para 6 casas decimais.
   - Valores com vírgula em vez de ponto.
4. Valida coerência:
   - Confirma se o ponto cai dentro de Portugal usando `limites_portugal.geojson`.
   - Opcional: confirma concelho/distrito via reverse geocoding local.
5. Executa o script `scripts/validar_geo.py`.
6. Devolve:
   - Coordenadas corrigidas
   - Flags de validação
   - Mensagens de erro/alerta
   - POI normalizado no formato oficial do Portugal Vivo
