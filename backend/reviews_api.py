"""
Reviews API - Reviews and ratings endpoints extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone
from pymongo.errors import DuplicateKeyError
import uuid
import logging

from models.api_models import User
from shared_utils import DatabaseHolder, clamp_pagination

logger = logging.getLogger(__name__)

reviews_router = APIRouter()

_db_holder = DatabaseHolder("reviews")
set_reviews_db = _db_holder.set


# Models

class ReviewCreate(BaseModel):
    item_id: str
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    text: Optional[str] = Field(None, max_length=5000)
    visit_date: Optional[str] = None
    image_urls: Optional[List[str]] = None


class Review(BaseModel):
    id: str
    item_id: str
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    rating: int
    title: Optional[str] = None
    text: Optional[str] = None
    visit_date: Optional[str] = None
    image_urls: Optional[List[str]] = None
    helpful_votes: int = 0
    created_at: datetime


class ReviewSummary(BaseModel):
    item_id: str
    average_rating: float
    total_reviews: int
    rating_distribution: Dict[str, int]


class ReviewUpdate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    text: Optional[str] = Field(None, max_length=5000)
    visit_date: Optional[str] = None
    image_urls: Optional[List[str]] = None


# Import auth helpers - will be set after auth_api is loaded
_require_auth = None


def set_auth_deps(require_auth_func):
    global _require_auth
    _require_auth = require_auth_func


@reviews_router.post("/reviews", response_model=Review)
async def create_review(
    review: ReviewCreate,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Create a new review for a heritage item"""
    try:
        item = await _db_holder.db.heritage_items.find_one({"id": review.item_id})
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Prevent duplicate reviews per user per item
    existing_review = await _db_holder.db.reviews.find_one({
        "item_id": review.item_id,
        "user_id": current_user.user_id
    })
    if existing_review:
        raise HTTPException(
            status_code=400,
            detail="Ja avaliou este item. Edite a avaliacao existente."
        )

    new_review = {
        "id": str(uuid.uuid4()),
        "item_id": review.item_id,
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "user_picture": current_user.picture,
        "rating": review.rating,
        "title": review.title,
        "text": review.text,
        "visit_date": review.visit_date,
        "image_urls": review.image_urls or [],
        "helpful_votes": 0,
        "created_at": datetime.now(timezone.utc)
    }

    try:
        await _db_holder.db.reviews.insert_one(new_review)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Ja avaliou este item. Edite a avaliacao existente.")
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")
    return Review(**new_review)


@reviews_router.get("/reviews/item/{item_id}", response_model=List[Review])
async def get_item_reviews(
    item_id: str,
    sort_by: str = "recent",
    limit: int = 20,
    skip: int = 0
):
    """Get reviews for a heritage item"""
    skip, limit = clamp_pagination(skip, limit, max_limit=100)
    sort_options = {
        "recent": [("created_at", -1)],
        "rating_high": [("rating", -1), ("created_at", -1)],
        "rating_low": [("rating", 1), ("created_at", -1)],
        "helpful": [("helpful_votes", -1), ("created_at", -1)],
    }

    sort = sort_options.get(sort_by, sort_options["recent"])

    reviews = await _db_holder.db.reviews.find(
        {"item_id": item_id},
        {"_id": 0}
    ).sort(sort).skip(skip).limit(limit).to_list(limit)

    return [Review(**r) for r in reviews]


@reviews_router.get("/reviews/item/{item_id}/summary", response_model=ReviewSummary)
async def get_review_summary(item_id: str):
    """Get review summary (average rating, distribution) for an item"""
    pipeline = [
        {"$match": {"item_id": item_id}},
        {"$group": {
            "_id": "$item_id",
            "average_rating": {"$avg": "$rating"},
            "total_reviews": {"$sum": 1},
            "rating_1": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}},
            "rating_2": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
            "rating_3": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
            "rating_4": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
            "rating_5": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
        }}
    ]

    result = await _db_holder.db.reviews.aggregate(pipeline).to_list(1)

    if not result:
        return ReviewSummary(
            item_id=item_id,
            average_rating=0,
            total_reviews=0,
            rating_distribution={"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        )

    r = result[0]
    return ReviewSummary(
        item_id=item_id,
        average_rating=round(r["average_rating"], 1),
        total_reviews=r["total_reviews"],
        rating_distribution={
            "1": r["rating_1"],
            "2": r["rating_2"],
            "3": r["rating_3"],
            "4": r["rating_4"],
            "5": r["rating_5"],
        }
    )


@reviews_router.get("/reviews/user", response_model=List[Review])
async def get_user_reviews(current_user: User = Depends(lambda r: _require_auth(r))):
    """Get reviews by the current user"""
    reviews = await _db_holder.db.reviews.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return [Review(**r) for r in reviews]


@reviews_router.put("/reviews/{review_id}")
async def update_review(
    review_id: str,
    data: ReviewUpdate,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Update user's own review"""
    try:
        review = await _db_holder.db.reviews.find_one({"id": review_id})
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Cannot edit another user's review")

    update_dict = {
        "rating": data.rating,
        "title": data.title,
        "text": data.text,
        "visit_date": data.visit_date,
        "image_urls": data.image_urls or [],
    }

    try:
        await _db_holder.db.reviews.update_one(
            {"id": review_id},
            {"$set": update_dict}
        )
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")

    return {"message": "Review updated"}


@reviews_router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: str,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Delete user's own review"""
    try:
        review = await _db_holder.db.reviews.find_one({"id": review_id})
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's review")

    try:
        await _db_holder.db.reviews.delete_one({"id": review_id})
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")
    return {"message": "Review deleted"}


@reviews_router.post("/reviews/{review_id}/helpful")
async def vote_review_helpful(
    review_id: str,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Vote a review as helpful"""
    try:
        review = await _db_holder.db.reviews.find_one({"id": review_id})
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    vote_key = f"review_vote_{current_user.user_id}_{review_id}"
    try:
        await _db_holder.db.review_votes.insert_one({
            "key": vote_key,
            "user_id": current_user.user_id,
            "review_id": review_id,
            "created_at": datetime.now(timezone.utc)
        })
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Ja votou nesta avaliacao")
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")

    try:
        await _db_holder.db.reviews.update_one(
            {"id": review_id},
            {"$inc": {"helpful_votes": 1}}
        )
    except Exception as e:
        logger.error("Reviews DB error: %s", e)
        raise HTTPException(status_code=500, detail="Erro de base de dados")

    return {"message": "Vote recorded"}
