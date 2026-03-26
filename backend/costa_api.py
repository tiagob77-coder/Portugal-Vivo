"""
Costa API — 10 zonas costeiras portuguesas
Lendas, biodiversidade, perfis temáticos e condições ambientais simuladas.
Prefix: /costa
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import math
import datetime

costa_router = APIRouter(prefix="/costa", tags=["Costa"])

_db = None


def set_costa_db(database):
    global _db
    _db = database


# ─── Dados das 10 zonas costeiras (Minho → Algarve) ──────────────────────────

COASTAL_ZONES = [
    {
        "id": "costa-minhota",
        "name": "Costa Minhota",
        "order": 1,
        "region": "Norte",
        "lat": 41.85,
        "lng": -8.87,
        "description": "Do Caminha à Esposende, praias de rio misturadas com o oceano. Vegetação exuberante, dunas vivas e aldeias piscatórias.",
        "lenda": "Conta-se que as sereias do Atlântico escolheram estas praias para repousar, atraídas pelo canto dos pescadores minhotos que ecoava pela costa nas noites de verão.",
        "biodiversidade": [
            {"especie": "Cegonha-branca", "nome_cientifico": "Ciconia ciconia", "nota": "Nidifica nos campanários da costa"},
            {"especie": "Lampreia", "nome_cientifico": "Petromyzon marinus", "nota": "Sobe o Minho em fevereiro"},
            {"especie": "Limodoro", "nome_cientifico": "Limodorum abortivum", "nota": "Orquídea rara nas dunas"},
        ],
        "perfis": {"surfer": 3, "familia": 5, "fotografo": 4, "natureza": 5},
        "condicoes": {
            "ondas_media_m": 1.2,
            "vento_predominante": "NW",
            "melhor_epoca": "Junho–Setembro",
            "seguranca": "alta",
        },
        "praias_destaque": ["Praia de Moledo", "Praia de Ofir", "Praia de Esposende"],
    },
    {
        "id": "costa-porto",
        "name": "Costa do Porto",
        "order": 2,
        "region": "Norte",
        "lat": 41.18,
        "lng": -8.70,
        "description": "De Matosinhos a Espinho, a costa urbana mais vibrante de Portugal. Marisco fresco, surf atlântico e pores do sol sobre o mar.",
        "lenda": "Os pescadores de Matosinhos guardam a tradição de lançar flores ao mar no dia de São João, em honra dos marinheiros perdidos nas tempestades do Atlântico Norte.",
        "biodiversidade": [
            {"especie": "Gaivota-de-asa-escura", "nome_cientifico": "Larus fuscus", "nota": "Colónia urbana nos telhados"},
            {"especie": "Caranguejo-verde", "nome_cientifico": "Carcinus maenas", "nota": "Abundante nas rochas"},
            {"especie": "Lírio-das-praias", "nome_cientifico": "Pancratium maritimum", "nota": "Floresce em agosto nas dunas"},
        ],
        "perfis": {"surfer": 5, "familia": 4, "fotografo": 4, "natureza": 2},
        "condicoes": {
            "ondas_media_m": 1.8,
            "vento_predominante": "N",
            "melhor_epoca": "Setembro–Outubro",
            "seguranca": "media",
        },
        "praias_destaque": ["Praia de Matosinhos", "Praia de Leça", "Praia de Espinho"],
    },
    {
        "id": "costa-aveiro",
        "name": "Costa de Aveiro",
        "order": 3,
        "region": "Centro",
        "lat": 40.64,
        "lng": -8.75,
        "description": "A Ria de Aveiro cria uma lagoa imensa onde moliceiros deslizam em silêncio. Praias oceânicas contrastam com a calma da ria.",
        "lenda": "Dizem que a Ria foi criada pelas lágrimas de uma princesa moura que chorou durante quarenta dias ao ver o seu amado partir para a guerra, e as suas lágrimas formaram a lagoa.",
        "biodiversidade": [
            {"especie": "Flamingo", "nome_cientifico": "Phoenicopterus roseus", "nota": "Visitante invernal na ria"},
            {"especie": "Enguia", "nome_cientifico": "Anguilla anguilla", "nota": "Ciclo de vida entre a ria e o Atlântico"},
            {"especie": "Salicórnia", "nome_cientifico": "Salicornia europaea", "nota": "Tapete vermelho nos sapais em outubro"},
        ],
        "perfis": {"surfer": 3, "familia": 5, "fotografo": 5, "natureza": 5},
        "condicoes": {
            "ondas_media_m": 1.5,
            "vento_predominante": "NW",
            "melhor_epoca": "Julho–Agosto",
            "seguranca": "alta",
        },
        "praias_destaque": ["Praia da Barra", "Praia de Mira", "Costa Nova"],
    },
    {
        "id": "costa-prata",
        "name": "Costa de Prata",
        "order": 4,
        "region": "Centro",
        "lat": 39.85,
        "lng": -8.95,
        "description": "De Figueira da Foz à Nazaré, praias imensas e ondas gigantes. A costa que guarda os maiores segredos do surf mundial.",
        "lenda": "Na Nazaré existe um canhão submarino de 5km que canaliza as ondas do Atlântico Norte, criando as maiores ondas surfáveis do mundo — um fenómeno que os pescadores já conheciam há séculos mas chamavam de 'o rugido do fundo'.",
        "biodiversidade": [
            {"especie": "Golfinho-roaz", "nome_cientifico": "Tursiops truncatus", "nota": "Grupos regulares ao largo"},
            {"especie": "Tartaruga-comum", "nome_cientifico": "Caretta caretta", "nota": "Ocasional no verão"},
            {"especie": "Estorno", "nome_cientifico": "Sturnus vulgaris", "nota": "Murmuração espetacular no outono"},
        ],
        "perfis": {"surfer": 5, "familia": 3, "fotografo": 5, "natureza": 4},
        "condicoes": {
            "ondas_media_m": 3.5,
            "vento_predominante": "N",
            "melhor_epoca": "Outubro–Março",
            "seguranca": "baixa",
        },
        "praias_destaque": ["Praia da Nazaré", "Praia de São Martinho do Porto", "Praia da Figueira da Foz"],
    },
    {
        "id": "costa-peniche",
        "name": "Costa de Peniche",
        "order": 5,
        "region": "Centro",
        "lat": 39.36,
        "lng": -9.38,
        "description": "A península de Peniche avança no oceano como uma sentinela. Fortaleza, surf mundial e a magia da Ilha da Berlenga.",
        "lenda": "A Berlenga foi habitada por monges medievais que, segundo a lenda, encontravam ouro nas rochas durante as marés baixas de equinócio — o chamado 'ouro das marés'.",
        "biodiversidade": [
            {"especie": "Alcatraz", "nome_cientifico": "Morus bassanus", "nota": "Mergulhador espetacular na Berlenga"},
            {"especie": "Lagosta-europeia", "nome_cientifico": "Homarus gammarus", "nota": "Reserva marinha da Berlenga"},
            {"especie": "Narciso-de-bulbocodium", "nome_cientifico": "Narcissus bulbocodium", "nota": "Endémico das falésias"},
        ],
        "perfis": {"surfer": 5, "familia": 4, "fotografo": 5, "natureza": 5},
        "condicoes": {
            "ondas_media_m": 2.2,
            "vento_predominante": "N",
            "melhor_epoca": "Todo o ano",
            "seguranca": "media",
        },
        "praias_destaque": ["Supertubos", "Praia do Baleal", "Ilha da Berlenga"],
    },
    {
        "id": "costa-lisboa",
        "name": "Costa de Lisboa",
        "order": 6,
        "region": "Lisboa",
        "lat": 38.72,
        "lng": -9.45,
        "description": "De Sintra a Cascais, a Costa do Estoril combina falésias dramáticas com praias douradas. O Cabo da Roca marca o fim da Europa continental.",
        "lenda": "O Cabo da Roca foi descrito por Camões como 'onde a terra acaba e o mar começa'. Conta a tradição que navegadores medievais acreditavam existir um monstro marinho além deste ponto, o 'Guardião do Fim do Mundo'.",
        "biodiversidade": [
            {"especie": "Cagarra", "nome_cientifico": "Calonectris borealis", "nota": "Colónia nas Ilhas Berlengas, visível ao largo"},
            {"especie": "Robalão", "nome_cientifico": "Dicentrarchus labrax", "nota": "Pesca desportiva em Cascais"},
            {"especie": "Estatice-de-sintra", "nome_cientifico": "Limonium binervosum", "nota": "Endémica das falésias da Sintra"},
        ],
        "perfis": {"surfer": 3, "familia": 5, "fotografo": 5, "natureza": 4},
        "condicoes": {
            "ondas_media_m": 1.5,
            "vento_predominante": "N",
            "melhor_epoca": "Junho–Setembro",
            "seguranca": "alta",
        },
        "praias_destaque": ["Praia de Cascais", "Praia Grande do Guincho", "Cabo da Roca"],
    },
    {
        "id": "costa-arrabida",
        "name": "Costa da Arrábida",
        "order": 7,
        "region": "Lisboa",
        "lat": 38.48,
        "lng": -8.97,
        "description": "A Arrábida esconde praias de água cristalina entre falésias calcárias cobertas de vegetação mediterrânica. A Méditerranea em Portugal.",
        "lenda": "Dizem os pescadores locais que existe uma gruta submarina sob o Portinho da Arrábida onde uma sereia adormeceu há mil anos, e que nas noites de lua cheia se ouve o seu canto suave a partir da praia.",
        "biodiversidade": [
            {"especie": "Tubarão-azul", "nome_cientifico": "Prionace glauca", "nota": "Avistado regularmente ao largo"},
            {"especie": "Lince-ibérico", "nome_cientifico": "Lynx pardinus", "nota": "Reintroduzido na Serra da Arrábida"},
            {"especie": "Rosmaninho", "nome_cientifico": "Lavandula stoechas", "nota": "Perfuma toda a serra em abril"},
        ],
        "perfis": {"surfer": 2, "familia": 5, "fotografo": 5, "natureza": 5},
        "condicoes": {
            "ondas_media_m": 0.8,
            "vento_predominante": "W",
            "melhor_epoca": "Maio–Setembro",
            "seguranca": "muito_alta",
        },
        "praias_destaque": ["Portinho da Arrábida", "Praia de Galapinhos", "Praia de Sesimbra"],
    },
    {
        "id": "costa-alentejana",
        "name": "Costa Alentejana",
        "order": 8,
        "region": "Alentejo",
        "lat": 37.95,
        "lng": -8.87,
        "description": "Entre Sines e a Comporta, dunas imensas, pinheiros e silêncio. A costa mais despovoada de Portugal continental.",
        "lenda": "A Comporta foi chamada pelos mouros de 'Qumburta', a terra das dunas sem fim. Conta-se que um navio pirata afundou ao largo com um tesouro que o oceano ainda guarda sob as areias.",
        "biodiversidade": [
            {"especie": "Flamingo", "nome_cientifico": "Phoenicopterus roseus", "nota": "Lagoa de Santo André — colónia invernal"},
            {"especie": "Cavalo-lusitano", "nome_cientifico": "Equus caballus", "nota": "Herdades tradicionais da Comporta"},
            {"especie": "Pinheiro-manso", "nome_cientifico": "Pinus pinea", "nota": "Pinhais do litoral alentejano"},
        ],
        "perfis": {"surfer": 3, "familia": 4, "fotografo": 5, "natureza": 5},
        "condicoes": {
            "ondas_media_m": 2.0,
            "vento_predominante": "NW",
            "melhor_epoca": "Junho–Agosto",
            "seguranca": "media",
        },
        "praias_destaque": ["Praia da Comporta", "Praia de Melides", "Praia de Sines"],
    },
    {
        "id": "costa-vicentina",
        "name": "Costa Vicentina",
        "order": 9,
        "region": "Alentejo",
        "lat": 37.42,
        "lng": -8.82,
        "description": "O litoral mais selvagem da Europa Ocidental. Parque Natural do Sudoeste Alentejano e Costa Vicentina — falésias, golfinhos e vento livre.",
        "lenda": "O Cabo de São Vicente foi considerado pelos romanos como o fim do mundo — Promontorium Sacrum. Diziam que o sol mergulhava no oceano com um sibilo ao anoitecer, e que as almas dos mortos navegavam para além deste ponto.",
        "biodiversidade": [
            {"especie": "Golfinho-comum", "nome_cientifico": "Delphinus delphis", "nota": "Grupos de centenas ao largo do cabo"},
            {"especie": "Águia-de-bonelli", "nome_cientifico": "Aquila fasciata", "nota": "Nidifica nas falésias do Cabo Sardão"},
            {"especie": "Açafrão-da-praia", "nome_cientifico": "Romulea ramiflora", "nota": "Floresce nas falésias em fevereiro"},
        ],
        "perfis": {"surfer": 5, "familia": 3, "fotografo": 5, "natureza": 5},
        "condicoes": {
            "ondas_media_m": 2.8,
            "vento_predominante": "N",
            "melhor_epoca": "Setembro–Outubro",
            "seguranca": "baixa",
        },
        "praias_destaque": ["Praia do Amado", "Praia de Odeceixe", "Cabo de São Vicente"],
    },
    {
        "id": "costa-algarve",
        "name": "Costa do Algarve",
        "order": 10,
        "region": "Algarve",
        "lat": 37.10,
        "lng": -8.20,
        "description": "Das falésias douradas de Lagos a Vila Real de Santo António. O Barlavento selvagem e o Sotavento sereno — dois Algarves num só.",
        "lenda": "Os mouros chamavam ao Algarve 'Al-Gharb' — o Ocidente. Diz a lenda que a princesa moura Zahra morreu de amor, e que as amendoeiras floresceram brancas em pleno inverno para consolar o seu pai, o rei.",
        "biodiversidade": [
            {"especie": "Camaleão-comum", "nome_cientifico": "Chamaeleo chamaeleon", "nota": "Único réptil camaleão europeu, raro"},
            {"especie": "Atum-rabilho", "nome_cientifico": "Thunnus thynnus", "nota": "Migração anual no Estreito de Gibraltar"},
            {"especie": "Esteva", "nome_cientifico": "Cistus ladanifer", "nota": "Perfuma as falésias em maio"},
        ],
        "perfis": {"surfer": 4, "familia": 5, "fotografo": 5, "natureza": 4},
        "condicoes": {
            "ondas_media_m": 1.0,
            "vento_predominante": "W",
            "melhor_epoca": "Maio–Outubro",
            "seguranca": "alta",
        },
        "praias_destaque": ["Praia de Benagil", "Praia de Meia Praia", "Ilha de Tavira"],
    },
]

# Index por id
_ZONES_BY_ID = {z["id"]: z for z in COASTAL_ZONES}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _simulate_conditions(zone: dict) -> dict:
    """Simula condições ambientais realistas baseado na hora/data e zona."""
    now = datetime.datetime.utcnow()
    hour = now.hour + now.minute / 60
    day_of_year = now.timetuple().tm_yday
    lat = zone["lat"]

    # Marés — ciclo semidiurno (~12.42h), amplitude varia por zona
    tide_amplitude = 1.8 + 0.6 * math.sin(lat * 0.15)
    tide_phase = (hour / 12.42) * 2 * math.pi + lat * 0.3
    tide_height = round(tide_amplitude / 2 * (1 + math.sin(tide_phase)), 2)
    tide_direction = "Enchente" if math.cos(tide_phase) > 0 else "Vazante"

    # Próximas marés (2 eventos)
    def _next_tide_times(ph: float, amp: float):
        events = []
        for offset_h in [0.5, 3.5, 6.5, 9.5]:
            p = ph + (offset_h / 12.42) * 2 * math.pi
            t_type = "Alta" if math.sin(p) > 0.8 else ("Baixa" if math.sin(p) < -0.8 else None)
            if t_type:
                future_h = (hour + offset_h) % 24
                events.append({
                    "hora": f"{int(future_h):02d}:{int((future_h % 1) * 60):02d}",
                    "tipo": t_type,
                    "altura_m": round(amp if t_type == "Alta" else 0.3, 2),
                })
            if len(events) >= 2:
                break
        return events[:2]

    proximas_mares = _next_tide_times(tide_phase, tide_amplitude)

    # Ondas — baseado nos dados da zona + variação sazonal
    wave_base = zone["condicoes"]["ondas_media_m"]
    seasonal = 1.0 + 0.4 * math.sin(2 * math.pi * (day_of_year - 355) / 365)
    wave_h = round(wave_base * seasonal * (0.85 + 0.3 * abs(math.sin(lat * 0.7 + day_of_year * 0.05))), 1)
    wave_period = round(8 + 6 * math.sin(day_of_year * 0.02), 1)
    directions_map = {"N": "Norte", "NW": "Noroeste", "W": "Oeste", "SW": "Sudoeste"}
    wave_dir = directions_map.get(zone["condicoes"]["vento_predominante"], "Noroeste")

    # Vento
    wind_speed = round(10 + 18 * abs(math.sin(lat * 0.4 + day_of_year * 0.08)) * seasonal, 1)
    wind_gusts = round(wind_speed * 1.4, 1)

    # Temperatura da água (mais quente no Algarve, mais fria no Norte)
    base_temp = 14 + (42 - lat) * 0.8
    seasonal_temp = base_temp + 4 * math.sin(2 * math.pi * (day_of_year - 60) / 365)
    water_temp = round(seasonal_temp, 1)

    # UV
    solar_el = max(0, math.sin(math.radians(lat)) * math.sin(math.radians(-23.45 * math.cos(math.radians(360 / 365 * (day_of_year + 10)))))
                   + math.cos(math.radians(lat)) * math.cos(math.radians(-23.45 * math.cos(math.radians(360 / 365 * (day_of_year + 10)))))
                   * math.cos(math.radians(15 * (hour - 12))))
    uv = round(min(11, 10 * solar_el), 1)

    # Segurança / bandeira
    seg = zone["condicoes"]["seguranca"]
    flag_map = {
        "muito_alta": ("verde", "Segura"),
        "alta": ("verde", "Segura"),
        "media": ("amarelo", "Precaução"),
        "baixa": ("vermelho", "Perigosa"),
    }
    flag_cor, nivel = flag_map.get(seg, ("amarelo", "Precaução"))
    if wave_h > 3.0:
        flag_cor, nivel = "vermelho", "Perigosa"
    if wave_h > 5.0:
        flag_cor, nivel = "roxo", "Interdita"

    observacao_map = {
        "verde": "Condições seguras para banhos e atividades aquáticas.",
        "amarelo": "Atenção às correntes e às ondas. Recomenda-se cautela.",
        "vermelho": "Condições perigosas. Desaconselhados os banhos.",
        "roxo": "Condições extremas. Acesso interdito à orla.",
    }

    return {
        "mares": {
            "altura_atual_m": tide_height,
            "estado": tide_direction,
            "proxima_mares": proximas_mares,
        },
        "ondas": {
            "altura_m": wave_h,
            "periodo_s": wave_period,
            "direcao": wave_dir,
        },
        "vento": {
            "velocidade_kmh": wind_speed,
            "direcao": zone["condicoes"]["vento_predominante"],
            "rajadas_kmh": wind_gusts,
        },
        "ambiental": {
            "temperatura_agua_c": water_temp,
            "uv_index": uv,
            "visibilidade_km": round(15 + 10 * math.sin(day_of_year * 0.03), 1),
        },
        "seguranca": {
            "flag_cor": flag_cor,
            "nivel": nivel,
            "observacao": observacao_map[flag_cor],
        },
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@costa_router.get("/")
async def list_costa_zones(
    region: Optional[str] = Query(None, description="Norte | Centro | Lisboa | Alentejo | Algarve"),
    perfil: Optional[str] = Query(None, description="surfer | familia | fotografo | natureza — ordena por este perfil (desc)"),
    order_by: str = Query("order", description="order | name | region"),
):
    """Lista todas as zonas costeiras com filtros opcionais por região e ordenação por perfil."""
    zones = list(COASTAL_ZONES)

    if region:
        zones = [z for z in zones if z["region"].lower() == region.lower()]

    valid_perfis = {"surfer", "familia", "fotografo", "natureza"}
    if perfil and perfil in valid_perfis:
        # Sort descending by the chosen perfil score
        zones = sorted(zones, key=lambda z: z["perfis"].get(perfil, 0), reverse=True)
    elif order_by == "name":
        zones = sorted(zones, key=lambda z: z["name"])
    elif order_by == "region":
        zones = sorted(zones, key=lambda z: (z["region"], z["order"]))
    # default: keep natural order (already ordered by "order" field)

    # Remove internal detail for list view
    return {
        "zones": [
            {k: v for k, v in z.items() if k not in ("lenda", "biodiversidade")}
            for z in zones
        ],
        "total": len(zones),
        "filters": {"region": region, "perfil": perfil, "order_by": perfil if (perfil and perfil in valid_perfis) else order_by},
        "source": "costa_curated_v1",
    }


@costa_router.get("/compare/{zone_a}/{zone_b}")
async def compare_zones(zone_a: str, zone_b: str):
    """Compara duas zonas costeiras lado a lado."""
    za = _ZONES_BY_ID.get(zone_a)
    zb = _ZONES_BY_ID.get(zone_b)
    if not za:
        raise HTTPException(status_code=404, detail=f"Zona '{zone_a}' não encontrada")
    if not zb:
        raise HTTPException(status_code=404, detail=f"Zona '{zone_b}' não encontrada")

    def _score(z: dict, perfil: str) -> int:
        return z["perfis"].get(perfil, 0)

    return {
        "zones": [za, zb],
        "comparison": {
            "perfis": {
                perfil: {za["id"]: _score(za, perfil), zb["id"]: _score(zb, perfil)}
                for perfil in ("surfer", "familia", "fotografo", "natureza")
            },
            "ondas": {za["id"]: za["condicoes"]["ondas_media_m"], zb["id"]: zb["condicoes"]["ondas_media_m"]},
            "melhor_surfer": za["id"] if za["perfis"]["surfer"] >= zb["perfis"]["surfer"] else zb["id"],
            "melhor_familia": za["id"] if za["perfis"]["familia"] >= zb["perfis"]["familia"] else zb["id"],
            "melhor_fotografia": za["id"] if za["perfis"]["fotografo"] >= zb["perfis"]["fotografo"] else zb["id"],
        },
    }


@costa_router.get("/{zone_id}/conditions")
async def get_zone_conditions(zone_id: str):
    """Condições ambientais simuladas para uma zona costeira."""
    zone = _ZONES_BY_ID.get(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zona '{zone_id}' não encontrada")
    return _simulate_conditions(zone)


@costa_router.get("/{zone_id}")
async def get_costa_zone(zone_id: str):
    """Detalhe completo de uma zona costeira."""
    zone = _ZONES_BY_ID.get(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zona '{zone_id}' não encontrada")
    return {**zone, "conditions": _simulate_conditions(zone)}
