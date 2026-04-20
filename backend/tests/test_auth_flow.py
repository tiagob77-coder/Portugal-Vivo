"""
FASE 3 - Auth flow unit tests.
Tests password hashing, input validation, model validation.
No database or server required.
"""
import pytest
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Password hashing tests
# ---------------------------------------------------------------------------

class TestPasswordHashing:
    """Test bcrypt and legacy PBKDF2 hashing."""

    def test_bcrypt_hash_and_verify(self):
        from auth_api import hash_password_bcrypt, verify_password_bcrypt
        hashed = hash_password_bcrypt("test_password_123")
        assert verify_password_bcrypt("test_password_123", hashed)
        assert not verify_password_bcrypt("wrong_password", hashed)

    def test_bcrypt_different_hashes(self):
        """Same password should produce different hashes (salted)."""
        from auth_api import hash_password_bcrypt
        h1 = hash_password_bcrypt("same_password")
        h2 = hash_password_bcrypt("same_password")
        assert h1 != h2  # Different salts

    def test_legacy_hash_and_verify(self):
        from auth_api import hash_password_legacy, verify_password_legacy
        hashed, salt = hash_password_legacy("legacy_pass")
        assert verify_password_legacy("legacy_pass", hashed, salt)
        assert not verify_password_legacy("wrong_pass", hashed, salt)

    def test_legacy_with_fixed_salt(self):
        from auth_api import hash_password_legacy
        h1, _ = hash_password_legacy("test", "fixed_salt")
        h2, _ = hash_password_legacy("test", "fixed_salt")
        assert h1 == h2

    def test_verify_user_password_bcrypt(self):
        from auth_api import hash_password_bcrypt, verify_user_password
        hashed = hash_password_bcrypt("my_password")
        user_doc = {"hash_algo": "bcrypt", "password_hash": hashed}
        assert verify_user_password("my_password", user_doc)
        assert not verify_user_password("bad_password", user_doc)

    def test_verify_user_password_legacy(self):
        from auth_api import hash_password_legacy, verify_user_password
        hashed, salt = hash_password_legacy("old_password")
        user_doc = {"password_hash": hashed, "password_salt": salt}
        assert verify_user_password("old_password", user_doc)
        assert not verify_user_password("wrong", user_doc)

    def test_backward_compat_aliases(self):
        from auth_api import hash_password, verify_password
        hashed, salt = hash_password("compat_test")
        assert verify_password("compat_test", hashed, salt)


# ---------------------------------------------------------------------------
# Email validation tests
# ---------------------------------------------------------------------------

class TestEmailValidation:
    """Test email validation function."""

    def test_valid_emails(self):
        from auth_api import validate_email
        valid = [
            "user@example.com",
            "test.user@domain.pt",
            "user+tag@gmail.com",
            "a@b.co",
        ]
        for email in valid:
            result = validate_email(email)
            assert result == email.strip().lower()

    def test_invalid_emails(self):
        from auth_api import validate_email
        invalid = [
            "not-an-email",
            "@domain.com",
            "user@",
            "user@.com",
            "",
            "user @example.com",
            "user@domain",
        ]
        for email in invalid:
            with pytest.raises(ValueError):
                validate_email(email)

    def test_email_too_long(self):
        from auth_api import validate_email
        long_email = "a" * 250 + "@b.co"
        with pytest.raises(ValueError, match="demasiado longo"):
            validate_email(long_email)

    def test_email_whitespace_stripped(self):
        from auth_api import validate_email
        result = validate_email("  User@Example.COM  ")
        assert result == "user@example.com"


# ---------------------------------------------------------------------------
# Password validation tests
# ---------------------------------------------------------------------------

class TestPasswordValidation:
    """Test password validation function."""

    def test_valid_password(self):
        from auth_api import validate_password
        assert validate_password("valid123") == "valid123"

    def test_password_too_short(self):
        from auth_api import validate_password
        with pytest.raises(ValueError, match="pelo menos 6"):
            validate_password("12345")

    def test_password_too_long(self):
        from auth_api import validate_password
        with pytest.raises(ValueError, match="demasiado longa"):
            validate_password("x" * 129)

    def test_password_min_length(self):
        from auth_api import validate_password
        assert validate_password("123456") == "123456"

    def test_password_max_length(self):
        from auth_api import validate_password
        assert validate_password("x" * 128) == "x" * 128


# ---------------------------------------------------------------------------
# Name validation tests
# ---------------------------------------------------------------------------

class TestNameValidation:
    """Test name validation function."""

    def test_valid_name(self):
        from auth_api import validate_name
        assert validate_name("João Silva") == "João Silva"

    def test_name_too_short(self):
        from auth_api import validate_name
        with pytest.raises(ValueError, match="pelo menos 2"):
            validate_name("A")

    def test_name_too_long(self):
        from auth_api import validate_name
        with pytest.raises(ValueError, match="demasiado longo"):
            validate_name("x" * 101)

    def test_name_stripped(self):
        from auth_api import validate_name
        assert validate_name("  Maria  ") == "Maria"

    def test_name_min_length(self):
        from auth_api import validate_name
        assert validate_name("AB") == "AB"


# ---------------------------------------------------------------------------
# Auth model validation tests
# ---------------------------------------------------------------------------

class TestAuthModels:
    """Test Pydantic auth request models."""

    def test_login_request_valid(self):
        from auth_api import EmailLoginRequest
        req = EmailLoginRequest(email="user@test.com", password="pass123")
        assert req.email == "user@test.com"

    def test_login_request_bad_email(self):
        from auth_api import EmailLoginRequest
        with pytest.raises(ValidationError):
            EmailLoginRequest(email="not-email", password="pass123")

    def test_register_request_valid(self):
        from auth_api import EmailRegisterRequest
        req = EmailRegisterRequest(email="new@test.com", password="pass123", name="Test User")
        assert req.email == "new@test.com"
        assert req.name == "Test User"

    def test_register_short_password(self):
        from auth_api import EmailRegisterRequest
        with pytest.raises(ValidationError):
            EmailRegisterRequest(email="new@test.com", password="12345", name="Test")

    def test_register_short_name(self):
        from auth_api import EmailRegisterRequest
        with pytest.raises(ValidationError):
            EmailRegisterRequest(email="new@test.com", password="pass123", name="A")

    def test_forgot_password_valid(self):
        from auth_api import ForgotPasswordRequest
        req = ForgotPasswordRequest(email="user@test.com")
        assert req.email == "user@test.com"

    def test_forgot_password_bad_email(self):
        from auth_api import ForgotPasswordRequest
        with pytest.raises(ValidationError):
            ForgotPasswordRequest(email="bad")


# ---------------------------------------------------------------------------
# Email regex edge cases
# ---------------------------------------------------------------------------

class TestEmailRegex:
    """Test email regex pattern edge cases."""

    def test_regex_pattern(self):
        from auth_api import EMAIL_REGEX
        assert EMAIL_REGEX.match("user@example.com")
        assert EMAIL_REGEX.match("a.b.c@test.org")
        assert not EMAIL_REGEX.match("@test.com")
        assert not EMAIL_REGEX.match("user@")
        assert not EMAIL_REGEX.match("")

    def test_unicode_domain_rejected(self):
        """Standard email regex should not match IDN domains."""
        from auth_api import EMAIL_REGEX
        assert not EMAIL_REGEX.match("user@domínio.pt")

    def test_sql_injection_in_email(self):
        """SQL-like payloads should be rejected."""
        from auth_api import validate_email
        with pytest.raises(ValueError):
            validate_email("'; DROP TABLE users; --@test.com")
