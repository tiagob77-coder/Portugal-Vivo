"""
MongoDB Restore Tool for Portugal Vivo de Portugal.

Lists available backups and restores from a specified archive.

Usage:
    python restore_mongodb.py --list                # List available backups
    python restore_mongodb.py --latest              # Restore the most recent backup
    python restore_mongodb.py --file <backup.gz>    # Restore a specific backup
    python restore_mongodb.py --from-s3 --latest    # Restore latest from S3
"""

import os
import sys
import subprocess
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MONGO_URL: str = os.environ.get("MONGO_URL", "mongodb://mongodb:27017")
DB_NAME: str = os.environ.get("DB_NAME", "patrimonio_vivo")
BACKUP_DIR: str = os.environ.get("BACKUP_DIR", "/app/backups")

AWS_ACCESS_KEY_ID: Optional[str] = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY: Optional[str] = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION: str = os.environ.get("AWS_REGION", "eu-west-1")
S3_BACKUP_BUCKET: Optional[str] = os.environ.get("S3_BACKUP_BUCKET")
S3_BACKUP_PREFIX: str = os.environ.get("S3_BACKUP_PREFIX", "mongodb-backups/")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-7s] %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("restore_mongodb")


def s3_configured() -> bool:
    return bool(S3_BACKUP_BUCKET and AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)


def get_s3_client():
    import boto3

    return boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION,
    )


# ---------------------------------------------------------------------------
# List backups
# ---------------------------------------------------------------------------

def list_local_backups() -> list[dict]:
    """Return local backups sorted newest-first."""
    backup_path = Path(BACKUP_DIR)
    if not backup_path.exists():
        return []

    results = []
    for f in sorted(backup_path.glob(f"{DB_NAME}_*.gz"), reverse=True):
        stat = f.stat()
        results.append(
            {
                "name": f.name,
                "path": str(f),
                "size_bytes": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "source": "local",
            }
        )
    return results


def list_s3_backups() -> list[dict]:
    """Return S3 backups sorted newest-first."""
    if not s3_configured():
        return []

    s3 = get_s3_client()
    paginator = s3.get_paginator("list_objects_v2")
    results = []

    for page in paginator.paginate(Bucket=S3_BACKUP_BUCKET, Prefix=S3_BACKUP_PREFIX):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            name = key.rsplit("/", 1)[-1]
            if name.endswith(".gz"):
                results.append(
                    {
                        "name": name,
                        "key": key,
                        "size_bytes": obj["Size"],
                        "modified": obj["LastModified"].isoformat(),
                        "source": "s3",
                    }
                )

    results.sort(key=lambda x: x["modified"], reverse=True)
    return results


def print_backup_list(backups: list[dict], source: str) -> None:
    """Pretty-print a list of backups."""
    if not backups:
        print(f"  No {source} backups found.")
        return

    print(f"\n  {'#':<4} {'Filename':<45} {'Size':>10}  {'Date'}")
    print(f"  {'─' * 4} {'─' * 45} {'─' * 10}  {'─' * 25}")
    for i, b in enumerate(backups, 1):
        size_mb = b["size_bytes"] / (1024 * 1024)
        print(f"  {i:<4} {b['name']:<45} {size_mb:>8.1f}MB  {b['modified']}")


# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------

def restore_from_archive(archive_path: str) -> None:
    """Run mongorestore from a gzipped archive."""
    log.info("Restoring from: %s", archive_path)

    cmd = [
        "mongorestore",
        f"--uri={MONGO_URL}",
        f"--db={DB_NAME}",
        "--gzip",
        f"--archive={archive_path}",
        "--drop",  # Drop existing collections before restoring
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        log.error("mongorestore failed: %s", result.stderr.strip())
        raise RuntimeError(f"mongorestore exited with code {result.returncode}")

    log.info("Restore completed successfully")


def download_from_s3(key: str) -> str:
    """Download a backup from S3 to a temp file. Returns local path."""
    s3 = get_s3_client()
    name = key.rsplit("/", 1)[-1]
    local_path = os.path.join(tempfile.gettempdir(), name)

    log.info("Downloading s3://%s/%s -> %s", S3_BACKUP_BUCKET, key, local_path)
    s3.download_file(S3_BACKUP_BUCKET, key, local_path)
    log.info("Download complete (%d bytes)", os.path.getsize(local_path))
    return local_path


def confirm_restore(backup_name: str) -> bool:
    """Prompt user to confirm the restore operation."""
    print(f"\n  WARNING: This will DROP and replace the '{DB_NAME}' database")
    print(f"  Backup to restore: {backup_name}")
    print(f"  Target: {MONGO_URL}")
    response = input("\n  Type 'yes' to proceed: ").strip().lower()
    return response == "yes"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    global BACKUP_DIR
    import argparse

    parser = argparse.ArgumentParser(description="MongoDB restore for Portugal Vivo")
    parser.add_argument("--list", action="store_true", help="List available backups")
    parser.add_argument("--latest", action="store_true", help="Restore the most recent backup")
    parser.add_argument("--file", type=str, help="Restore from a specific backup file")
    parser.add_argument(
        "--from-s3", action="store_true", help="Use S3 as the backup source"
    )
    parser.add_argument(
        "--yes", "-y", action="store_true", help="Skip confirmation prompt"
    )
    parser.add_argument(
        "--backup-dir",
        type=str,
        default=None,
        help=f"Override backup directory (default: {BACKUP_DIR})",
    )

    args = parser.parse_args()

    if args.backup_dir:
        BACKUP_DIR = args.backup_dir

    # --- List ---
    if args.list:
        print("\n=== Local Backups ===")
        print_backup_list(list_local_backups(), "local")
        if s3_configured():
            print("\n=== S3 Backups ===")
            print_backup_list(list_s3_backups(), "S3")
        else:
            print("\n  (S3 not configured)")
        return

    # --- Restore from explicit file ---
    if args.file:
        archive = args.file
        if not os.path.isabs(archive):
            archive = os.path.join(BACKUP_DIR, archive)
        if not os.path.exists(archive):
            log.error("File not found: %s", archive)
            sys.exit(1)
        if not args.yes and not confirm_restore(os.path.basename(archive)):
            print("  Aborted.")
            return
        restore_from_archive(archive)
        return

    # --- Restore latest ---
    if args.latest:
        if args.from_s3:
            if not s3_configured():
                log.error("S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BACKUP_BUCKET.")
                sys.exit(1)
            backups = list_s3_backups()
            if not backups:
                log.error("No S3 backups found")
                sys.exit(1)
            latest = backups[0]
            if not args.yes and not confirm_restore(latest["name"]):
                print("  Aborted.")
                return
            local_path = download_from_s3(latest["key"])
            restore_from_archive(local_path)
            os.unlink(local_path)
        else:
            backups = list_local_backups()
            if not backups:
                log.error("No local backups found in %s", BACKUP_DIR)
                sys.exit(1)
            latest = backups[0]
            if not args.yes and not confirm_restore(latest["name"]):
                print("  Aborted.")
                return
            restore_from_archive(latest["path"])
        return

    parser.print_help()


if __name__ == "__main__":
    main()
