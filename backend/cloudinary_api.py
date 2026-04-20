"""
Cloudinary Image Upload API for Portugal Vivo
Handles signed uploads, image management, and CDN delivery
"""
import time
import os
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from typing import Optional
from auth_api import require_auth
from shared_utils import DatabaseHolder
from datetime import datetime, timezone

cloudinary_router = APIRouter(prefix="/cloudinary", tags=["Cloudinary"])

_db_holder = DatabaseHolder("cloudinary")
set_cloudinary_db = _db_holder.set

# Initialize Cloudinary
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

ALLOWED_FOLDERS = ("users/", "pois/", "reviews/", "uploads/")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def cloudinary_url(public_id: str, **transforms) -> str:
    """Generate a Cloudinary CDN URL with transformations"""
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    t_parts = []
    for k, v in transforms.items():
        t_parts.append(f"{k}_{v}")
    t_str = ",".join(t_parts) if t_parts else "q_auto,f_auto"
    return f"https://res.cloudinary.com/{cloud_name}/image/upload/{t_str}/{public_id}"


@cloudinary_router.get("/signature")
async def generate_signature(
    folder: str = Query("uploads", description="Upload folder path"),
    resource_type: str = Query("image", description="Resource type"),
    user: dict = Depends(require_auth),
):
    """Generate a signed upload signature for direct frontend-to-Cloudinary uploads"""
    if not any(folder.startswith(f) for f in ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Pasta de upload invalida")

    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
        "resource_type": resource_type,
    }

    signature = cloudinary.utils.api_sign_request(
        params,
        os.environ.get("CLOUDINARY_API_SECRET")
    )

    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.environ.get("CLOUDINARY_API_KEY"),
        "folder": folder,
        "resource_type": resource_type,
    }


@cloudinary_router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    folder: str = Form("uploads"),
    poi_id: Optional[str] = Form(None),
    review_id: Optional[str] = Form(None),
    user: dict = Depends(require_auth),
):
    """Upload an image via backend (signed, validated)"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Apenas imagens sao permitidas")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Imagem demasiado grande (max 10MB)")

    if not any(folder.startswith(f) for f in ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Pasta de upload invalida")

    try:
        result = cloudinary.uploader.upload(
            contents,
            folder=folder,
            resource_type="image",
            transformation=[
                {"quality": "auto", "fetch_format": "auto"},
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no upload: {str(e)}")

    # Store reference in DB
    image_record = {
        "public_id": result["public_id"],
        "url": result["secure_url"],
        "thumbnail_url": cloudinary_url(result["public_id"], c="fill", w=300, h=200, q="auto", f="auto"),
        "width": result.get("width"),
        "height": result.get("height"),
        "format": result.get("format"),
        "bytes": result.get("bytes"),
        "folder": folder,
        "user_id": user.user_id,
        "poi_id": poi_id,
        "review_id": review_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await _db_holder.db.user_images.insert_one(image_record)
    image_record.pop("_id", None)

    return {
        "success": True,
        "image": image_record,
    }


@cloudinary_router.get("/images")
async def get_user_images(
    poi_id: Optional[str] = Query(None),
    user: dict = Depends(require_auth),
):
    """Get images uploaded by the current user, optionally filtered by POI"""
    query = {"user_id": user.user_id}
    if poi_id:
        query["poi_id"] = poi_id

    images = await _db_holder.db.user_images.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"images": images, "total": len(images)}


@cloudinary_router.get("/poi-images/{poi_id}")
async def get_poi_images(poi_id: str):
    """Get all user-uploaded images for a specific POI (public)"""
    images = await _db_holder.db.user_images.find(
        {"poi_id": poi_id},
        {"_id": 0, "public_id": 1, "url": 1, "thumbnail_url": 1, "user_id": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(50)
    return {"images": images, "total": len(images)}


@cloudinary_router.delete("/image/{public_id:path}")
async def delete_image(
    public_id: str,
    user: dict = Depends(require_auth),
):
    """Delete an uploaded image (owner only)"""
    record = await _db_holder.db.user_images.find_one(
        {"public_id": public_id, "user_id": user.user_id}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Imagem nao encontrada ou sem permissao")

    try:
        cloudinary.uploader.destroy(public_id, invalidate=True)
    except Exception:
        pass

    await _db_holder.db.user_images.delete_one({"public_id": public_id, "user_id": user.user_id})

    return {"success": True, "message": "Imagem eliminada"}
