"""Sends the desk's snapshot to the live page every minute.

The ARGO DESK Live page on claude.ai reads it from Supabase, so the desk can be followed
from any device. Data only goes out: nothing that comes back can change the desk. It is
optional: without DESK_LIVE_URL, DESK_LIVE_KEY and DESK_LIVE_TOKEN nothing is sent.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

from desk import snapshot
from desk.config import Settings

FUNCTION = "pcdesk_publish"  # checks the token, then stores the four documents


class Publisher:
    def __init__(self, cfg: Settings, db_path: Path, timeout: float = 10.0):
        self.cfg = cfg
        self.db_path = db_path
        self.timeout = timeout
        self.endpoint = f"{cfg.live_url.rstrip('/')}/rest/v1/rpc/{FUNCTION}"
        self.failing = ""  # the last error, so the journal hears of trouble once, not every minute

    @staticmethod
    def configured(cfg: Settings) -> bool:
        return bool(cfg.live_url and cfg.live_key and cfg.live_token)

    def publish(self, now: float) -> str:
        """Send one snapshot. Returns "" when it arrived, otherwise what went wrong."""
        docs = snapshot.build(self.db_path, self.cfg, now)
        body = json.dumps(
            {"token": self.cfg.live_token, "docs": docs}, ensure_ascii=False, allow_nan=False
        ).encode()
        request = urllib.request.Request(
            self.endpoint,
            data=body,
            method="POST",
            headers={
                "apikey": self.cfg.live_key,
                "Authorization": f"Bearer {self.cfg.live_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                response.read()
        except urllib.error.HTTPError as e:
            detail = e.read()[:200].decode("utf-8", errors="replace")
            return f"risposta {e.code} dal database: {detail}"
        except (urllib.error.URLError, OSError) as e:
            return f"database non raggiungibile ({getattr(e, 'reason', e)})"
        return ""
