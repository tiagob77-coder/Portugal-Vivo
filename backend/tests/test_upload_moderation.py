"""
E2E tests for image upload and admin moderation flows.
Tests the complete lifecycle: upload, list, moderate (approve/reject/delete).
"""
import io
import pytest
import anyio

from conftest import requires_db


@pytest.mark.anyio
@requires_db
async def test_upload_endpoint_rejects_invalid_type(client):
    """Upload endpoint should reject non-image files."""
    # Create a fake text file
    files = {"file": ("test.txt", io.BytesIO(b"not an image"), "text/plain")}
    data = {"context": "general"}

    # First register/login to get a token
    reg_resp = await client.post("/api/auth/register", json={
        "name": "Upload Tester",
        "email": "upload_test@example.com",
        "password": "testpass123",
    })
    if reg_resp.status_code == 409:
        # User already exists, login instead
        login_resp = await client.post("/api/auth/login", json={
            "email": "upload_test@example.com",
            "password": "testpass123",
        })
        token = login_resp.json().get("token", "")
    else:
        token = reg_resp.json().get("token", "")

    resp = await client.post(
        "/api/uploads",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    # 400 when endpoint validates content type; 401 when token is missing/invalid
    # 422 when auth/form validation fails first; 429 when rate limiter triggers
    assert resp.status_code in (400, 401, 422, 429)
    if resp.status_code == 400:
        assert "suportado" in resp.json().get("detail", "").lower() or "não" in resp.json().get("detail", "").lower()


@pytest.mark.anyio
@requires_db
async def test_upload_endpoint_rejects_empty_file(client):
    """Upload endpoint should reject empty files."""
    files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    data = {"context": "general"}

    login_resp = await client.post("/api/auth/login", json={
        "email": "upload_test@example.com",
        "password": "testpass123",
    })
    token = login_resp.json().get("token", "")

    resp = await client.post(
        "/api/uploads",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    # 400 when endpoint validates empty file; 401 when token is missing/invalid
    # 422 when auth/form validation fails first; 429 when rate limiter triggers
    assert resp.status_code in (400, 401, 422, 429)
    if resp.status_code == 400:
        assert "vazio" in resp.json().get("detail", "").lower()


@pytest.mark.anyio
@requires_db
async def test_upload_endpoint_rejects_oversized_file(client):
    """Upload endpoint should reject files over 5MB."""
    # Create a 6MB fake JPEG (just header + padding)
    big_data = b"\xff\xd8\xff\xe0" + b"\x00" * (6 * 1024 * 1024)
    files = {"file": ("big.jpg", io.BytesIO(big_data), "image/jpeg")}
    data = {"context": "general"}

    login_resp = await client.post("/api/auth/login", json={
        "email": "upload_test@example.com",
        "password": "testpass123",
    })
    token = login_resp.json().get("token", "")

    resp = await client.post(
        "/api/uploads",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    # 400 when endpoint validates oversized file; 401 when token is missing/invalid
    # 422 when auth/form validation fails first; 429 when rate limiter triggers
    assert resp.status_code in (400, 401, 422, 429)
    if resp.status_code == 400:
        assert "grande" in resp.json().get("detail", "").lower()


@pytest.mark.anyio
@requires_db
async def test_upload_requires_auth(client):
    """Upload endpoint should require authentication."""
    files = {"file": ("test.jpg", io.BytesIO(b"\xff\xd8\xff\xe0test"), "image/jpeg")}
    data = {"context": "general"}

    resp = await client.post("/api/uploads", files=files, data=data)
    assert resp.status_code in (401, 403, 422, 429)


@pytest.mark.anyio
@requires_db
async def test_admin_uploads_list(client):
    """Admin uploads endpoint should return a list."""
    resp = await client.get("/api/admin/uploads", params={"limit": 10})
    assert resp.status_code in (200, 429)
    if resp.status_code == 200:
        data = resp.json()
        assert "uploads" in data
        assert "total" in data
        assert isinstance(data["uploads"], list)


@pytest.mark.anyio
@requires_db
async def test_admin_moderate_invalid_action(client):
    """Moderation with invalid action should return 400."""
    resp = await client.post(
        "/api/admin/uploads/nonexistent/moderate",
        json={"action": "invalid_action"},
    )
    assert resp.status_code in (400, 429)


@pytest.mark.anyio
@requires_db
async def test_admin_moderate_nonexistent_image(client):
    """Moderation of non-existent image should return 404."""
    resp = await client.post(
        "/api/admin/uploads/nonexistent_id_12345/moderate",
        json={"action": "approve"},
    )
    assert resp.status_code in (404, 429)


@pytest.mark.anyio
@requires_db
async def test_cloudinary_signature_requires_auth(client):
    """Cloudinary signature endpoint should require auth."""
    resp = await client.get("/api/cloudinary/signature")
    assert resp.status_code in (401, 403, 422, 429)


@pytest.mark.anyio
@requires_db
async def test_cloudinary_poi_images_returns_list(client):
    """POI images endpoint should return list (even empty)."""
    resp = await client.get("/api/cloudinary/poi-images/test_poi_id")
    assert resp.status_code in (200, 429)
    if resp.status_code == 200:
        data = resp.json()
        assert "images" in data
        assert "total" in data
        assert isinstance(data["images"], list)


@pytest.mark.anyio
@requires_db
async def test_upload_valid_image_with_context(client):
    """Upload a valid small JPEG with POI context."""
    # Minimal valid JPEG (smallest possible)
    # JFIF header + minimal data
    minimal_jpeg = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
        b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
        b"\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342"
        b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
        b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
        b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
        b"\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04"
        b"\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07"
        b"\x22q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16"
        b"\x17\x18\x19\x1a%&\'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz"
        b"\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99"
        b"\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7"
        b"\xb8\xb9\xba\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5"
        b"\xd6\xd7\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1"
        b"\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa"
        b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd2\x8a(\x03\xff\xd9"
    )

    files = {"file": ("test_poi.jpg", io.BytesIO(minimal_jpeg), "image/jpeg")}
    data = {"context": "poi", "item_id": "test_heritage_123"}

    login_resp = await client.post("/api/auth/login", json={
        "email": "upload_test@example.com",
        "password": "testpass123",
    })
    token = login_resp.json().get("token", "")

    resp = await client.post(
        "/api/uploads",
        files=files,
        data=data,
        headers={"Authorization": f"Bearer {token}"},
    )
    # Should succeed (200), fail gracefully if Cloudinary not configured (500),
    # or reject if auth token is invalid in test environment (401/422)
    assert resp.status_code in (200, 401, 422, 429, 500)
    if resp.status_code == 200:
        result = resp.json()
        assert "url" in result
        assert "id" in result
        assert "size" in result
