"""
Beachcam API - Curated beach webcam data for Portugal's coast
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

beachcam_router = APIRouter(prefix="/beachcams", tags=["Beachcams"])


# Curated beachcam data - MEO Beachcam and other sources
# Images from Unsplash (CC0) for reliable loading
BEACHCAM_DATA = [
    {
        "id": "nazare-norte",
        "name": "Praia do Norte - Nazaré",
        "region": "Centro",
        "location": {"lat": 39.6095, "lng": -9.0785},
        "embed_url": "https://beachcam.meo.pt/livecams/praia-do-norte-nazare/",
        "image_url": "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80",
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
        "embed_url": "https://beachcam.meo.pt/livecams/supertubos-peniche/",
        "image_url": "https://images.unsplash.com/photo-1455729552865-3658a5d39692?w=800&q=80",
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
        "embed_url": "https://beachcam.meo.pt/livecams/ribeira-dilhas-ericeira/",
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
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
        "embed_url": "https://beachcam.meo.pt/livecams/costa-da-caparica/",
        "image_url": "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
        "description": "A praia favorita dos lisboetas. Extensa faixa de areia com beach bars, surf schools e o famoso Transpraia.",
        "surf_level": "Iniciante-Intermédio",
        "best_season": "Mai-Out",
        "highlights": ["Surf schools", "Beach bars", "Transpraia"],
    },
    {
        "id": "carcavelos",
        "name": "Carcavelos",
        "region": "Lisboa",
        "location": {"lat": 38.6771, "lng": -9.3372},
        "embed_url": "https://beachcam.meo.pt/livecams/carcavelos/",
        "image_url": "https://images.unsplash.com/photo-1476673160081-cf065c05ad80?w=800&q=80",
        "description": "A praia mais acessível de Lisboa, a 20 min de comboio. Onda consistente para surf e bodyboard.",
        "surf_level": "Iniciante-Intermédio",
        "best_season": "Ano todo",
        "highlights": ["Acessível de comboio", "Surf consistente", "Praia urbana"],
    },
    {
        "id": "sagres-tonel",
        "name": "Praia do Tonel - Sagres",
        "region": "Algarve",
        "location": {"lat": 37.0008, "lng": -8.9452},
        "embed_url": "https://beachcam.meo.pt/livecams/praia-do-tonel-sagres/",
        "image_url": "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80",
        "description": "Junto ao Cabo de São Vicente, o ponto mais sudoeste da Europa. Ondas poderosas e paisagem dramática.",
        "surf_level": "Intermédio-Avançado",
        "best_season": "Set-Mai",
        "highlights": ["Cabo de São Vicente", "Falésias dramáticas", "Ondas poderosas"],
    },
    {
        "id": "portimao-rocha",
        "name": "Praia da Rocha - Portimão",
        "region": "Algarve",
        "location": {"lat": 37.1175, "lng": -8.5378},
        "embed_url": "https://beachcam.meo.pt/livecams/praia-da-rocha-portimao/",
        "image_url": "https://images.unsplash.com/photo-1520942702018-0862200e6873?w=800&q=80",
        "description": "Icónica praia algarvia com falésias douradas. Águas calmas ideais para famílias, marina e vida noturna.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["Falésias douradas", "Marina", "Vida noturna"],
    },
    {
        "id": "lagos-meia-praia",
        "name": "Meia Praia - Lagos",
        "region": "Algarve",
        "location": {"lat": 37.1110, "lng": -8.6540},
        "embed_url": "https://beachcam.meo.pt/livecams/meia-praia-lagos/",
        "image_url": "https://images.unsplash.com/photo-1473186578172-c141e6798cf4?w=800&q=80",
        "description": "A maior praia de Lagos com 4km de areia dourada. Desportos náuticos, kitesurf e banho de sol.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["4km de praia", "Desportos náuticos", "Kitesurf"],
    },
    {
        "id": "porto-matosinhos",
        "name": "Praia de Matosinhos",
        "region": "Norte",
        "location": {"lat": 41.1811, "lng": -8.6917},
        "embed_url": "https://beachcam.meo.pt/livecams/matosinhos/",
        "image_url": "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&q=80",
        "description": "A praia urbana do Porto. Beach break consistente, surf schools e os melhores restaurantes de peixe.",
        "surf_level": "Iniciante-Intermédio",
        "best_season": "Ano todo",
        "highlights": ["Praia urbana Porto", "Surf schools", "Restaurantes de peixe"],
    },
    {
        "id": "espinho",
        "name": "Praia de Espinho",
        "region": "Norte",
        "location": {"lat": 41.0081, "lng": -8.6457},
        "embed_url": "https://beachcam.meo.pt/livecams/espinho/",
        "image_url": "https://images.unsplash.com/photo-1471922694854-ff1b63b20054?w=800&q=80",
        "description": "Tradição surfista do Norte. Ondas consistentes, escola de surf histórica e campeonatos nacionais.",
        "surf_level": "Intermédio",
        "best_season": "Set-Mai",
        "highlights": ["Tradição de surf", "Campeonatos nacionais", "Ondas consistentes"],
    },
    {
        "id": "figueira-foz",
        "name": "Figueira da Foz - Buarcos",
        "region": "Centro",
        "location": {"lat": 40.1476, "lng": -8.8710},
        "embed_url": "https://beachcam.meo.pt/livecams/figueira-da-foz/",
        "image_url": "https://images.unsplash.com/photo-1509233725247-49e657c54213?w=800&q=80",
        "description": "A praia mais larga da Europa. Cidade com tradição balnear desde o século XIX. Casino e surf.",
        "surf_level": "Todos",
        "best_season": "Ano todo",
        "highlights": ["Praia mais larga da Europa", "Casino histórico", "Surf e bodyboard"],
    },
    {
        "id": "vilamoura",
        "name": "Praia de Vilamoura",
        "region": "Algarve",
        "location": {"lat": 37.0725, "lng": -8.1121},
        "embed_url": "https://beachcam.meo.pt/livecams/vilamoura/",
        "image_url": "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80",
        "description": "Praia premiada junto à marina de luxo de Vilamoura. Águas calmas, desportos aquáticos e golfe nas proximidades.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["Marina de luxo", "Bandeira Azul", "Golfe"],
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
