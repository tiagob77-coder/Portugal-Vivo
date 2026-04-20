# CAOP data

Place the latest CAOP GeoPackage(s) from
[DGT Centro de Dados](https://cdd.dgterritorio.gov.pt/) here:

```
backend/data/caop/
├── CAOP_Continente.gpkg   (mainland)
├── CAOP_Acores.gpkg       (Azores — optional, will auto-detect)
└── CAOP_Madeira.gpkg      (Madeira — optional, will auto-detect)
```

The ingestion script auto-detects the presence of each file and skips missing
ones. Source CRS is expected to be **EPSG:3763 (ETRS89 / PT-TM06)**; geometries
are reprojected to **EPSG:4326 (WGS84)** before storage.

## Running ingestion

```bash
cd backend
python3 scripts/ingest_caop.py
```

The script populates three MongoDB collections:

| Collection | Document shape |
| --- | --- |
| `caop_distritos`   | `{ district_id, code, name, name_clean, nuts1_code, nuts2_code, geometry, centroid, bbox, area_km2 }` |
| `caop_concelhos`   | `{ municipality_id, code, name, name_clean, district_code, nuts3_code, geometry, centroid, bbox, area_km2 }` |
| `caop_freguesias`  | `{ parish_id, code (DTMNFR), name, name_clean, municipality_code, district_code, nuts3_code, geometry, centroid, bbox, area_km2 }` |

All collections have:

- 2dsphere index on `geometry`
- unique index on `code`
- text index on `name_clean`

## License

CAOP is produced and licensed by Direção-Geral do Território (DGT) under the
terms indicated on <https://www.dgterritorio.gov.pt/>. Consult the original
license before redistribution.
