"""
Saved Itineraries API — Trip Planner persistence, collaboration and attachments.

Endpoints:
  POST   /itineraries                        - Save a generated itinerary
  GET    /itineraries                        - List user's saved itineraries
  GET    /itineraries/{id}                   - Get a specific itinerary
  PATCH  /itineraries/{id}                   - Update (reorder/add/remove POIs, meta)
  DELETE /itineraries/{id}                   - Delete
  POST   /itineraries/{id}/share             - Generate share link with role
  POST   /itineraries/{id}/join              - Join a shared itinerary via token
  GET    /itineraries/{id}/collaborators     - List collaborators
  POST   /itineraries/{id}/vote/{poi_id}     - Vote on a POI (👍/👎)
  POST   /itineraries/{id}/comment          - Add comment to a block
  GET    /itineraries/{id}/comments         - Get all comments
  POST   /itineraries/{id}/attachment       - Attach reservation/ticket to a block
  DELETE /itineraries/{id}/attachment/{att_id} - Remove attachment
  GET    /itineraries/shared/{token}         - Load shared itinerary (no auth needed)
"""
import uuid
import secrets
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from shared_utils import DatabaseHolder, clamp_pagination
from models.api_models import User

logger = logging.getLogger(__name__)

itineraries_router = APIRouter(prefix="/itineraries", tags=["TripPlanner"])

_db_holder = DatabaseHolder("itineraries")
set_itineraries_db = _db_holder.set

_require_auth = None


def set_itineraries_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ItinerarySave(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    region: str
    locality: Optional[str] = None
    days: int = Field(..., ge=1, le=14)
    interests: List[str] = []
    profile: Optional[str] = None
    pace: Optional[str] = None
    budget: Optional[str] = None
    transport: Optional[str] = None
    itinerary_data: Dict[str, Any] = Field(..., description="Full SmartItineraryResponse JSON")
    cover_image: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=1000)


class ItineraryUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=120)
    notes: Optional[str] = Field(None, max_length=1000)
    cover_image: Optional[str] = None
    itinerary_data: Optional[Dict[str, Any]] = None


class ShareCreate(BaseModel):
    role: str = Field("viewer", regex="^(editor|voter|viewer)$")
    expires_days: Optional[int] = Field(None, ge=1, le=30)


class VoteBody(BaseModel):
    vote: str = Field(..., regex="^(up|down)$")


class CommentCreate(BaseModel):
    day: int = Field(..., ge=1)
    poi_id: Optional[str] = None
    text: str = Field(..., min_length=1, max_length=500)


class AttachmentCreate(BaseModel):
    day: int = Field(..., ge=1)
    poi_id: Optional[str] = None
    type: str = Field(..., regex="^(booking|ticket|note|link)$")
    title: str = Field(..., min_length=2, max_length=150)
    reference: Optional[str] = Field(None, max_length=100, description="Booking ref / confirmation code")
    url: Optional[str] = Field(None, max_length=500)
    amount: Optional[float] = None
    currency: str = "EUR"
    notes: Optional[str] = Field(None, max_length=300)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_itinerary_or_404(db, itin_id: str, user_id: Optional[str] = None):
    doc = await db.saved_itineraries.find_one({"id": itin_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Itinerário não encontrado")
    if user_id:
        is_owner = doc["owner_id"] == user_id
        is_collab = any(c["user_id"] == user_id for c in doc.get("collaborators", []))
        if not is_owner and not is_collab:
            # Check if there's a public share
            if not doc.get("public_token"):
                raise HTTPException(status_code=403, detail="Sem acesso a este itinerário")
    return doc


# ---------------------------------------------------------------------------
# Core CRUD
# ---------------------------------------------------------------------------

@itineraries_router.post("", status_code=201)
async def save_itinerary(
    body: ItinerarySave,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Save a generated itinerary to the user's account."""
    db = _db_holder.db
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": current_user.user_id,
        "owner_name": current_user.name,
        "owner_picture": current_user.picture,
        "title": body.title,
        "region": body.region,
        "locality": body.locality,
        "days": body.days,
        "interests": body.interests,
        "profile": body.profile,
        "pace": body.pace,
        "budget": body.budget,
        "transport": body.transport,
        "itinerary_data": body.itinerary_data,
        "cover_image": body.cover_image,
        "notes": body.notes,
        "collaborators": [],      # [{user_id, name, picture, role, joined_at}]
        "public_token": None,     # share token
        "public_role": None,      # viewer|voter|editor
        "votes": {},              # {poi_id: {up: n, down: n, user_votes: {uid: "up|down"}}}
        "attachments": [],        # see AttachmentCreate
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.saved_itineraries.insert_one(doc)
    doc.pop("_id", None)
    return {"id": doc["id"], "message": "Itinerário guardado com sucesso"}


@itineraries_router.get("")
async def list_itineraries(
    skip: int = 0,
    limit: int = Query(20, le=50),
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """List the authenticated user's saved itineraries (own + collaborating)."""
    db = _db_holder.db
    skip, limit = clamp_pagination(skip, limit)
    query = {
        "$or": [
            {"owner_id": current_user.user_id},
            {"collaborators.user_id": current_user.user_id},
        ]
    }
    total = await db.saved_itineraries.count_documents(query)
    docs = await db.saved_itineraries.find(
        query,
        {"_id": 0, "itinerary_data": 0}  # omit heavy payload in list view
    ).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"itineraries": docs, "total": total}


@itineraries_router.get("/shared/{token}")
async def get_shared_itinerary(token: str):
    """Load a shared itinerary by token (no auth required)."""
    db = _db_holder.db
    doc = await db.saved_itineraries.find_one({"public_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Link de partilha inválido ou expirado")
    return doc


@itineraries_router.get("/{itin_id}")
async def get_itinerary(
    itin_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Get a specific saved itinerary."""
    db = _db_holder.db
    return await _get_itinerary_or_404(db, itin_id, current_user.user_id)


@itineraries_router.patch("/{itin_id}")
async def update_itinerary(
    itin_id: str,
    body: ItineraryUpdate,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Update itinerary metadata or reorder POIs (owner or editor collaborator)."""
    db = _db_holder.db
    doc = await _get_itinerary_or_404(db, itin_id, current_user.user_id)

    is_editor = doc["owner_id"] == current_user.user_id or any(
        c["user_id"] == current_user.user_id and c["role"] == "editor"
        for c in doc.get("collaborators", [])
    )
    if not is_editor:
        raise HTTPException(status_code=403, detail="Apenas editores podem modificar o itinerário")

    update = {k: v for k, v in body.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.saved_itineraries.update_one({"id": itin_id}, {"$set": update})
    return {"message": "Itinerário atualizado"}


@itineraries_router.delete("/{itin_id}")
async def delete_itinerary(
    itin_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Delete an itinerary (owner only)."""
    db = _db_holder.db
    doc = await _get_itinerary_or_404(db, itin_id)
    if doc["owner_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Só o criador pode eliminar o itinerário")
    await db.saved_itineraries.delete_one({"id": itin_id})
    return {"message": "Itinerário eliminado"}


# ---------------------------------------------------------------------------
# Sharing & collaboration
# ---------------------------------------------------------------------------

@itineraries_router.post("/{itin_id}/share")
async def create_share_link(
    itin_id: str,
    body: ShareCreate,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Generate a shareable link. Only owner can create/rotate the link."""
    db = _db_holder.db
    doc = await _get_itinerary_or_404(db, itin_id)
    if doc["owner_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Apenas o criador pode partilhar")

    token = secrets.token_urlsafe(16)
    await db.saved_itineraries.update_one(
        {"id": itin_id},
        {"$set": {"public_token": token, "public_role": body.role, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"token": token, "role": body.role, "link": f"/itinerary/shared/{token}"}


@itineraries_router.post("/{itin_id}/join")
async def join_itinerary(
    itin_id: str,
    token: str = Query(..., description="Share token from the invite link"),
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Join a shared itinerary as a collaborator."""
    db = _db_holder.db
    doc = await db.saved_itineraries.find_one({"id": itin_id, "public_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Link inválido ou itinerário não encontrado")
    if doc["owner_id"] == current_user.user_id:
        return {"message": "És o criador deste itinerário"}
    already = any(c["user_id"] == current_user.user_id for c in doc.get("collaborators", []))
    if not already:
        collab = {
            "user_id": current_user.user_id,
            "name": current_user.name,
            "picture": current_user.picture,
            "role": doc.get("public_role", "viewer"),
            "joined_at": datetime.now(timezone.utc),
        }
        await db.saved_itineraries.update_one(
            {"id": itin_id},
            {"$push": {"collaborators": collab}, "$set": {"updated_at": datetime.now(timezone.utc)}}
        )
    return {"message": "Juntaste-te ao itinerário", "role": doc.get("public_role", "viewer")}


@itineraries_router.get("/{itin_id}/collaborators")
async def get_collaborators(
    itin_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """List all collaborators of an itinerary."""
    db = _db_holder.db
    doc = await _get_itinerary_or_404(db, itin_id, current_user.user_id)
    return {
        "owner": {
            "user_id": doc["owner_id"],
            "name": doc["owner_name"],
            "picture": doc.get("owner_picture"),
            "role": "owner",
        },
        "collaborators": doc.get("collaborators", []),
    }


# ---------------------------------------------------------------------------
# Votes on POIs within an itinerary
# ---------------------------------------------------------------------------

@itineraries_router.post("/{itin_id}/vote/{poi_id}")
async def vote_on_poi(
    itin_id: str,
    poi_id: str,
    body: VoteBody,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Vote 👍 or 👎 on a POI inside the itinerary (collaborators and owner)."""
    db = _db_holder.db
    doc = await _get_itinerary_or_404(db, itin_id, current_user.user_id)

    votes = doc.get("votes", {})
    poi_votes = votes.get(poi_id, {"up": 0, "down": 0, "user_votes": {}})
    prev = poi_votes["user_votes"].get(current_user.user_id)

    # Undo previous vote
    if prev:
        poi_votes[prev] = max(0, poi_votes[prev] - 1)
    # Apply new vote (toggle off if same)
    if prev != body.vote:
        poi_votes[body.vote] = poi_votes.get(body.vote, 0) + 1
        poi_votes["user_votes"][current_user.user_id] = body.vote
    else:
        del poi_votes["user_votes"][current_user.user_id]

    votes[poi_id] = poi_votes
    await db.saved_itineraries.update_one(
        {"id": itin_id},
        {"$set": {"votes": votes, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"poi_id": poi_id, "votes": poi_votes}


# ---------------------------------------------------------------------------
# Comments on itinerary blocks
# ---------------------------------------------------------------------------

@itineraries_router.post("/{itin_id}/comment")
async def add_comment(
    itin_id: str,
    body: CommentCreate,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Add a comment to an itinerary block (day/POI)."""
    db = _db_holder.db
    await _get_itinerary_or_404(db, itin_id, current_user.user_id)
    comment = {
        "id": str(uuid.uuid4()),
        "itinerary_id": itin_id,
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "user_picture": current_user.picture,
        "day": body.day,
        "poi_id": body.poi_id,
        "text": body.text,
        "created_at": datetime.now(timezone.utc),
    }
    await db.itinerary_comments.insert_one(comment)
    comment.pop("_id", None)
    return comment


@itineraries_router.get("/{itin_id}/comments")
async def get_comments(
    itin_id: str,
    day: Optional[int] = None,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Get all comments for an itinerary, optionally filtered by day."""
    db = _db_holder.db
    await _get_itinerary_or_404(db, itin_id, current_user.user_id)
    query: dict = {"itinerary_id": itin_id}
    if day is not None:
        query["day"] = day
    comments = await db.itinerary_comments.find(query, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"comments": comments, "total": len(comments)}


# ---------------------------------------------------------------------------
# Attachments (reservations, tickets, links)
# ---------------------------------------------------------------------------

@itineraries_router.post("/{itin_id}/attachment")
async def add_attachment(
    itin_id: str,
    body: AttachmentCreate,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """
    Attach a reservation or ticket to an itinerary block.
    Types: booking | ticket | note | link
    """
    db = _db_holder.db
    doc = await _get_itinerary_or_404(db, itin_id, current_user.user_id)

    attachment = {
        "id": str(uuid.uuid4()),
        "day": body.day,
        "poi_id": body.poi_id,
        "type": body.type,
        "title": body.title,
        "reference": body.reference,
        "url": body.url,
        "amount": body.amount,
        "currency": body.currency,
        "notes": body.notes,
        "added_by": current_user.user_id,
        "added_by_name": current_user.name,
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.saved_itineraries.update_one(
        {"id": itin_id},
        {"$push": {"attachments": attachment}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "Reserva/bilhete anexado", "attachment": attachment}


@itineraries_router.delete("/{itin_id}/attachment/{att_id}")
async def remove_attachment(
    itin_id: str,
    att_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Remove an attachment from an itinerary."""
    db = _db_holder.db
    await _get_itinerary_or_404(db, itin_id, current_user.user_id)
    result = await db.saved_itineraries.update_one(
        {"id": itin_id},
        {"$pull": {"attachments": {"id": att_id}},
         "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    return {"message": "Anexo removido"}


# ---------------------------------------------------------------------------
# Budget summary
# ---------------------------------------------------------------------------

@itineraries_router.get("/{itin_id}/budget")
async def get_budget_summary(
    itin_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Calculate total budget from all attachments of type 'booking' or 'ticket'."""
    db = _db_holder.db
    doc = await _get_itinerary_or_404(db, itin_id, current_user.user_id)
    attachments = doc.get("attachments", [])
    paid = [a for a in attachments if a.get("type") in ("booking", "ticket") and a.get("amount")]
    total = sum(a["amount"] for a in paid)
    by_day: Dict[int, float] = {}
    for a in paid:
        day = a.get("day", 0)
        by_day[day] = by_day.get(day, 0) + a["amount"]
    return {
        "total_eur": round(total, 2),
        "by_day": by_day,
        "items": paid,
        "currency": "EUR",
    }
