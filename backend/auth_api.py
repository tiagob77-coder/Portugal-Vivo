"""
Auth API - Authentication endpoints extracted from server.py.
Handles login, registration, password reset, session exchange, and logout.
Includes bcrypt hashing, input validation, and role-based access control.
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, timezone, timedelta
import time
import uuid
import hashlib
import secrets
import os
import re
import httpx
import logging
import bcrypt

from models.api_models import User
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

# In-process TTL cache for get_current_user. Cuts two Mongo round-trips from
# every authenticated request. Short TTL keeps the blast radius of a revoked
# session small (logout still deletes the session row — we just tolerate up
# to `_SESSION_CACHE_TTL` seconds of staleness).
_SESSION_CACHE_TTL = 60  # seconds
_SESSION_CACHE_MAX = 2048
_session_cache: dict[str, tuple[float, Optional[User]]] = {}


def _cache_get(token: str) -> Optional[tuple[float, Optional[User]]]:
    entry = _session_cache.get(token)
    if not entry:
        return None
    expires_at, _ = entry
    if expires_at < time.monotonic():
        _session_cache.pop(token, None)
        return None
    return entry


def _cache_put(token: str, user: Optional[User]) -> None:
    # Cheap eviction: when full, drop ~10% of entries (oldest by expiry first)
    if len(_session_cache) >= _SESSION_CACHE_MAX:
        victims = sorted(_session_cache.items(), key=lambda kv: kv[1][0])[: _SESSION_CACHE_MAX // 10]
        for k, _ in victims:
            _session_cache.pop(k, None)
    _session_cache[token] = (time.monotonic() + _SESSION_CACHE_TTL, user)


def _cache_invalidate(token: str) -> None:
    _session_cache.pop(token, None)

AUTH_BACKEND_URL = os.environ.get("AUTH_BACKEND_URL", "https://demobackend.emergentagent.com")
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")

auth_router = APIRouter()

_db_holder = DatabaseHolder("auth")
set_auth_db = _db_holder.set


# ========================
# AUTH HELPERS
# ========================

async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token (with short TTL cache)."""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]

    if not session_token:
        return None

    cached = _cache_get(session_token)
    if cached is not None:
        return cached[1]

    session = await _db_holder.db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )

    if not session:
        _cache_put(session_token, None)
        return None

    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        _cache_put(session_token, None)
        return None

    user_doc = await _db_holder.db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )

    if user_doc:
        user = User(**user_doc)
        _cache_put(session_token, user)
        return user
    _cache_put(session_token, None)
    return None


async def require_auth(request: Request) -> User:
    """Require authentication"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(request: Request) -> User:
    """Require admin role"""
    user = await require_auth(request)
    user_doc = await _db_holder.db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores")
    return user


# ========================
# PASSWORD HASHING (bcrypt + PBKDF2 legacy)
# ========================

def hash_password_bcrypt(password: str) -> str:
    """Hash password with bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password_bcrypt(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash"""
    return bcrypt.checkpw(password.encode(), hashed.encode())


def hash_password_legacy(password: str, salt: str = None) -> tuple[str, str]:
    """Legacy PBKDF2 hash (for backward compatibility)"""
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return hashed.hex(), salt


def verify_password_legacy(password: str, hashed: str, salt: str) -> bool:
    """Verify legacy PBKDF2 password"""
    new_hash, _ = hash_password_legacy(password, salt)
    return new_hash == hashed


# Backward-compatible aliases
def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    return hash_password_legacy(password, salt)

def verify_password(password: str, hashed: str, salt: str) -> bool:
    return verify_password_legacy(password, hashed, salt)


def verify_user_password(password: str, user_doc: dict) -> bool:
    """Verify password - supports both bcrypt and legacy PBKDF2"""
    if user_doc.get("hash_algo") == "bcrypt":
        return verify_password_bcrypt(password, user_doc["password_hash"])
    return verify_password_legacy(password, user_doc["password_hash"], user_doc["password_salt"])


async def migrate_to_bcrypt(user_id: str, password: str):
    """Silently migrate a user from PBKDF2 to bcrypt on successful login"""
    new_hash = hash_password_bcrypt(password)
    await _db_holder.db.users.update_one(
        {"user_id": user_id},
        {"$set": {"password_hash": new_hash, "hash_algo": "bcrypt"},
         "$unset": {"password_salt": ""}}
    )


# ========================
# INPUT VALIDATION
# ========================

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def validate_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_REGEX.match(email):
        raise ValueError("Formato de email invalido")
    if len(email) > 254:
        raise ValueError("Email demasiado longo")
    return email


def validate_password(password: str) -> str:
    if len(password) < 6:
        raise ValueError("Password deve ter pelo menos 6 caracteres")
    if len(password) > 128:
        raise ValueError("Password demasiado longa")
    return password


def validate_name(name: str) -> str:
    name = name.strip()
    if len(name) < 2:
        raise ValueError("Nome deve ter pelo menos 2 caracteres")
    if len(name) > 100:
        raise ValueError("Nome demasiado longo")
    return name


# ========================
# AUTH MODELS (with validation)
# ========================

class EmailLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator('email')
    @classmethod
    def check_email(cls, v):
        return validate_email(v)


class EmailRegisterRequest(BaseModel):
    email: str
    password: str
    name: str

    @field_validator('email')
    @classmethod
    def check_email(cls, v):
        return validate_email(v)

    @field_validator('password')
    @classmethod
    def check_password(cls, v):
        return validate_password(v)

    @field_validator('name')
    @classmethod
    def check_name(cls, v):
        return validate_name(v)


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator('email')
    @classmethod
    def check_email(cls, v):
        return validate_email(v)


# ========================
# AUTH ENDPOINTS
# ========================

@auth_router.post("/auth/login")
async def email_login(request: EmailLoginRequest, response: Response):
    """Login with email and password"""
    user = await _db_holder.db.users.find_one({"email": request.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Email ou password incorretos")

    if "password_hash" not in user:
        raise HTTPException(status_code=401, detail="Esta conta usa login social. Use o botao Google.")

    if not verify_user_password(request.password, user):
        raise HTTPException(status_code=401, detail="Email ou password incorretos")

    # Silently migrate legacy PBKDF2 to bcrypt
    if user.get("hash_algo") != "bcrypt":
        await migrate_to_bcrypt(user["user_id"], request.password)

    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await _db_holder.db.user_sessions.delete_many({"user_id": user["user_id"]})
    await _db_holder.db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )

    return {
        "user": User(**user),
        "session_token": session_token,
        "message": "Login bem sucedido"
    }


@auth_router.post("/auth/register")
async def email_register(request: EmailRegisterRequest, response: Response):
    """Register with email and password (bcrypt)"""
    existing = await _db_holder.db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Este email ja esta registado")

    password_hash = hash_password_bcrypt(request.password)

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": request.email,
        "name": request.name,
        "password_hash": password_hash,
        "hash_algo": "bcrypt",
        "picture": None,
        "created_at": datetime.now(timezone.utc),
        "favorites": [],
        "role": "user",
        "auth_type": "email"
    }

    await _db_holder.db.users.insert_one(user_doc)

    return {"message": "Conta criada com sucesso", "user_id": user_id}


@auth_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Request password reset"""
    user = await _db_holder.db.users.find_one({"email": request.email})

    if user and "password_hash" in user:
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        await _db_holder.db.password_resets.insert_one({
            "user_id": user["user_id"],
            "email": request.email,
            "token": reset_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
            "used": False
        })

        logger.info("Password reset requested for %s", request.email)

    return {"message": "Se o email existir, recebera instrucoes para repor a password"}


@auth_router.post("/auth/reset-password")
async def reset_password(token: str, new_password: str):
    """Reset password with token"""
    """Reset password with token (uses bcrypt)"""
    reset = await _db_holder.db.password_resets.find_one({
        "token": token,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })

    if not reset:
        raise HTTPException(status_code=400, detail="Token invalido ou expirado")

    new_password = validate_password(new_password)
    password_hash = hash_password_bcrypt(new_password)

    await _db_holder.db.users.update_one(
        {"user_id": reset["user_id"]},
        {"$set": {"password_hash": password_hash, "hash_algo": "bcrypt"},
         "$unset": {"password_salt": ""}}
    )

    await _db_holder.db.password_resets.update_one(
        {"token": token},
        {"$set": {"used": True}}
    )

    await _db_holder.db.user_sessions.delete_many({"user_id": reset["user_id"]})

    return {"message": "Password alterada com sucesso"}


@auth_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")

    async with httpx.AsyncClient() as http_client:
        try:
            auth_response = await http_client.get(
                f"{AUTH_BACKEND_URL}/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")

            user_data = auth_response.json()
        except httpx.TimeoutException:
            logger.error("Auth service timeout")
            raise HTTPException(status_code=504, detail="Auth service timeout")
        except Exception as e:
            logger.error("Auth error: %s", e)
            raise HTTPException(status_code=401, detail="Authentication failed")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await _db_holder.db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )

    if existing_user:
        user_id = existing_user["user_id"]
    else:
        await _db_holder.db.users.insert_one({
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc),
            "favorites": []
        })

    session_token = user_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await _db_holder.db.user_sessions.delete_many({"user_id": user_id})
    await _db_holder.db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )

    user_doc = await _db_holder.db.users.find_one({"user_id": user_id}, {"_id": 0})
    return User(**user_doc)


@auth_router.get("/auth/me")
async def get_me(current_user: User = Depends(require_auth)):
    """Get current user"""
    return current_user


@auth_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        _cache_invalidate(session_token)
        await _db_holder.db.user_sessions.delete_many({"session_token": session_token})

    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}
