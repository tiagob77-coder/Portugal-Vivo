"""
SEO API - Dynamic meta tags, Schema.org JSON-LD, sitemap.xml, robots.txt,
and server-rendered share pages for social media crawlers.
"""
from fastapi import APIRouter, Response
from fastapi.responses import HTMLResponse
from datetime import datetime
import logging
import json
import html as html_lib

from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

seo_router = APIRouter(tags=["SEO"])

_db_holder = DatabaseHolder("seo")
set_seo_db = _db_holder.set
_get_db = _db_holder.get

SITE_URL = "https://portugal-vivo.app"
SITE_NAME = "Portugal Vivo"
DEFAULT_IMAGE = "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80"

CATEGORY_NAMES: dict[str, str] = {
    # Natureza
    "percursos_pedestres": "Percurso Pedestre",
    "ecovias_passadicos": "Ecovia / Passadiço",
    "aventura_natureza": "Aventura na Natureza",
    "natureza_especializada": "Natureza",
    "fauna_autoctone": "Fauna Autóctone",
    "flora_autoctone": "Flora Autóctone",
    "flora_botanica": "Flora & Botânica",
    "biodiversidade_avistamentos": "Biodiversidade",
    "miradouros": "Miradouro",
    "barragens_albufeiras": "Barragem / Albufeira",
    "cascatas_pocos": "Cascata / Poço",
    "praias_fluviais": "Praia Fluvial",
    "arqueologia_geologia": "Arqueologia & Geologia",
    "moinhos_azenhas": "Moinhos & Azenhas",
    # História & Património
    "museus_monumentos": "Museu / Monumento",
    "castelos": "Castelo",
    "arqueologia": "Arqueologia",
    "religioso": "Património Religioso",
    "patrimonio_industrial": "Património Industrial",
    "linhas_ferroviarias": "Linha Ferroviária Histórica",
    "aldeias": "Aldeia Histórica",
    # Praias & Mar
    "praias_bandeira_azul": "Praia Bandeira Azul",
    "surf_desportos": "Surf & Desportos Mar",
    "pesca_maritima": "Pesca & Mar",
    # Gastronomia
    "restaurantes_gastronomia": "Gastronomia",
    "tabernas_tascas": "Taberna / Tasca",
    "mercados_feiras": "Mercado / Feira",
    "produtos_dop": "Produto DOP",
    "enoturismo_vinho": "Enoturismo",
    "pastelaria_doces": "Pastelaria & Doces",
    "azeite_olivicultura": "Azeite & Olivicultura",
    # Cultura Viva
    "musica_tradicional": "Música Tradicional",
    "festas_festivais": "Festas & Festivais",
    "artesanato_saberes": "Artesanato & Saberes",
    # Experiências & Rotas
    "rotas_tematicas": "Rota Temática",
    "alojamento_turismo": "Alojamento Turístico",
    "campismo_glamping": "Campismo & Glamping",
    "termas_spas": "Termas & Spas",
    "turismo_rural": "Turismo Rural",
    "experiencias_guiadas": "Experiência Guiada",
    "desportos_aventura": "Desportos de Aventura",
    "acessibilidade": "Turismo Acessível",
    # Legacy
    "termas": "Termas",
    "piscinas": "Praias Fluviais",
    "gastronomia": "Gastronomia",
    "fauna": "Fauna",
    "florestas": "Florestas",
    "rios": "Rios",
    "arte": "Arte",
    "comunidade": "Comunidade",
    "cogumelos": "Cogumelos",
    "minerais": "Minerais",
    "produtos": "Produtos",
    "crencas": "Crenças",
    "lendas": "Lendas",
    "festas": "Festas",
    "saberes": "Saberes",
    "percursos": "Percursos",
    "rotas": "Rotas",
}

SCHEMA_TYPE_MAP: dict[str, str] = {
    "museus_monumentos": "Museum",
    "castelos": "LandmarksOrHistoricalBuildings",
    "arqueologia": "LandmarksOrHistoricalBuildings",
    "arqueologia_geologia": "LandmarksOrHistoricalBuildings",
    "religioso": "LandmarksOrHistoricalBuildings",
    "patrimonio_industrial": "LandmarksOrHistoricalBuildings",
    "linhas_ferroviarias": "LandmarksOrHistoricalBuildings",
    "percursos_pedestres": "SportsActivityLocation",
    "ecovias_passadicos": "SportsActivityLocation",
    "aventura_natureza": "SportsActivityLocation",
    "desportos_aventura": "SportsActivityLocation",
    "surf_desportos": "SportsActivityLocation",
    "praias_bandeira_azul": "Beach",
    "praias_fluviais": "Beach",
    "aldeias": "City",
    "restaurantes_gastronomia": "Restaurant",
    "tabernas_tascas": "Restaurant",
    "festas_festivais": "Event",
    "festas": "Event",
    "mercados_feiras": "Market",
}

REGION_NAMES: dict[str, str] = {
    "norte": "Norte",
    "centro": "Centro",
    "lisboa": "Lisboa e Vale do Tejo",
    "alentejo": "Alentejo",
    "algarve": "Algarve",
    "acores": "Açores",
    "madeira": "Madeira",
}


def _truncate(text: str, max_len: int) -> str:
    if not text:
        return ""
    return text[:max_len - 3] + "..." if len(text) > max_len else text


def generate_schema_org(poi: dict, coords: list) -> dict:
    category = poi.get("category", "")
    schema_type = SCHEMA_TYPE_MAP.get(category, "TouristAttraction")

    locality = poi.get("concelho") or poi.get("municipality") or poi.get("region", "")
    slug = poi.get("slug") or poi.get("id", "")
    url = f"{SITE_URL}/heritage/{slug}"

    schema: dict = {
        "@context": "https://schema.org",
        "@type": schema_type,
        "name": poi.get("name", ""),
        "description": poi.get("description", ""),
        "url": url,
        "image": poi.get("image_url") or DEFAULT_IMAGE,
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": coords[1] if len(coords) >= 2 else 0,
            "longitude": coords[0] if len(coords) >= 2 else 0,
        },
        "address": {
            "@type": "PostalAddress",
            "addressLocality": locality,
            "addressCountry": "PT",
        },
        "inLanguage": ["pt-PT", "en"],
        "isAccessibleForFree": poi.get("is_free", True),
    }

    tourist_types = poi.get("tourist_type") or []
    if not tourist_types:
        cat_display = CATEGORY_NAMES.get(category, "")
        if cat_display:
            tourist_types = [cat_display]
    if tourist_types:
        schema["touristType"] = tourist_types

    # Type-specific extras
    metadata = poi.get("metadata") or {}
    if schema_type == "SportsActivityLocation":
        if poi.get("distance_km"):
            schema["amenityFeature"] = [{"@type": "LocationFeatureSpecification",
                                          "name": "distance", "value": f"{poi['distance_km']} km"}]
    elif schema_type in ("Museum", "LandmarksOrHistoricalBuildings"):
        if metadata.get("opening_hours"):
            schema["openingHours"] = metadata["opening_hours"]
        if poi.get("admission_price") is not None:
            schema["isAccessibleForFree"] = poi["admission_price"] == 0

    tags = poi.get("tags", [])
    if tags:
        schema["keywords"] = ", ".join(tags[:10])

    return schema


def generate_seo_meta(poi: dict) -> dict:
    name = poi.get("name", "")
    raw_desc = poi.get("description") or poi.get("short_description") or ""
    description = _truncate(raw_desc, 160)
    locality = poi.get("concelho") or poi.get("municipality") or ""
    region = poi.get("region", "Portugal")
    region_display = REGION_NAMES.get(region, region)
    location_display = locality or region_display or "Portugal"
    category = poi.get("category", "")
    category_display = CATEGORY_NAMES.get(category, "Destino")
    slug = poi.get("slug") or poi.get("id", "")
    image = poi.get("image_url") or DEFAULT_IMAGE
    canonical = f"{SITE_URL}/heritage/{slug}"
    canonical_en = f"{SITE_URL}/en/heritage/{slug}"

    raw_title = f"{name} — {category_display} em {location_display} | {SITE_NAME}"
    title = raw_title if len(raw_title) <= 60 else f"{name} | {SITE_NAME}"

    coords = []
    loc = poi.get("location", {})
    if isinstance(loc, dict):
        if "coordinates" in loc:
            coords = loc["coordinates"]
        elif "lng" in loc and "lat" in loc:
            coords = [loc["lng"], loc["lat"]]

    return {
        "title": title,
        "description": description,
        "canonical": canonical,
        "og": {
            "title": name,
            "description": description,
            "image": image,
            "url": canonical,
            "type": "place",
            "locale": "pt_PT",
            "site_name": SITE_NAME,
        },
        "twitter": {
            "card": "summary_large_image",
            "title": name,
            "description": description,
            "image": image,
        },
        "schema": generate_schema_org(poi, coords),
        "hreflang": {
            "pt": canonical,
            "en": canonical_en,
        },
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@seo_router.get("/seo/meta/{poi_id}")
async def get_poi_seo_meta(poi_id: str):
    """Full structured SEO metadata for a POI (title, OG, Twitter, Schema.org, hreflang)."""
    db = _get_db()
    poi = await db.heritage_items.find_one(
        {"id": poi_id},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "description": 1, "short_description": 1,
         "category": 1, "region": 1, "concelho": 1, "municipality": 1,
         "image_url": 1, "location": 1, "tags": 1, "is_free": 1,
         "admission_price": 1, "tourist_type": 1, "metadata": 1,
         "distance_km": 1},
    )
    if not poi:
        return {
            "title": SITE_NAME,
            "description": "Descubra o património cultural e natural de Portugal.",
            "canonical": SITE_URL,
            "og": {"title": SITE_NAME, "image": DEFAULT_IMAGE, "url": SITE_URL,
                   "type": "website", "locale": "pt_PT", "site_name": SITE_NAME},
            "twitter": {"card": "summary_large_image", "title": SITE_NAME, "image": DEFAULT_IMAGE},
            "schema": None,
            "hreflang": {"pt": SITE_URL, "en": f"{SITE_URL}/en"},
        }
    return generate_seo_meta(poi)


@seo_router.get("/og/poi/{poi_id}")
async def get_poi_og_metadata(poi_id: str):
    """Open Graph metadata for a POI (backwards-compatible endpoint)."""
    db = _get_db()
    poi = await db.heritage_items.find_one(
        {"id": poi_id},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "description": 1, "category": 1,
         "region": 1, "concelho": 1, "image_url": 1, "location": 1, "tags": 1},
    )
    if not poi:
        return {"title": SITE_NAME, "description": "Descubra o património cultural de Portugal.",
                "image": DEFAULT_IMAGE, "url": SITE_URL, "type": "website"}

    meta = generate_seo_meta(poi)
    return {
        "title": meta["title"],
        "description": meta["description"],
        "image": meta["og"]["image"],
        "url": meta["canonical"],
        "type": "place",
        "site_name": SITE_NAME,
        "locale": "pt_PT",
        "category": CATEGORY_NAMES.get(poi.get("category", ""), poi.get("category", "")),
        "region": REGION_NAMES.get(poi.get("region", ""), poi.get("region", "")),
        "location": poi.get("location"),
        "tags": poi.get("tags", []),
        "twitter_card": "summary_large_image",
    }


@seo_router.get("/og/route/{route_id}")
async def get_route_og_metadata(route_id: str):
    """OG metadata for a thematic route."""
    db = _get_db()
    route = await db.routes.find_one(
        {"id": route_id},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
         "region": 1, "duration_hours": 1, "distance_km": 1},
    )
    if not route:
        return {"title": SITE_NAME, "description": "Explore rotas temáticas pelo património de Portugal.",
                "image": DEFAULT_IMAGE, "url": SITE_URL, "type": "website"}

    desc = route.get("description", "")
    extras = []
    if route.get("duration_hours"):
        extras.append(f"{route['duration_hours']}h")
    if route.get("distance_km"):
        extras.append(f"{route['distance_km']}km")
    if extras:
        desc = f"{desc} ({', '.join(extras)})"
    desc = _truncate(desc, 160)
    canonical = f"{SITE_URL}/route/{route_id}"

    return {
        "title": f"{route['name']} — Rota | {SITE_NAME}",
        "description": desc,
        "image": DEFAULT_IMAGE,
        "url": canonical,
        "type": "article",
        "site_name": SITE_NAME,
        "locale": "pt_PT",
        "twitter_card": "summary_large_image",
        "schema": {
            "@context": "https://schema.org",
            "@type": "TouristTrip",
            "name": route["name"],
            "description": route.get("description", ""),
            "url": canonical,
            "inLanguage": ["pt-PT", "en"],
        },
    }


@seo_router.get("/sitemap.xml")
async def sitemap_xml():
    """Dynamic sitemap with POIs, routes, trails, and events."""
    db = _get_db()
    urls: list[str] = []

    static_pages = [
        {"loc": "/", "priority": "1.0", "changefreq": "daily"},
        {"loc": "/descobrir", "priority": "0.9", "changefreq": "daily"},
        {"loc": "/mapa", "priority": "0.8", "changefreq": "weekly"},
        {"loc": "/leaderboard", "priority": "0.7", "changefreq": "daily"},
        {"loc": "/categories", "priority": "0.8", "changefreq": "weekly"},
    ]
    for page in static_pages:
        urls.append(
            f'  <url>\n'
            f'    <loc>{SITE_URL}{page["loc"]}</loc>\n'
            f'    <changefreq>{page["changefreq"]}</changefreq>\n'
            f'    <priority>{page["priority"]}</priority>\n'
            f'  </url>'
        )

    # POIs
    pois = await db.heritage_items.find(
        {}, {"_id": 0, "id": 1, "slug": 1, "updated_at": 1, "created_at": 1}
    ).limit(5000).to_list(5000)

    for poi in pois:
        path = poi.get("slug") or poi["id"]
        date_field = poi.get("updated_at") or poi.get("created_at")
        lastmod = ""
        if date_field:
            if hasattr(date_field, "strftime"):
                lastmod = f"\n    <lastmod>{date_field.strftime('%Y-%m-%d')}</lastmod>"
            elif isinstance(date_field, str) and len(date_field) >= 10:
                lastmod = f"\n    <lastmod>{date_field[:10]}</lastmod>"
        urls.append(
            f'  <url>\n'
            f'    <loc>{SITE_URL}/heritage/{path}</loc>{lastmod}\n'
            f'    <changefreq>monthly</changefreq>\n'
            f'    <priority>0.7</priority>\n'
            f'  </url>'
        )

    # Routes
    routes = await db.routes.find({}, {"_id": 0, "id": 1}).limit(500).to_list(500)
    for route in routes:
        urls.append(
            f'  <url>\n'
            f'    <loc>{SITE_URL}/route/{route["id"]}</loc>\n'
            f'    <changefreq>monthly</changefreq>\n'
            f'    <priority>0.6</priority>\n'
            f'  </url>'
        )

    # Trails
    try:
        trails = await db.trails.find({}, {"_id": 0, "id": 1}).limit(500).to_list(500)
        for trail in trails:
            urls.append(
                f'  <url>\n'
                f'    <loc>{SITE_URL}/trail/{trail["id"]}</loc>\n'
                f'    <changefreq>weekly</changefreq>\n'
                f'    <priority>0.7</priority>\n'
                f'  </url>'
            )
    except Exception:
        pass

    # Events (agenda)
    try:
        events = await db.calendar_events.find(
            {}, {"_id": 0, "id": 1}
        ).limit(200).to_list(200)
        for ev in events:
            urls.append(
                f'  <url>\n'
                f'    <loc>{SITE_URL}/evento/{ev["id"]}</loc>\n'
                f'    <changefreq>daily</changefreq>\n'
                f'    <priority>0.8</priority>\n'
                f'  </url>'
            )
    except Exception:
        pass

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + '\n'.join(urls) + '\n'
        '</urlset>'
    )
    return Response(content=xml, media_type="application/xml")


@seo_router.get("/share/poi/{poi_id}", response_class=HTMLResponse)
async def poi_share_page(poi_id: str):
    """Server-rendered share page with full OG + JSON-LD for social crawlers."""
    db = _get_db()
    poi = await db.heritage_items.find_one(
        {"id": poi_id},
        {"_id": 0, "id": 1, "name": 1, "slug": 1, "description": 1, "category": 1,
         "region": 1, "concelho": 1, "municipality": 1, "image_url": 1,
         "location": 1, "tags": 1, "is_free": 1, "tourist_type": 1, "metadata": 1},
    )

    if not poi:
        title = SITE_NAME
        description = "Descubra o património cultural e natural de Portugal."
        image = DEFAULT_IMAGE
        canonical = SITE_URL
        schema_json = ""
        hreflang_pt = SITE_URL
        hreflang_en = f"{SITE_URL}/en"
    else:
        meta = generate_seo_meta(poi)
        title = html_lib.escape(meta["title"])
        description = html_lib.escape(meta["description"])
        image = html_lib.escape(meta["og"]["image"])
        canonical = html_lib.escape(meta["canonical"])
        hreflang_pt = html_lib.escape(meta["hreflang"]["pt"])
        hreflang_en = html_lib.escape(meta["hreflang"]["en"])
        schema_json = json.dumps(meta["schema"], ensure_ascii=False)

    schema_block = (
        f'  <script type="application/ld+json">{schema_json}</script>\n'
        if schema_json else ""
    )
    poi_path = poi.get("slug") or poi_id if poi else poi_id

    page_html = f"""<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta property="og:type" content="place">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image" content="{image}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:site_name" content="{SITE_NAME}">
  <meta property="og:locale" content="pt_PT">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{image}">
  <link rel="canonical" href="{canonical}">
  <link rel="alternate" hreflang="pt" href="{hreflang_pt}">
  <link rel="alternate" hreflang="en" href="{hreflang_en}">
  <link rel="alternate" hreflang="x-default" href="{hreflang_pt}">
  <meta http-equiv="refresh" content="0; url=/heritage/{poi_path}">
{schema_block}</head>
<body style="background:#1a0f0a;color:#FAF8F3;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:20px;">
    <h1 style="font-size:24px;margin-bottom:8px;">{title}</h1>
    <p style="color:#94A3B8;max-width:400px;">{description}</p>
    <p style="color:#C49A6C;">A redirecionar...</p>
  </div>
</body>
</html>"""
    return HTMLResponse(content=page_html)


@seo_router.get("/share/route/{route_id}", response_class=HTMLResponse)
async def route_share_page(route_id: str):
    """Server-rendered share page for routes."""
    db = _get_db()
    route = await db.routes.find_one(
        {"id": route_id},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1, "region": 1},
    )

    if not route:
        title = SITE_NAME
        description = "Explore rotas temáticas pelo património de Portugal."
        image = DEFAULT_IMAGE
        canonical = SITE_URL
        schema_json = ""
    else:
        canonical = f"{SITE_URL}/route/{route_id}"
        title = html_lib.escape(f"{route['name']} — Rota | {SITE_NAME}")
        desc_raw = route.get("description", "")
        description = html_lib.escape(_truncate(desc_raw, 160))
        image = DEFAULT_IMAGE
        schema = {
            "@context": "https://schema.org",
            "@type": "TouristTrip",
            "name": route["name"],
            "description": route.get("description", ""),
            "url": canonical,
            "inLanguage": ["pt-PT", "en"],
        }
        schema_json = json.dumps(schema, ensure_ascii=False)

    schema_block = (
        f'  <script type="application/ld+json">{schema_json}</script>\n'
        if schema_json else ""
    )

    page_html = f"""<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image" content="{image}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:site_name" content="{SITE_NAME}">
  <meta property="og:locale" content="pt_PT">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{image}">
  <link rel="canonical" href="{canonical}">
  <link rel="alternate" hreflang="pt" href="{canonical}">
  <link rel="alternate" hreflang="en" href="{SITE_URL}/en/route/{route_id}">
  <link rel="alternate" hreflang="x-default" href="{canonical}">
  <meta http-equiv="refresh" content="0; url=/route/{route_id}">
{schema_block}</head>
<body style="background:#1a0f0a;color:#FAF8F3;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:20px;">
    <h1 style="font-size:24px;margin-bottom:8px;">{title}</h1>
    <p style="color:#94A3B8;max-width:400px;">{description}</p>
    <p style="color:#C49A6C;">A redirecionar...</p>
  </div>
</body>
</html>"""
    return HTMLResponse(content=page_html)


@seo_router.get("/robots.txt")
async def robots_txt():
    """Serve robots.txt."""
    content = (
        "User-agent: *\n"
        "Allow: /\n"
        "Allow: /heritage/\n"
        "Allow: /route/\n"
        "Allow: /trail/\n"
        "Allow: /evento/\n"
        "Allow: /categories\n"
        "Disallow: /api/\n"
        "Disallow: /admin\n"
        "Disallow: /iq-admin\n"
        f"\nSitemap: {SITE_URL}/api/sitemap.xml\n"
    )
    return Response(content=content, media_type="text/plain")
