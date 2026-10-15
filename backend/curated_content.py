"""
Curated sheet text: the Resumo, História, Crianças and Enciclopédia texts an
editor writes on a POI from official sources.

Read wherever an editor may have put them, so the app serves the verified
text instead of asking an LLM:

    conteudo: {resumo, historia, criancas, enciclopedia, fontes, verificado_em}   (preferred)
    resumo / historia / criancas / enciclopedia at the top level of the sheet
    content_depth: {snackable, historia, criancas, enciclopedico}

Accented keys (crianças, enciclopédia, história) are accepted. The
Enciclopédia may be a plain text or its research axes as a dict
({"Origem": "…"}) or a list ([{"eixo": "Origem", "texto": "…"}]).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

# Depth level used by /content/depth → name of the curated field.
DEPTH_FIELDS = {
    "snackable": "resumo",
    "historia": "historia",
    "criancas": "criancas",
    "enciclopedico": "enciclopedia",
}
CURATED_FIELDS = tuple(DEPTH_FIELDS.values())

_ALIASES = {
    "resumo": ("resumo",),
    "historia": ("historia", "história"),
    "criancas": ("criancas", "crianças"),
    "enciclopedia": ("enciclopedia", "enciclopédia"),
}

# Fields a projection must include for the reader to work.
CURATED_PROJECTION = {
    "conteudo": 1, "content_depth": 1, "fontes": 1, "sources": 1, "verificado_em": 1,
    **{alias: 1 for aliases in _ALIASES.values() for alias in aliases},
}


def _as_text(value: Any) -> str:
    """A text, or research axes ({title: text} / [{eixo, texto}]) joined as paragraphs."""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        parts = [f"{title}\n{_as_text(body)}" for title, body in value.items() if _as_text(body)]
        return "\n\n".join(parts)
    if isinstance(value, list):
        parts = []
        for entry in value:
            if isinstance(entry, dict):
                title = entry.get("eixo") or entry.get("titulo") or entry.get("title") or ""
                body = _as_text(entry.get("texto") or entry.get("text") or entry.get("conteudo") or "")
                if body:
                    parts.append(f"{title}\n{body}" if title else body)
            elif _as_text(entry):
                parts.append(_as_text(entry))
        return "\n\n".join(parts)
    return ""


def curated_field(item: dict, field: str) -> str:
    """Curated text of ``field`` (resumo, historia, criancas, enciclopedia) or ""."""
    containers = [item.get("conteudo"), item]
    for container in containers:
        if not isinstance(container, dict):
            continue
        for key in _ALIASES[field]:
            text = _as_text(container.get(key))
            if text:
                return text
    depth = next((d for d, f in DEPTH_FIELDS.items() if f == field), None)
    legacy = item.get("content_depth")
    if depth and isinstance(legacy, dict):
        return _as_text(legacy.get(depth))
    return ""


def curated_text(item: dict, depth: str) -> str:
    field = DEPTH_FIELDS.get(depth)
    return curated_field(item, field) if field else ""


def curated_texts(item: dict) -> Dict[str, str]:
    """The curated fields that have text, keyed by field name."""
    texts = {field: curated_field(item, field) for field in CURATED_FIELDS}
    return {field: text for field, text in texts.items() if text}


def curated_sources(item: dict) -> List[Dict[str, str]]:
    """Sources recorded on the sheet as [{titulo, url?}]."""
    conteudo = item.get("conteudo") if isinstance(item.get("conteudo"), dict) else {}
    raw = conteudo.get("fontes") or item.get("fontes") or item.get("sources") or []
    if isinstance(raw, (str, dict)):
        raw = [raw]
    sources = []
    for entry in raw if isinstance(raw, list) else []:
        if isinstance(entry, str) and entry.strip():
            value = entry.strip()
            sources.append({"titulo": value, "url": value} if value.startswith("http") else {"titulo": value})
        elif isinstance(entry, dict):
            title = entry.get("titulo") or entry.get("title") or entry.get("nome") or entry.get("url") or ""
            url = entry.get("url") or entry.get("link") or ""
            if title:
                sources.append({"titulo": str(title), **({"url": str(url)} if url else {})})
    return sources


def verified_at(item: dict) -> Optional[str]:
    conteudo = item.get("conteudo") if isinstance(item.get("conteudo"), dict) else {}
    value = conteudo.get("verificado_em") or item.get("verificado_em")
    return str(value) if value else None
