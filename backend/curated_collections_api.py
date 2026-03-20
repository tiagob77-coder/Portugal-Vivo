"""
Curated Collections API (P1-5)

Manages thematic curated collections (e.g. "Portugal à Mesa").
Each Collection has:
  - id, slug, title, description, cover_image_url
  - tags, region, author (editorial | user)
  - poi_ids: ordered list of POI IDs
  - created_at, updated_at, is_published
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone
import uuid

from shared_utils import DatabaseHolder
from shared_constants import sanitize_regex
from models.api_models import User

import logging
logger = logging.getLogger(__name__)

curated_collections_router = APIRouter(prefix="/curated-collections", tags=["Collections"])

_db_holder = DatabaseHolder("curated_collections")
set_curated_collections_db = _db_holder.set

_require_auth = None


def set_curated_collections_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CollectionCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    description: str = Field(..., min_length=10, max_length=2000)
    cover_image_url: Optional[str] = None
    tags: List[str] = []
    region: Optional[str] = None
    poi_ids: List[str] = []
    author_type: Literal["editorial", "user"] = "user"


class CollectionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=120)
    description: Optional[str] = Field(None, min_length=10, max_length=2000)
    cover_image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    region: Optional[str] = None
    poi_ids: Optional[List[str]] = None


class CollectionResponse(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    cover_image_url: Optional[str] = None
    tags: List[str]
    region: Optional[str]
    poi_ids: List[str]
    poi_count: int
    author_type: str
    author_id: Optional[str]
    is_published: bool
    created_at: datetime
    updated_at: datetime


def _make_slug(title: str) -> str:
    import re
    from text_unidecode import unidecode
    slug = unidecode(title).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug[:80]


def _doc_to_response(doc: dict) -> CollectionResponse:
    return CollectionResponse(
        id=doc["id"],
        slug=doc["slug"],
        title=doc["title"],
        description=doc["description"],
        cover_image_url=doc.get("cover_image_url"),
        tags=doc.get("tags", []),
        region=doc.get("region"),
        poi_ids=doc.get("poi_ids", []),
        poi_count=len(doc.get("poi_ids", [])),
        author_type=doc.get("author_type", "user"),
        author_id=doc.get("author_id"),
        is_published=doc.get("is_published", False),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@curated_collections_router.get("", response_model=List[CollectionResponse])
async def list_collections(
    region: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    author_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=200),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List published curated collections."""
    query: dict = {"is_published": True}
    if region:
        query["region"] = {"$regex": sanitize_regex(region), "$options": "i"}
    if tag:
        query["tags"] = tag
    if author_type:
        query["author_type"] = author_type
    if search:
        s = sanitize_regex(search)
        query["$or"] = [
            {"title": {"$regex": s, "$options": "i"}},
            {"description": {"$regex": s, "$options": "i"}},
        ]
    docs = await _db_holder.db.curated_collections.find(query, {"_id": 0}) \
        .sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    return [_doc_to_response(d) for d in docs]


@curated_collections_router.get("/{collection_id}", response_model=CollectionResponse)
async def get_collection(collection_id: str):
    """Get a single collection by ID or slug."""
    doc = await _db_holder.db.curated_collections.find_one(
        {"$or": [{"id": collection_id}, {"slug": collection_id}], "is_published": True},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Collection not found")
    return _doc_to_response(doc)


@curated_collections_router.get("/{collection_id}/pois")
async def get_collection_pois(collection_id: str):
    """Get full POI details for a collection (ordered)."""
    doc = await _db_holder.db.curated_collections.find_one(
        {"$or": [{"id": collection_id}, {"slug": collection_id}], "is_published": True},
        {"_id": 0, "poi_ids": 1, "title": 1}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Collection not found")
    poi_ids = doc.get("poi_ids", [])
    if not poi_ids:
        return {"title": doc["title"], "pois": []}
    pois = await _db_holder.db.heritage_items.find(
        {"id": {"$in": poi_ids}}, {"_id": 0}
    ).to_list(200)
    # Preserve order from poi_ids
    poi_map = {p["id"]: p for p in pois}
    ordered = [poi_map[pid] for pid in poi_ids if pid in poi_map]
    return {"title": doc["title"], "pois": ordered}


@curated_collections_router.post("", response_model=CollectionResponse, status_code=201)
async def create_collection(
    payload: CollectionCreate,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Create a new curated collection."""
    now = datetime.now(timezone.utc)
    collection_id = str(uuid.uuid4())
    slug = _make_slug(payload.title)
    # Ensure slug uniqueness
    existing = await _db_holder.db.curated_collections.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{collection_id[:8]}"

    doc = {
        "id": collection_id,
        "slug": slug,
        "title": payload.title,
        "description": payload.description,
        "cover_image_url": payload.cover_image_url,
        "tags": payload.tags,
        "region": payload.region,
        "poi_ids": payload.poi_ids,
        "author_type": payload.author_type,
        "author_id": current_user.user_id,
        "is_published": False,
        "created_at": now,
        "updated_at": now,
    }
    await _db_holder.db.curated_collections.insert_one(doc)
    doc.pop("_id", None)
    return _doc_to_response(doc)


@curated_collections_router.patch("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: str,
    payload: CollectionUpdate,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Update a collection (owner only)."""
    doc = await _db_holder.db.curated_collections.find_one({"id": collection_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Collection not found")
    if doc.get("author_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not the collection owner")

    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc)
    await _db_holder.db.curated_collections.update_one({"id": collection_id}, {"$set": updates})
    doc.update(updates)
    return _doc_to_response(doc)


@curated_collections_router.post("/{collection_id}/pois/{poi_id}")
async def add_poi_to_collection(
    collection_id: str,
    poi_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Append a POI to a collection."""
    doc = await _db_holder.db.curated_collections.find_one({"id": collection_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Collection not found")
    if doc.get("author_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not the collection owner")
    await _db_holder.db.curated_collections.update_one(
        {"id": collection_id},
        {"$addToSet": {"poi_ids": poi_id}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "POI added to collection"}


@curated_collections_router.delete("/{collection_id}/pois/{poi_id}")
async def remove_poi_from_collection(
    collection_id: str,
    poi_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Remove a POI from a collection."""
    doc = await _db_holder.db.curated_collections.find_one({"id": collection_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Collection not found")
    if doc.get("author_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not the collection owner")
    await _db_holder.db.curated_collections.update_one(
        {"id": collection_id},
        {"$pull": {"poi_ids": poi_id}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": "POI removed from collection"}


@curated_collections_router.delete("/{collection_id}")
async def delete_collection(
    collection_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Delete a collection (owner only)."""
    doc = await _db_holder.db.curated_collections.find_one({"id": collection_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Collection not found")
    if doc.get("author_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not the collection owner")
    await _db_holder.db.curated_collections.delete_one({"id": collection_id})
    return {"message": "Collection deleted"}
