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

POIs vindos do geocoder offline trazem `coord_approximate: true` e
`coord_source: "centroid_<tipo>"` para que o frontend / aplicador possa
distingui-los das coordenadas precisas vindas do Excel.

## Cobertura actual

| Origem | POIs | % |
|---|---|---|
| Coords reais do Excel | 3 043 | 53.9 % |
| Geocoder offline (centroides) | 1 839 | 33.8 % |
| **Total com coords** | **4 882** | **87.7 %** |
| Ainda sem coords | 684 | 12.3 % |

Os 684 restantes têm `region` parcial (p. ex. `norte (porto e norte)`)
sem concelho nem localidade — só Nominatim ou intervenção manual os
resolve com precisão útil.

## Regras

- Caixa delimitadora aceite: lat ∈ [32, 43], lng ∈ [-32, -6] (cobre
  continente + Açores + Madeira).
- Quando lat/lng vêm trocados, são detectados e corrigidos.
- Regiões NUTS II inferidas pela secção do Excel ou — em último recurso
  — pelas próprias coordenadas (`infer_region_from_coords`).
- Match contra `heritage_items`: por `poi_source_id` primeiro, depois
  `name_normalised + region`.
