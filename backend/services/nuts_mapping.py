"""
NUTS hierarchy for Portugal (NUTS 2024 revision — aligned with CAOP 2025).

CAOP 2025 uses the NUTS 2024 (Regulamento (UE) 2022/2104) codes, notably:
  - Centro changed PT16 → PT19 (PT191..PT196)
  - AML split: PT1A (Grande Lisboa) + PT1B (Península de Setúbal)
  - Alentejo changed PT18 → PT1C (PT1C1..PT1C4), with Oeste/Médio Tejo/Lezíria
    grouped into the new PT1D (Oeste e Vale do Tejo)

Legacy NUTS 2013 codes (PT16x, PT170, PT18x) are kept as aliases in _LEGACY
so old data/tests resolve correctly.

Municipality (concelho) → NUTS III must be derived from the CAOP GeoPackage
attributes (authoritative) rather than from DISTRICT_TO_NUTS2 which is a
best-fit fallback only.
"""
from __future__ import annotations


NUTS1 = {
    "PT1": "Continente",
    "PT2": "Região Autónoma dos Açores",
    "PT3": "Região Autónoma da Madeira",
}

# NUTS II (2024): nine regions in Continente + two Ilhas
NUTS2 = {
    "PT11": ("Norte", "PT1"),
    "PT15": ("Algarve", "PT1"),
    "PT19": ("Centro", "PT1"),                          # was PT16 in 2013
    "PT1A": ("Área Metropolitana de Lisboa", "PT1"),    # was PT170 in 2013
    "PT1B": ("Península de Setúbal", "PT1"),            # split from PT17
    "PT1C": ("Alentejo", "PT1"),                        # was PT18 in 2013
    "PT1D": ("Oeste e Vale do Tejo", "PT1"),            # new grouping
    "PT20": ("Região Autónoma dos Açores", "PT2"),
    "PT30": ("Região Autónoma da Madeira", "PT3"),
    # Legacy NUTS 2013 aliases
    "PT16": ("Centro", "PT1"),
    "PT17": ("Área Metropolitana de Lisboa", "PT1"),
    "PT18": ("Alentejo", "PT1"),
}

# NUTS III (2024): 25 regions in Continente + 1 Açores + 1 Madeira
NUTS3 = {
    # Norte (PT11) — unchanged except rename of PT11B
    "PT111": ("Alto Minho", "PT11"),
    "PT112": ("Cávado", "PT11"),
    "PT119": ("Ave", "PT11"),
    "PT11A": ("Área Metropolitana do Porto", "PT11"),
    "PT11B": ("Alto Tâmega e Barroso", "PT11"),
    "PT11C": ("Tâmega e Sousa", "PT11"),
    "PT11D": ("Douro", "PT11"),
    "PT11E": ("Terras de Trás-os-Montes", "PT11"),
    # Algarve (PT15)
    "PT150": ("Algarve", "PT15"),
    # Centro (PT19) — renumbered from 2013 PT16
    "PT191": ("Região de Aveiro", "PT19"),
    "PT192": ("Região de Coimbra", "PT19"),
    "PT193": ("Região de Leiria", "PT19"),
    "PT194": ("Viseu Dão Lafões", "PT19"),
    "PT195": ("Beira Baixa", "PT19"),
    "PT196": ("Beiras e Serra da Estrela", "PT19"),
    # Área Metropolitana de Lisboa (PT1A) — split from former PT17
    "PT1A0": ("Grande Lisboa", "PT1A"),
    # Península de Setúbal (PT1B) — new
    "PT1B0": ("Península de Setúbal", "PT1B"),
    # Alentejo (PT1C) — renumbered from 2013 PT18
    "PT1C1": ("Alentejo Litoral", "PT1C"),
    "PT1C2": ("Baixo Alentejo", "PT1C"),
    "PT1C3": ("Alto Alentejo", "PT1C"),
    "PT1C4": ("Alentejo Central", "PT1C"),
    # Oeste e Vale do Tejo (PT1D) — new
    "PT1D1": ("Oeste", "PT1D"),
    "PT1D2": ("Médio Tejo", "PT1D"),
    "PT1D3": ("Lezíria do Tejo", "PT1D"),
    # Ilhas
    "PT200": ("Região Autónoma dos Açores", "PT20"),
    "PT300": ("Região Autónoma da Madeira", "PT30"),
    # ─── Legacy NUTS 2013 aliases (retained so older data still resolves) ───
    "PT16B": ("Oeste", "PT16"),
    "PT16D": ("Região de Aveiro", "PT16"),
    "PT16E": ("Região de Coimbra", "PT16"),
    "PT16F": ("Região de Leiria", "PT16"),
    "PT16G": ("Viseu Dão Lafões", "PT16"),
    "PT16H": ("Beira Baixa", "PT16"),
    "PT16I": ("Médio Tejo", "PT16"),
    "PT16J": ("Beiras e Serra da Estrela", "PT16"),
    "PT170": ("Área Metropolitana de Lisboa", "PT17"),
    "PT181": ("Alentejo Litoral", "PT18"),
    "PT184": ("Baixo Alentejo", "PT18"),
    "PT185": ("Lezíria do Tejo", "PT18"),
    "PT186": ("Alto Alentejo", "PT18"),
    "PT187": ("Alentejo Central", "PT18"),
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


# District (2-digit DT) → NUTS II code (best-fit; many districts straddle
# multiple NUTS II regions — used only as last-resort fallback when CAOP
# per-feature data is missing. Prefer reading nuts3_cod from CAOP attrs).
DISTRICT_TO_NUTS2 = {
    "01": "PT19",  # Aveiro → Centro (most of district)
    "02": "PT1C",  # Beja → Alentejo
    "03": "PT11",  # Braga → Norte
    "04": "PT11",  # Bragança → Norte
    "05": "PT19",  # Castelo Branco → Centro (Beira Baixa)
    "06": "PT19",  # Coimbra → Centro
    "07": "PT1C",  # Évora → Alentejo
    "08": "PT15",  # Faro → Algarve
    "09": "PT19",  # Guarda → Centro
    "10": "PT19",  # Leiria → Centro (also some Oeste PT1D)
    "11": "PT1A",  # Lisboa → AML (also Oeste PT1D)
    "12": "PT1C",  # Portalegre → Alentejo
    "13": "PT11",  # Porto → Norte
    "14": "PT1D",  # Santarém → Oeste e Vale do Tejo
    "15": "PT1B",  # Setúbal → Península de Setúbal (Alentejo Litoral PT1C for south)
    "16": "PT11",  # Viana do Castelo → Norte
    "17": "PT11",  # Vila Real → Norte
    "18": "PT19",  # Viseu → Centro
    # Archipelagos (CAOP assigns 2-digit DT to islands)
    "31": "PT30",  # Ilha da Madeira
    "32": "PT30",  # Porto Santo
    "40": "PT20", "41": "PT20", "42": "PT20", "43": "PT20", "44": "PT20",
    "45": "PT20", "46": "PT20", "47": "PT20", "48": "PT20", "49": "PT20",
}


__all__ = ["NUTS1", "NUTS2", "NUTS3", "resolve", "DISTRICT_TO_NUTS2"]
