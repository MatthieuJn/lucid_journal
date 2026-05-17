"""
ActivityWatch → Lucid Journal sync script
Runs on your PC. Pulls events from:
  - PC ActivityWatch  (localhost:5600)
  - Android ActivityWatch via local network (ANDROID_AW_HOST:5600)
Then pushes to the Vercel API route.

Usage:
    pip install requests python-dotenv
    python scripts/sync_activitywatch.py

Schedule with Task Scheduler or run manually.
"""

import os
import sys
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

# Load from root .env.local (works whether you run from repo root or scripts/)
_root = Path(__file__).parent.parent
load_dotenv(_root / ".env.local")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

VERCEL_URL = os.environ["VERCEL_URL"]          # e.g. https://lucid-journal.vercel.app
SYNC_SECRET = os.environ.get("SYNC_SECRET", "")

PC_AW_HOST = os.environ.get("PC_AW_HOST", "localhost:5600")
ANDROID_AW_HOST = os.environ.get("ANDROID_AW_HOST", "")  # leave empty to skip Android

# How far back to pull events (default: last 24h)
LOOKBACK_HOURS = int(os.environ.get("LOOKBACK_HOURS", "24"))

# ActivityWatch bucket name patterns to collect
# AW buckets are named like: aw-watcher-window_HOSTNAME, aw-watcher-afk_HOSTNAME, etc.
PC_BUCKET_PATTERNS = ["aw-watcher-window", "aw-watcher-afk", "aw-watcher-web"]
ANDROID_BUCKET_PATTERNS = ["aw-watcher-android"]

# ── ActivityWatch helpers ──────────────────────────────────────────────────────

def aw_get(host: str, path: str, timeout: int = 10) -> Any:
    url = f"http://{host}/api/0{path}"
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    return r.json()


def get_buckets(host: str, patterns: list[str]) -> list[dict]:
    try:
        all_buckets = aw_get(host, "/buckets")
    except Exception as e:
        log.warning("Cannot reach ActivityWatch at %s: %s", host, e)
        return []

    matched = []
    for bucket_id, info in all_buckets.items():
        if any(bucket_id.startswith(p) for p in patterns):
            info["id"] = bucket_id
            matched.append(info)
    return matched


def get_events(host: str, bucket_id: str, since: datetime) -> list[dict]:
    since_str = since.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    try:
        events = aw_get(host, f"/buckets/{bucket_id}/events?limit=10000&start={since_str}")
        return events
    except Exception as e:
        log.warning("Error fetching events from bucket %s: %s", bucket_id, e)
        return []


def extract_app_title(event: dict, bucket_id: str) -> tuple[str | None, str | None]:
    data = event.get("data", {})
    # window watcher
    if "app" in data:
        return data.get("app"), data.get("title")
    # android watcher
    if "package" in data:
        return data.get("package"), data.get("classname")
    # afk watcher
    if "status" in data:
        return "afk", data.get("status")
    # web watcher
    if "url" in data:
        return "browser", data.get("title") or data.get("url")
    return None, None


def collect(source: str, host: str, patterns: list[str], since: datetime) -> list[dict]:
    buckets = get_buckets(host, patterns)
    log.info("[%s] Found %d matching buckets on %s", source, len(buckets), host)

    rows = []
    for bucket in buckets:
        bucket_id = bucket["id"]
        events = get_events(host, bucket_id, since)
        log.info("[%s] %s → %d events", source, bucket_id, len(events))

        for ev in events:
            app, title = extract_app_title(ev, bucket_id)
            duration_seconds = int(ev.get("duration", 0))
            rows.append({
                "source": source,
                "bucket_id": bucket_id,
                "event_id": ev["id"],
                "timestamp": ev["timestamp"],
                "duration_seconds": duration_seconds,
                "app": app,
                "title": title,
                "raw_data": ev,
            })

    return rows

# ── Push to Vercel ─────────────────────────────────────────────────────────────

def push(events: list[dict]) -> int:
    if not events:
        log.info("Nothing to push.")
        return 0

    headers = {"Content-Type": "application/json"}
    if SYNC_SECRET:
        headers["x-sync-secret"] = SYNC_SECRET

    url = f"{VERCEL_URL.rstrip('/')}/api/activity/sync"
    r = requests.post(url, json=events, headers=headers, timeout=30)
    r.raise_for_status()
    result = r.json()
    inserted = result.get("inserted", len(events))
    log.info("Pushed %d events → API returned inserted=%s", len(events), inserted)
    return inserted

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    since = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
    log.info("Syncing events since %s (last %dh)", since.isoformat(), LOOKBACK_HOURS)

    all_events: list[dict] = []

    # PC
    all_events += collect("pc", PC_AW_HOST, PC_BUCKET_PATTERNS, since)

    # Android (only if configured)
    if ANDROID_AW_HOST:
        all_events += collect("android", ANDROID_AW_HOST, ANDROID_BUCKET_PATTERNS, since)
    else:
        log.info("ANDROID_AW_HOST not set — skipping Android sync")

    log.info("Total events collected: %d", len(all_events))
    push(all_events)


if __name__ == "__main__":
    main()
