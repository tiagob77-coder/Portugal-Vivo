"""
Beachcam API - Curated beach webcam data for Portugal's coast
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

beachcam_router = APIRouter(prefix="/beachcams", tags=["Beachcams"])


# Curated beachcam data - MEO Beachcam and other sources
BEACHCAM_DATA = [
    {
        "id": "nazare-norte",
        "name": "Praia do Norte - Nazare",
        "region": "Centro",
        "location": {"lat": 39.6095, "lng": -9.0785},
        "embed_url": "https://beachcam.meo.pt/livecams/praia-do-norte-nazare/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/praia-do-norte-nazare.jpg",
        "description": "A famosa Praia do Norte, casa das maiores ondas do mundo. Nazare Canyon cria ondas que ultrapassam 30m.",
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
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/supertubos-peniche.jpg",
        "description": "O tubo perfeito da Europa. Palco do MEO Rip Curl Pro Portugal, etapa do World Surf League Championship Tour.",
        "surf_level": "Avancado",
        "best_season": "Set-Dez",
        "highlights": ["WSL Championship Tour", "Tubo perfeito", "Beach break"],
    },
    {
        "id": "ericeira-ribeira-dilhas",
        "name": "Ribeira d'Ilhas - Ericeira",
        "region": "Lisboa",
        "location": {"lat": 38.9774, "lng": -9.4209},
        "embed_url": "https://beachcam.meo.pt/livecams/ribeira-dilhas-ericeira/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/ribeira-dilhas-ericeira.jpg",
        "description": "Reserva Mundial de Surf da Ericeira. Onda direita longa e consistente, perfeita para todos os niveis.",
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
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/costa-da-caparica.jpg",
        "description": "A praia favorita dos lisboetas. Extensa faixa de areia com beach bars, surf schools e o famoso Transpraia.",
        "surf_level": "Iniciante-Intermedio",
        "best_season": "Mai-Out",
        "highlights": ["Surf schools", "Beach bars", "Transpraia"],
    },
    {
        "id": "carcavelos",
        "name": "Carcavelos",
        "region": "Lisboa",
        "location": {"lat": 38.6771, "lng": -9.3372},
        "embed_url": "https://beachcam.meo.pt/livecams/carcavelos/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/carcavelos.jpg",
        "description": "A praia mais acessivel de Lisboa, a 20 min de comboio. Onda consistente para surf e bodyboard.",
        "surf_level": "Iniciante-Intermedio",
        "best_season": "Ano todo",
        "highlights": ["Acessivel de comboio", "Surf consistente", "Praia urbana"],
    },
    {
        "id": "sagres-tonel",
        "name": "Praia do Tonel - Sagres",
        "region": "Algarve",
        "location": {"lat": 37.0008, "lng": -8.9452},
        "embed_url": "https://beachcam.meo.pt/livecams/praia-do-tonel-sagres/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/tonel-sagres.jpg",
        "description": "Junto ao Cabo de Sao Vicente, o ponto mais sudoeste da Europa. Ondas poderosas e paisagem dramatica.",
        "surf_level": "Intermedio-Avancado",
        "best_season": "Set-Mai",
        "highlights": ["Cabo de Sao Vicente", "Falesias dramaticas", "Ondas poderosas"],
    },
    {
        "id": "portimao-rocha",
        "name": "Praia da Rocha - Portimao",
        "region": "Algarve",
        "location": {"lat": 37.1175, "lng": -8.5378},
        "embed_url": "https://beachcam.meo.pt/livecams/praia-da-rocha-portimao/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/praia-da-rocha.jpg",
        "description": "Iconica praia algarvia com falesias douradas. Aguas calmas ideais para familias, marina e vida noturna.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["Falesias douradas", "Marina", "Vida noturna"],
    },
    {
        "id": "lagos-meia-praia",
        "name": "Meia Praia - Lagos",
        "region": "Algarve",
        "location": {"lat": 37.1110, "lng": -8.6540},
        "embed_url": "https://beachcam.meo.pt/livecams/meia-praia-lagos/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/meia-praia-lagos.jpg",
        "description": "A maior praia de Lagos com 4km de areia dourada. Desportos nauticos, kitesurf e banho de sol.",
        "surf_level": "Iniciante",
        "best_season": "Mai-Out",
        "highlights": ["4km de praia", "Desportos nauticos", "Kitesurf"],
    },
    {
        "id": "porto-matosinhos",
        "name": "Praia de Matosinhos",
        "region": "Norte",
        "location": {"lat": 41.1811, "lng": -8.6917},
        "embed_url": "https://beachcam.meo.pt/livecams/matosinhos/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/matosinhos.jpg",
        "description": "A praia urbana do Porto. Beach break consistente, surf schools e os melhores restaurantes de peixe.",
        "surf_level": "Iniciante-Intermedio",
        "best_season": "Ano todo",
        "highlights": ["Praia urbana Porto", "Surf schools", "Restaurantes de peixe"],
    },
    {
        "id": "espinho",
        "name": "Praia de Espinho",
        "region": "Norte",
        "location": {"lat": 41.0081, "lng": -8.6457},
        "embed_url": "https://beachcam.meo.pt/livecams/espinho/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/espinho.jpg",
        "description": "Tradicao surfista do Norte. Ondas consistentes, escola de surf historica e campeonatos nacionais.",
        "surf_level": "Intermedio",
        "best_season": "Set-Mai",
        "highlights": ["Tradicao de surf", "Campeonatos nacionais", "Ondas consistentes"],
    },
    {
        "id": "figueira-foz",
        "name": "Figueira da Foz - Buarcos",
        "region": "Centro",
        "location": {"lat": 40.1476, "lng": -8.8710},
        "embed_url": "https://beachcam.meo.pt/livecams/figueira-da-foz/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/figueira-da-foz.jpg",
        "description": "A praia mais larga da Europa. Cidade com tradicao balnear desde o seculo XIX. Casino e surf.",
        "surf_level": "Todos",
        "best_season": "Ano todo",
        "highlights": ["Praia mais larga da Europa", "Casino historico", "Surf e bodyboard"],
    },
    {
        "id": "vilamoura",
        "name": "Praia de Vilamoura",
        "region": "Algarve",
        "location": {"lat": 37.0725, "lng": -8.1121},
        "embed_url": "https://beachcam.meo.pt/livecams/vilamoura/",
        "image_url": "https://beachcam.meo.pt/static/images/thumbs/vilamoura.jpg",
        "description": "Praia premiada junto a marina de luxo de Vilamoura. Aguas calmas, desportos aquaticos e golfe nas proximidades.",
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
