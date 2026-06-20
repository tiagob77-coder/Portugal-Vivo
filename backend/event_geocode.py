"""
event_geocode.py — Lightweight, offline geocoding for cultural events.

Events carry only a free-text `concelho` (often a venue name like
"Cem Soldos, Tomar" or "Parque da Cidade, Porto") plus a coarse `region`.
To place them on the map and cross-reference nearby transport/nature
(see discovery_api / gtfs_service) we need coordinates.

Strategy (no external calls, deterministic):
  1. Exact match of the normalized concelho against a município table.
  2. Alias substrings for venues whose name doesn't contain the município.
  3. Longest município name that appears as a substring of the concelho.
  4. Region centroid fallback (covers all 7 regions incl. Madeira/Açores).
  5. National centroid as last resort.

Coordinates are município-seat centroids at ~2-decimal (~1 km) precision,
which is enough for map placement and "nearest major station within radius".
"""
import re
import unicodedata
from typing import Optional, Tuple

Coord = Tuple[float, float]


def _norm(s: str) -> str:
    n = unicodedata.normalize("NFD", (s or "").lower()).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", n).strip()


# Município-seat coordinates (lat, lng). Keys are accent-stripped lowercase.
MUNICIPIO_COORDS: dict[str, Coord] = {
    # --- Norte ---
    "porto": (41.15, -8.61), "braga": (41.55, -8.43), "guimaraes": (41.44, -8.29),
    "viana do castelo": (41.69, -8.83), "barcelos": (41.53, -8.62), "vila verde": (41.65, -8.44),
    "amares": (41.63, -8.35), "esposende": (41.53, -8.78), "caminha": (41.87, -8.84),
    "paredes de coura": (41.91, -8.56), "arcos de valdevez": (41.85, -8.42),
    "ponte de lima": (41.77, -8.58), "montalegre": (41.82, -7.79), "chaves": (41.74, -7.47),
    "braganca": (41.81, -6.76), "vinhais": (41.83, -7.00), "mirandela": (41.49, -7.18),
    "macedo de cavaleiros": (41.54, -6.96), "alfandega da fe": (41.34, -6.96),
    "miranda do douro": (41.50, -6.27), "carrazeda de ansiaes": (41.24, -7.31),
    "freixo de espada a cinta": (41.09, -6.81), "alijo": (41.28, -7.47), "mesao frio": (41.16, -7.87),
    "peso da regua": (41.16, -7.79), "lamego": (41.10, -7.81), "armamar": (41.12, -7.69),
    "sernancelhe": (40.91, -7.42), "moimenta da beira": (40.98, -7.62), "amarante": (41.27, -8.08),
    "marco de canaveses": (41.18, -8.15), "baiao": (41.16, -8.03), "cinfaes": (41.07, -8.09),
    "castelo de paiva": (41.04, -8.27), "arouca": (40.93, -8.24), "pacos de ferreira": (41.28, -8.38),
    "paredes": (41.21, -8.33), "lousada": (41.28, -8.28), "gondomar": (41.14, -8.53),
    "maia": (41.23, -8.62), "matosinhos": (41.18, -8.69), "espinho": (41.01, -8.64),
    "santa maria da feira": (40.93, -8.55), "ovar": (40.86, -8.62), "oliveira de azemeis": (40.84, -8.48),
    "vale de cambra": (40.85, -8.39), "fafe": (41.45, -8.17), "cabeceiras de basto": (41.51, -7.99),
    "celorico de basto": (41.39, -8.00), "mondim de basto": (41.41, -7.95),
    "ribeira de pena": (41.52, -7.79), "gaia": (41.13, -8.61), "vila nova de gaia": (41.13, -8.61),
    "podence": (41.56, -6.84),
    # --- Centro ---
    "coimbra": (40.21, -8.43), "aveiro": (40.64, -8.65), "agueda": (40.58, -8.45),
    "viseu": (40.66, -7.91), "leiria": (39.74, -8.81), "obidos": (39.36, -9.16),
    "tomar": (39.60, -8.41), "cantanhede": (40.35, -8.59), "fundao": (40.14, -7.50),
    "celorico da beira": (40.63, -7.39), "gouveia": (40.50, -7.59), "seia": (40.42, -7.71),
    "oliveira do hospital": (40.36, -7.86), "fornos de algodres": (40.62, -7.45),
    "satao": (40.74, -7.73), "penamacor": (40.17, -7.17), "almeida": (40.73, -6.90),
    "idanha a nova": (39.92, -7.23), "tondela": (40.52, -8.08), "soure": (40.06, -8.63),
    "ansiao": (39.91, -8.43), "ferreira do zezere": (39.70, -8.29), "torres novas": (39.48, -8.54),
    "ourem": (39.65, -8.58), "nazare": (39.60, -9.07), "sardoal": (39.54, -8.16),
    "cadaval": (39.24, -9.10), "batalha": (39.66, -8.82), "figueira da foz": (40.15, -8.86),
    # --- Lisboa e Vale do Tejo ---
    "lisboa": (38.72, -9.14), "oeiras": (38.69, -9.31), "cascais": (38.70, -9.42),
    "sintra": (38.80, -9.39), "almada": (38.68, -9.16), "costa caparica": (38.65, -9.23),
    "seixal": (38.64, -9.10), "sesimbra": (38.44, -9.10), "setubal": (38.52, -8.89),
    "santarem": (39.23, -8.69), "vila franca de xira": (38.95, -8.99), "torres vedras": (39.09, -9.26),
    # --- Alentejo ---
    "evora": (38.57, -7.91), "beja": (38.02, -7.86), "marvao": (39.39, -7.38),
    "crato": (39.28, -7.65), "campo maior": (39.02, -7.07), "moura": (38.14, -7.45),
    "serpa": (37.94, -7.60), "castro verde": (37.70, -8.08), "viana do alentejo": (38.33, -8.00),
    "portel": (38.31, -7.70), "alandroal": (38.70, -7.40), "odemira": (37.60, -8.64),
    "zambujeira do mar": (37.52, -8.78), "sines": (37.95, -8.87),
    # --- Algarve ---
    "faro": (37.02, -7.93), "loule": (37.14, -8.02), "albufeira": (37.09, -8.25),
    "portimao": (37.14, -8.54), "lagos": (37.10, -8.67), "silves": (37.19, -8.44),
    "aljezur": (37.32, -8.80), "monchique": (37.32, -8.56), "lagoa": (37.14, -8.45),
    "paderne": (37.16, -8.20), "sao bras de alportel": (37.15, -7.89), "tavira": (37.13, -7.65),
    "olhao": (37.03, -7.84),
    # --- Madeira ---
    "funchal": (32.65, -16.91), "camara de lobos": (32.65, -16.98), "ribeira brava": (32.67, -17.06),
    # --- Açores ---
    "ponta delgada": (37.74, -25.67), "angra do heroismo": (38.66, -27.22),
    "ribeira grande": (37.82, -25.52), "madalena": (38.54, -28.53),
}

# Venue / partial names → município key (checked as substrings before the
# generic longest-substring pass). Resolves names that don't contain the seat.
ALIASES: dict[str, str] = {
    "alges": "oeiras", "passeio maritimo": "oeiras", "bela vista": "lisboa",
    "altice arena": "lisboa", "gulbenkian": "lisboa", "culturgest": "lisboa",
    "matinha": "lisboa", "jardins lisboa": "lisboa", "parques lisboa": "lisboa",
    "terreiro do paco": "lisboa", "chiado": "lisboa", "fil": "lisboa",
    "cinema s jorge": "lisboa", "ccb": "lisboa", "casa da musica": "porto",
    "praca da cancao": "coimbra", "tagv": "coimbra", "campino": "santarem",
    "casa do campino": "santarem", "taboao": "paredes de coura", "meco": "sesimbra",
    "relogio": "figueira da foz", "praca da republica": "braga", "centro braga": "braga",
    "pico": "madalena", "sao miguel": "ponta delgada", "sta maria da feira": "santa maria da feira",
    "jardim pescador": "olhao", "forte santiago": "viana do castelo", "forte de santiago": "viana do castelo",
}

# Region centroids (accent-stripped keys). Covers the 7 tourism regions.
REGION_CENTROIDS: dict[str, Coord] = {
    "norte": (41.15, -8.61), "centro": (40.20, -8.42), "lisboa": (38.72, -9.14),
    "alentejo": (38.57, -7.91), "algarve": (37.02, -7.93), "madeira": (32.65, -16.91),
    "acores": (37.74, -25.67),
}

NATIONAL: Coord = (39.5, -8.0)

# Precompute município keys sorted by length (desc) so the longest, most
# specific name wins the substring pass (avoids e.g. "gaia" beating a longer key).
_KEYS_BY_LEN = sorted(MUNICIPIO_COORDS.keys(), key=len, reverse=True)


def _to_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None


def in_portugal(lat: Optional[float], lng: Optional[float]) -> bool:
    """Bounds covering mainland + Madeira + Azores."""
    return (
        lat is not None and lng is not None
        and 32.0 <= lat <= 43.0 and -32.0 <= lng <= -6.0
    )


def coords_from_event(evt: dict) -> Tuple[Optional[float], Optional[float]]:
    """Read explicit coordinates supplied with an event (e.g. an Excel with GPS).

    Accepts numeric/string `latitude`+`longitude`, or a `gps`/`coordinates`/
    `coords` value as a "lat,lng" string or a [lat, lng] pair. Returns
    (None, None) when absent or outside Portugal.
    """
    lat = _to_float(evt.get("latitude"))
    lng = _to_float(evt.get("longitude"))
    if lat is None or lng is None:
        raw = evt.get("gps") or evt.get("coordinates") or evt.get("coords")
        if isinstance(raw, str) and "," in raw:
            parts = raw.split(",")
            if len(parts) == 2:
                lat, lng = _to_float(parts[0]), _to_float(parts[1])
        elif isinstance(raw, (list, tuple)) and len(raw) == 2:
            lat, lng = _to_float(raw[0]), _to_float(raw[1])
    return (lat, lng) if in_portugal(lat, lng) else (None, None)


def geocode(concelho: str, region: str = "") -> Tuple[Optional[float], Optional[float], str]:
    """Return (lat, lng, precision) for an event location.

    precision ∈ {"municipio", "alias", "regiao", "nacional"}.
    """
    c = _norm(concelho)
    if c:
        if c in MUNICIPIO_COORDS:
            lat, lng = MUNICIPIO_COORDS[c]
            return lat, lng, "municipio"
        for ali, key in ALIASES.items():
            if ali in c and key in MUNICIPIO_COORDS:
                lat, lng = MUNICIPIO_COORDS[key]
                return lat, lng, "alias"
        for key in _KEYS_BY_LEN:
            if key in c:
                lat, lng = MUNICIPIO_COORDS[key]
                return lat, lng, "municipio"

    rkey = _norm(region)
    if rkey in REGION_CENTROIDS:
        lat, lng = REGION_CENTROIDS[rkey]
        return lat, lng, "regiao"

    return NATIONAL[0], NATIONAL[1], "nacional"
