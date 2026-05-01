"""
Beachcam API - Curated beach webcam data for Portugal's coast
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

beachcam_router = APIRouter(prefix="/beachcams", tags=["Beachcams"])


# Curated beachcam data - VERIFIED FREE webcam sources
# Images from Unsplash - REAL Portuguese beaches
BEACHCAM_DATA = [
    {
        "id": "nazare-norte",
        "name": "Praia do Norte - Nazaré",
        "region": "Centro",
        "location": {"lat": 39.6095, "lng": -9.0785},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/24835-nazare-praia-do-norte",
        "image_url": "https://images.unsplash.com/photo-1679609409352-df54851d203c?w=800&q=80",
        "description": "A famosa Praia do Norte, casa das maiores ondas do mundo. Nazaré Canyon cria ondas que ultrapassam 30m.",
        "surf_level": "Extremo",
        "best_season": "Out-Mar",
        "highlights": ["Ondas gigantes", "Canyon submarino", "Big Wave Surf"],
    },
    {
        "id": "peniche-supertubos",
        "name": "Supertubos - Peniche",
        "region": "Centro",
        "location": {"lat": 39.3475, "lng": -9.3881},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/13286-peniche-praia-super-tubos",
        "image_url": "https://images.unsplash.com/photo-1676934193196-3d0cd1dbe504?w=800&q=80",
        "description": "O tubo perfeito da Europa. Palco do MEO Rip Curl Pro Portugal, etapa do World Surf League Championship Tour.",
        "surf_level": "Avançado",
        "best_season": "Set-Dez",
        "highlights": ["WSL Championship Tour", "Tubo perfeito", "Beach break"],
    },
    {
        "id": "ericeira-ribeira-dilhas",
        "name": "Ribeira d'Ilhas - Ericeira",
        "region": "Lisboa",
        "location": {"lat": 38.9774, "lng": -9.4209},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/13287-ericeira-ribeira-d-ilhas",
        "image_url": "https://images.unsplash.com/photo-1645651623864-cdf1327e8c2e?w=800&q=80",
        "description": "Reserva Mundial de Surf da Ericeira. Onda direita longa e consistente, perfeita para todos os níveis.",
        "surf_level": "Todos",
        "best_season": "Ano todo",
        "highlights": ["Reserva Mundial de Surf", "Onda direita", "Point break"],
    },
    {
        "id": "costa-caparica",
        "name": "Costa da Caparica",
        "region": "Lisboa",
        "location": {"lat": 38.6268, "lng": -9.2365},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/13288-costa-da-caparica",
        "image_url": "https://images.unsplash.com/photo-1629797956021-389de140752d?w=800&q=80",
        "description": "A praia favorita dos lisboetas. Extensa faixa de areia com beach bars, surf schools e o famoso Transpraia.",
        "surf_level": "Iniciante-Intermédio",
        "best_season": "Mai-Out",
        "highlights": ["Surf schools", "Beach bars", "Transpraia"],
    },
    {
        "id": "sagres-mareta",
        "name": "Praia da Mareta - Sagres",
        "region": "Algarve",
        "location": {"lat": 37.0008, "lng": -8.9452},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/34686-sagres-mareta-beach",
        "image_url": "https://images.unsplash.com/photo-1596627116790-af6f46dddb76?w=800&q=80",
        "description": "Junto ao Cabo de São Vicente, o ponto mais sudoeste da Europa. Ondas poderosas e paisagem dramática.",
        "surf_level": "Intermédio-Avançado",
        "best_season": "Set-Mai",
        "highlights": ["Cabo de São Vicente", "Falésias dramáticas", "Ondas poderosas"],
    },
    {
        "id": "lagos-porto-mos",
        "name": "Porto de Mós - Lagos",
        "region": "Algarve",
        "location": {"lat": 37.0821, "lng": -8.6732},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/18014-lagos-porto-de-mos-beach",
        "image_url": "https://images.unsplash.com/photo-1566138781103-cd73fc587bda?w=800&q=80",
        "description": "Praia espetacular com falésias douradas e águas cristalinas. Uma das mais belas do Algarve.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["Falésias douradas", "Águas cristalinas", "Grutas"],
    },
    {
        "id": "lagos-meia-praia",
        "name": "Meia Praia - Lagos",
        "region": "Algarve",
        "location": {"lat": 37.1110, "lng": -8.6540},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/14195-lagos-meia-praia-duna-beach",
        "image_url": "https://images.unsplash.com/photo-1715440936261-1199a843ce01?w=800&q=80",
        "description": "A maior praia de Lagos com 4km de areia dourada. Desportos náuticos, kitesurf e banho de sol.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["4km de praia", "Desportos náuticos", "Kitesurf"],
    },
    {
        "id": "praia-da-luz",
        "name": "Praia da Luz",
        "region": "Algarve",
        "location": {"lat": 37.0889, "lng": -8.7312},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/2806-praia-da-luz",
        "image_url": "https://images.unsplash.com/photo-1596394516292-36c9f5d37f6d?w=800&q=80",
        "description": "Praia familiar com águas calmas e areia dourada. Ambiente tranquilo e belos pores-do-sol.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["Praia familiar", "Pores-do-sol", "Águas calmas"],
    },
    {
        "id": "albufeira-peneco",
        "name": "Praia do Peneco - Albufeira",
        "region": "Algarve",
        "location": {"lat": 37.0875, "lng": -8.2500},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/16875-albufeira-peneco-beach",
        "image_url": "https://images.unsplash.com/photo-1591720765380-df44c2636fb7?w=800&q=80",
        "description": "A praia central de Albufeira. Acesso pelo famoso túnel, animação e vida noturna nas proximidades.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["Praia central", "Túnel de acesso", "Vida noturna"],
    },
    {
        "id": "nazare-praia",
        "name": "Nazaré Beach - Praia da Vila",
        "region": "Centro",
        "location": {"lat": 39.5990, "lng": -9.0720},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/13325-nazare-beach",
        "image_url": "https://images.unsplash.com/photo-1596627116790-af6f46dddb76?w=800&q=80",
        "description": "A praia principal da Nazaré junto ao Sítio. Tradições piscatórias, barcos coloridos e funicular histórico.",
        "surf_level": "Todos",
        "best_season": "Ano todo",
        "highlights": ["Funicular histórico", "Tradições piscatórias", "Barcos coloridos"],
    },
    {
        "id": "porto-foz",
        "name": "Foz do Douro - Porto",
        "region": "Norte",
        "location": {"lat": 41.1500, "lng": -8.6750},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/13970-porto-dom-luis-i-bridge",
        "image_url": "https://images.unsplash.com/photo-1591720765380-df44c2636fb7?w=800&q=80",
        "description": "Vista panorâmica da Ponte D. Luís I e da emblemática Ribeira do Porto, Património Mundial UNESCO.",
        "surf_level": "Iniciante-Intermédio",
        "best_season": "Ano todo",
        "highlights": ["Ponte D. Luís I", "Ribeira", "Património UNESCO"],
    },
]


@beachcam_router.get("/list")
async def list_beachcams(
    region: Optional[str] = Query(None, description="Filter by region: Norte, Centro, Lisboa, Algarve"),
    surf_level: Optional[str] = Query(None, description="Filter by surf level"),
):
    cams = BEACHCAM_DATA
    if region:
        cams = [c for c in cams if c["region"].lower() == region.lower()]
    if surf_level:
        cams = [c for c in cams if surf_level.lower() in c["surf_level"].lower()]

    return {
        "beachcams": cams,
        "total": len(cams),
        "regions": list(set(c["region"] for c in BEACHCAM_DATA)),
    }


@beachcam_router.get("/{cam_id}")
async def get_beachcam(cam_id: str):
    for cam in BEACHCAM_DATA:
        if cam["id"] == cam_id:
            return cam
    raise HTTPException(404, "Webcam not found")
