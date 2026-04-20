"""
SEO API - Dynamic Open Graph meta tags, sitemap.xml, and social share cards.
Provides OG metadata per POI for rich social media previews.
"""
from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse
from datetime import datetime, timezone
import logging
import html
import urllib.parse

from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

seo_router = APIRouter(tags=["SEO"])

_db_holder = DatabaseHolder("seo")
set_seo_db = _db_holder.set
_get_db = _db_holder.get

# Category display names
CATEGORY_NAMES = {
    "termas": "Termas", "piscinas": "Praias Fluviais", "miradouros": "Miradouros",
    "aldeias": "Aldeias", "percursos": "Percursos", "gastronomia": "Gastronomia",
    "lendas": "Lendas", "festas": "Festas", "saberes": "Saberes",
    "arqueologia": "Arqueologia", "fauna": "Fauna", "florestas": "Florestas",
    "rios": "Rios", "arte": "Arte", "religioso": "Religioso",
    "comunidade": "Comunidade", "rotas": "Rotas", "cogumelos": "Cogumelos",
    "minerais": "Minerais", "produtos": "Produtos", "crencas": "Crenças",
}

REGION_NAMES = {
    "norte": "Norte", "centro": "Centro", "lisboa": "Lisboa e Vale do Tejo",
    "alentejo": "Alentejo", "algarve": "Algarve", "acores": "Açores", "madeira": "Madeira",
}

DEFAULT_IMAGE = "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80"
SITE_URL = "https://portugal-vivo.app"
SITE_NAME = "Portugal Vivo"


@seo_router.get("/og/poi/{poi_id}")
async def get_poi_og_metadata(poi_id: str):
    """Get Open Graph metadata for a specific POI."""
    db = _get_db()
    poi = await db.heritage_items.find_one(
        {"id": poi_id},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
         "region": 1, "image_url": 1, "location": 1, "tags": 1, "address": 1}
    )

    if not poi:
        return {
            "title": SITE_NAME,
            "description": "Descubra o património cultural e natural de Portugal.",
            "image": DEFAULT_IMAGE,
            "url": SITE_URL,
            "type": "website",
        }

    category_name = CATEGORY_NAMES.get(poi.get("category", ""), poi.get("category", ""))
    region_name = REGION_NAMES.get(poi.get("region", ""), poi.get("region", ""))

    description = poi.get("description", "")
    if len(description) > 200:
        description = description[:197] + "..."

    title = f"{poi['name']} - {category_name} | {SITE_NAME}"
    image = poi.get("image_url") or DEFAULT_IMAGE

    return {
        "title": title,
        "description": description,
        "image": image,
        "url": f"{SITE_URL}/heritage/{poi_id}",
        "type": "article",
        "site_name": SITE_NAME,
        "locale": "pt_PT",
        "category": category_name,
        "region": region_name,
        "location": poi.get("location"),
        "tags": poi.get("tags", []),
        "twitter_card": "summary_large_image",
    }


@seo_router.get("/og/route/{route_id}")
async def get_route_og_metadata(route_id: str):
    """Get OG metadata for a route."""
    db = _get_db()
    route = await db.routes.find_one(
        {"id": route_id},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
         "region": 1, "duration_hours": 1, "distance_km": 1}
    )

    if not route:
        return {
            "title": SITE_NAME,
            "description": "Explore rotas temáticas pelo património de Portugal.",
            "image": DEFAULT_IMAGE,
            "url": SITE_URL,
            "type": "website",
        }

    desc = route.get("description", "")
    extras = []
    if route.get("duration_hours"):
        extras.append(f"{route['duration_hours']}h")
    if route.get("distance_km"):
        extras.append(f"{route['distance_km']}km")
    if extras:
        desc = f"{desc} ({', '.join(extras)})"
    if len(desc) > 200:
        desc = desc[:197] + "..."

    return {
        "title": f"{route['name']} - Rotas | {SITE_NAME}",
        "description": desc,
        "image": DEFAULT_IMAGE,
        "url": f"{SITE_URL}/route/{route_id}",
        "type": "article",
        "site_name": SITE_NAME,
        "locale": "pt_PT",
        "twitter_card": "summary_large_image",
    }


@seo_router.get("/sitemap.xml")
async def sitemap_xml():
    """Generate dynamic sitemap.xml with all POIs, routes, and categories."""
    db = _get_db()

    urls = []

    # Static pages
    static_pages = [
        {"loc": "/", "priority": "1.0", "changefreq": "daily"},
        {"loc": "/(tabs)/descobrir", "priority": "0.9", "changefreq": "daily"},
        {"loc": "/(tabs)/mapa", "priority": "0.8", "changefreq": "weekly"},
        {"loc": "/leaderboard", "priority": "0.7", "changefreq": "daily"},
        {"loc": "/categories", "priority": "0.8", "changefreq": "weekly"},
        {"loc": "/gamification", "priority": "0.6", "changefreq": "weekly"},
    ]

    for page in static_pages:
        urls.append(
            f'  <url>\n'
            f'    <loc>{SITE_URL}{page["loc"]}</loc>\n'
            f'    <changefreq>{page["changefreq"]}</changefreq>\n'
            f'    <priority>{page["priority"]}</priority>\n'
            f'  </url>'
        )

    # Dynamic POI pages
    pois = await db.heritage_items.find(
        {}, {"_id": 0, "id": 1, "name": 1, "created_at": 1}
    ).limit(5000).to_list(5000)

    for poi in pois:
        lastmod = ""
        if poi.get("created_at"):
            if hasattr(poi["created_at"], 'strftime'):
                lastmod = f"\n    <lastmod>{poi['created_at'].strftime('%Y-%m-%d')}</lastmod>"
            elif isinstance(poi["created_at"], str):
                lastmod = f"\n    <lastmod>{poi['created_at'][:10]}</lastmod>"

        urls.append(
            f'  <url>\n'
            f'    <loc>{SITE_URL}/heritage/{poi["id"]}</loc>{lastmod}\n'
            f'    <changefreq>monthly</changefreq>\n'
            f'    <priority>0.6</priority>\n'
            f'  </url>'
        )

    # Dynamic route pages
    routes = await db.routes.find(
        {}, {"_id": 0, "id": 1}
    ).limit(500).to_list(500)

    for route in routes:
        urls.append(
            f'  <url>\n'
            f'    <loc>{SITE_URL}/route/{route["id"]}</loc>\n'
            f'    <changefreq>monthly</changefreq>\n'
            f'    <priority>0.5</priority>\n'
            f'  </url>'
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + '\n'.join(urls) + '\n'
        '</urlset>'
    )

    return Response(content=xml, media_type="application/xml")


@seo_router.get("/share/poi/{poi_id}", response_class=HTMLResponse)
async def poi_share_page(poi_id: str):
    """
    Server-rendered HTML page with OG meta tags for a POI.
    Social media crawlers will see these tags when a link is shared.
    Browsers will be redirected to the SPA.
    """
    db = _get_db()
    poi = await db.heritage_items.find_one(
        {"id": poi_id},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
         "region": 1, "image_url": 1, "tags": 1}
    )

    if not poi:
        title = SITE_NAME
        description = "Descubra o património cultural e natural de Portugal."
        image = DEFAULT_IMAGE
        url = SITE_URL
    else:
        category_name = CATEGORY_NAMES.get(poi.get("category", ""), poi.get("category", ""))
        region_name = REGION_NAMES.get(poi.get("region", ""), poi.get("region", ""))
        title = html.escape(f"{poi['name']} - {category_name}")
        desc_raw = poi.get("description", "")
        description = html.escape(desc_raw[:200] + "..." if len(desc_raw) > 200 else desc_raw)
        image = poi.get("image_url") or DEFAULT_IMAGE
        url = f"{SITE_URL}/heritage/{poi_id}"

    page_html = f"""<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} | {SITE_NAME}</title>
  <meta name="description" content="{description}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image" content="{image}">
  <meta property="og:url" content="{url}">
  <meta property="og:site_name" content="{SITE_NAME}">
  <meta property="og:locale" content="pt_PT">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{image}">

  <!-- Redirect to SPA -->
  <meta http-equiv="refresh" content="0; url=/heritage/{poi_id}">
  <link rel="canonical" href="{url}">
</head>
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
    """Server-rendered share page for routes with OG tags."""
    db = _get_db()
    route = await db.routes.find_one(
        {"id": route_id},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1, "region": 1}
    )

    if not route:
        title = SITE_NAME
        description = "Explore rotas temáticas pelo património de Portugal."
        image = DEFAULT_IMAGE
        url = SITE_URL
    else:
        title = html.escape(route["name"])
        desc_raw = route.get("description", "")
        description = html.escape(desc_raw[:200] + "..." if len(desc_raw) > 200 else desc_raw)
        image = DEFAULT_IMAGE
        url = f"{SITE_URL}/route/{route_id}"

    page_html = f"""<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} | {SITE_NAME}</title>
  <meta name="description" content="{description}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image" content="{image}">
  <meta property="og:url" content="{url}">
  <meta property="og:site_name" content="{SITE_NAME}">
  <meta property="og:locale" content="pt_PT">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{image}">
  <meta http-equiv="refresh" content="0; url=/route/{route_id}">
  <link rel="canonical" href="{url}">
</head>
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
        "Allow: /categories\n"
        "Disallow: /api/\n"
        "Disallow: /admin\n"
        "Disallow: /iq-admin\n"
        f"\nSitemap: {SITE_URL}/api/sitemap.xml\n"
    )
    return Response(content=content, media_type="text/plain")
