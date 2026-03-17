"""
Seed script for 9 previously empty categories in Portugal Vivo.
Categories: miradouros, cascatas, tascas, baloicos, moinhos, aventura,
            areas_protegidas, rotas, comunidade
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

CATEGORY_IMAGES = {
    "miradouros": [
        "https://images.pexels.com/photos/2901209/pexels-photo-2901209.jpeg",
        "https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg",
    ],
    "cascatas": [
        "https://images.pexels.com/photos/2743287/pexels-photo-2743287.jpeg",
        "https://images.pexels.com/photos/2406776/pexels-photo-2406776.jpeg",
    ],
    "tascas": [
        "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg",
        "https://images.pexels.com/photos/696218/pexels-photo-696218.jpeg",
    ],
    "baloicos": [
        "https://images.pexels.com/photos/3933881/pexels-photo-3933881.jpeg",
    ],
    "moinhos": [
        "https://images.pexels.com/photos/532931/pexels-photo-532931.jpeg",
        "https://images.pexels.com/photos/1755683/pexels-photo-1755683.jpeg",
    ],
    "aventura": [
        "https://images.pexels.com/photos/3601094/pexels-photo-3601094.jpeg",
        "https://images.pexels.com/photos/3601422/pexels-photo-3601422.jpeg",
    ],
    "areas_protegidas": [
        "https://images.pexels.com/photos/1578750/pexels-photo-1578750.jpeg",
        "https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg",
    ],
    "rotas": [
        "https://images.pexels.com/photos/1578750/pexels-photo-1578750.jpeg",
    ],
    "comunidade": [
        "https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg",
    ],
}


def get_image(category: str, index: int = 0) -> str:
    images = CATEGORY_IMAGES.get(category, CATEGORY_IMAGES["comunidade"])
    return images[index % len(images)]


# ========================
# MIRADOUROS
# ========================
MIRADOUROS = [
    {"name": "Miradouro de Santa Luzia", "description": "Um dos mais belos miradouros de Lisboa, com vista panorâmica sobre o bairro de Alfama, o Tejo e a margem sul.", "region": "lisboa", "location": {"lat": 38.7139, "lng": -9.1296}, "address": "Largo do Miradouro de Santa Luzia, Lisboa"},
    {"name": "Miradouro da Senhora do Monte", "description": "O miradouro mais alto de Lisboa com vista 360° sobre a cidade, o castelo e o Tejo.", "region": "lisboa", "location": {"lat": 38.7194, "lng": -9.1353}, "address": "Rua da Senhora do Monte, Lisboa"},
    {"name": "Miradouro da Graça", "description": "Vista privilegiada sobre o Castelo de São Jorge e o centro histórico de Lisboa.", "region": "lisboa", "location": {"lat": 38.7178, "lng": -9.1331}, "address": "Largo da Graça, Lisboa"},
    {"name": "Miradouro de São Pedro de Alcântara", "description": "Jardim-miradouro no Bairro Alto com vista sobre a Baixa e o Castelo de São Jorge.", "region": "lisboa", "location": {"lat": 38.7156, "lng": -9.1447}, "address": "Rua de São Pedro de Alcântara, Lisboa"},
    {"name": "Miradouro da Penha de Águia", "description": "Vista vertiginosa sobre o vale da Ribeira da Janela e o oceano na Madeira.", "region": "madeira", "location": {"lat": 32.8083, "lng": -16.9417}, "address": "Faial, Madeira"},
    {"name": "Miradouro do Cabo Girão", "description": "Um dos mais altos cabos da Europa (580m), com plataforma de vidro sobre o Atlântico.", "region": "madeira", "location": {"lat": 32.6586, "lng": -17.0039}, "address": "Câmara de Lobos, Madeira"},
    {"name": "Miradouro da Vista do Rei", "description": "O mais famoso miradouro dos Açores, com vista sobre as lagoas das Sete Cidades.", "region": "acores", "location": {"lat": 37.8417, "lng": -25.7833}, "address": "Sete Cidades, São Miguel, Açores"},
    {"name": "Miradouro da Boca do Inferno", "description": "Vista dramática sobre as caldeiras vulcânicas de São Miguel.", "region": "acores", "location": {"lat": 37.8333, "lng": -25.7833}, "address": "Sete Cidades, São Miguel, Açores"},
    {"name": "Miradouro do Santuário de Santa Luzia", "description": "Vista panorâmica sobre Viana do Castelo, o rio Lima e o Atlântico desde o Monte de Santa Luzia.", "region": "norte", "location": {"lat": 41.7000, "lng": -8.8333}, "address": "Monte de Santa Luzia, Viana do Castelo"},
    {"name": "Miradouro de São Leonardo da Galafura", "description": "Considerado por Miguel Torga 'o melhor miradouro do mundo', com vista sobre o Douro vinhateiro.", "region": "norte", "location": {"lat": 41.1667, "lng": -7.7500}, "address": "São Leonardo da Galafura, Peso da Régua"},
    {"name": "Miradouro do Cabeço do Velho", "description": "Vista sobre a Serra da Estrela e as aldeias de montanha do centro de Portugal.", "region": "centro", "location": {"lat": 40.3833, "lng": -7.5333}, "address": "Guarda"},
    {"name": "Miradouro de São Gens", "description": "Vista panorâmica sobre a Serra do Alvão e o vale do Corgo.", "region": "norte", "location": {"lat": 41.3000, "lng": -7.7833}, "address": "Favaios, Alijó"},
    {"name": "Miradouro do Mezio", "description": "Porta de entrada do Parque Nacional da Peneda-Gerês com vista sobre a serra.", "region": "norte", "location": {"lat": 41.7167, "lng": -8.1000}, "address": "Arcos de Valdevez"},
    {"name": "Miradouro da Pedra Bela", "description": "Vista espetacular sobre as serras do Gerês desde uma formação rochosa natural.", "region": "norte", "location": {"lat": 41.7500, "lng": -8.1333}, "address": "Gerês, Terras de Bouro"},
    {"name": "Miradouro de Monsanto", "description": "Vista sobre a aldeia mais portuguesa de Portugal, encaixada entre penedos graníticos.", "region": "centro", "location": {"lat": 40.0389, "lng": -7.1139}, "address": "Monsanto, Idanha-a-Nova"},
]

# ========================
# CASCATAS
# ========================
CASCATAS = [
    {"name": "Cascata da Cabreia", "description": "Queda de água de cerca de 20 metros na Serra da Freita, rodeada de vegetação luxuriante.", "region": "norte", "location": {"lat": 40.7525, "lng": -8.3905}, "address": "Sever do Vouga, Aveiro"},
    {"name": "Cascata da Frecha da Mizarela", "description": "A cascata mais alta de Portugal continental com cerca de 60 metros de queda, na Serra da Freita.", "region": "norte", "location": {"lat": 40.8833, "lng": -8.2500}, "address": "Arouca, Aveiro"},
    {"name": "Cascata do Arado", "description": "Uma das cascatas mais bonitas do Gerês, com queda de 15 metros rodeada de natureza selvagem.", "region": "norte", "location": {"lat": 41.7333, "lng": -8.1333}, "address": "Gerês, Terras de Bouro"},
    {"name": "Cascata do Tahiti", "description": "Cascata paradisíaca escondida na serra, com piscina natural cristalina no Gerês.", "region": "norte", "location": {"lat": 41.7500, "lng": -8.1167}, "address": "Gerês, Terras de Bouro"},
    {"name": "Cascata de Pitões das Júnias", "description": "Queda de água junto às ruínas do Mosteiro de Santa Maria das Júnias, cenário medieval.", "region": "norte", "location": {"lat": 41.8333, "lng": -7.9333}, "address": "Pitões das Júnias, Montalegre"},
    {"name": "Cascata da Portela do Homem", "description": "Cascata na fronteira com Espanha, junto à antiga estrada romana no Gerês.", "region": "norte", "location": {"lat": 41.8000, "lng": -8.1167}, "address": "Gerês"},
    {"name": "Cascata de Fecha de Barjas", "description": "Cascata de 40 metros de altura no coração do Parque Nacional da Peneda-Gerês.", "region": "norte", "location": {"lat": 41.7667, "lng": -8.1000}, "address": "Gerês, Terras de Bouro"},
    {"name": "Cascata do Risco", "description": "Impressionante queda de água de 100 metros na Madeira, acessível por levada.", "region": "madeira", "location": {"lat": 32.7667, "lng": -17.1167}, "address": "Rabaçal, Madeira"},
    {"name": "Cascata das 25 Fontes", "description": "25 fios de água caem para uma lagoa de águas cristalinas, um dos postais da Madeira.", "region": "madeira", "location": {"lat": 32.7500, "lng": -17.1167}, "address": "Rabaçal, Madeira"},
    {"name": "Cascata do Caldeirão Verde", "description": "Espetacular cascata no coração da Laurissilva madeirense, acessível por levada.", "region": "madeira", "location": {"lat": 32.7833, "lng": -16.9167}, "address": "Santana, Madeira"},
    {"name": "Cascata da Fóia", "description": "Queda de água na serra algarvia, junto ao ponto mais alto do Algarve.", "region": "algarve", "location": {"lat": 37.3167, "lng": -8.5833}, "address": "Serra de Monchique, Algarve"},
    {"name": "Cascata de Paredes", "description": "Cascata no Geoparque de Arouca, perto dos famosos passadiços do Paiva.", "region": "norte", "location": {"lat": 40.9500, "lng": -8.2500}, "address": "Arouca"},
]

# ========================
# TASCAS E TABERNAS
# ========================
TASCAS = [
    {"name": "Tasca do Chico", "description": "Tasca típica no Bairro Alto onde se ouve fado espontâneo todas as noites. Ambiente autêntico e petiscos tradicionais.", "region": "lisboa", "location": {"lat": 38.7131, "lng": -9.1448}, "address": "Rua do Diário de Notícias 39, Lisboa"},
    {"name": "A Cevicheria do Sr. Silva", "description": "Taberna tradicional reinventada em Alfama, com vinhos naturais e petiscos modernos.", "region": "lisboa", "location": {"lat": 38.7111, "lng": -9.1311}, "address": "Alfama, Lisboa"},
    {"name": "Taberna da Rua das Flores", "description": "Petiscos gourmet numa antiga taberna do Porto. Vinhos do Douro e cozinha criativa.", "region": "norte", "location": {"lat": 41.1456, "lng": -8.6167}, "address": "Rua das Flores, Porto"},
    {"name": "Adega São Nicolau", "description": "Restaurante-taberna junto ao rio Douro, especialista em peixes e mariscos frescos do Porto.", "region": "norte", "location": {"lat": 41.1406, "lng": -8.6153}, "address": "Rua de São Nicolau 1, Porto"},
    {"name": "Tasca do Celso", "description": "Taberna centenária em Évora com enchidos alentejanos, queijos e vinhos da região.", "region": "alentejo", "location": {"lat": 38.5714, "lng": -7.9086}, "address": "Évora"},
    {"name": "Taberna Típica Quarta-Feira", "description": "Uma das mais antigas tabernas de Coimbra, frequentada por estudantes há gerações.", "region": "centro", "location": {"lat": 40.2089, "lng": -8.4261}, "address": "Coimbra"},
    {"name": "Adega do Albertino", "description": "Taberna tradicional em Viseu com petiscos da Beira Alta e vinhos do Dão.", "region": "centro", "location": {"lat": 40.6594, "lng": -7.9128}, "address": "Viseu"},
    {"name": "Tasca do Porto", "description": "Casa de petiscos tradicionais minhotos com presunto, queijo e broa de milho.", "region": "norte", "location": {"lat": 41.4417, "lng": -8.2917}, "address": "Guimarães"},
    {"name": "Taberna da Vila", "description": "Taberna algarvia com cataplanas, conquilhas e vinhos locais em Tavira.", "region": "algarve", "location": {"lat": 37.1247, "lng": -7.6506}, "address": "Tavira, Algarve"},
    {"name": "Adega Regional de Colares", "description": "Taberna histórica junto às vinhas de Colares, uma das regiões vinícolas mais antigas de Portugal.", "region": "lisboa", "location": {"lat": 38.8000, "lng": -9.4500}, "address": "Colares, Sintra"},
]

# ========================
# BALOICOS
# ========================
BALOICOS = [
    {"name": "Baloiço de São Lourenço", "description": "Baloiço panorâmico com vista sobre o vale do Minho e a fronteira com Espanha.", "region": "norte", "location": {"lat": 41.9500, "lng": -8.6500}, "address": "São Lourenço, Monção"},
    {"name": "Baloiço de Cinfães", "description": "Baloiço sobre o Douro com vista para a albufeira de Carrapatelo.", "region": "norte", "location": {"lat": 41.0667, "lng": -8.0833}, "address": "Cinfães"},
    {"name": "Baloiço da Nazaré", "description": "Baloiço no Sítio da Nazaré com vista sobre o oceano e as ondas gigantes.", "region": "centro", "location": {"lat": 39.6083, "lng": -9.0750}, "address": "Sítio da Nazaré"},
    {"name": "Baloiço de Santa Marta de Portuzelo", "description": "Vista panorâmica sobre Viana do Castelo e o estuário do Lima.", "region": "norte", "location": {"lat": 41.7167, "lng": -8.8500}, "address": "Santa Marta de Portuzelo, Viana"},
    {"name": "Baloiço do Miradouro de Linhares", "description": "Baloiço junto ao castelo medieval com vista sobre o vale do Mondego.", "region": "centro", "location": {"lat": 40.5333, "lng": -7.4500}, "address": "Linhares da Beira, Celorico"},
    {"name": "Baloiço de Arcos de Valdevez", "description": "Baloiço sobre o vale com vista para as montanhas do Soajo.", "region": "norte", "location": {"lat": 41.8500, "lng": -8.4167}, "address": "Arcos de Valdevez"},
    {"name": "Baloiço de Arouca", "description": "Baloiço junto aos passadiços do Paiva com vista sobre o geoparque.", "region": "norte", "location": {"lat": 40.9333, "lng": -8.2333}, "address": "Arouca"},
    {"name": "Baloiço da Serra de Montejunto", "description": "Baloiço com vista sobre o vale do Tejo e as planícies ribatejanas.", "region": "centro", "location": {"lat": 39.1667, "lng": -9.0500}, "address": "Serra de Montejunto, Alenquer"},
    {"name": "Baloiço de Castro Laboreiro", "description": "Baloiço nas alturas do Gerês com vista para a fronteira galega.", "region": "norte", "location": {"lat": 42.0333, "lng": -8.1500}, "address": "Castro Laboreiro, Melgaço"},
    {"name": "Baloiço do Marco de Canaveses", "description": "Vista sobre o Douro e as vinhas em socalcos do vale.", "region": "norte", "location": {"lat": 41.1833, "lng": -8.1500}, "address": "Marco de Canaveses"},
]

# ========================
# MOINHOS E AZENHAS
# ========================
MOINHOS = [
    {"name": "Moinhos de Gavinhos", "description": "Conjunto de moinhos de vento restaurados no alto da serra, com vista panorâmica.", "region": "norte", "location": {"lat": 41.1667, "lng": -8.1667}, "address": "Gavinhos, Penafiel"},
    {"name": "Azenhas do Mar", "description": "Aldeia icónica sobre as falésias com antigos moinhos de água junto ao Atlântico.", "region": "lisboa", "location": {"lat": 38.8417, "lng": -9.4583}, "address": "Azenhas do Mar, Sintra"},
    {"name": "Moinho de Maré de Corroios", "description": "Moinho de maré do século XV, um dos maiores e mais bem preservados da Península Ibérica.", "region": "lisboa", "location": {"lat": 38.6333, "lng": -9.1500}, "address": "Corroios, Seixal"},
    {"name": "Moinhos da Apúlia", "description": "Moinhos de vento tradicionais junto à praia, usados para moer milho e centeio.", "region": "norte", "location": {"lat": 41.4833, "lng": -8.7667}, "address": "Apúlia, Esposende"},
    {"name": "Moinhos do Folão", "description": "Conjunto de moinhos de água no vale do rio Este, testemunho da indústria moageira.", "region": "norte", "location": {"lat": 41.3500, "lng": -8.5167}, "address": "Braga"},
    {"name": "Moinho de Vento de Montedor", "description": "Moinho de vento restaurado com vista sobre a costa e as ilhas Cíes ao fundo.", "region": "norte", "location": {"lat": 41.7500, "lng": -8.8833}, "address": "Montedor, Viana do Castelo"},
    {"name": "Azenha de Santa Cruz", "description": "Antiga azenha (moinho de água) convertida em espaço museológico.", "region": "centro", "location": {"lat": 39.1333, "lng": -9.3833}, "address": "Santa Cruz, Torres Vedras"},
    {"name": "Moinhos da Serra da Atalhada", "description": "Conjunto de moinhos de vento restaurados na serra, com alojamento turístico.", "region": "centro", "location": {"lat": 39.5667, "lng": -8.0833}, "address": "Penela"},
    {"name": "Moinho de Odeceixe", "description": "Moinho de vento branco sobre as falésias da Costa Vicentina.", "region": "algarve", "location": {"lat": 37.4333, "lng": -8.8000}, "address": "Odeceixe, Aljezur"},
    {"name": "Moinhos de Palmela", "description": "Moinhos de vento no alto do castelo de Palmela com vista sobre a Arrábida.", "region": "lisboa", "location": {"lat": 38.5667, "lng": -8.9000}, "address": "Palmela, Setúbal"},
]

# ========================
# PARQUES DE AVENTURA
# ========================
AVENTURA = [
    {"name": "Parque Aventura Foja", "description": "Arborismo, escalada e slide na serra algarvia, com percursos para todas as idades.", "region": "algarve", "location": {"lat": 37.3167, "lng": -8.5333}, "address": "Serra de Monchique, Algarve"},
    {"name": "516 Arouca", "description": "A maior ponte suspensa pedonal do mundo (516m), sobre o rio Paiva a 175m de altura.", "region": "norte", "location": {"lat": 40.9667, "lng": -8.2333}, "address": "Arouca"},
    {"name": "Parque Aventura do Gerês", "description": "Canyoning, rafting e rappel no Parque Nacional da Peneda-Gerês.", "region": "norte", "location": {"lat": 41.7500, "lng": -8.1500}, "address": "Gerês"},
    {"name": "Parque Aventura Pedras Salgadas", "description": "Arborismo e atividades radicais no parque ecológico de Pedras Salgadas.", "region": "norte", "location": {"lat": 41.5167, "lng": -7.5833}, "address": "Pedras Salgadas, Vila Pouca de Aguiar"},
    {"name": "Skyglass Arouca", "description": "Passadiço de vidro sobre o vale do Paiva, experiência vertiginosa a 200m de altura.", "region": "norte", "location": {"lat": 40.9500, "lng": -8.2500}, "address": "Arouca"},
    {"name": "Parque Aventura de Peniche", "description": "Atividades náuticas, surf e coasteering na capital portuguesa do surf.", "region": "centro", "location": {"lat": 39.3500, "lng": -9.3833}, "address": "Peniche"},
    {"name": "Passadiços do Paiva", "description": "8 km de passadiços de madeira ao longo das margens do rio Paiva, percurso icónico.", "region": "norte", "location": {"lat": 40.9667, "lng": -8.2333}, "address": "Arouca"},
    {"name": "Parque Aventura da Tapada de Mafra", "description": "Arborismo e paintball na tapada real de Mafra, envolvido pela natureza.", "region": "lisboa", "location": {"lat": 38.9333, "lng": -9.3167}, "address": "Tapada de Mafra"},
    {"name": "Slide Center da Madeira", "description": "Descida em tobogã de 900 metros no Monte, tradição centenária da Madeira.", "region": "madeira", "location": {"lat": 32.6667, "lng": -16.9000}, "address": "Monte, Funchal, Madeira"},
    {"name": "Parque de Aventura de Santa Cruz", "description": "Escalada, rapel e arborismo junto à praia de Santa Cruz.", "region": "centro", "location": {"lat": 39.1333, "lng": -9.3833}, "address": "Santa Cruz, Torres Vedras"},
]

# ========================
# AREAS PROTEGIDAS
# ========================
AREAS_PROTEGIDAS = [
    {"name": "Parque Nacional da Peneda-Gerês", "description": "O único parque nacional de Portugal, com paisagens de montanha, cascatas e vida selvagem única. Lobos, cavalos garranos e águias reais.", "region": "norte", "location": {"lat": 41.7500, "lng": -8.1500}, "address": "Gerês, Minho"},
    {"name": "Parque Natural da Serra da Estrela", "description": "O ponto mais alto de Portugal continental, com paisagens glaciares, vale do Zêzere e o famoso queijo Serra da Estrela.", "region": "centro", "location": {"lat": 40.3217, "lng": -7.6114}, "address": "Serra da Estrela"},
    {"name": "Parque Natural de Sintra-Cascais", "description": "Paisagem cultural UNESCO com palácios românticos, florestas encantadas e falésias atlânticas.", "region": "lisboa", "location": {"lat": 38.7833, "lng": -9.4167}, "address": "Sintra - Cascais"},
    {"name": "Parque Natural do Sudoeste Alentejano e Costa Vicentina", "description": "A costa mais bem preservada da Europa, com falésias, praias selvagens e flora única.", "region": "alentejo", "location": {"lat": 37.5000, "lng": -8.8000}, "address": "Costa Vicentina"},
    {"name": "Parque Natural da Ria Formosa", "description": "Sistema lagunar de ilhas-barreira no Algarve, santuário de aves migratórias.", "region": "algarve", "location": {"lat": 37.0333, "lng": -7.8333}, "address": "Ria Formosa, Algarve"},
    {"name": "Parque Natural da Arrábida", "description": "Serra calcária com vegetação mediterrânica sobre praias de águas turquesas.", "region": "lisboa", "location": {"lat": 38.4833, "lng": -8.9833}, "address": "Serra da Arrábida, Setúbal"},
    {"name": "Reserva Natural do Estuário do Tejo", "description": "Uma das mais importantes zonas húmidas da Europa para aves migratórias.", "region": "lisboa", "location": {"lat": 38.8333, "lng": -8.9500}, "address": "Estuário do Tejo"},
    {"name": "Parque Natural de Montesinho", "description": "Terras selvagens de Trás-os-Montes com lobos, aldeias isoladas e tradições ancestrais.", "region": "norte", "location": {"lat": 41.9333, "lng": -6.8333}, "address": "Bragança"},
    {"name": "Parque Natural do Douro Internacional", "description": "Vales profundos do Douro na fronteira com Espanha, habitat do abutre-do-egito.", "region": "norte", "location": {"lat": 41.1667, "lng": -6.6667}, "address": "Miranda do Douro"},
    {"name": "Parque Natural do Alvão", "description": "Cascatas espetaculares (Fisgas de Ermelo) e paisagens de montanha entre Marão e Alvão.", "region": "norte", "location": {"lat": 41.3500, "lng": -7.8167}, "address": "Vila Real"},
    {"name": "Reserva Natural das Berlengas", "description": "Arquipélago granítico com águas cristalinas e forte de São João Baptista.", "region": "centro", "location": {"lat": 39.4167, "lng": -9.5083}, "address": "Berlengas, Peniche"},
    {"name": "Parque Natural do Vale do Guadiana", "description": "Paisagens do Baixo Alentejo com o Pulo do Lobo, a maior queda de água do sul.", "region": "alentejo", "location": {"lat": 37.8000, "lng": -7.6667}, "address": "Mértola"},
]

# ========================
# ROTAS TEMATICAS
# ========================
ROTAS = [
    {"name": "Rota dos Vinhos do Douro", "description": "Percurso pelas quintas vinícolas do Douro, Património Mundial, com provas e paisagens de socalcos.", "region": "norte", "location": {"lat": 41.1500, "lng": -7.7167}, "address": "Vale do Douro"},
    {"name": "Rota dos Vinhos do Alentejo", "description": "Visita a adegas e herdades alentejanas, com provas de vinho e gastronomia regional.", "region": "alentejo", "location": {"lat": 38.5714, "lng": -7.9086}, "address": "Alentejo"},
    {"name": "Rota da Cortiça", "description": "Descubra o montado alentejano e o processo de produção da cortiça portuguesa, líder mundial.", "region": "alentejo", "location": {"lat": 38.0000, "lng": -8.0000}, "address": "Alentejo"},
    {"name": "Rota dos Castelos do Mondego", "description": "Percurso pelos castelos medievais ao longo do rio Mondego, de Coimbra a Penacova.", "region": "centro", "location": {"lat": 40.2089, "lng": -8.4261}, "address": "Vale do Mondego"},
    {"name": "Rota do Românico", "description": "Percurso por igrejas e mosteiros românicos do vale do Sousa e Tâmega.", "region": "norte", "location": {"lat": 41.1833, "lng": -8.2833}, "address": "Vale do Sousa e Tâmega"},
    {"name": "Rota das Aldeias Históricas", "description": "Circuito pelas 12 Aldeias Históricas de Portugal, vilas medievais na fronteira da Beira.", "region": "centro", "location": {"lat": 40.3833, "lng": -7.1333}, "address": "Beira Interior"},
    {"name": "Rota dos Faróis", "description": "Percurso costeiro pelos faróis mais icónicos de Portugal, do Minho ao Algarve.", "region": "centro", "location": {"lat": 39.3667, "lng": -9.3667}, "address": "Costa Portuguesa"},
    {"name": "Rota da Lã", "description": "Descoberta da tradição da lã na Serra da Estrela, desde o pastor ao produto final.", "region": "centro", "location": {"lat": 40.3217, "lng": -7.6114}, "address": "Serra da Estrela"},
    {"name": "Rota dos Templários", "description": "Percurso pelos castelos e igrejas da Ordem dos Templários em Tomar e arredores.", "region": "centro", "location": {"lat": 39.6017, "lng": -8.4117}, "address": "Tomar"},
    {"name": "Rota do Contrabando", "description": "Percurso pelos caminhos do antigo contrabando na raia portuguesa, entre aldeias de montanha.", "region": "norte", "location": {"lat": 41.5000, "lng": -7.0000}, "address": "Trás-os-Montes"},
]

# ========================
# NARRATIVAS COMUNITARIAS
# ========================
COMUNIDADE = [
    {"name": "Aldeia Comunitária de Covas do Barroso", "description": "Primeira aldeia comunitária certificada pela FAO como Património Agrícola Mundial. Tradição de baldios e trabalho coletivo.", "region": "norte", "location": {"lat": 41.7000, "lng": -7.6500}, "address": "Covas do Barroso, Boticas"},
    {"name": "Projeto Tasa - Saberes e Sabores", "description": "Rede de artesãos e produtores locais que preservam técnicas tradicionais e gastronomia regional.", "region": "centro", "location": {"lat": 40.2089, "lng": -8.4261}, "address": "Coimbra"},
    {"name": "Aldeias de Montanha do Gerês", "description": "Comunidades serranas que mantêm práticas agrícolas ancestrais e festividades tradicionais.", "region": "norte", "location": {"lat": 41.8333, "lng": -7.9333}, "address": "Pitões das Júnias, Montalegre"},
    {"name": "Cooperativa dos Baldios de Vilarinho das Furnas", "description": "Memória da aldeia submersa pela barragem, com tradição comunitária de gestão de terras.", "region": "norte", "location": {"lat": 41.7333, "lng": -8.1167}, "address": "Vilarinho das Furnas, Terras de Bouro"},
    {"name": "Rede das Aldeias do Xisto", "description": "Projeto de revitalização de 27 aldeias de xisto com turismo sustentável e comunitário.", "region": "centro", "location": {"lat": 40.1000, "lng": -8.2333}, "address": "Serra da Lousã"},
    {"name": "Mercado da Terra de Avis", "description": "Mercado Slow Food onde produtores locais vendem diretamente ao consumidor.", "region": "alentejo", "location": {"lat": 39.0500, "lng": -7.8833}, "address": "Avis, Alentejo"},
    {"name": "Projeto Biovilla", "description": "Ecoaldeia sustentável na Arrábida com agricultura regenerativa e turismo comunitário.", "region": "lisboa", "location": {"lat": 38.5167, "lng": -8.9167}, "address": "Palmela, Setúbal"},
    {"name": "Associação In Loco - Serra do Caldeirão", "description": "Desenvolvimento comunitário na serra algarvia, preservando tradições e produtos locais.", "region": "algarve", "location": {"lat": 37.2833, "lng": -7.9167}, "address": "Serra do Caldeirão, Algarve"},
    {"name": "Terras de Còa", "description": "Comunidade que preserva as gravuras rupestres do Vale do Côa e promove turismo arqueológico.", "region": "norte", "location": {"lat": 41.0833, "lng": -7.1167}, "address": "Vila Nova de Foz Côa"},
    {"name": "Cooperativa de Mértola", "description": "Projeto comunitário de revitalização da vila histórica e do património islâmico.", "region": "alentejo", "location": {"lat": 37.6500, "lng": -7.6667}, "address": "Mértola"},
]


def create_item(data: dict, category: str, index: int = 0) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "description": data["description"],
        "category": category,
        "subcategory": data.get("subcategory"),
        "region": data["region"],
        "location": data.get("location"),
        "address": data.get("address"),
        "image_url": get_image(category, index),
        "tags": data.get("tags", [category, data["region"]]),
        "metadata": data.get("metadata", {}),
        "created_at": datetime.now(timezone.utc),
    }


async def seed_empty_categories():
    """Seed the 9 previously empty categories with POI data."""
    print("Seeding 9 empty categories...")

    datasets = [
        ("miradouros", MIRADOUROS),
        ("cascatas", CASCATAS),
        ("tascas", TASCAS),
        ("baloicos", BALOICOS),
        ("moinhos", MOINHOS),
        ("aventura", AVENTURA),
        ("areas_protegidas", AREAS_PROTEGIDAS),
        ("rotas", ROTAS),
        ("comunidade", COMUNIDADE),
    ]

    all_items = []
    for category, data_list in datasets:
        print(f"  Preparing {category}: {len(data_list)} items")
        for i, item in enumerate(data_list):
            all_items.append(create_item(item, category, i))

    if all_items:
        await db.heritage_items.insert_many(all_items)
        print(f"\nInserted {len(all_items)} items across 9 categories.")

    # Summary
    print("\nSummary:")
    for category, data_list in datasets:
        count = await db.heritage_items.count_documents({"category": category})
        print(f"  {category}: {count} items")

    total = await db.heritage_items.count_documents({})
    print(f"\nTotal heritage items in database: {total}")


if __name__ == "__main__":
    asyncio.run(seed_empty_categories())
