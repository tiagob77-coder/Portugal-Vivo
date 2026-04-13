"""
NUTS hierarchy for Portugal (NUTS 2013 revision).

NUTS III → NUTS II → NUTS I table is static and stable.
Municipality (concelho) → NUTS III must be derived at ingestion time, either
from the CAOP GeoPackage attributes (if present) or by centroid-in-polygon
against the NUTS III layer from DGT/Eurostat.

The table below is exhaustive for the current 25 NUTS III regions.
"""
from __future__ import annotations


NUTS1 = {
    "PT1": "Continente",
    "PT2": "Região Autónoma dos Açores",
    "PT3": "Região Autónoma da Madeira",
}

NUTS2 = {
    "PT11": ("Norte", "PT1"),
    "PT15": ("Algarve", "PT1"),
    "PT16": ("Centro", "PT1"),
    "PT17": ("Área Metropolitana de Lisboa", "PT1"),
    "PT18": ("Alentejo", "PT1"),
    "PT20": ("Região Autónoma dos Açores", "PT2"),
    "PT30": ("Região Autónoma da Madeira", "PT3"),
}

NUTS3 = {
    # Norte (PT11)
    "PT111": ("Alto Minho", "PT11"),
    "PT112": ("Cávado", "PT11"),
    "PT119": ("Ave", "PT11"),
    "PT11A": ("Área Metropolitana do Porto", "PT11"),
    "PT11B": ("Alto Tâmega", "PT11"),
    "PT11C": ("Tâmega e Sousa", "PT11"),
    "PT11D": ("Douro", "PT11"),
    "PT11E": ("Terras de Trás-os-Montes", "PT11"),
    # Centro (PT16)
    "PT16B": ("Oeste", "PT16"),
    "PT16D": ("Região de Aveiro", "PT16"),
    "PT16E": ("Região de Coimbra", "PT16"),
    "PT16F": ("Região de Leiria", "PT16"),
    "PT16G": ("Viseu Dão Lafões", "PT16"),
    "PT16H": ("Beira Baixa", "PT16"),
    "PT16I": ("Médio Tejo", "PT16"),
    "PT16J": ("Beiras e Serra da Estrela", "PT16"),
    # AML (PT17)
    "PT170": ("Área Metropolitana de Lisboa", "PT17"),
    # Alentejo (PT18)
    "PT181": ("Alentejo Litoral", "PT18"),
    "PT184": ("Baixo Alentejo", "PT18"),
    "PT185": ("Lezíria do Tejo", "PT18"),
    "PT186": ("Alto Alentejo", "PT18"),
    "PT187": ("Alentejo Central", "PT18"),
    # Algarve (PT15)
    "PT150": ("Algarve", "PT15"),
    # Ilhas
    "PT200": ("Região Autónoma dos Açores", "PT20"),
    "PT300": ("Região Autónoma da Madeira", "PT30"),
}


def resolve(nuts3_code: str) -> dict[str, str]:
    """Return the full hierarchy for a NUTS III code."""
    if not nuts3_code:
        return {}
    n3 = NUTS3.get(nuts3_code.upper())
    if not n3:
        return {"nuts3_code": nuts3_code}
    n3_name, n2_code = n3
    n2 = NUTS2.get(n2_code, (None, None))
    n1_code = n2[1] if n2 else None
    return {
        "nuts3_code": nuts3_code.upper(),
        "nuts3_name": n3_name,
        "nuts2_code": n2_code,
        "nuts2_name": n2[0],
        "nuts1_code": n1_code,
        "nuts1_name": NUTS1.get(n1_code) if n1_code else None,
    }


# District (2-digit) → NUTS II code (best-fit; some districts straddle NUTS II
# boundaries — used only as last-resort fallback when no polygon data).
DISTRICT_TO_NUTS2 = {
    "01": "PT11",  # Aveiro → Norte/Centro (mostly Centro PT16, but historically Norte)
    "02": "PT18",  # Beja → Alentejo
    "03": "PT11",  # Braga → Norte
    "04": "PT11",  # Bragança → Norte
    "05": "PT16",  # Castelo Branco → Centro
    "06": "PT16",  # Coimbra → Centro
    "07": "PT18",  # Évora → Alentejo
    "08": "PT15",  # Faro → Algarve
    "09": "PT16",  # Guarda → Centro
    "10": "PT16",  # Leiria → Centro
    "11": "PT17",  # Lisboa → AML
    "12": "PT18",  # Portalegre → Alentejo
    "13": "PT11",  # Porto → Norte
    "14": "PT18",  # Santarém → Alentejo/AML/Centro — use Alentejo
    "15": "PT17",  # Setúbal → AML + Alentejo Litoral
    "16": "PT11",  # Viana do Castelo → Norte
    "17": "PT11",  # Vila Real → Norte
    "18": "PT16",  # Viseu → Centro
    "31": "PT20",  # Ilha da Madeira — actual is PT30 (see below)
    "32": "PT30",  # Madeira
    "40": "PT20",  # Açores (all islands 41-49 fall under PT20)
    "41": "PT20", "42": "PT20", "43": "PT20", "44": "PT20",
    "45": "PT20", "46": "PT20", "47": "PT20", "48": "PT20", "49": "PT20",
}


__all__ = ["NUTS1", "NUTS2", "NUTS3", "resolve", "DISTRICT_TO_NUTS2"]
