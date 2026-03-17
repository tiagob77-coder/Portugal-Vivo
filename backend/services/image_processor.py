"""
Image processing service using Pillow.
Handles downloading, optimizing, resizing, and format conversion of images.
"""
import io
import logging
from typing import Dict, Optional, Tuple

import httpx
from PIL import Image, ExifTags

logger = logging.getLogger(__name__)

# Size presets: name -> (width, height)
VARIANT_SIZES = {
    "thumbnail": (200, 200),
    "medium": (600, 400),
    "large": (1200, 800),
}

MAX_INPUT_SIZE = 10 * 1024 * 1024  # 10MB
SUPPORTED_FORMATS = {"JPEG", "PNG", "WEBP", "MPO"}


class ImageProcessingError(Exception):
    """Raised when image processing fails."""
    pass


class ImageProcessor:
    """Processes images: download, optimize, resize, strip EXIF, convert formats."""

    def __init__(self, default_quality: int = 85):
        self.default_quality = default_quality

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------

    async def download_image(self, url: str, timeout: int = 20) -> bytes:
        """Download image from URL with timeout and size limit enforcement."""
        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                headers={"User-Agent": "PatrimonioVivo/2.0 ImageOptimizer"}
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()

                data = resp.content
                if len(data) > MAX_INPUT_SIZE:
                    raise ImageProcessingError(
                        f"Image too large: {len(data)} bytes (max {MAX_INPUT_SIZE})"
                    )
                return data
        except httpx.HTTPStatusError as e:
            raise ImageProcessingError(f"HTTP error downloading image: {e.response.status_code}")
        except httpx.TimeoutException:
            raise ImageProcessingError("Timeout downloading image")
        except ImageProcessingError:
            raise
        except Exception as e:
            raise ImageProcessingError(f"Error downloading image: {e}")

    # ------------------------------------------------------------------
    # Core processing
    # ------------------------------------------------------------------

    def _open_image(self, image_bytes: bytes) -> Image.Image:
        """Open and validate image bytes."""
        try:
            img = Image.open(io.BytesIO(image_bytes))
            img.load()  # force decode to catch corruption early
        except Exception as e:
            raise ImageProcessingError(f"Cannot open image: {e}")

        if img.format and img.format not in SUPPORTED_FORMATS:
            raise ImageProcessingError(f"Unsupported format: {img.format}")

        # Convert palette / RGBA as needed
        if img.mode in ("P", "PA"):
            img = img.convert("RGBA")
        if img.mode == "RGBA":
            # Composite onto white background for JPEG compatibility
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[3])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        return img

    def strip_exif(self, image_bytes: bytes) -> bytes:
        """Remove EXIF metadata from image for privacy. Returns JPEG bytes."""
        img = self._open_image(image_bytes)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=95)
        return buf.getvalue()

    def optimize_image(
        self,
        image_bytes: bytes,
        fmt: str = "webp",
        quality: int = 0,
        max_dimension: Optional[int] = None,
    ) -> bytes:
        """Optimize image: strip EXIF, optional resize, convert format."""
        quality = quality or self.default_quality
        img = self._open_image(image_bytes)

        if max_dimension:
            img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)

        buf = io.BytesIO()
        save_fmt = fmt.upper()
        if save_fmt == "WEBP":
            img.save(buf, format="WEBP", quality=quality, method=4)
        else:
            img.save(buf, format="JPEG", quality=quality, optimize=True)
        return buf.getvalue()

    def _resize_crop(self, img: Image.Image, size: Tuple[int, int]) -> Image.Image:
        """Resize to cover target size then center-crop (thumbnail style)."""
        target_w, target_h = size
        src_w, src_h = img.size

        # Scale so the smaller dimension matches the target
        scale = max(target_w / src_w, target_h / src_h)
        new_w = int(src_w * scale)
        new_h = int(src_h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

        # Center crop
        left = (new_w - target_w) // 2
        top = (new_h - target_h) // 2
        img = img.crop((left, top, left + target_w, top + target_h))
        return img

    def generate_thumbnail(
        self,
        image_bytes: bytes,
        size: Tuple[int, int] = (200, 200),
        fmt: str = "webp",
        quality: int = 0,
    ) -> bytes:
        """Generate a square thumbnail using center-crop."""
        quality = quality or self.default_quality
        img = self._open_image(image_bytes)
        img = self._resize_crop(img, size)

        buf = io.BytesIO()
        save_fmt = fmt.upper()
        if save_fmt == "WEBP":
            img.save(buf, format="WEBP", quality=quality, method=4)
        else:
            img.save(buf, format="JPEG", quality=quality, optimize=True)
        return buf.getvalue()

    def generate_variants(
        self,
        image_bytes: bytes,
        quality: int = 0,
    ) -> Dict[str, Dict[str, bytes]]:
        """
        Generate all size variants in both WebP and JPEG.

        Returns::

            {
                "original": {"webp": bytes, "jpeg": bytes},
                "thumbnail": {"webp": bytes, "jpeg": bytes},
                "medium": {"webp": bytes, "jpeg": bytes},
                "large": {"webp": bytes, "jpeg": bytes},
            }
        """
        quality = quality or self.default_quality
        img = self._open_image(image_bytes)
        variants: Dict[str, Dict[str, bytes]] = {}

        # Original (optimized, no resize)
        variants["original"] = self._save_both(img, quality)

        for name, size in VARIANT_SIZES.items():
            resized = self._resize_crop(img.copy(), size)
            variants[name] = self._save_both(resized, quality)

        return variants

    def _save_both(self, img: Image.Image, quality: int) -> Dict[str, bytes]:
        """Save an image in both WebP and JPEG formats."""
        webp_buf = io.BytesIO()
        img.save(webp_buf, format="WEBP", quality=quality, method=4)

        jpeg_buf = io.BytesIO()
        img.save(jpeg_buf, format="JPEG", quality=quality, optimize=True)

        return {"webp": webp_buf.getvalue(), "jpeg": jpeg_buf.getvalue()}

    def get_image_info(self, image_bytes: bytes) -> dict:
        """Return metadata about the image: dimensions, format, size."""
        try:
            img = Image.open(io.BytesIO(image_bytes))
            return {
                "width": img.width,
                "height": img.height,
                "format": img.format,
                "mode": img.mode,
                "size_bytes": len(image_bytes),
            }
        except Exception as e:
            raise ImageProcessingError(f"Cannot read image info: {e}")
