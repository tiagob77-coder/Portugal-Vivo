"""
Upload API — User image uploads via Cloudinary.
Supports POI photo contributions, review images, and community content.
Falls back to local MongoDB storage (base64) if Cloudinary is not configured.
"""
import os
import io
import uuid
import base64
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from typing import Optional

from shared_utils import DatabaseHolder
from models.api_models import User

# Pillow is the source of truth for what bytes really are — content-type
# headers are trivially spoofable. We import lazily so the rest of the
# module still loads in environments without Pillow (tests).
try:
    from PIL import Image  # type: ignore[import-not-found]
    _PIL_AVAILABLE = True
except Exception:  # pragma: no cover
    Image = None  # type: ignore[assignment]
    _PIL_AVAILABLE = False

logger = logging.getLogger(__name__)

upload_router = APIRouter(prefix="/uploads", tags=["Uploads"])

_db_holder = DatabaseHolder("uploads")
set_upload_db = _db_holder.set

_require_auth = None


def set_upload_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


async def _auth_dep(request: Request):
    return await _require_auth(request)


# Cloudinary config (optional — degrades to MongoDB base64 storage)
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")
_cloudinary_configured = False

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True,
        )
        _cloudinary_configured = True
        logger.info("Cloudinary configured (cloud: %s)", CLOUDINARY_CLOUD_NAME)
    except ImportError:
        logger.warning("cloudinary package not installed — using MongoDB storage")
else:
    logger.info("Cloudinary not configured — using MongoDB storage fallback")

# Limits
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_CONTEXTS = {"poi", "review", "contribution", "general"}
_CHUNK_SIZE = 64 * 1024  # 64 KB

# Pillow's identifier per supported MIME type. Anything else returned by
# ``Image.open(...).format`` is rejected — we don't accept SVG, GIF, BMP
# or polyglot files.
_ALLOWED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}
_PIL_FORMAT_TO_MIME = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}

# Sanity bounds on image dimensions so a 1×1 pixel decompression bomb or
# a 32k×32k tiny file cannot trip us up. Pillow has its own
# DecompressionBombError but we set a much tighter limit here.
_MAX_DIMENSION = 8192  # px on either axis
_MIN_DIMENSION = 16    # px — anything smaller is almost certainly garbage


def _validate_image_bytes(file_bytes: bytes) -> str:
    """Validate that ``file_bytes`` is a real, sane image and return its
    canonical MIME type.

    Raises HTTPException(400) on anything that fails — the message is
    safe to surface to the user.

    Why not trust ``file.content_type``? The browser/SDK supplies that
    header from the file extension or even an arbitrary value; an
    attacker can rename ``payload.php`` to ``photo.jpg`` and the
    Content-Type stays ``image/jpeg``. Pillow does the only thing that
    matters: opens the bytes and tells us what they really are.
    """
    if not _PIL_AVAILABLE:
        # Environments without Pillow (a stripped-down test bench, for
        # instance) get a soft pass — better to refuse to gate than to
        # 500 on every legitimate upload. The Dockerfile installs
        # Pillow so production never lands here.
        logger.warning("Pillow not available — falling back to content-type only")
        return "image/jpeg"

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            fmt = (img.format or "").upper()
            img.verify()  # parses the whole file; throws on tampering
    except Exception:
        raise HTTPException(status_code=400, detail="Ficheiro não é uma imagem válida")

    if fmt not in _ALLOWED_PIL_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato {fmt or 'desconhecido'} não suportado. Use JPEG, PNG ou WebP.",
        )

    # ``verify()`` invalidates the image — reopen to inspect dimensions.
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            width, height = img.size
    except Exception:
        raise HTTPException(status_code=400, detail="Ficheiro corrompido")

    if width < _MIN_DIMENSION or height < _MIN_DIMENSION:
        raise HTTPException(
            status_code=400,
            detail=f"Imagem demasiado pequena (mínimo {_MIN_DIMENSION}×{_MIN_DIMENSION} px)",
        )
    if width > _MAX_DIMENSION or height > _MAX_DIMENSION:
        raise HTTPException(
            status_code=400,
            detail=f"Imagem demasiado grande (máximo {_MAX_DIMENSION}×{_MAX_DIMENSION} px)",
        )

    return _PIL_FORMAT_TO_MIME[fmt]


async def _read_with_limit(file: UploadFile, limit: int) -> bytes:
    """Read an UploadFile in chunks and abort as soon as the limit is exceeded.

    Prevents a client from pinning arbitrary memory by sending a massive body.
    """
    buf = bytearray()
    while True:
        chunk = await file.read(_CHUNK_SIZE)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > limit:
            raise HTTPException(status_code=413, detail="Ficheiro demasiado grande (máx. 5 MB)")
    return bytes(buf)


async def _upload_to_cloudinary(file_bytes: bytes, folder: str, public_id: str) -> str:
    """Upload to Cloudinary and return the secure URL."""
    import cloudinary.uploader
    result = cloudinary.uploader.upload(
        io.BytesIO(file_bytes),
        folder=f"portugal-vivo/{folder}",
        public_id=public_id,
        overwrite=True,
        resource_type="image",
        transformation=[
            {"width": 1200, "height": 800, "crop": "limit", "quality": "auto", "fetch_format": "auto"}
        ],
    )
    return result["secure_url"]


async def _upload_to_mongo(file_bytes: bytes, content_type: str, folder: str, public_id: str) -> str:
    """Fallback: store base64-encoded image in MongoDB."""
    b64 = base64.b64encode(file_bytes).decode("utf-8")
    doc = {
        "id": public_id,
        "folder": folder,
        "data": f"data:{content_type};base64,{b64}",
        "size": len(file_bytes),
        "created_at": datetime.now(timezone.utc),
    }
    await _db_holder.db.uploaded_images.insert_one(doc)
    # Return a self-hosted URL
    return f"/api/uploads/serve/{public_id}"


@upload_router.post("")
async def upload_image(
    file: UploadFile = File(...),
    context: str = Form("general"),  # "poi", "review", "contribution", "general"
    item_id: Optional[str] = Form(None),
    current_user: User = Depends(_auth_dep),
):
    """
    Upload a user image. Returns the image URL.

    - **context**: what the image is for (poi, review, contribution, general)
    - **item_id**: optional heritage item or contribution ID
    """
    # ``context`` is interpolated into the storage public_id and the
    # Cloudinary folder path, so it must be one of the known values rather
    # than arbitrary client input.
    if context not in ALLOWED_CONTEXTS:
        raise HTTPException(
            status_code=400,
            detail=f"Contexto inválido. Use: {', '.join(sorted(ALLOWED_CONTEXTS))}",
        )

    # The content-type header is a courtesy from the client — it is NOT
    # an authority on the file's actual type. We still gate on it cheaply
    # to short-circuit obvious junk (e.g. application/octet-stream) before
    # reading the bytes, but the canonical decision is made below by
    # ``_validate_image_bytes``.
    if file.content_type and file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Tipo de ficheiro não suportado. Use: JPEG, PNG ou WebP",
        )

    # Streaming read with size limit (prevents memory DoS)
    file_bytes = await _read_with_limit(file, MAX_FILE_SIZE)
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Ficheiro vazio")

    # Magic-bytes validation: the only check that matters. Pillow opens
    # the buffer, identifies the real format and verifies that the whole
    # file decodes. Returns the canonical MIME type to store with the
    # upload record (the header value can be misleading).
    canonical_mime = _validate_image_bytes(file_bytes)

    # Generate unique ID
    public_id = f"{context}_{uuid.uuid4().hex[:12]}"
    folder = context

    try:
        if _cloudinary_configured:
            url = await _upload_to_cloudinary(file_bytes, folder, public_id)
        else:
            url = await _upload_to_mongo(file_bytes, canonical_mime, folder, public_id)
    except Exception as e:
        logger.error("Upload failed: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao fazer upload da imagem")

    # Record upload metadata. We persist BOTH the canonical MIME (from
    # Pillow) and the original client header for audit — divergence
    # between the two is a signal worth keeping for forensic review.
    upload_record = {
        "id": public_id,
        "user_id": current_user.user_id,
        "url": url,
        "context": context,
        "item_id": item_id,
        "original_filename": file.filename,
        "content_type": canonical_mime,
        "content_type_claimed": file.content_type,
        "size": len(file_bytes),
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await _db_holder.db.upload_records.insert_one(upload_record)
    except Exception as e:
        logger.warning("Failed to record upload metadata: %s", e)

    return {"url": url, "id": public_id, "size": len(file_bytes)}


@upload_router.get("/serve/{image_id}")
async def serve_uploaded_image(image_id: str):
    """Serve a MongoDB-stored image (fallback when Cloudinary is not configured)."""
    from starlette.responses import Response

    doc = await _db_holder.db.uploaded_images.find_one({"id": image_id}, {"_id": 0})
    if not doc or "data" not in doc:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")

    data_uri = doc["data"]
    # Parse data URI: "data:image/jpeg;base64,..."
    try:
        header, b64_data = data_uri.split(",", 1)
        content_type = header.split(":")[1].split(";")[0]
        image_bytes = base64.b64decode(b64_data)
    except Exception:
        raise HTTPException(status_code=500, detail="Imagem corrompida")

    return Response(
        content=image_bytes,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
