"""
CAOP normalization helpers.

Pure-Python (no I/O). Shared by ingestion and runtime lookup so the same
normalization rules are applied end-to-end.
"""
from __future__ import annotations

import re
import unicodedata


_UF_PREFIXES = (
    "união das freguesias de ",
    "uniao das freguesias de ",
    "freguesia de ",
    "freguesia da ",
    "freguesia do ",
    "freguesia dos ",
    "freguesia das ",
)


def strip_diacritics(text: str) -> str:
    """Remove combining marks while preserving the base letters."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def clean_name(raw: str) -> str:
    """
    Canonical form for search/comparison:

    - lowercase
    - strips 'União das Freguesias de …' / 'Freguesia de …' prefixes
    - removes diacritics and punctuation other than inner dashes
    - collapses whitespace
    """
    if not raw:
        return ""
    s = raw.strip()
    lower = s.lower()
    for prefix in _UF_PREFIXES:
        if lower.startswith(prefix):
            s = s[len(prefix):]
            break
    s = strip_diacritics(s).lower()
    s = re.sub(r"[^a-z0-9\-\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def title_case_pt(raw: str) -> str:
    """
    Portuguese-aware title-case. Keeps short connectives (de, do, da, dos, das,
    e) in lowercase unless they are the first word.
    """
    if not raw:
        return ""
    lowercase_words = {"de", "do", "da", "dos", "das", "e", "a", "o"}
    parts = raw.strip().split()
    out: list[str] = []
    for i, p in enumerate(parts):
        lp = p.lower()
        if i > 0 and lp in lowercase_words:
            out.append(lp)
        else:
            out.append(p[:1].upper() + p[1:].lower())
    return " ".join(out)


def parse_dtmnfr(code: str | int | None) -> tuple[str, str, str]:
    """
    DTMNFR is 6 digits: DD + MM + FFF.
    Returns (district_code_2, municipality_code_4, parish_code_6).
    Any zero-padding issues are fixed.
    """
    if code is None:
        return ("", "", "")
    s = str(code).strip().zfill(6)
    return (s[:2], s[:4], s)


__all__ = ["clean_name", "strip_diacritics", "title_case_pt", "parse_dtmnfr"]
