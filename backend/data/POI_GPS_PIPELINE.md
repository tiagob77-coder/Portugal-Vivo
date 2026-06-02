# POI GPS Pipeline — v19

Pipeline para extrair, normalizar e aplicar coordenadas GPS da base
`PortugalVivo_BaseDados_POI_v19.xlsx`.

## Ficheiros

| Ficheiro | Origem | Conteúdo |
|---|---|---|
| `PortugalVivo_BaseDados_POI_v19.xlsx` | Upload do utilizador | 49 sheets com ~5 600 POIs |
| `poi_gps_v19.json` | `extract_poi_gps_v19.py` | POIs com coordenadas válidas (continente + Açores + Madeira) |
| `poi_gps_v19_missing.json` | `extract_poi_gps_v19.py` | POIs cujo Excel só carrega o nome como label (sem coords decimais) |
| `poi_gps_v19_geocode_cache.json` | `geocode_missing_pois.py` | Cache persistente de resultados Nominatim |

## Pipeline

```bash
# 1. Extrair coords reais do Excel → JSON
python backend/extract_poi_gps_v19.py

# 2. (Opcional) Geocodificar via Nominatim os POIs sem coords reais
python backend/geocode_missing_pois.py --limit 100   # arranque conservador

# 3. Aplicar correções à coleção heritage_items (dry-run primeiro)
python backend/apply_poi_gps_v19.py --dry-run
python backend/apply_poi_gps_v19.py --apply
python backend/apply_poi_gps_v19.py --apply --force  # também sobrepõe POIs com coords já válidas
```

## Cobertura actual

Após `extract_poi_gps_v19.py`:

- **3 043 POIs** com coordenadas válidas (53.9%)
- **2 599 POIs** ainda sem coordenadas — esses sheets carregam apenas a
  etiqueta "📍 Nome" em vez de pares decimais.

Sheets sem coords decimais (top): Praias Bandeira Azul, Restaurantes,
Miradouros, Mercados e Feiras, Património Ferroviário, Alojamentos
Rurais, Fauna/Flora Autóctone, Cascatas, Arqueologia, Termas, Moinhos,
Pousadas, Pérolas. `geocode_missing_pois.py` resolve estes via Nominatim.

## Regras

- Caixa delimitadora aceite: lat ∈ [32, 43], lng ∈ [-32, -6] (cobre
  continente + Açores + Madeira).
- Quando lat/lng vêm trocados, são detectados e corrigidos.
- Regiões NUTS II inferidas pela secção do Excel ou — em último recurso
  — pelas próprias coordenadas (`infer_region_from_coords`).
- Match contra `heritage_items`: por `poi_source_id` primeiro, depois
  `name_normalised + region`.
