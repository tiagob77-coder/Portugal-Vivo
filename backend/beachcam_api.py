"""
Beachcam API - Curated beach webcam data for Portugal's coast
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

beachcam_router = APIRouter(prefix="/beachcams", tags=["Beachcams"])


# Curated beachcam data - VERIFIED FREE webcam sources (worldcam.eu)
# ONLY URLs that exist and work directly
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
        "id": "albufeira-gale",
        "name": "Praia da Galé - Albufeira",
        "region": "Algarve",
        "location": {"lat": 37.0756, "lng": -8.3167},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/15504-albufeira-praia-da-gale",
        "image_url": "https://images.unsplash.com/photo-1596394516292-36c9f5d37f6d?w=800&q=80",
        "description": "Praia paradisíaca com formações rochosas únicas. Águas cristalinas e ambiente mais tranquilo.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["Formações rochosas", "Águas cristalinas", "Tranquilidade"],
    },
    {
        "id": "armacao-pera",
        "name": "Praia de Armação de Pêra",
        "region": "Algarve",
        "location": {"lat": 37.1000, "lng": -8.3583},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/28285-armacao-de-pera-beach",
        "image_url": "https://images.unsplash.com/photo-1596627116790-af6f46dddb76?w=800&q=80",
        "description": "Extensa praia com 3km de areal. Pesca tradicional, restaurantes de peixe e passeios de barco às grutas.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["3km de praia", "Pesca tradicional", "Grutas de Benagil"],
    },
    {
        "id": "alvor",
        "name": "Praia do Alvor",
        "region": "Algarve",
        "location": {"lat": 37.1250, "lng": -8.5917},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/16659-alvor-praia-do-alvor",
        "image_url": "https://images.unsplash.com/photo-1715440936261-1199a843ce01?w=800&q=80",
        "description": "Praia extensa junto à Ria de Alvor. Dunas, passadiços de madeira e observação de aves.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["Ria de Alvor", "Passadiços", "Observação de aves"],
    },
    {
        "id": "aljezur-arrifana",
        "name": "Praia da Arrifana - Aljezur",
        "region": "Algarve",
        "location": {"lat": 37.2917, "lng": -8.8667},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/12501-aljezur-praia-da-arrifana",
        "image_url": "https://images.unsplash.com/photo-1596627116790-af6f46dddb76?w=800&q=80",
        "description": "Praia selvagem na Costa Vicentina. Point break famoso para surf, falésias imponentes e pôr-do-sol épico.",
        "surf_level": "Intermédio",
        "best_season": "Set-Mai",
        "highlights": ["Costa Vicentina", "Point break", "Falésias"],
    },
    {
        "id": "aljezur-amoreira",
        "name": "Praia da Amoreira - Aljezur",
        "region": "Algarve",
        "location": {"lat": 37.3333, "lng": -8.8500},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/16658-aljezur-praia-da-amoreira",
        "image_url": "https://images.unsplash.com/photo-1596394516292-36c9f5d37f6d?w=800&q=80",
        "description": "Praia com ribeira e lagoa. Ideal para famílias, bodyboard e caminhadas na Costa Vicentina.",
        "surf_level": "Todos",
        "best_season": "Mai-Out",
        "highlights": ["Ribeira e lagoa", "Famílias", "Costa Vicentina"],
    },
    {
        "id": "aljezur-amado",
        "name": "Praia do Amado - Aljezur",
        "region": "Algarve",
        "location": {"lat": 37.1667, "lng": -8.9000},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/33207-aljezur-praia-do-amado",
        "image_url": "https://images.unsplash.com/photo-1679609409352-df54851d203c?w=800&q=80",
        "description": "Uma das melhores praias de surf em Portugal. Beach break consistente, escola de surf e ambiente descontraído.",
        "surf_level": "Todos",
        "best_season": "Ano todo",
        "highlights": ["Surf school", "Beach break", "Ambiente relax"],
    },
    {
        "id": "odeceixe",
        "name": "Praia de Odeceixe",
        "region": "Algarve",
        "location": {"lat": 37.4333, "lng": -8.8000},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/33206-aljezur-odeceixe-beach",
        "image_url": "https://images.unsplash.com/photo-1596627116790-af6f46dddb76?w=800&q=80",
        "description": "Praia na fronteira Algarve/Alentejo. Ribeira de Seixe cria lagoa segura para crianças, surf nas ondas.",
        "surf_level": "Todos",
        "best_season": "Mai-Out",
        "highlights": ["Fronteira Algarve/Alentejo", "Lagoa segura", "Surf"],
    },
    {
        "id": "porto-dom-luis",
        "name": "Ribeira do Porto - Ponte D. Luís",
        "region": "Norte",
        "location": {"lat": 41.1400, "lng": -8.6130},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/13970-porto-dom-luis-i-bridge",
        "image_url": "https://images.unsplash.com/photo-1591720765380-df44c2636fb7?w=800&q=80",
        "description": "Vista icónica da Ponte D. Luís I e da Ribeira do Porto. Património Mundial UNESCO, caves do vinho.",
        "surf_level": "N/A",
        "best_season": "Ano todo",
        "highlights": ["Ponte D. Luís I", "Ribeira UNESCO", "Caves do vinho"],
    },
    {
        "id": "lisboa-panoramica",
        "name": "Lisboa - Vista Panorâmica",
        "region": "Lisboa",
        "location": {"lat": 38.7223, "lng": -9.1393},
        "embed_url": "https://worldcam.eu/webcams/europe/portugal/3900-lisbon-panoramic-view",
        "image_url": "https://images.unsplash.com/photo-1596394516292-36c9f5d37f6d?w=800&q=80",
        "description": "Vista panorâmica sobre a capital portuguesa. Tejo, Castelo de São Jorge e telhados históricos.",
        "surf_level": "N/A",
        "best_season": "Ano todo",
        "highlights": ["Rio Tejo", "Castelo São Jorge", "Centro histórico"],
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
