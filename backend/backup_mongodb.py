"""
MongoDB Automated Backup System for Portugal Vivo de Portugal.

Creates compressed backups using mongodump, supports S3 upload and local storage.
Implements retention policies: 7 daily, 4 weekly, 3 monthly.

Usage:
    python backup_mongodb.py
    python backup_mongodb.py --local-only
    python backup_mongodb.py --backup-dir /custom/path
"""

import os
import sys
import subprocess
import logging
import json
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Structured logging setup
# ---------------------------------------------------------------------------

LOG_FORMAT = os.environ.get("LOG_FORMAT", "").lower()
IS_PRODUCTION = LOG_FORMAT == "json" or os.environ.get("ENVIRONMENT", "").lower() in (
    "production",
    "staging",
)


class _JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "component": "mongodb-backup",
        }
        if record.exc_info and record.exc_info[1]:
            entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]),
            }
        # Merge extra structured fields
        for key in ("backup_file", "backup_size", "duration_s", "bucket", "key"):
            if hasattr(record, key):
                entry[key] = getattr(record, key)
        return json.dumps(entry, ensure_ascii=False, default=str)


def _setup_logger() -> logging.Logger:
    logger = logging.getLogger("backup_mongodb")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    if IS_PRODUCTION:
        handler.setFormatter(_JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)-7s] %(name)s: %(message)s")
        )
    logger.addHandler(handler)
    return logger


log = _setup_logger()

# ---------------------------------------------------------------------------
# Configuration from environment
# ---------------------------------------------------------------------------

MONGO_URL: str = os.environ.get("MONGO_URL", "mongodb://mongodb:27017")
DB_NAME: str = os.environ.get("DB_NAME", "patrimonio_vivo")
BACKUP_DIR: str = os.environ.get("BACKUP_DIR", "/app/backups")

# S3 configuration (all optional -- falls back to local-only if missing)
AWS_ACCESS_KEY_ID: Optional[str] = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY: Optional[str] = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION: str = os.environ.get("AWS_REGION", "eu-west-1")
S3_BACKUP_BUCKET: Optional[str] = os.environ.get("S3_BACKUP_BUCKET")
S3_BACKUP_PREFIX: str = os.environ.get("S3_BACKUP_PREFIX", "mongodb-backups/")

# Retention policy
RETAIN_DAILY: int = int(os.environ.get("RETAIN_DAILY", "7"))
RETAIN_WEEKLY: int = int(os.environ.get("RETAIN_WEEKLY", "4"))
RETAIN_MONTHLY: int = int(os.environ.get("RETAIN_MONTHLY", "3"))


def s3_configured() -> bool:
    return bool(S3_BACKUP_BUCKET and AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)


def get_s3_client():
    """Lazily create an S3 client."""
    import boto3

    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION,
    )


# ---------------------------------------------------------------------------
# Backup
# ---------------------------------------------------------------------------

def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def run_mongodump(output_path: Path) -> Path:
    """Run mongodump with gzip compression and return the archive path."""
    archive_name = f"{DB_NAME}_{_timestamp()}.gz"
    archive_path = output_path / archive_name

    cmd = [
        "mongodump",
        f"--uri={MONGO_URL}",
        f"--db={DB_NAME}",
        "--gzip",
        f"--archive={archive_path}",
    ]

    log.info("Starting mongodump", extra={"backup_file": str(archive_path)})
    t0 = datetime.now(timezone.utc)

    result = subprocess.run(cmd, capture_output=True, text=True)

    duration = (datetime.now(timezone.utc) - t0).total_seconds()

    if result.returncode != 0:
        log.error(
            "mongodump failed: %s",
            result.stderr.strip(),
            extra={"duration_s": duration},
        )
        raise RuntimeError(f"mongodump exited with code {result.returncode}")

    size_bytes = archive_path.stat().st_size
    log.info(
        "mongodump completed",
        extra={
            "backup_file": str(archive_path),
            "backup_size": size_bytes,
            "duration_s": round(duration, 2),
        },
    )
    return archive_path


def upload_to_s3(local_path: Path) -> str:
    """Upload a backup archive to S3 and return the S3 key."""
    s3 = get_s3_client()
    key = f"{S3_BACKUP_PREFIX}{local_path.name}"

    log.info(
        "Uploading to S3",
        extra={"bucket": S3_BACKUP_BUCKET, "key": key, "backup_size": local_path.stat().st_size},
    )
    t0 = datetime.now(timezone.utc)

    s3.upload_file(str(local_path), S3_BACKUP_BUCKET, key)

    duration = (datetime.now(timezone.utc) - t0).total_seconds()
    log.info(
        "S3 upload completed",
        extra={"bucket": S3_BACKUP_BUCKET, "key": key, "duration_s": round(duration, 2)},
    )
    return key


# ---------------------------------------------------------------------------
# Retention
# ---------------------------------------------------------------------------

def _parse_backup_timestamp(filename: str) -> Optional[datetime]:
    """Extract datetime from a backup filename like patrimonio_vivo_20260101T020000Z.gz"""
    try:
        ts_part = filename.replace(f"{DB_NAME}_", "").replace(".gz", "")
        return datetime.strptime(ts_part, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    except (ValueError, IndexError):
        return None


def apply_retention_local(backup_dir: Path) -> None:
    """Delete old local backups according to the retention policy."""
    files = sorted(backup_dir.glob(f"{DB_NAME}_*.gz"))
    if not files:
        return

    now = datetime.now(timezone.utc)
    keep: set[str] = set()

    # Parse all backup timestamps
    backups = []
    for f in files:
        ts = _parse_backup_timestamp(f.name)
        if ts:
            backups.append((f, ts))

    backups.sort(key=lambda x: x[1], reverse=True)

    # Keep last N daily
    daily_kept = 0
    seen_days: set[str] = set()
    for f, ts in backups:
        day_key = ts.strftime("%Y-%m-%d")
        if day_key not in seen_days:
            seen_days.add(day_key)
            daily_kept += 1
            if daily_kept <= RETAIN_DAILY:
                keep.add(f.name)

    # Keep last N weekly (one per ISO week)
    weekly_kept = 0
    seen_weeks: set[str] = set()
    for f, ts in backups:
        week_key = ts.strftime("%G-W%V")
        if week_key not in seen_weeks:
            seen_weeks.add(week_key)
            weekly_kept += 1
            if weekly_kept <= RETAIN_WEEKLY:
                keep.add(f.name)

    # Keep last N monthly (one per month)
    monthly_kept = 0
    seen_months: set[str] = set()
    for f, ts in backups:
        month_key = ts.strftime("%Y-%m")
        if month_key not in seen_months:
            seen_months.add(month_key)
            monthly_kept += 1
            if monthly_kept <= RETAIN_MONTHLY:
                keep.add(f.name)

    # Delete everything not in the keep set
    deleted = 0
    for f, ts in backups:
        if f.name not in keep:
            f.unlink()
            deleted += 1
            log.info("Deleted old local backup: %s", f.name)

    if deleted:
        log.info("Retention cleanup: deleted %d old backups, kept %d", deleted, len(keep))


def apply_retention_s3() -> None:
    """Delete old S3 backups according to the retention policy."""
    if not s3_configured():
        return

    s3 = get_s3_client()
    prefix = S3_BACKUP_PREFIX

    paginator = s3.get_paginator("list_objects_v2")
    all_objects = []
    for page in paginator.paginate(Bucket=S3_BACKUP_BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            name = key.rsplit("/", 1)[-1]
            ts = _parse_backup_timestamp(name)
            if ts:
                all_objects.append((key, name, ts))

    if not all_objects:
        return

    all_objects.sort(key=lambda x: x[2], reverse=True)
    keep: set[str] = set()

    # Daily
    seen_days: set[str] = set()
    daily_kept = 0
    for key, name, ts in all_objects:
        day_key = ts.strftime("%Y-%m-%d")
        if day_key not in seen_days:
            seen_days.add(day_key)
            daily_kept += 1
            if daily_kept <= RETAIN_DAILY:
                keep.add(key)

    # Weekly
    seen_weeks: set[str] = set()
    weekly_kept = 0
    for key, name, ts in all_objects:
        week_key = ts.strftime("%G-W%V")
        if week_key not in seen_weeks:
            seen_weeks.add(week_key)
            weekly_kept += 1
            if weekly_kept <= RETAIN_WEEKLY:
                keep.add(key)

    # Monthly
    seen_months: set[str] = set()
    monthly_kept = 0
    for key, name, ts in all_objects:
        month_key = ts.strftime("%Y-%m")
        if month_key not in seen_months:
            seen_months.add(month_key)
            monthly_kept += 1
            if monthly_kept <= RETAIN_MONTHLY:
                keep.add(key)

    # Delete old objects
    to_delete = [key for key, _, _ in all_objects if key not in keep]
    if to_delete:
        # S3 delete_objects accepts up to 1000 keys at a time
        for i in range(0, len(to_delete), 1000):
            batch = to_delete[i : i + 1000]
            s3.delete_objects(
                Bucket=S3_BACKUP_BUCKET,
                Delete={"Objects": [{"Key": k} for k in batch]},
            )
        log.info(
            "S3 retention cleanup: deleted %d old backups, kept %d",
            len(to_delete),
            len(keep),
        )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_backup(local_only: bool = False, backup_dir: Optional[str] = None) -> str:
    """Execute a full backup cycle. Returns the backup filename."""
    output_dir = Path(backup_dir or BACKUP_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    log.info(
        "=== MongoDB backup started ===",
        extra={"backup_file": str(output_dir)},
    )
    t0 = datetime.now(timezone.utc)

    # 1. Dump
    archive_path = run_mongodump(output_dir)

    # 2. Upload to S3 (if configured and not local-only)
    if not local_only and s3_configured():
        try:
            upload_to_s3(archive_path)
            apply_retention_s3()
        except Exception:
            log.exception("S3 upload/retention failed -- local backup is still available")
    elif not local_only and not s3_configured():
        log.info("S3 not configured -- keeping local backup only")

    # 3. Local retention
    apply_retention_local(output_dir)

    total_duration = (datetime.now(timezone.utc) - t0).total_seconds()
    log.info(
        "=== MongoDB backup completed ===",
        extra={
            "backup_file": archive_path.name,
            "duration_s": round(total_duration, 2),
        },
    )
    return archive_path.name


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="MongoDB backup for Portugal Vivo")
    parser.add_argument(
        "--local-only",
        action="store_true",
        help="Skip S3 upload, keep backup locally only",
    )
    parser.add_argument(
        "--backup-dir",
        type=str,
        default=None,
        help=f"Override backup directory (default: {BACKUP_DIR})",
    )
    args = parser.parse_args()

    try:
        filename = run_backup(local_only=args.local_only, backup_dir=args.backup_dir)
        print(f"Backup successful: {filename}")
    except Exception:
        log.exception("Backup failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
