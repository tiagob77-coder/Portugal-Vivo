import json
from shapely.geometry import Point, shape
import geopandas as gpd

def load_portugal_limits():
    return gpd.read_file("references/limites_portugal.geojson")

def validar_coordenadas(lat, lon):
    erros = []
    alteracoes = []

    # Corrigir vírgulas
    if isinstance(lat, str):
        lat = lat.replace(",", ".")
    if isinstance(lon, str):
        lon = lon.replace(",", ".")

    try:
        lat = float(lat)
        lon = float(lon)
    except:
        erros.append("Coordenadas não numéricas.")
        return None, None, erros, alteracoes

    # Inversão lat/lon
    if abs(lat) > 90 or abs(lon) > 180:
        lat, lon = lon, lat
        alteracoes.append("Coordenadas invertidas (lat/lon).")

    # Zero absoluto
    if lat == 0 and lon == 0:
        erros.append("Coordenadas (0,0) inválidas.")

    # Range básico
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        erros.append("Coordenadas fora do range global.")

    return round(lat, 6), round(lon, 6), erros, alteracoes

def validar_em_portugal(lat, lon, portugal_limits):
    point = Point(lon, lat)
    for _, row in portugal_limits.iterrows():
        if shape(row["geometry"]).contains(point):
            return True
    return False

def processar_poi(poi):
    portugal_limits = load_portugal_limits()

    lat, lon, erros, alteracoes = validar_coordenadas(
        poi.get("latitude"),
        poi.get("longitude")
    )

    if lat is None:
        poi["validacao_gps"] = {"erros": erros, "alteracoes": alteracoes}
        return poi

    dentro = validar_em_portugal(lat, lon, portugal_limits)

    poi["latitude"] = lat
    poi["longitude"] = lon
    poi["validacao_gps"] = {
        "erros": erros,
        "alteracoes": alteracoes,
        "dentro_portugal": dentro
    }

    return poi
