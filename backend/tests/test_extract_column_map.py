"""Regression tests for extract_poi_gps_v19._build_column_map — specifically
the geocoding-anchor capture. The nature & gastronomy sheets carry no plain
'Localidade' column; their geocodable place lives in 'Onde Observar' (Flora),
'Habitat'/'Local' (Fauna), 'Local Emblemático' (Pratos/Doçaria) or
'Restaurante Sugerido' (Sopas). Before this mapping those rows reached the
geocoder with no locality and fell back to the region centroid (~100 km off);
mapping them to `localidade` lets the geocoder resolve a precise point."""
from extract_poi_gps_v19 import _build_column_map


def test_plain_localidade_still_mapped():
    cmap = _build_column_map(["Nome", "Região", "Localidade", "Descrição"])
    assert cmap["localidade"] == 2


def test_localizacao_maps_to_localidade():
    cmap = _build_column_map(["Nome", "Região", "Localização", "GPS"])
    assert cmap["localidade"] == 2


def test_flora_onde_observar_maps_to_localidade():
    # Flora Autóctone header (real layout).
    headers = ["#", "Espécie", "Estatuto", "Região", "Floração",
               "Curiosidade", "Onde Observar", "Descrição", "GPS (Maps)"]
    cmap = _build_column_map(headers)
    assert cmap.get("localidade") == 6  # "Onde Observar"


def test_fauna_habitat_maps_to_localidade():
    # Fauna Autóctone header (real layout): Habitat at E(4), Local at F(5).
    headers = ["#", "Espécie", "Tipo / Classe", "Região", "Habitat",
               "Local", "Raridade", "Descrição", "GPS (Maps)"]
    cmap = _build_column_map(headers)
    # "Habitat" comes before "Local" in the header, so it wins setdefault.
    assert cmap.get("localidade") == 4


def test_bare_local_column_maps_to_localidade():
    headers = ["Nome", "Região", "Local"]
    cmap = _build_column_map(headers)
    assert cmap.get("localidade") == 2


def test_local_emblematico_maps_to_localidade():
    headers = ["#", "Prato", "Região", "Descrição", "Local Emblemático 1", "GPS 1"]
    cmap = _build_column_map(headers)
    assert cmap.get("localidade") == 4


def test_restaurante_sugerido_maps_to_localidade():
    headers = ["Região", "Nº", "Nome da Sopa", "Descrição / Notas",
               "Restaurante Sugerido", "Localização", "GPS"]
    cmap = _build_column_map(headers)
    # "Restaurante Sugerido" (idx 4) and "Localização" (idx 5) both qualify;
    # whichever the loop hits first via setdefault wins — Localização is the
    # more precise label, and it appears later, so the anchor (idx 4) wins.
    assert cmap.get("localidade") == 4


def test_real_localidade_wins_over_anchor_when_both_present():
    # A dedicated Localidade column must take priority over a generic anchor.
    headers = ["Nome", "Localidade", "Região", "Habitat"]
    cmap = _build_column_map(headers)
    assert cmap["localidade"] == 1  # "Localidade", not "Habitat"


def test_anchor_does_not_clobber_morada_address():
    # Morada must still map to address, independent of the anchor capture.
    headers = ["Nome", "Região", "Morada", "Local"]
    cmap = _build_column_map(headers)
    assert cmap["address"] == 2
    assert cmap["localidade"] == 3


def test_gps_column_still_detected_alongside_anchor():
    headers = ["#", "Espécie", "Região", "Onde Observar", "GPS (Maps)"]
    cmap = _build_column_map(headers)
    assert cmap.get("gps") == 4
    assert cmap.get("localidade") == 3


def test_no_anchor_no_localidade_key():
    cmap = _build_column_map(["Nome", "Região", "Cor", "Preço"])
    assert "localidade" not in cmap
