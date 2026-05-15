from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional

from dependencies import get_db
from services.audio_guide_service import audio_guide_service
from premium_guard import require_feature

router = APIRouter()


# Backwards-compatibility shim — server.py wires every router via set_X_db()
# at startup. Keeping the no-op preserves that call site so this refactor
# can land one module at a time without touching server.py.
def set_audio_guide_db(database):
    """No-op; the module now reads the DB via Depends(get_db)."""
    _ = database


class AudioGuideRequest(BaseModel):
    text: str
    poi_name: str
    poi_id: str
    category: Optional[str] = None
    language: str = "pt"
    use_hd: bool = False
    speed: str = "normal"


@router.post("/audio/generate", dependencies=[Depends(require_feature("audio_guides"))])
async def generate_audio_guide(request: AudioGuideRequest):
    """Generate audio guide for a POI using TTS (Premium)"""
    result = await audio_guide_service.generate_audio_guide(
        text=request.text,
        poi_name=request.poi_name,
        poi_id=request.poi_id,
        category=request.category,
        language=request.language,
        use_hd=request.use_hd,
        speed=request.speed
    )
    return result


@router.get("/audio/voices")
async def get_available_voices():
    """Get list of available TTS voices"""
    return await audio_guide_service.get_available_voices()


@router.get("/audio/guide/{item_id}", dependencies=[Depends(require_feature("audio_guides"))])
async def get_audio_for_item(
    item_id: str,
    use_hd: bool = False,
    speed: str = "normal",
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate audio guide for a specific heritage item (Premium)"""
    # Get item details
    item = await db.heritage_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Check if item has narrative/description
    text = item.get("ai_narrative") or item.get("description") or item.get("name")
    if not text or len(text) < 20:
        return {
            "success": False,
            "error": "Item does not have enough content for audio guide",
            "audio_available": False
        }

    return await audio_guide_service.generate_audio_guide(
        text=text,
        poi_name=item.get("name", ""),
        poi_id=item_id,
        category=item.get("category"),
        language="pt",
        use_hd=use_hd,
        speed=speed
    )
