"""
Epoch Classification API - Classify and filter POIs by historical period
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import re

from shared_utils import DatabaseHolder
from premium_guard import require_feature

epochs_router = APIRouter(prefix="/epochs", tags=["epochs"])
_db_holder = DatabaseHolder("epochs")
set_db = _db_holder.set

# Epoch definitions with keywords for classification
EPOCHS = {
    "pre_historia": {
        "name": "Pré-História",
        "period": "Antes de 218 a.C.",
        "color": "#8B4513",
        "icon": "architecture",
        "keywords": ["paleolít", "neolít", "rupestre", "megalít", "dolmen", "menir", "anta", "mamoa", "castro", "citânia", "gravura", "petroglifo", "idade do bronze", "idade do ferro", "pré-histór"],
    },
    "romano": {
        "name": "Romano",
        "period": "218 a.C. - 409 d.C.",
        "color": "#DC2626",
        "icon": "account_balance",
        "keywords": ["roman", "villa", "termas roman", "ponte roman", "lusitânia", "conimbriga", "bracara", "olisipo", "via romana", "mosaico roman", "aqueduto"],
    },
    "medieval": {
        "name": "Medieval",
        "period": "409 - 1415",
        "color": "#7C3AED",
        "icon": "castle",
        "keywords": ["medieval", "castelo", "muralha", "românic", "gótic", "templári", "cruzad", "reconquista", "fortaleza", "torre de menagem", "mosteiro", "convento medieval", "fundação de portugal"],
    },
    "manuelino": {
        "name": "Manuelino / Descobrimentos",
        "period": "1415 - 1580",
        "color": "#2563EB",
        "icon": "sailing",
        "keywords": ["manuelino", "descobriment", "navegaç", "torre de belém", "jerónimos", "vasco da gama", "infante d. henrique", "manuelin", "renasciment", "quinhentist"],
    },
    "barroco": {
        "name": "Barroco / Iluminismo",
        "period": "1580 - 1820",
        "color": "#D97706",
        "icon": "church",
        "keywords": ["barroc", "nasoni", "talha dourada", "azulejo", "pombalin", "joanin", "rococó", "clérigos", "palácio", "solar", "capela barroc", "igreja barroc"],
    },
    "contemporaneo": {
        "name": "Contemporâneo",
        "period": "1820 - Presente",
        "color": "#059669",
        "icon": "apartment",
        "keywords": ["contemporâne", "modern", "arte urbana", "street art", "industrial", "fábrica", "art déco", "art nouveau", "república", "revolução", "25 de abril", "siza vieira", "souto moura"],
    },
}


def classify_epoch(item: dict) -> list:
    """Classify a POI into historical epochs based on tags, description, and category."""
    epochs = []
    text = " ".join([
        (item.get("name") or ""),
        (item.get("description") or ""),
        " ".join(item.get("tags") or []),
        (item.get("subcategory") or ""),
        (item.get("category") or ""),
    ]).lower()

    for epoch_id, epoch_data in EPOCHS.items():
        for keyword in epoch_data["keywords"]:
            if keyword.lower() in text:
                epochs.append(epoch_id)
                break

    return epochs if epochs else ["sem_epoca"]


@epochs_router.get("", dependencies=[Depends(require_feature("epochs"))])
async def list_epochs():
    """List all historical epochs with counts (Premium)."""
    result = []
    for epoch_id, epoch_data in EPOCHS.items():
        # Build regex pattern for this epoch's keywords
        patterns = [re.escape(kw) for kw in epoch_data["keywords"]]
        regex = "|".join(patterns)

        count = await _db_holder.db.heritage_items.count_documents({
            "$or": [
                {"tags": {"$regex": regex, "$options": "i"}},
                {"description": {"$regex": regex, "$options": "i"}},
                {"name": {"$regex": regex, "$options": "i"}},
            ]
        })

        result.append({
            "id": epoch_id,
            "name": epoch_data["name"],
            "period": epoch_data["period"],
            "color": epoch_data["color"],
            "icon": epoch_data["icon"],
            "count": count,
        })

    return result


@epochs_router.get("/{epoch_id}/pois", dependencies=[Depends(require_feature("epochs"))])
async def get_epoch_pois(epoch_id: str, limit: int = 500):
    """Get POIs for a specific epoch (Premium)."""
    from shared_utils import clamp_pagination
    _, limit = clamp_pagination(0, limit, max_limit=500)
    if epoch_id not in EPOCHS:
        raise HTTPException(status_code=404, detail="Época não encontrada")

    epoch = EPOCHS[epoch_id]
    patterns = [re.escape(kw) for kw in epoch["keywords"]]
    regex = "|".join(patterns)

    pois = await _db_holder.db.heritage_items.find(
        {
            "location.lat": {"$exists": True, "$ne": None},
            "$or": [
                {"tags": {"$regex": regex, "$options": "i"}},
                {"description": {"$regex": regex, "$options": "i"}},
                {"name": {"$regex": regex, "$options": "i"}},
            ]
        },
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "location": 1, "description": 1, "iq_score": 1, "tags": 1}
    ).limit(limit).to_list(limit)

    return {
        "epoch": {
            "id": epoch_id,
            "name": epoch["name"],
            "period": epoch["period"],
            "color": epoch["color"],
        },
        "pois": pois,
        "total": len(pois),
    }


@epochs_router.get("/map-items", dependencies=[Depends(require_feature("epochs"))])
async def get_epoch_map_items(epoch_ids: Optional[str] = None):
    """Get map items filtered by epoch(s) (Premium)."""
    selected = epoch_ids.split(",") if epoch_ids else list(EPOCHS.keys())

    all_pois = {}

    for epoch_id in selected:
        if epoch_id not in EPOCHS:
            continue
        epoch = EPOCHS[epoch_id]
        patterns = [re.escape(kw) for kw in epoch["keywords"]]
        regex = "|".join(patterns)

        pois = await _db_holder.db.heritage_items.find(
            {
                "location.lat": {"$exists": True, "$ne": None},
                "$or": [
                    {"tags": {"$regex": regex, "$options": "i"}},
                    {"description": {"$regex": regex, "$options": "i"}},
                    {"name": {"$regex": regex, "$options": "i"}},
                ]
            },
            {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "location": 1, "iq_score": 1}
        ).limit(500).to_list(500)

        for poi in pois:
            if poi["id"] not in all_pois:
                poi["epoch"] = epoch_id
                poi["epoch_color"] = epoch["color"]
                all_pois[poi["id"]] = poi

    return list(all_pois.values())
