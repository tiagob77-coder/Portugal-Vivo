"""
Google OAuth API - Social sign-in with Google.
Handles Google ID token verification and user creation/login.
"""
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import uuid
import secrets
import os
import httpx
import logging

from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

google_auth_router = APIRouter(prefix="/auth", tags=["Auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

_db_holder = DatabaseHolder("google_auth")
set_google_auth_db = _db_holder.set
_get_db = _db_holder.get


class GoogleLoginRequest(BaseModel):
    id_token: str | None = None
    access_token: str | None = None
    credential: str | None = None  # Google One Tap credential


async def verify_google_token(id_token: str) -> dict | None:
    """Verify a Google ID token and return user info."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            # Try tokeninfo endpoint first
            resp = await client.get(
                GOOGLE_TOKEN_INFO_URL,
                params={"id_token": id_token}
            )
            if resp.status_code == 200:
                data = resp.json()
                # Verify audience matches our client ID
                if GOOGLE_CLIENT_ID and data.get("aud") != GOOGLE_CLIENT_ID:
                    logger.warning("Google token audience mismatch")
                    return None
                return {
                    "google_id": data.get("sub"),
                    "email": data.get("email"),
                    "name": data.get("name", data.get("email", "").split("@")[0]),
                    "picture": data.get("picture"),
                    "email_verified": data.get("email_verified") == "true",
                }
        except Exception as e:
            logger.error("Google token verification failed: %s", e)
            return None
    return None


async def get_google_userinfo(access_token: str) -> dict | None:
    """Get user info from Google using an access token."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "google_id": data.get("sub"),
                    "email": data.get("email"),
                    "name": data.get("name", data.get("email", "").split("@")[0]),
                    "picture": data.get("picture"),
                    "email_verified": data.get("email_verified", False),
                }
        except Exception as e:
            logger.error("Google userinfo request failed: %s", e)
            return None
    return None


@google_auth_router.post("/google")
async def google_login(request: GoogleLoginRequest, response: Response):
    """
    Login or register with Google.
    Accepts either id_token (from Google Sign-In) or access_token (from OAuth flow).
    """
    db = _get_db()

    # Verify Google credentials
    google_user = None

    token = request.id_token or request.credential
    if token:
        google_user = await verify_google_token(token)
    elif request.access_token:
        google_user = await get_google_userinfo(request.access_token)

    if not google_user or not google_user.get("email"):
        raise HTTPException(status_code=401, detail="Credenciais Google inválidas")

    email = google_user["email"].strip().lower()
    google_id = google_user.get("google_id", "")

    # Find existing user by email or google_id
    existing = await db.users.find_one(
        {"$or": [{"email": email}, {"google_id": google_id}]},
        {"_id": 0}
    )

    if existing:
        user_id = existing["user_id"]
        # Update Google-specific fields
        update_fields = {"google_id": google_id, "auth_type": "google"}
        if google_user.get("picture") and not existing.get("picture"):
            update_fields["picture"] = google_user["picture"]
        if google_user.get("name") and not existing.get("name"):
            update_fields["name"] = google_user["name"]

        await db.users.update_one(
            {"user_id": user_id},
            {"$set": update_fields}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": google_user.get("name", email.split("@")[0]),
            "picture": google_user.get("picture"),
            "google_id": google_id,
            "auth_type": "google",
            "created_at": datetime.now(timezone.utc),
            "favorites": [],
            "role": "user",
        }
        await db.users.insert_one(user_doc)

    # Create session
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
        "auth_method": "google",
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=30 * 24 * 60 * 60
    )

    # Fetch full user doc for response
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})

    from models.api_models import User
    return {
        "user": User(**user_doc),
        "session_token": session_token,
        "message": "Login com Google bem sucedido",
        "is_new_user": existing is None,
    }


@google_auth_router.get("/google/client-id")
async def get_google_client_id():
    """Get the Google Client ID for frontend use."""
    return {"client_id": GOOGLE_CLIENT_ID}
