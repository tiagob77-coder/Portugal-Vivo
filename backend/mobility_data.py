"""
Dados de mobilidade realistas para Lisboa e Portugal.
Metro de Lisboa, CP Comboios, Transtejo/Soflusa Ferries.
Fonte: Dados públicos GTFS, sites oficiais (metrolisboa.pt, cp.pt, transtejo.pt)
Última atualização: Março 2026
"""

DATA_FRESHNESS = "static_2026"
LAST_UPDATED = "2026-03-01"

# ============================================================
# METRO DE LISBOA - 4 linhas, 56 estações
# ============================================================

METRO_LINES = [
    {
        "id": "azul",
        "name": "Linha Azul",
        "color": "#0060AA",
        "terminals": ["Reboleira", "Santa Apolónia"],
        "stations_count": 18,
        "first_train": {"weekday": "06:30", "weekend": "06:30"},
        "last_train": {"weekday": "01:00", "weekend": "01:00"},
        "official_url": "https://www.metrolisboa.pt",
    },
    {
        "id": "amarela",
        "name": "Linha Amarela",
        "color": "#FFCD00",
        "terminals": ["Rato", "Odivelas"],
        "stations_count": 13,
        "first_train": {"weekday": "06:30", "weekend": "06:30"},
        "last_train": {"weekday": "01:00", "weekend": "01:00"},
        "official_url": "https://www.metrolisboa.pt",
    },
    {
        "id": "verde",
        "name": "Linha Verde",
        "color": "#00A84F",
        "terminals": ["Telheiras", "Cais do Sodré"],
        "stations_count": 13,
        "first_train": {"weekday": "06:30", "weekend": "06:30"},
        "last_train": {"weekday": "01:00", "weekend": "01:00"},
        "official_url": "https://www.metrolisboa.pt",
    },
    {
        "id": "vermelha",
        "name": "Linha Vermelha",
        "color": "#ED1C24",
        "terminals": ["São Sebastião", "Aeroporto"],
        "stations_count": 12,
        "first_train": {"weekday": "06:30", "weekend": "06:30"},
        "last_train": {"weekday": "01:00", "weekend": "01:00"},
        "official_url": "https://www.metrolisboa.pt",
    },
]

METRO_STATIONS = [
    # Linha Azul (Reboleira → Santa Apolónia)
    {"name": "Reboleira", "lines": ["azul"], "lat": 38.7533, "lng": -9.2237, "municipality": "Amadora"},
    {"name": "Amadora Este", "lines": ["azul"], "lat": 38.7500, "lng": -9.2134, "municipality": "Amadora"},
    {"name": "Alfornelos", "lines": ["azul"], "lat": 38.7543, "lng": -9.2032, "municipality": "Amadora"},
    {"name": "Pontinha", "lines": ["azul"], "lat": 38.7626, "lng": -9.1935, "municipality": "Odivelas"},
    {"name": "Carnide", "lines": ["azul"], "lat": 38.7594, "lng": -9.1853, "municipality": "Lisboa"},
    {"name": "Colégio Militar/Luz", "lines": ["azul"], "lat": 38.7509, "lng": -9.1774, "municipality": "Lisboa"},
    {"name": "Alto dos Moinhos", "lines": ["azul"], "lat": 38.7481, "lng": -9.1706, "municipality": "Lisboa"},
    {"name": "Laranjeiras", "lines": ["azul"], "lat": 38.7464, "lng": -9.1643, "municipality": "Lisboa"},
    {"name": "Jardim Zoológico", "lines": ["azul"], "lat": 38.7420, "lng": -9.1672, "municipality": "Lisboa"},
    {"name": "Praça de Espanha", "lines": ["azul"], "lat": 38.7382, "lng": -9.1601, "municipality": "Lisboa"},
    {"name": "São Sebastião", "lines": ["azul", "vermelha"], "lat": 38.7337, "lng": -9.1539, "municipality": "Lisboa"},
    {"name": "Parque", "lines": ["azul"], "lat": 38.7295, "lng": -9.1519, "municipality": "Lisboa"},
    {"name": "Marquês de Pombal", "lines": ["azul", "amarela"], "lat": 38.7251, "lng": -9.1500, "municipality": "Lisboa"},
    {"name": "Avenida", "lines": ["azul"], "lat": 38.7197, "lng": -9.1468, "municipality": "Lisboa"},
    {"name": "Restauradores", "lines": ["azul"], "lat": 38.7158, "lng": -9.1420, "municipality": "Lisboa"},
    {"name": "Baixa-Chiado", "lines": ["azul", "verde"], "lat": 38.7108, "lng": -9.1402, "municipality": "Lisboa"},
    {"name": "Terreiro do Paço", "lines": ["azul"], "lat": 38.7074, "lng": -9.1332, "municipality": "Lisboa"},
    {"name": "Santa Apolónia", "lines": ["azul"], "lat": 38.7147, "lng": -9.1220, "municipality": "Lisboa"},
    # Linha Amarela (Rato → Odivelas)
    {"name": "Rato", "lines": ["amarela"], "lat": 38.7202, "lng": -9.1534, "municipality": "Lisboa"},
    {"name": "Picoas", "lines": ["amarela"], "lat": 38.7289, "lng": -9.1470, "municipality": "Lisboa"},
    {"name": "Saldanha", "lines": ["amarela", "vermelha"], "lat": 38.7345, "lng": -9.1450, "municipality": "Lisboa"},
    {"name": "Campo Pequeno", "lines": ["amarela"], "lat": 38.7420, "lng": -9.1458, "municipality": "Lisboa"},
    {"name": "Entrecampos", "lines": ["amarela"], "lat": 38.7474, "lng": -9.1485, "municipality": "Lisboa"},
    {"name": "Cidade Universitária", "lines": ["amarela"], "lat": 38.7520, "lng": -9.1595, "municipality": "Lisboa"},
    {"name": "Campo Grande", "lines": ["amarela", "verde"], "lat": 38.7588, "lng": -9.1575, "municipality": "Lisboa"},
    {"name": "Quinta das Conchas", "lines": ["amarela"], "lat": 38.7648, "lng": -9.1502, "municipality": "Lisboa"},
    {"name": "Lumiar", "lines": ["amarela"], "lat": 38.7700, "lng": -9.1558, "municipality": "Lisboa"},
    {"name": "Ameixoeira", "lines": ["amarela"], "lat": 38.7773, "lng": -9.1591, "municipality": "Lisboa"},
    {"name": "Senhor Roubado", "lines": ["amarela"], "lat": 38.7847, "lng": -9.1644, "municipality": "Odivelas"},
    {"name": "Odivelas", "lines": ["amarela"], "lat": 38.7932, "lng": -9.1705, "municipality": "Odivelas"},
    # Linha Verde (Telheiras → Cais do Sodré)
    {"name": "Telheiras", "lines": ["verde"], "lat": 38.7575, "lng": -9.1650, "municipality": "Lisboa"},
    {"name": "Alvalade", "lines": ["verde"], "lat": 38.7525, "lng": -9.1413, "municipality": "Lisboa"},
    {"name": "Roma", "lines": ["verde"], "lat": 38.7472, "lng": -9.1375, "municipality": "Lisboa"},
    {"name": "Areeiro", "lines": ["verde"], "lat": 38.7415, "lng": -9.1330, "municipality": "Lisboa"},
    {"name": "Alameda", "lines": ["verde", "vermelha"], "lat": 38.7375, "lng": -9.1325, "municipality": "Lisboa"},
    {"name": "Arroios", "lines": ["verde"], "lat": 38.7310, "lng": -9.1343, "municipality": "Lisboa"},
    {"name": "Anjos", "lines": ["verde"], "lat": 38.7255, "lng": -9.1363, "municipality": "Lisboa"},
    {"name": "Intendente", "lines": ["verde"], "lat": 38.7219, "lng": -9.1356, "municipality": "Lisboa"},
    {"name": "Martim Moniz", "lines": ["verde"], "lat": 38.7163, "lng": -9.1368, "municipality": "Lisboa"},
    {"name": "Rossio", "lines": ["verde"], "lat": 38.7138, "lng": -9.1389, "municipality": "Lisboa"},
    {"name": "Cais do Sodré", "lines": ["verde"], "lat": 38.7062, "lng": -9.1442, "municipality": "Lisboa"},
    # Linha Vermelha (São Sebastião → Aeroporto)
    {"name": "Olaias", "lines": ["vermelha"], "lat": 38.7360, "lng": -9.1255, "municipality": "Lisboa"},
    {"name": "Bela Vista", "lines": ["vermelha"], "lat": 38.7402, "lng": -9.1195, "municipality": "Lisboa"},
    {"name": "Chelas", "lines": ["vermelha"], "lat": 38.7498, "lng": -9.1122, "municipality": "Lisboa"},
    {"name": "Olivais", "lines": ["vermelha"], "lat": 38.7578, "lng": -9.1082, "municipality": "Lisboa"},
    {"name": "Cabo Ruivo", "lines": ["vermelha"], "lat": 38.7640, "lng": -9.1040, "municipality": "Lisboa"},
    {"name": "Oriente", "lines": ["vermelha"], "lat": 38.7678, "lng": -9.0992, "municipality": "Lisboa"},
    {"name": "Moscavide", "lines": ["vermelha"], "lat": 38.7715, "lng": -9.1007, "municipality": "Loures"},
    {"name": "Encarnação", "lines": ["vermelha"], "lat": 38.7726, "lng": -9.1107, "municipality": "Lisboa"},
    {"name": "Aeroporto", "lines": ["vermelha"], "lat": 38.7691, "lng": -9.1285, "municipality": "Lisboa"},
]

# Frequências Metro por faixa horária (minutos)
METRO_FREQUENCIES = {
    "ponta_manha": {"range": (7, 9), "min": 4, "label": "Hora de ponta (manhã)"},
    "normal_manha": {"range": (9, 12), "min": 6, "label": "Período normal"},
    "almoco": {"range": (12, 14), "min": 5, "label": "Hora de almoço"},
    "normal_tarde": {"range": (14, 17), "min": 6, "label": "Período normal"},
    "ponta_tarde": {"range": (17, 20), "min": 4, "label": "Hora de ponta (tarde)"},
    "noite": {"range": (20, 24), "min": 8, "label": "Período noturno"},
    "madrugada": {"range": (0, 1), "min": 10, "label": "Última hora"},
    "inicio": {"range": (6, 7), "min": 8, "label": "Início de serviço"},
}


def get_metro_frequency(hour: int) -> dict:
    for period, info in METRO_FREQUENCIES.items():
        start, end = info["range"]
        if start <= hour < end:
            return {"frequency_min": info["min"], "period": info["label"]}
    return {"frequency_min": 10, "period": "Fora de serviço (frequência reduzida)"}


# ============================================================
# CP COMBOIOS - Linhas urbanas e longo curso
# ============================================================

TRAIN_LINES = [
    {
        "id": "cascais",
        "name": "Linha de Cascais",
        "type": "urbano",
        "operator": "CP Urbanos",
        "terminals": ["Cais do Sodré", "Cascais"],
        "duration_min": 33,
        "stations_count": 18,
        "frequency_min": {"ponta": 12, "normal": 20, "fds": 20},
        "first_train": {"weekday": "05:30", "weekend": "06:00"},
        "last_train": {"weekday": "01:30", "weekend": "01:30"},
        "price_range": "1.50€ - 2.30€",
        "official_url": "https://www.cp.pt",
    },
    {
        "id": "sintra",
        "name": "Linha de Sintra",
        "type": "urbano",
        "operator": "CP Urbanos",
        "terminals": ["Rossio", "Sintra"],
        "duration_min": 40,
        "stations_count": 16,
        "frequency_min": {"ponta": 10, "normal": 20, "fds": 20},
        "first_train": {"weekday": "05:26", "weekend": "06:06"},
        "last_train": {"weekday": "01:16", "weekend": "01:16"},
        "price_range": "1.50€ - 2.30€",
        "official_url": "https://www.cp.pt",
    },
    {
        "id": "azambuja",
        "name": "Linha da Azambuja",
        "type": "urbano",
        "operator": "CP Urbanos",
        "terminals": ["Lisboa Santa Apolónia", "Azambuja"],
        "duration_min": 60,
        "stations_count": 14,
        "frequency_min": {"ponta": 15, "normal": 30, "fds": 30},
        "first_train": {"weekday": "05:40", "weekend": "06:30"},
        "last_train": {"weekday": "00:30", "weekend": "00:30"},
        "price_range": "1.50€ - 3.40€",
        "official_url": "https://www.cp.pt",
    },
    {
        "id": "fertagus",
        "name": "Fertagus (Ponte 25 de Abril)",
        "type": "urbano",
        "operator": "Fertagus",
        "terminals": ["Roma-Areeiro", "Setúbal"],
        "duration_min": 52,
        "stations_count": 14,
        "frequency_min": {"ponta": 10, "normal": 20, "fds": 30},
        "first_train": {"weekday": "05:30", "weekend": "06:30"},
        "last_train": {"weekday": "02:00", "weekend": "02:00"},
        "price_range": "2.00€ - 4.20€",
        "official_url": "https://www.fertagus.pt",
    },
    {
        "id": "alfa_pendular",
        "name": "Alfa Pendular",
        "type": "longo_curso",
        "operator": "CP Longo Curso",
        "terminals": ["Braga", "Faro"],
        "duration_min": None,
        "stations_count": 10,
        "frequency_min": None,
        "first_train": None,
        "last_train": None,
        "price_range": "22€ - 50€",
        "official_url": "https://www.cp.pt",
    },
    {
        "id": "intercidades",
        "name": "Intercidades",
        "type": "longo_curso",
        "operator": "CP Longo Curso",
        "terminals": ["Vários"],
        "duration_min": None,
        "stations_count": None,
        "frequency_min": None,
        "first_train": None,
        "last_train": None,
        "price_range": "15€ - 35€",
        "official_url": "https://www.cp.pt",
    },
]

TRAIN_STATIONS = [
    # Linha de Cascais (18 estações)
    {"id": "cais_sodre", "name": "Cais do Sodré", "city": "Lisboa", "lines": ["cascais"], "lat": 38.7062, "lng": -9.1442},
    {"id": "santos", "name": "Santos", "city": "Lisboa", "lines": ["cascais"], "lat": 38.7040, "lng": -9.1512},
    {"id": "alcantara_mar", "name": "Alcântara-Mar", "city": "Lisboa", "lines": ["cascais"], "lat": 38.7016, "lng": -9.1636},
    {"id": "belem", "name": "Belém", "city": "Lisboa", "lines": ["cascais"], "lat": 38.6965, "lng": -9.1993},
    {"id": "alges", "name": "Algés", "city": "Oeiras", "lines": ["cascais"], "lat": 38.6985, "lng": -9.2172},
    {"id": "oeiras", "name": "Oeiras", "city": "Oeiras", "lines": ["cascais"], "lat": 38.6926, "lng": -9.3105},
    {"id": "carcavelos", "name": "Carcavelos", "city": "Cascais", "lines": ["cascais"], "lat": 38.6828, "lng": -9.3350},
    {"id": "estoril", "name": "Estoril", "city": "Cascais", "lines": ["cascais"], "lat": 38.7064, "lng": -9.3968},
    {"id": "cascais", "name": "Cascais", "city": "Cascais", "lines": ["cascais"], "lat": 38.6978, "lng": -9.4217},
    # Linha de Sintra (estações principais)
    {"id": "rossio", "name": "Rossio", "city": "Lisboa", "lines": ["sintra"], "lat": 38.7142, "lng": -9.1395},
    {"id": "campolide", "name": "Campolide", "city": "Lisboa", "lines": ["sintra"], "lat": 38.7262, "lng": -9.1652},
    {"id": "benfica", "name": "Benfica", "city": "Lisboa", "lines": ["sintra"], "lat": 38.7445, "lng": -9.1972},
    {"id": "amadora", "name": "Amadora", "city": "Amadora", "lines": ["sintra"], "lat": 38.7536, "lng": -9.2239},
    {"id": "queluz_belas", "name": "Queluz-Belas", "city": "Sintra", "lines": ["sintra"], "lat": 38.7607, "lng": -9.2554},
    {"id": "agualva_cacem", "name": "Agualva-Cacém", "city": "Sintra", "lines": ["sintra"], "lat": 38.7673, "lng": -9.2968},
    {"id": "rio_mouro", "name": "Rio de Mouro", "city": "Sintra", "lines": ["sintra"], "lat": 38.7705, "lng": -9.3297},
    {"id": "sintra", "name": "Sintra", "city": "Sintra", "lines": ["sintra"], "lat": 38.7993, "lng": -9.3812},
    # Linha da Azambuja (estações principais)
    {"id": "santa_apolonia", "name": "Santa Apolónia", "city": "Lisboa", "lines": ["azambuja", "alfa_pendular", "intercidades"], "lat": 38.7147, "lng": -9.1220},
    {"id": "lisboa_oriente", "name": "Lisboa Oriente", "city": "Lisboa", "lines": ["azambuja", "alfa_pendular", "intercidades", "fertagus"], "lat": 38.7678, "lng": -9.0992},
    {"id": "alverca", "name": "Alverca", "city": "V.F. Xira", "lines": ["azambuja"], "lat": 38.8953, "lng": -9.0375},
    {"id": "vila_franca_xira", "name": "Vila Franca de Xira", "city": "V.F. Xira", "lines": ["azambuja"], "lat": 38.9541, "lng": -8.9893},
    {"id": "azambuja", "name": "Azambuja", "city": "Azambuja", "lines": ["azambuja"], "lat": 39.0680, "lng": -8.8695},
    # Fertagus (estações principais)
    {"id": "roma_areeiro", "name": "Roma-Areeiro", "city": "Lisboa", "lines": ["fertagus"], "lat": 38.7415, "lng": -9.1330},
    {"id": "entrecampos_ft", "name": "Entrecampos", "city": "Lisboa", "lines": ["fertagus"], "lat": 38.7474, "lng": -9.1485},
    {"id": "pragal", "name": "Pragal", "city": "Almada", "lines": ["fertagus"], "lat": 38.6645, "lng": -9.1732},
    {"id": "corroios", "name": "Corroios", "city": "Seixal", "lines": ["fertagus"], "lat": 38.6329, "lng": -9.1504},
    {"id": "fogueteiro", "name": "Fogueteiro", "city": "Seixal", "lines": ["fertagus"], "lat": 38.6231, "lng": -9.1090},
    {"id": "coina", "name": "Coina", "city": "Barreiro", "lines": ["fertagus"], "lat": 38.6223, "lng": -9.0224},
    {"id": "penalva", "name": "Penalva", "city": "Barreiro", "lines": ["fertagus"], "lat": 38.6253, "lng": -8.9786},
    {"id": "palmela", "name": "Palmela", "city": "Palmela", "lines": ["fertagus"], "lat": 38.5611, "lng": -8.8943},
    {"id": "setubal", "name": "Setúbal", "city": "Setúbal", "lines": ["fertagus"], "lat": 38.5244, "lng": -8.8927},
    # Longo Curso (estações principais)
    {"id": "porto_campanha", "name": "Porto Campanhã", "city": "Porto", "lines": ["alfa_pendular", "intercidades"], "lat": 41.1489, "lng": -8.5856},
    {"id": "porto_sao_bento", "name": "Porto São Bento", "city": "Porto", "lines": ["intercidades"], "lat": 41.1455, "lng": -8.6103},
    {"id": "braga", "name": "Braga", "city": "Braga", "lines": ["alfa_pendular", "intercidades"], "lat": 41.5501, "lng": -8.4337},
    {"id": "coimbra_b", "name": "Coimbra-B", "city": "Coimbra", "lines": ["alfa_pendular", "intercidades"], "lat": 40.2120, "lng": -8.4313},
    {"id": "aveiro", "name": "Aveiro", "city": "Aveiro", "lines": ["alfa_pendular", "intercidades"], "lat": 40.6420, "lng": -8.6534},
    {"id": "leiria", "name": "Leiria", "city": "Leiria", "lines": ["intercidades"], "lat": 39.7442, "lng": -8.8062},
    {"id": "entroncamento", "name": "Entroncamento", "city": "Entroncamento", "lines": ["intercidades"], "lat": 39.4678, "lng": -8.4718},
    {"id": "santarem", "name": "Santarém", "city": "Santarém", "lines": ["intercidades"], "lat": 39.2378, "lng": -8.6819},
    {"id": "faro", "name": "Faro", "city": "Faro", "lines": ["alfa_pendular", "intercidades"], "lat": 37.0176, "lng": -7.9398},
    {"id": "tunes", "name": "Tunes", "city": "Silves", "lines": ["alfa_pendular", "intercidades"], "lat": 37.1367, "lng": -8.2319},
    {"id": "albufeira_ferreiras", "name": "Albufeira-Ferreiras", "city": "Albufeira", "lines": ["intercidades"], "lat": 37.1026, "lng": -8.2509},
    {"id": "evora", "name": "Évora", "city": "Évora", "lines": ["intercidades"], "lat": 38.5647, "lng": -7.8991},
    {"id": "beja", "name": "Beja", "city": "Beja", "lines": ["intercidades"], "lat": 38.0160, "lng": -7.8732},
    {"id": "guarda", "name": "Guarda", "city": "Guarda", "lines": ["intercidades"], "lat": 40.5362, "lng": -7.2693},
]

# Horários aproximados Alfa Pendular
ALFA_PENDULAR_SCHEDULE = [
    {"departure": "06:10", "origin": "Lisboa Oriente", "destination": "Porto Campanhã", "duration": "2h40", "price": "35€"},
    {"departure": "07:03", "origin": "Porto Campanhã", "destination": "Lisboa Oriente", "duration": "2h40", "price": "35€"},
    {"departure": "08:10", "origin": "Lisboa Oriente", "destination": "Braga", "duration": "3h25", "price": "42€"},
    {"departure": "09:10", "origin": "Lisboa Oriente", "destination": "Porto Campanhã", "duration": "2h40", "price": "35€"},
    {"departure": "10:03", "origin": "Porto Campanhã", "destination": "Faro", "duration": "5h20", "price": "50€"},
    {"departure": "11:10", "origin": "Lisboa Oriente", "destination": "Porto Campanhã", "duration": "2h40", "price": "35€"},
    {"departure": "13:10", "origin": "Lisboa Oriente", "destination": "Porto Campanhã", "duration": "2h40", "price": "35€"},
    {"departure": "14:03", "origin": "Porto Campanhã", "destination": "Lisboa Oriente", "duration": "2h40", "price": "35€"},
    {"departure": "15:10", "origin": "Lisboa Oriente", "destination": "Porto Campanhã", "duration": "2h40", "price": "35€"},
    {"departure": "17:10", "origin": "Lisboa Oriente", "destination": "Porto Campanhã", "duration": "2h40", "price": "35€"},
    {"departure": "18:03", "origin": "Porto Campanhã", "destination": "Lisboa Oriente", "duration": "2h40", "price": "35€"},
    {"departure": "19:10", "origin": "Lisboa Oriente", "destination": "Porto Campanhã", "duration": "2h40", "price": "35€"},
    {"departure": "21:10", "origin": "Lisboa Oriente", "destination": "Porto Campanhã", "duration": "2h40", "price": "35€"},
]


# ============================================================
# TRANSTEJO / SOFLUSA - Ferries do Tejo
# ============================================================

FERRY_ROUTES = [
    {
        "id": "cacilhas",
        "name": "Cais do Sodré → Cacilhas",
        "operator": "Transtejo",
        "duration_min": 10,
        "origin": {"name": "Cais do Sodré", "lat": 38.7062, "lng": -9.1442},
        "destination": {"name": "Cacilhas", "lat": 38.6876, "lng": -9.1484},
        "weekday": {
            "first": "05:25", "last": "01:25",
            "frequency_min": {"ponta": 10, "normal": 15, "noite": 30},
        },
        "weekend": {
            "first": "06:15", "last": "01:25",
            "frequency_min": {"normal": 20, "noite": 30},
        },
        "price": "1.30€ (Viva Viagem) / 2.80€ (bilhete ocasional)",
        "official_url": "https://www.transtejo.pt",
    },
    {
        "id": "seixal",
        "name": "Cais do Sodré → Seixal",
        "operator": "Transtejo",
        "duration_min": 25,
        "origin": {"name": "Cais do Sodré", "lat": 38.7062, "lng": -9.1442},
        "destination": {"name": "Seixal", "lat": 38.6339, "lng": -9.1019},
        "weekday": {
            "first": "05:45", "last": "21:40",
            "frequency_min": {"ponta": 20, "normal": 40},
        },
        "weekend": {
            "first": "07:15", "last": "21:00",
            "frequency_min": {"normal": 60},
        },
        "price": "1.30€ (Viva Viagem) / 2.80€ (bilhete ocasional)",
        "official_url": "https://www.transtejo.pt",
    },
    {
        "id": "montijo",
        "name": "Cais do Sodré → Montijo",
        "operator": "Transtejo",
        "duration_min": 30,
        "origin": {"name": "Cais do Sodré", "lat": 38.7062, "lng": -9.1442},
        "destination": {"name": "Montijo", "lat": 38.7050, "lng": -8.9781},
        "weekday": {
            "first": "06:00", "last": "21:00",
            "frequency_min": {"ponta": 30, "normal": 60},
        },
        "weekend": {
            "first": "07:30", "last": "21:00",
            "frequency_min": {"normal": 60},
        },
        "price": "1.30€ (Viva Viagem) / 2.80€ (bilhete ocasional)",
        "official_url": "https://www.transtejo.pt",
    },
    {
        "id": "trafaria",
        "name": "Porto Brandão/Trafaria → Belém",
        "operator": "Transtejo",
        "duration_min": 15,
        "origin": {"name": "Belém", "lat": 38.6935, "lng": -9.2101},
        "destination": {"name": "Trafaria", "lat": 38.6702, "lng": -9.2364},
        "weekday": {
            "first": "06:25", "last": "22:30",
            "frequency_min": {"ponta": 20, "normal": 30},
        },
        "weekend": {
            "first": "07:25", "last": "22:30",
            "frequency_min": {"normal": 40},
        },
        "price": "1.30€ (Viva Viagem) / 2.80€ (bilhete ocasional)",
        "official_url": "https://www.transtejo.pt",
    },
    {
        "id": "barreiro",
        "name": "Terreiro do Paço → Barreiro",
        "operator": "Soflusa",
        "duration_min": 25,
        "origin": {"name": "Terreiro do Paço", "lat": 38.7074, "lng": -9.1332},
        "destination": {"name": "Barreiro", "lat": 38.6635, "lng": -9.0718},
        "weekday": {
            "first": "05:20", "last": "02:10",
            "frequency_min": {"ponta": 15, "normal": 20, "noite": 30},
        },
        "weekend": {
            "first": "06:20", "last": "02:10",
            "frequency_min": {"normal": 30, "noite": 40},
        },
        "price": "1.30€ (Viva Viagem) / 2.80€ (bilhete ocasional)",
        "official_url": "https://www.soflusa.pt",
    },
]


def get_ferry_frequency(route: dict, hour: int, is_weekend: bool) -> int:
    schedule = route["weekend"] if is_weekend else route["weekday"]
    freqs = schedule["frequency_min"]
    if "noite" in freqs and hour >= 21:
        return freqs["noite"]
    if "ponta" in freqs and (7 <= hour <= 9 or 17 <= hour <= 19):
        return freqs["ponta"]
    return freqs.get("normal", 30)
