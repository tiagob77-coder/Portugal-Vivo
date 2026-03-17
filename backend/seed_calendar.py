"""
Seed script to migrate CALENDAR_EVENTS from hardcoded array to MongoDB.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

CALENDAR_EVENTS = [
    # Janeiro
    {"id": "janeiras", "name": "Janeiras e Reis", "date_start": "01-06", "date_end": "01-06", "category": "festas", "region": "norte", "description": "Cantos de porta em porta celebrando os Reis"},
    # Fevereiro
    {"id": "caretos", "name": "Caretos de Podence", "date_start": "02-01", "date_end": "02-28", "category": "festas", "region": "norte", "description": "Carnaval tradicional com máscaras ancestrais"},
    {"id": "carnaval_loule", "name": "Carnaval de Loulé", "date_start": "02-15", "date_end": "02-20", "category": "festas", "region": "algarve", "description": "Um dos carnavais mais antigos do Algarve"},
    # Março/Abril
    {"id": "semana_santa", "name": "Semana Santa de Braga", "date_start": "03-20", "date_end": "04-20", "category": "religioso", "region": "norte", "description": "Procissões e celebrações da Páscoa"},
    # Abril
    {"id": "festa_flor", "name": "Festa da Flor", "date_start": "04-15", "date_end": "04-30", "category": "festas", "region": "madeira", "description": "Desfile alegórico e mural de flores"},
    # Maio
    {"id": "queima_fitas", "name": "Queima das Fitas", "date_start": "05-01", "date_end": "05-15", "category": "festas", "region": "centro", "description": "Tradição académica de Coimbra"},
    {"id": "santo_cristo", "name": "Senhor Santo Cristo", "date_start": "05-15", "date_end": "05-20", "category": "religioso", "region": "acores", "description": "A maior romaria açoriana"},
    {"id": "fatima_maio", "name": "Peregrinação a Fátima", "date_start": "05-12", "date_end": "05-13", "category": "religioso", "region": "centro", "description": "Aniversário das aparições"},
    # Junho
    {"id": "santos_populares", "name": "Santos Populares", "date_start": "06-12", "date_end": "06-29", "category": "festas", "region": "lisboa", "description": "Santo António, São João e São Pedro"},
    {"id": "sao_joao", "name": "São João do Porto", "date_start": "06-23", "date_end": "06-24", "category": "festas", "region": "norte", "description": "A maior festa popular do Norte"},
    {"id": "sao_pedro", "name": "Festas de São Pedro", "date_start": "06-28", "date_end": "06-29", "category": "festas", "region": "centro", "description": "Celebrações em honra de São Pedro"},
    # Julho
    {"id": "tabuleiros", "name": "Festa dos Tabuleiros", "date_start": "07-01", "date_end": "07-15", "category": "festas", "region": "centro", "description": "Cortejo quadrienal em Tomar (anos pares)"},
    {"id": "medieval_obidos", "name": "Feira Medieval de Óbidos", "date_start": "07-10", "date_end": "07-30", "category": "festas", "region": "centro", "description": "Recriação histórica medieval"},
    # Agosto
    {"id": "agonia", "name": "Romaria d'Agonia", "date_start": "08-15", "date_end": "08-20", "category": "festas", "region": "norte", "description": "Trajes tradicionais e tapetes floridos em Viana"},
    {"id": "vindimas", "name": "Festa das Vindimas", "date_start": "08-25", "date_end": "09-15", "category": "festas", "region": "norte", "description": "Colheita das uvas no Douro"},
    {"id": "feira_mateus", "name": "Feira de São Mateus", "date_start": "08-15", "date_end": "09-21", "category": "festas", "region": "centro", "description": "Uma das mais antigas feiras de Portugal"},
    # Setembro
    {"id": "romaria_nazare", "name": "Romaria da Nazaré", "date_start": "09-08", "date_end": "09-15", "category": "religioso", "region": "centro", "description": "Festas em honra de Nossa Senhora"},
    {"id": "cereja", "name": "Festa da Cereja", "date_start": "09-01", "date_end": "09-10", "category": "festas", "region": "centro", "description": "Celebração do fruto no Fundão"},
    # Outubro
    {"id": "fatima_outubro", "name": "Peregrinação a Fátima", "date_start": "10-12", "date_end": "10-13", "category": "religioso", "region": "centro", "description": "Última aparição de Nossa Senhora"},
    {"id": "castanhas", "name": "Magusto e Castanhas", "date_start": "10-25", "date_end": "11-15", "category": "festas", "region": "norte", "description": "Época das castanhas assadas"},
    # Novembro
    {"id": "sao_martinho", "name": "São Martinho", "date_start": "11-11", "date_end": "11-11", "category": "festas", "region": "norte", "description": "Magusto, jeropiga e castanhas"},
    # Dezembro
    {"id": "natal", "name": "Tradições de Natal", "date_start": "12-01", "date_end": "12-31", "category": "festas", "region": "norte", "description": "Presépios, consoada e tradições natalícias"},
    {"id": "madeira_natal", "name": "Natal e Fim de Ano na Madeira", "date_start": "12-15", "date_end": "12-31", "category": "festas", "region": "madeira", "description": "Fogos de artifício espetaculares"},
]


async def seed_calendar_events():
    """Seed calendar events into MongoDB."""
    print("Migrating calendar events to MongoDB...")

    # Create unique index on event id
    await db.calendar_events.create_index("id", unique=True)

    # Upsert each event
    for event in CALENDAR_EVENTS:
        event_doc = {
            **event,
            "created_at": datetime.now(timezone.utc),
        }
        await db.calendar_events.update_one(
            {"id": event["id"]},
            {"$set": event_doc},
            upsert=True,
        )

    count = await db.calendar_events.count_documents({})
    print(f"Calendar events in database: {count}")


if __name__ == "__main__":
    asyncio.run(seed_calendar_events())
