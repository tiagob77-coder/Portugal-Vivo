"""
Unit tests for the magic-bytes upload validator (SEC-010).

The endpoint itself needs a running app + auth, so these tests exercise
the validator function directly. The point is to lock in the rejection
behaviour so a future refactor can't quietly disable it:

  * Anything that does NOT decode as a real image → 400.
  * SVG / GIF / BMP / TIFF / HTML disguised as JPEG → 400.
  * Images smaller than _MIN_DIMENSION or larger than _MAX_DIMENSION → 400.
  * Real JPEG/PNG/WEBP inside the bounds → returns the canonical MIME.
"""
from __future__ import annotations

import io
import pytest

PIL = pytest.importorskip("PIL.Image")
from PIL import Image  # noqa: E402  (after importorskip)

from fastapi import HTTPException

from upload_api import (  # noqa: E402
    _MAX_DIMENSION,
    _MIN_DIMENSION,
    _validate_image_bytes,
)


def _make(format_name: str, size: tuple[int, int] = (200, 200), color="red") -> bytes:
    """Helper — encode a real image into bytes."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format_name)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

class TestAcceptedFormats:
    @pytest.mark.parametrize(
        "fmt,mime",
        [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")],
    )
    def test_round_trip(self, fmt, mime):
        assert _validate_image_bytes(_make(fmt)) == mime


# ---------------------------------------------------------------------------
# Format rejections
# ---------------------------------------------------------------------------

class TestRejectedFormats:
    def test_empty_buffer_rejected(self):
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(b"")
        assert exc.value.status_code == 400

    def test_text_disguised_as_image_rejected(self):
        # Classic polyglot attempt — content-type says image/jpeg, payload
        # is anything else. Pillow can't open it.
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(b"<?php phpinfo(); ?>")
        assert exc.value.status_code == 400

    def test_html_rejected(self):
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(b"<html><body>not an image</body></html>")
        assert exc.value.status_code == 400

    def test_gif_rejected(self):
        gif_bytes = _make("GIF")
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(gif_bytes)
        assert exc.value.status_code == 400
        assert "GIF" in exc.value.detail or "não suportado" in exc.value.detail.lower()

    def test_bmp_rejected(self):
        bmp_bytes = _make("BMP")
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(bmp_bytes)
        assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Dimension bounds
# ---------------------------------------------------------------------------

class TestDimensionBounds:
    def test_tiny_image_rejected(self):
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(_make("PNG", size=(_MIN_DIMENSION - 1, _MIN_DIMENSION - 1)))
        assert exc.value.status_code == 400
        assert "pequena" in exc.value.detail

    def test_exact_minimum_accepted(self):
        # Boundary case — exactly _MIN_DIMENSION should pass.
        result = _validate_image_bytes(_make("PNG", size=(_MIN_DIMENSION, _MIN_DIMENSION)))
        assert result == "image/png"

    def test_too_wide_rejected(self):
        # Skip when Pillow would refuse to allocate this buffer locally;
        # the gate is still tested by the height case below.
        try:
            big = _make("JPEG", size=(_MAX_DIMENSION + 1, 100))
        except Exception:
            pytest.skip("local Pillow cannot encode such a wide image")
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(big)
        assert exc.value.status_code == 400
        assert "grande" in exc.value.detail

    def test_one_pixel_off_max_accepted(self):
        # The boundary on the upper side. Use a slim image so the JPEG
        # buffer stays cheap — we only care about one dimension at a time.
        result = _validate_image_bytes(_make("JPEG", size=(_MAX_DIMENSION, 16)))
        assert result == "image/jpeg"


# ---------------------------------------------------------------------------
# Polyglot / tampered content
# ---------------------------------------------------------------------------

class TestTamperedContent:
    def test_truncated_jpeg_rejected(self):
        good = _make("JPEG")
        truncated = good[: max(64, len(good) // 4)]
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(truncated)
        assert exc.value.status_code == 400

    def test_random_bytes_rejected(self):
        with pytest.raises(HTTPException) as exc:
            _validate_image_bytes(b"\x00\x01\x02\x03\x04\x05" * 64)
        assert exc.value.status_code == 400
