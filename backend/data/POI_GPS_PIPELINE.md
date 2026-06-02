# POI GPS Pipeline — v19

Pipeline para extrair, normalizar e aplicar coordenadas GPS da base
`PortugalVivo_BaseDados_POI_v19.xlsx`.

## Ficheiros

| Ficheiro | Origem | Conteúdo |
|---|---|---|
| `PortugalVivo_BaseDados_POI_v19.xlsx` | Upload do utilizador | 49 sheets com ~5 600 POIs |
| `poi_gps_v19.json` | `extract_poi_gps_v19.py` | POIs com coordenadas válidas (continente + Açores + Madeira) |
| `poi_gps_v19_missing.json` | `extract_poi_gps_v19.py` | POIs cujo Excel só carrega o nome como label (sem coords decimais) |
| `pt_centroids.json` | curado | 265 centroides de concelhos/cidades PT (Norte → Madeira) |
| `poi_gps_v19_geocode_cache.json` | `geocode_missing_pois.py` | Cache persistente de resultados Nominatim |
| `audit_poi_gps_integrity.py` | — | Relatório de integridade (precisão por sheet/categoria) |

## Pipeline

```bash
# 1. Extrair coords reais do Excel → JSON
python backend/extract_poi_gps_v19.py

# 2. Geocoding OFFLINE — coords aproximadas via centroides de concelho/cidade
python backend/geocode_offline_pois.py            # 100% local, ~73% match

# 3. (Opcional) Geocoding ONLINE Nominatim para o resto (1 req/s, requer internet)
python backend/geocode_missing_pois.py --limit 100

# 4. Aplicar correções à coleção heritage_items (dry-run primeiro)
python backend/apply_poi_gps_v19.py --dry-run
python backend/apply_poi_gps_v19.py --apply
python backend/apply_poi_gps_v19.py --apply --force  # também sobrepõe POIs com coords já válidas
```

POIs vindos do geocoder offline trazem `coord_approximate: true`,
`coord_source: "centroid_<tipo>"` e `coord_precision` para que o
frontend / aplicador possa distingui-los das coordenadas precisas
vindas do Excel.

### Campo `coord_precision`

| Valor | Significado | Exemplo |
|---|---|---|
| `precise` | Lat/lng exactos extraídos do Excel | "Castelo de Aguiar de Sousa" |
| `municipality` | Centroide de concelho / cidade / parque (≈ ±5 km) | "Praia de Cascais" → Cascais |
| `district` | Centroide de distrito / ilha / sub-região (≈ ±20 km) | "Mercado de Bragança" → Bragança |
| `region` | Centroide NUTS II — usar como overlay regional | "Sopa de Beldroegas" → Alentejo |

O frontend deve tratar `region`-level POIs como overlays regionais
(ou agrupá-los visualmente), não como pin individual no mapa, dado
que muitos partilham as mesmas coords.

## Cobertura actual

| Precisão | POIs | % |
|---|---|---|
| `precise` (Excel) | 3 043 | 54.0 % |
| `municipality` (centroide concelho/cidade) | 1 303 | 23.1 % |
| `district` (centroide distrito/ilha) | 622 | 11.0 % |
| `region` (centroide NUTS II) | 663 | 11.8 % |
| **Total com coords** | **5 631** | **~100 %** |
| Ainda sem coords | 1 | 0.02 % |

O 1 POI restante é uma linha-resumo da sheet Barragens ("Total: 23
barragens…"), não um POI real. Para refinar coords aproximadas para
locations exactas, correr `geocode_missing_pois.py` (Nominatim, lento)
ou intervir manualmente no Excel.

## Auditoria

```bash
python backend/audit_poi_gps_integrity.py
# Gate em CI:
python backend/audit_poi_gps_integrity.py --min-precise-pct 50 --max-region-pct 15
```

Relata cobertura, distribuição de precisão por sheet e por categoria,
e identifica clusters de POIs com coords sobrepostas. Sai com código
não-zero se ultrapassar os thresholds.

## Regras

- Caixa delimitadora aceite: lat ∈ [32, 43], lng ∈ [-32, -6] (cobre
  continente + Açores + Madeira).
- Quando lat/lng vêm trocados, são detectados e corrigidos.
- Regiões NUTS II inferidas pela secção do Excel ou — em último recurso
  — pelas próprias coordenadas (`infer_region_from_coords`).
- Match contra `heritage_items`: por `poi_source_id` primeiro, depois
  `name_normalised + region`.
