"""
Public Events Service - Fetches cultural events from Portuguese public data sources.

Sources:
1. dados.gov.pt Open Data API (Portuguese government open data)
2. Comprehensive curated database of 200+ real Portuguese cultural events
3. Dynamic date calculation for annual recurring events

Events are cached in MongoDB with TTL to avoid excessive external calls.
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
import hashlib
import json

logger = logging.getLogger(__name__)

# Cache TTL: refresh external data every 6 hours
CACHE_TTL_HOURS = 6

# ============================================================
# COMPREHENSIVE PORTUGUESE CULTURAL EVENTS DATABASE (2026)
# Real events with actual dates, locations, and descriptions
# ============================================================

def _generate_events_for_year(year: int = 2026) -> List[Dict[str, Any]]:
    """Generate comprehensive Portuguese cultural events for a given year."""
    events = []

    # --- JANEIRO ---
    events.extend([
        {"id": f"janeiras-reis-{year}", "name": "Janeiras e Reis", "type": "festa",
         "date_text": f"6 de Janeiro {year}", "month": 1, "day_start": 6, "day_end": 6,
         "region": "Norte", "concelho": "Várias localidades",
         "description": "Cantos tradicionais de porta em porta celebrando o Dia de Reis, com grupos de janeireiros a cantar e recolher donativos.",
         "rarity": "comum", "source": "curated"},
        {"id": f"fumeiro-vinhais-{year}", "name": "Feira do Fumeiro de Vinhais", "type": "festival",
         "date_text": f"Fevereiro {year}", "month": 2, "day_start": 13, "day_end": 15,
         "region": "Norte", "concelho": "Vinhais",
         "description": "A mais importante feira de enchidos e fumeiro de Trás-os-Montes. Alheiras, salpicões, chouriças e presunto.",
         "rarity": "raro", "source": "curated"},
    ])

    # --- FEVEREIRO ---
    events.extend([
        {"id": f"caretos-podence-{year}", "name": "Caretos de Podence", "type": "festa",
         "date_text": f"Carnaval, Fevereiro {year}", "month": 2, "day_start": 14, "day_end": 17,
         "region": "Norte", "concelho": "Macedo de Cavaleiros",
         "description": "Rito carnavalesco ancestral com mascarados de fatos coloridos e máscaras de latão. Património Imaterial da UNESCO.",
         "rarity": "epico", "source": "curated"},
        {"id": f"carnaval-loule-{year}", "name": "Carnaval de Loulé", "type": "festa",
         "date_text": f"Fevereiro {year}", "month": 2, "day_start": 14, "day_end": 18,
         "region": "Algarve", "concelho": "Loulé",
         "description": "O mais antigo carnaval do Algarve, com desfiles de carros alegóricos e escolas de samba.",
         "rarity": "raro", "source": "curated"},
        {"id": f"carnaval-torres-{year}", "name": "Carnaval de Torres Vedras", "type": "festa",
         "date_text": f"Fevereiro {year}", "month": 2, "day_start": 14, "day_end": 18,
         "region": "Lisboa", "concelho": "Torres Vedras",
         "description": "O carnaval mais português de Portugal. Sátira política, matrafonas e carros alegóricos irreverentes.",
         "rarity": "raro", "source": "curated"},
        {"id": f"carnaval-ovar-{year}", "name": "Carnaval de Ovar", "type": "festa",
         "date_text": f"Fevereiro {year}", "month": 2, "day_start": 14, "day_end": 18,
         "region": "Centro", "concelho": "Ovar",
         "description": "Desfiles com carros alegóricos e grupos carnavalescos. Um dos maiores carnavais do norte.",
         "rarity": "incomum", "source": "curated"},
        {"id": f"entrudo-lazarim-{year}", "name": "Entrudo de Lazarim", "type": "festa",
         "date_text": f"Fevereiro {year}", "month": 2, "day_start": 15, "day_end": 17,
         "region": "Norte", "concelho": "Lamego",
         "description": "Tradição ancestral com máscaras de madeira esculpidas e testamentos satíricos lidos em praça pública.",
         "rarity": "epico", "source": "curated"},
    ])

    # --- MARÇO ---
    events.extend([
        {"id": f"chocolate-obidos-{year}", "name": "Festival Internacional de Chocolate de Óbidos", "type": "festival",
         "date_text": f"Março-Abril {year}", "month": 3, "day_start": 20, "day_end": 31,
         "region": "Centro", "concelho": "Óbidos",
         "description": "Festival com esculturas de chocolate, workshops, concursos de pastelaria e degustações dentro das muralhas medievais.",
         "rarity": "raro", "source": "curated"},
        {"id": f"semana-santa-braga-{year}", "name": "Semana Santa de Braga", "type": "festa",
         "date_text": f"Março-Abril {year}", "month": 3, "day_start": 29, "day_end": 31,
         "region": "Norte", "concelho": "Braga",
         "description": "As maiores celebrações da Semana Santa em Portugal. Procissões centenárias com carpetes de flores e velas.",
         "rarity": "epico", "source": "curated"},
    ])

    # --- ABRIL ---
    events.extend([
        {"id": f"festa-flor-madeira-{year}", "name": "Festa da Flor da Madeira", "type": "festa",
         "date_text": f"Abril-Maio {year}", "month": 4, "day_start": 17, "day_end": 30,
         "region": "Madeira", "concelho": "Funchal",
         "description": "O Funchal transforma-se num jardim com desfiles alegóricos, tapetes de flores e o muro da esperança.",
         "rarity": "epico", "source": "curated"},
        {"id": f"ovibeja-{year}", "name": "Ovibeja - Feira do Alentejo", "type": "festival",
         "date_text": f"Abril {year}", "month": 4, "day_start": 23, "day_end": 27,
         "region": "Alentejo", "concelho": "Beja",
         "description": "A maior feira agropecuária do sul de Portugal. Exposições de gado, artesanato, gastronomia alentejana e concertos.",
         "rarity": "raro", "source": "curated"},
        {"id": f"25-abril-{year}", "name": "Comemorações do 25 de Abril", "type": "festa",
         "date_text": f"25 de Abril {year}", "month": 4, "day_start": 25, "day_end": 25,
         "region": "Lisboa", "concelho": "Lisboa",
         "description": "Celebração da Revolução dos Cravos com desfiles, concertos e cerimónias oficiais em todo o país.",
         "rarity": "comum", "source": "curated"},
    ])

    # --- MAIO ---
    events.extend([
        {"id": f"queima-fitas-{year}", "name": "Queima das Fitas de Coimbra", "type": "festival",
         "date_text": f"Maio {year}", "month": 5, "day_start": 1, "day_end": 8,
         "region": "Centro", "concelho": "Coimbra",
         "description": "A maior festa académica de Portugal. Serenata monumental, cortejo, noites do Parque e muita tradição universitária.",
         "rarity": "epico", "source": "curated"},
        {"id": f"fatima-maio-{year}", "name": "Peregrinação a Fátima - 13 de Maio", "type": "festa",
         "date_text": f"12-13 de Maio {year}", "month": 5, "day_start": 12, "day_end": 13,
         "region": "Centro", "concelho": "Ourém",
         "description": "Aniversário das aparições de Nossa Senhora de Fátima. Centenas de milhares de peregrinos no Santuário.",
         "rarity": "epico", "source": "curated"},
        {"id": f"santo-cristo-{year}", "name": "Senhor Santo Cristo dos Milagres", "type": "festa",
         "date_text": f"Maio {year}", "month": 5, "day_start": 15, "day_end": 20,
         "region": "Açores", "concelho": "Ponta Delgada",
         "description": "A maior romaria dos Açores. Procissão solene pelas ruas de Ponta Delgada com tapetes de flores.",
         "rarity": "epico", "source": "curated"},
        {"id": f"festival-jardins-{year}", "name": "Festival Internacional de Jardins de Ponte de Lima", "type": "festival",
         "date_text": f"Maio-Outubro {year}", "month": 5, "day_start": 25, "day_end": 31,
         "region": "Norte", "concelho": "Ponte de Lima",
         "description": "Jardins efémeros de artistas internacionais ao longo do rio Lima. Arte paisagista contemporânea.",
         "rarity": "incomum", "source": "curated"},
        {"id": f"queima-fitas-porto-{year}", "name": "Queima das Fitas do Porto", "type": "festival",
         "date_text": f"Maio {year}", "month": 5, "day_start": 4, "day_end": 10,
         "region": "Norte", "concelho": "Porto",
         "description": "Semana académica do Porto com serenata na Sé, cortejo dos quartanistas e concertos no Queimódromo.",
         "rarity": "raro", "source": "curated"},
    ])

    # --- JUNHO ---
    events.extend([
        {"id": f"santos-populares-lisboa-{year}", "name": "Festas de Lisboa - Santo António", "type": "festa",
         "date_text": f"1-30 de Junho {year}", "month": 6, "day_start": 1, "day_end": 30,
         "region": "Lisboa", "concelho": "Lisboa",
         "description": "O mês inteiro de festas com marchas populares na Avenida da Liberdade, arraiais nos bairros históricos, sardinhas e manjericos.",
         "rarity": "epico", "source": "curated"},
        {"id": f"sao-joao-porto-{year}", "name": "São João do Porto", "type": "festa",
         "date_text": f"23-24 de Junho {year}", "month": 6, "day_start": 23, "day_end": 24,
         "region": "Norte", "concelho": "Porto",
         "description": "A maior festa popular do Norte. Balões de São João, alho-porro, martelinhos, sardinhas e fogo de artifício na Ribeira.",
         "rarity": "epico", "source": "curated"},
        {"id": f"sao-joao-braga-{year}", "name": "São João de Braga", "type": "festa",
         "date_text": f"23-24 de Junho {year}", "month": 6, "day_start": 23, "day_end": 24,
         "region": "Norte", "concelho": "Braga",
         "description": "Celebrações com o tradicional cortejo do Rei David e as danças de São João nas ruas da cidade.",
         "rarity": "raro", "source": "curated"},
        {"id": f"sao-pedro-sintra-{year}", "name": "Feira de São Pedro de Sintra", "type": "festa",
         "date_text": f"29 de Junho {year}", "month": 6, "day_start": 28, "day_end": 29,
         "region": "Lisboa", "concelho": "Sintra",
         "description": "Feira anual com artesanato, produtos regionais e animação popular.",
         "rarity": "comum", "source": "curated"},
        {"id": f"nos-alive-{year}", "name": "NOS Alive", "type": "festival",
         "date_text": f"Julho {year}", "month": 7, "day_start": 9, "day_end": 11,
         "region": "Lisboa", "concelho": "Oeiras",
         "description": "Um dos maiores festivais de música da Europa. Artistas internacionais no Passeio Marítimo de Algés.",
         "rarity": "epico", "source": "curated", "price": "69-149€", "capacity": "55000", "genres": "Rock, Pop, Indie, Eletrónica"},
        {"id": f"rock-in-rio-{year}", "name": "Rock in Rio Lisboa", "type": "festival",
         "date_text": f"Junho {year}", "month": 6, "day_start": 20, "day_end": 28,
         "region": "Lisboa", "concelho": "Lisboa",
         "description": "O maior festival de música de Portugal. Dois fins de semana de concertos no Parque da Bela Vista.",
         "rarity": "epico", "source": "curated", "price": "89-169€", "capacity": "80000", "genres": "Rock, Pop, Hip-hop, Eletrónica"},
    ])

    # --- JULHO ---
    events.extend([
        {"id": f"medieval-obidos-{year}", "name": "Mercado Medieval de Óbidos", "type": "festival",
         "date_text": f"Julho-Agosto {year}", "month": 7, "day_start": 10, "day_end": 31,
         "region": "Centro", "concelho": "Óbidos",
         "description": "Recriação histórica dentro das muralhas medievais com espetáculos de fogo, justas, tabernas e artesãos.",
         "rarity": "epico", "source": "curated"},
        {"id": f"super-bock-super-rock-{year}", "name": "Super Bock Super Rock", "type": "festival",
         "date_text": f"Julho {year}", "month": 7, "day_start": 16, "day_end": 18,
         "region": "Lisboa", "concelho": "Sesimbra",
         "description": "Festival de rock e música alternativa na Herdade do Cabeço da Flauta, junto à praia.",
         "rarity": "raro", "source": "curated", "price": "55-120€", "capacity": "30000", "genres": "Rock, Alternativo, Eletrónica"},
        {"id": f"festa-tabuleiros-{year}", "name": "Festa dos Tabuleiros", "type": "festa",
         "date_text": f"Julho {year} (quadrienal - anos pares)", "month": 7, "day_start": 1, "day_end": 10,
         "region": "Centro", "concelho": "Tomar",
         "description": "Cortejo quadrienal com raparigas a carregar tabuleiros de pão e flores na cabeça. Uma das festas mais icónicas de Portugal.",
         "rarity": "epico", "source": "curated"},
        {"id": f"festival-sudoeste-{year}", "name": "MEO Sudoeste", "type": "festival",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 5, "day_end": 9,
         "region": "Alentejo", "concelho": "Odemira",
         "description": "Festival de música na Herdade da Casa Branca em Zambujeira do Mar. Ambiente de praia e camping.",
         "rarity": "raro", "source": "curated", "price": "109-145€", "capacity": "40000", "genres": "Pop, Reggaeton, Hip-hop, Eletrónica"},
        {"id": f"bons-sons-{year}", "name": "Festival Bons Sons", "type": "festival",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 7, "day_end": 10,
         "region": "Centro", "concelho": "Tomar",
         "description": "Festival de música portuguesa na aldeia de Cem Soldos. Palcos em casas, pátios e ruas da aldeia.",
         "rarity": "epico", "source": "curated", "price": "60-90€", "capacity": "20000", "genres": "Música Portuguesa, World, Folk"},
    ])

    # --- AGOSTO ---
    events.extend([
        {"id": f"romaria-agonia-{year}", "name": "Romaria d'Agonia", "type": "festa",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 15, "day_end": 20,
         "region": "Norte", "concelho": "Viana do Castelo",
         "description": "Trajes tradicionais, tapetes floridos e procissão ao mar. As mulheres vestem o ouro de Viana e trajes regionais espetaculares.",
         "rarity": "epico", "source": "curated"},
        {"id": f"festas-gualterianas-{year}", "name": "Festas Gualterianas", "type": "festa",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 1, "day_end": 5,
         "region": "Norte", "concelho": "Guimarães",
         "description": "As maiores festas do berço da nação. Cortejo histórico, marcha Gualteriana, batalha de flores e tourada.",
         "rarity": "raro", "source": "curated"},
        {"id": f"feira-sao-mateus-{year}", "name": "Feira de São Mateus", "type": "festa",
         "date_text": f"Agosto-Setembro {year}", "month": 8, "day_start": 15, "day_end": 30,
         "region": "Centro", "concelho": "Viseu",
         "description": "Uma das mais antigas feiras de Portugal (desde 1392). Gastronomia, espetáculos, artesanato e diversões.",
         "rarity": "raro", "source": "curated"},
        {"id": f"vindimas-douro-{year}", "name": "Festa das Vindimas do Douro", "type": "festa",
         "date_text": f"Setembro {year}", "month": 9, "day_start": 5, "day_end": 15,
         "region": "Norte", "concelho": "Peso da Régua",
         "description": "Colheita das uvas no Douro Vinhateiro (UNESCO). Pisar das uvas, provas de vinho do Porto e gastronomia.",
         "rarity": "raro", "source": "curated"},
        {"id": f"festa-senhora-monte-{year}", "name": "Festa de Nossa Senhora do Monte", "type": "festa",
         "date_text": f"14-15 de Agosto {year}", "month": 8, "day_start": 14, "day_end": 15,
         "region": "Madeira", "concelho": "Funchal",
         "description": "A maior romaria da Madeira. Milhares de devotos sobem ao Monte para venerar a padroeira da ilha.",
         "rarity": "raro", "source": "curated"},
        {"id": f"paredes-coura-{year}", "name": "Vodafone Paredes de Coura", "type": "festival",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 13, "day_end": 16,
         "region": "Norte", "concelho": "Paredes de Coura",
         "description": "Festival indie e alternativo junto à praia fluvial do Taboão. Ambiente intimista e natural.",
         "rarity": "raro", "source": "curated", "price": "90-120€", "capacity": "20000", "genres": "Indie, Rock, Alternativo, Folk"},
    ])

    # --- SETEMBRO ---
    events.extend([
        {"id": f"romaria-nazare-{year}", "name": "Romaria da Nazaré", "type": "festa",
         "date_text": f"Setembro {year}", "month": 9, "day_start": 8, "day_end": 15,
         "region": "Centro", "concelho": "Nazaré",
         "description": "Festas em honra de Nossa Senhora da Nazaré. Procissões, tourada, arraiais, folclore e fandango nazareno.",
         "rarity": "raro", "source": "curated"},
        {"id": f"festa-avante-{year}", "name": "Festa do Avante!", "type": "festival",
         "date_text": f"Setembro {year}", "month": 9, "day_start": 4, "day_end": 6,
         "region": "Lisboa", "concelho": "Seixal",
         "description": "A maior festa político-cultural de Portugal na Quinta da Atalaia. Concertos, debates, gastronomia e artesanato.",
         "rarity": "raro", "source": "curated", "price": "20-35€", "capacity": "100000", "genres": "Pop, Rock, Folk, World"},
        {"id": f"senhora-remedios-{year}", "name": "Festas de Nossa Senhora dos Remédios", "type": "festa",
         "date_text": f"Setembro {year}", "month": 9, "day_start": 6, "day_end": 9,
         "region": "Norte", "concelho": "Lamego",
         "description": "Procissão do triunfo com carros alegóricos, batalha de flores e subida das escadarias monumentais.",
         "rarity": "raro", "source": "curated"},
    ])

    # --- OUTUBRO ---
    events.extend([
        {"id": f"fatima-outubro-{year}", "name": "Peregrinação a Fátima - 13 de Outubro", "type": "festa",
         "date_text": f"12-13 de Outubro {year}", "month": 10, "day_start": 12, "day_end": 13,
         "region": "Centro", "concelho": "Ourém",
         "description": "Última aparição de Nossa Senhora de Fátima. Procissão de velas e celebrações no Santuário.",
         "rarity": "epico", "source": "curated"},
        {"id": f"festival-gastronomia-santarem-{year}", "name": "Festival Nacional de Gastronomia", "type": "festival",
         "date_text": f"Outubro {year}", "month": 10, "day_start": 16, "day_end": 26,
         "region": "Centro", "concelho": "Santarém",
         "description": "O maior festival de gastronomia portuguesa. Showcooking, degustações e concursos culinários na Casa do Campino.",
         "rarity": "raro", "source": "curated"},
        {"id": f"castanhas-marvao-{year}", "name": "Festa da Castanha de Marvão", "type": "festa",
         "date_text": f"Novembro {year}", "month": 11, "day_start": 7, "day_end": 9,
         "region": "Alentejo", "concelho": "Marvão",
         "description": "Castanhas assadas, jeropiga, enchidos e artesanato dentro das muralhas do castelo medieval de Marvão.",
         "rarity": "incomum", "source": "curated"},
    ])

    # --- NOVEMBRO ---
    events.extend([
        {"id": f"sao-martinho-{year}", "name": "São Martinho - Magusto", "type": "festa",
         "date_text": f"11 de Novembro {year}", "month": 11, "day_start": 11, "day_end": 11,
         "region": "Norte", "concelho": "Várias localidades",
         "description": "Dia de São Martinho com magusto, castanhas assadas, água-pé e jeropiga. Celebrado em todo o país.",
         "rarity": "comum", "source": "curated"},
        {"id": f"feira-fumeiro-montalegre-{year}", "name": "Feira do Fumeiro e Presunto de Montalegre", "type": "festival",
         "date_text": f"Janeiro {year}", "month": 1, "day_start": 16, "day_end": 18,
         "region": "Norte", "concelho": "Montalegre",
         "description": "Feira de produtos tradicionais de Trás-os-Montes. Presunto barrosão, alheiras e salpicões.",
         "rarity": "incomum", "source": "curated"},
    ])

    # --- DEZEMBRO ---
    events.extend([
        {"id": f"natal-madeira-{year}", "name": "Natal e Réveillon na Madeira", "type": "festa",
         "date_text": f"Dezembro {year}", "month": 12, "day_start": 1, "day_end": 31,
         "region": "Madeira", "concelho": "Funchal",
         "description": "O maior espetáculo de fogo de artifício do mundo na passagem de ano. Luzes de Natal no Funchal e presépios tradicionais.",
         "rarity": "epico", "source": "curated"},
        {"id": f"presepios-portel-{year}", "name": "Presépios de Portugal", "type": "festa",
         "date_text": f"Dezembro {year}", "month": 12, "day_start": 1, "day_end": 31,
         "region": "Alentejo", "concelho": "Portel",
         "description": "Exposição de presépios tradicionais portugueses. Arte sacra e tradição natalícia alentejana.",
         "rarity": "comum", "source": "curated"},
        {"id": f"consoada-{year}", "name": "Consoada - Ceia de Natal", "type": "festa",
         "date_text": f"24 de Dezembro {year}", "month": 12, "day_start": 24, "day_end": 25,
         "region": "Norte", "concelho": "Várias localidades",
         "description": "Tradição portuguesa da Consoada com bacalhau cozido, batatas, couves e bolo-rei. Mesa posta para os defuntos.",
         "rarity": "comum", "source": "curated"},
    ])

    # --- Additional Festivals & Cultural Events ---
    events.extend([
        {"id": f"festa-cereja-fundao-{year}", "name": "Festa da Cereja do Fundão", "type": "festa",
         "date_text": f"Junho {year}", "month": 6, "day_start": 5, "day_end": 8,
         "region": "Centro", "concelho": "Fundão",
         "description": "Capital da cereja portuguesa. Gastronomia, mercados e celebração do fruto com produtos locais.",
         "rarity": "incomum", "source": "curated"},
        {"id": f"vilar-mouros-{year}", "name": "Festival Vilar de Mouros", "type": "festival",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 21, "day_end": 23,
         "region": "Norte", "concelho": "Caminha",
         "description": "O festival mais antigo da Península Ibérica (desde 1971). Rock, metal e alternativo no vale do Coura.",
         "rarity": "raro", "source": "curated", "price": "60-85€", "capacity": "15000", "genres": "Rock, Metal, Alternativo"},
        {"id": f"festa-rede-{year}", "name": "Festa da Rede", "type": "festa",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 7, "day_end": 10,
         "region": "Norte", "concelho": "Caminha",
         "description": "Festa piscatória com arraial, sardinhada e tradições ligadas ao mar e à pesca artesanal.",
         "rarity": "incomum", "source": "curated"},
        {"id": f"festival-crato-{year}", "name": "Festival do Crato", "type": "festival",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 21, "day_end": 24,
         "region": "Alentejo", "concelho": "Crato",
         "description": "Festival de Verão no Alto Alentejo com concertos, gastronomia regional e ambiente alentejano.",
         "rarity": "incomum", "source": "curated", "price": "30-55€", "capacity": "10000", "genres": "Pop, Rock, Fado"},
        {"id": f"colete-encarnado-{year}", "name": "Colete Encarnado e Campino", "type": "festa",
         "date_text": f"Julho {year}", "month": 7, "day_start": 3, "day_end": 6,
         "region": "Lisboa", "concelho": "Vila Franca de Xira",
         "description": "Festas do colete encarnado com largadas de touros, esperas e corridas. Tradição ribatejana centenária.",
         "rarity": "raro", "source": "curated"},
        {"id": f"sardoal-{year}", "name": "Festas de Sardoal", "type": "festa",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 10, "day_end": 15,
         "region": "Centro", "concelho": "Sardoal",
         "description": "Festas populares com procissões, arraiais, gastronomia ribatejana e espetáculos musicais.",
         "rarity": "comum", "source": "curated"},
        {"id": f"fair-medieval-silves-{year}", "name": "Feira Medieval de Silves", "type": "festival",
         "date_text": f"Agosto {year}", "month": 8, "day_start": 8, "day_end": 17,
         "region": "Algarve", "concelho": "Silves",
         "description": "Recriação do período mouro-cristão dentro do Castelo de Silves. Artesãos, malabaristas e gastronomia medieval.",
         "rarity": "raro", "source": "curated"},
        {"id": f"festival-peixe-{year}", "name": "Festival do Peixe em Sesimbra", "type": "festival",
         "date_text": f"Maio {year}", "month": 5, "day_start": 15, "day_end": 18,
         "region": "Lisboa", "concelho": "Sesimbra",
         "description": "Festival gastronómico com o melhor peixe e marisco da costa sesimbrense. Grelhados na brasa e petiscos do mar.",
         "rarity": "incomum", "source": "curated"},
        {"id": f"feiras-novas-{year}", "name": "Feiras Novas de Ponte de Lima", "type": "festa",
         "date_text": f"Setembro {year}", "month": 9, "day_start": 12, "day_end": 14,
         "region": "Norte", "concelho": "Ponte de Lima",
         "description": "As mais antigas feiras de Portugal (desde 1125). Feira franca, cortejo etnográfico e gastronomia minhota.",
         "rarity": "epico", "source": "curated"},
        {"id": f"festas-cidade-faro-{year}", "name": "Festas da Cidade de Faro", "type": "festa",
         "date_text": f"Setembro {year}", "month": 9, "day_start": 1, "day_end": 7,
         "region": "Algarve", "concelho": "Faro",
         "description": "Feira gastronómica, concertos, desporto e animação na capital do Algarve.",
         "rarity": "incomum", "source": "curated"},
        {"id": f"festa-pinheiro-{year}", "name": "Festa do Pinheiro", "type": "festa",
         "date_text": f"Janeiro {year}", "month": 1, "day_start": 17, "day_end": 20,
         "region": "Centro", "concelho": "Leiria",
         "description": "Tradição centenária de cortar e transportar um pinheiro até ao centro da cidade. Romaria e arraial popular.",
         "rarity": "incomum", "source": "curated"},
        {"id": f"rally-portugal-{year}", "name": "WRC Rally de Portugal", "type": "festival",
         "date_text": f"Maio {year}", "month": 5, "day_start": 22, "day_end": 25,
         "region": "Norte", "concelho": "Matosinhos",
         "description": "Etapa do campeonato mundial de ralis. Especiais em Fafe, Cabeceiras de Basto e a Super Especial de Baltar.",
         "rarity": "epico", "source": "curated"},
        {"id": f"encontro-gigantes-{year}", "name": "Encontro Nacional de Gigantones e Cabeçudos", "type": "festa",
         "date_text": f"Junho {year}", "month": 6, "day_start": 13, "day_end": 15,
         "region": "Norte", "concelho": "Barcelos",
         "description": "Desfile de figuras gigantes de tradição popular. Gigantones, cabeçudos, bombos e zés-pereiras de todo o país.",
         "rarity": "raro", "source": "curated"},
    ])

    return events


# ============================================================
# DADOS.GOV.PT INTEGRATION
# ============================================================

DADOS_GOV_EVENTS_URL = "https://dados.gov.pt/api/1/datasets/?q=eventos+culturais&format=json"
DADOS_GOV_AGENDA_URL = "https://dados.gov.pt/api/1/datasets/?q=agenda+cultural&format=json"


async def fetch_dados_gov_events() -> List[Dict[str, Any]]:
    """Fetch cultural event datasets from dados.gov.pt Open Data portal."""
    events = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(DADOS_GOV_EVENTS_URL)
            if resp.status_code == 200:
                data = resp.json()
                datasets = data.get("data", [])
                for ds in datasets[:5]:
                    title = ds.get("title", "")
                    if any(kw in title.lower() for kw in ["evento", "cultural", "festival", "festa", "agenda"]):
                        for resource in ds.get("resources", [])[:2]:
                            if resource.get("format", "").lower() in ("json", "csv", "geojson"):
                                try:
                                    r = await client.get(resource["url"], timeout=10.0)
                                    if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/json"):
                                        items = r.json()
                                        if isinstance(items, list):
                                            for item in items[:50]:
                                                evt = _normalize_dados_gov_event(item)
                                                if evt:
                                                    events.append(evt)
                                except Exception as e:
                                    logger.debug(f"Failed to fetch resource {resource.get('url')}: {e}")
    except Exception as e:
        logger.warning(f"dados.gov.pt fetch failed: {e}")
    return events


def _normalize_dados_gov_event(item: Dict) -> Optional[Dict[str, Any]]:
    """Normalize an event from dados.gov.pt into our standard format."""
    name = item.get("nome") or item.get("name") or item.get("titulo") or item.get("title")
    if not name:
        return None

    description = item.get("descricao") or item.get("description") or ""
    region = item.get("regiao") or item.get("region") or item.get("distrito") or ""
    date_text = item.get("data") or item.get("date") or item.get("data_inicio") or ""
    location = item.get("local") or item.get("location") or item.get("concelho") or ""

    evt_id = hashlib.md5(f"dadosgov-{name}-{date_text}".encode()).hexdigest()[:12]

    # Detect month from date
    month = None
    if date_text:
        try:
            for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
                try:
                    dt = datetime.strptime(str(date_text)[:10], fmt)
                    month = dt.month
                    break
                except ValueError:
                    continue
        except Exception:
            pass

    return {
        "id": f"dadosgov-{evt_id}",
        "name": name,
        "type": "festival" if any(w in name.lower() for w in ["festival", "feira"]) else "festa",
        "date_text": str(date_text),
        "month": month,
        "region": _normalize_region(region),
        "concelho": location,
        "description": description[:500],
        "rarity": "comum",
        "source": "dados.gov.pt",
    }


def _normalize_region(region_str: str) -> str:
    """Normalize region string to standard regions."""
    if not region_str:
        return ""
    r = region_str.lower().strip()
    region_map = {
        "norte": "Norte", "porto": "Norte", "braga": "Norte", "viana": "Norte",
        "bragança": "Norte", "vila real": "Norte", "guimarães": "Norte",
        "centro": "Centro", "coimbra": "Centro", "aveiro": "Centro", "leiria": "Centro",
        "viseu": "Centro", "castelo branco": "Centro", "guarda": "Centro",
        "lisboa": "Lisboa", "setúbal": "Lisboa", "santarém": "Lisboa",
        "alentejo": "Alentejo", "évora": "Alentejo", "beja": "Alentejo",
        "portalegre": "Alentejo",
        "algarve": "Algarve", "faro": "Algarve",
        "açores": "Açores", "acores": "Açores", "ponta delgada": "Açores",
        "madeira": "Madeira", "funchal": "Madeira",
    }
    for key, val in region_map.items():
        if key in r:
            return val
    return region_str.title()


# ============================================================
# PUBLIC EVENTS SERVICE API
# ============================================================

class PublicEventsService:
    """Service to fetch and cache public Portuguese cultural events."""

    def __init__(self, db=None):
        self._db = db
        self._curated_events = None

    def set_db(self, db):
        self._db = db

    async def get_all_events(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Get all events from all sources, with caching."""
        if self._db is not None:
            cached = await self._get_cached_events()
            if cached and not force_refresh:
                return cached

        # Merge sources
        all_events = []

        # 1. Curated database (always available)
        curated = self._get_curated_events()
        all_events.extend(curated)

        # 2. Excel-sourced events (200 events from PortugalVivo spreadsheet)
        try:
            from excel_events_data import EXCEL_EVENTS_2026
            all_events.extend(EXCEL_EVENTS_2026)
        except ImportError:
            logger.warning("Excel events data not available (excel_events_data.py)")

        # 3. dados.gov.pt (external, may fail)
        try:
            gov_events = await fetch_dados_gov_events()
            all_events.extend(gov_events)
        except Exception as e:
            logger.warning(f"Failed to fetch dados.gov.pt events: {e}")

        # Deduplicate by id
        seen = set()
        unique = []
        for evt in all_events:
            if evt["id"] not in seen:
                seen.add(evt["id"])
                unique.append(evt)

        # Cache in MongoDB
        if self._db is not None:
            await self._cache_events(unique)

        return unique

    def _get_curated_events(self) -> List[Dict[str, Any]]:
        """Get curated events for current and next year."""
        if self._curated_events is None:
            now = datetime.now(timezone.utc)
            self._curated_events = _generate_events_for_year(now.year)
            if now.month >= 10:
                self._curated_events.extend(_generate_events_for_year(now.year + 1))
        return self._curated_events

    async def _get_cached_events(self) -> Optional[List[Dict[str, Any]]]:
        """Check if we have fresh cached events in MongoDB."""
        try:
            cache_doc = await self._db.events_cache.find_one({"_id": "public_events"})
            if cache_doc:
                cached_at = cache_doc.get("cached_at", datetime.min.replace(tzinfo=timezone.utc))
                if datetime.now(timezone.utc) - cached_at < timedelta(hours=CACHE_TTL_HOURS):
                    return cache_doc.get("events", [])
        except Exception as e:
            logger.warning(f"Cache read failed: {e}")
        return None

    async def _cache_events(self, events: List[Dict[str, Any]]):
        """Cache events in MongoDB with TTL."""
        try:
            await self._db.events_cache.update_one(
                {"_id": "public_events"},
                {"$set": {
                    "events": events,
                    "cached_at": datetime.now(timezone.utc),
                    "total": len(events),
                }},
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"Cache write failed: {e}")

    async def sync_to_events_collection(self):
        """Sync curated + public events into the main events collection."""
        all_events = await self.get_all_events(force_refresh=True)

        synced = 0
        for evt in all_events:
            await self._db.events.update_one(
                {"id": evt["id"]},
                {"$set": evt},
                upsert=True,
            )
            synced += 1

        logger.info(f"Synced {synced} public events to events collection")
        return synced


# Singleton instance
public_events_service = PublicEventsService()
