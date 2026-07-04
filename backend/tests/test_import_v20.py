"""
Unit tests for the v20 → app schema importer transforms (pure functions, no DB).
"""
from import_v20 import resolve_category, to_heritage, to_event, region_id, rarity_id


class TestResolveCategory:
    def test_folha_exact_match(self):
        cid, main = resolve_category("Percursos Pedestres")
        assert cid == "percursos_pedestres"
        assert main == "territorio_natureza"

    def test_folha_alias(self):
        cid, _ = resolve_category("Sopas Típicas")
        assert cid == "pratos_tipicos"

    def test_categoria_fallback(self):
        # generic master sheet → resolved from categoria
        cid, main = resolve_category("Base de Dados POI", categoria="Geologia")
        assert cid == "arqueologia_geologia"
        assert main == "territorio_natureza"

    def test_festas(self):
        cid, main = resolve_category("Festas e Romarias")
        assert cid == "festas_romarias" and main == "cultura_viva"


class TestRegionRarity:
    def test_region_from_name(self):
        assert region_id("Norte") == "norte"
        assert region_id("Açores") == "acores"

    def test_region_from_distrito(self):
        assert region_id("", "Vila Real") == "norte"
        assert region_id(None, "Faro") == "algarve"

    def test_rarity(self):
        assert rarity_id("⭐ Épico") == "epico"
        assert rarity_id("Raro") == "raro"
        assert rarity_id(None) == "comum"


class TestToHeritage:
    def _doc(self, **kw):
        base = {
            "poi_id": "POIS_X_0001", "slug": "torre-de-belem", "nome": "Torre de Belém",
            "folha_origem": "Base de Dados POI", "categoria": "História",
            "regiao": "Lisboa", "concelho": "Lisboa", "distrito": "Lisboa",
            "descricao": "Monumento manuelino.", "raridade": "⭐ Épico",
            "location": {"type": "Point", "coordinates": [-9.2160, 38.6916]},
        }
        base.update(kw)
        return base

    def test_geojson_to_latlng(self):
        h = to_heritage(self._doc())
        assert h["location"] == {"lat": 38.6916, "lng": -9.216}
        assert h["geo_location"]["coordinates"] == [-9.216, 38.6916]
        assert h["geo_precision"] == "exact"

    def test_identity_and_category(self):
        h = to_heritage(self._doc())
        assert h["id"] == "POIS_X_0001"
        assert h["category"] == "museus"  # História → museus alias
        assert h["main_category"] == "historia_patrimonio"
        assert h["status"] == "active" and h["source"] == "v20_import"
        assert h["rarity"] == "epico"

    def test_geocode_fallback_when_no_location(self):
        d = self._doc()
        d.pop("location")
        h = to_heritage(d)
        # Lisboa concelho → geocoded coordinates present
        assert "location" in h and h["geo_precision"] != "exact"


class TestToEvent:
    def test_festa_emitted(self):
        d = {
            "poi_id": "EVEN_FESTAS_E_ROM_0001", "slug": "festa-x", "nome": "Festa X",
            "folha_origem": "Festas e Romarias", "regiao": "Norte", "concelho": "Braga",
            "descricao": "Romaria.", "raridade": "Raro",
            "location": {"type": "Point", "coordinates": [-8.43, 41.55]},
        }
        e = to_event(d)
        assert e is not None
        assert e["type"] == "festa"
        assert e["region"] == "Norte"
        assert e["location_geo"]["coordinates"] == [-8.43, 41.55]

    def test_festival_type(self):
        d = {"poi_id": "EVEN_FEST_0001", "nome": "Fest", "folha_origem": "Festivais de Música",
             "regiao": "Lisboa", "concelho": "Lisboa"}
        e = to_event(d)
        assert e and e["type"] == "festival"

    def test_market_not_an_event(self):
        d = {"poi_id": "EVEN_MERC_0001", "nome": "Mercado", "folha_origem": "Mercados e Feiras"}
        assert to_event(d) is None
