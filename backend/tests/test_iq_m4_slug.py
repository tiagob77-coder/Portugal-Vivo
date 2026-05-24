"""Pure-function tests for M4 slug helpers: _generate_checksum (stable
5-char hash) and _generate_aliases (short / region-prefixed / initials)."""
from iq_engine_base import POIProcessingData
from iq_module_m4_slug import SlugGeneratorModule

_M = SlugGeneratorModule()


def _data(name="Castelo de São Jorge", region=None):
    return POIProcessingData(id="poi-1", name=name, description="", region=region)


# ── _generate_checksum ────────────────────────────────────────────────────────

def test_checksum_length_is_five():
    assert len(_M._generate_checksum("poi-1", "Castelo")) == 5


def test_checksum_is_uppercase_hex():
    cs = _M._generate_checksum("poi-1", "Castelo")
    assert all(c in "0123456789ABCDEF" for c in cs)


def test_checksum_stable_for_same_input():
    a = _M._generate_checksum("poi-1", "Castelo")
    b = _M._generate_checksum("poi-1", "Castelo")
    assert a == b


def test_checksum_differs_when_id_changes():
    a = _M._generate_checksum("poi-1", "Castelo")
    b = _M._generate_checksum("poi-2", "Castelo")
    assert a != b


def test_checksum_differs_when_name_changes():
    a = _M._generate_checksum("poi-1", "Castelo")
    b = _M._generate_checksum("poi-1", "Mosteiro")
    assert a != b


# ── _generate_aliases ─────────────────────────────────────────────────────────

def test_aliases_short_version_for_long_name():
    aliases = _M._generate_aliases(_data(name="Mosteiro dos Jerónimos de Lisboa"))
    # First-3-words short slug should be present.
    assert any("mosteiro" in a and "jeronimos" in a for a in aliases)


def test_aliases_region_prefixed_when_region_given():
    aliases = _M._generate_aliases(_data(name="Castelo", region="Norte"))
    assert any(a.startswith("norte-") for a in aliases)


def test_aliases_no_region_prefix_when_no_region():
    aliases = _M._generate_aliases(_data(name="Castelo de São Jorge"))
    # No region → no region-prefixed alias.
    assert not any(a.startswith("none-") for a in aliases)


def test_aliases_includes_initials_for_multi_word_name():
    aliases = _M._generate_aliases(_data(name="Centro Cultural de Belém"))
    # Initials "CCdB" → "ccdb".
    assert "ccdb" in aliases


def test_aliases_region_prefixed_length_capped_at_eighty():
    long_name = "x " * 60   # very long
    aliases = _M._generate_aliases(_data(name=long_name, region="Norte"))
    for a in aliases:
        assert len(a) <= 80
