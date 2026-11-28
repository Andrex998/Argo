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
from urllib.parse import urlparse

from desk import snapshot
from desk.config import Settings

FUNCTION = "pcdesk_publish"  # checks the token, then stores the four documents
RETRY_AFTER = 180.0  # after a failed upload, wait this long before the next try


class Publisher:
    def __init__(self, cfg: Settings, db_path: Path, timeout: float = 10.0):
        url = urlparse(cfg.live_url)
        loopback = url.scheme == "http" and url.hostname in ("127.0.0.1", "localhost", "::1")
        if url.scheme != "https" and not loopback:
            raise ValueError(
                "DESK_LIVE_URL deve iniziare con https://, o il token viaggerebbe in chiaro"
            )
        self.cfg = cfg
        self.db_path = db_path
        self.timeout = timeout
        self.endpoint = f"{cfg.live_url.rstrip('/')}/rest/v1/rpc/{FUNCTION}"
        self.failing = ""  # the last error, so the journal hears of trouble once, not every minute
        self.next_try = (
            0.0  # while the database is unreachable, the desk does not wait on it each minute
        )

    @staticmethod
    def configured(cfg: Settings) -> bool:
        return bool(cfg.live_url and cfg.live_key and cfg.live_token)

    def publish(self, now: float) -> str:
        """Send one snapshot. Returns "" when it arrived, otherwise what went wrong."""
        if now < self.next_try:
            return self.failing  # still in the pause after a failure
        error = self._send(now)
        self.next_try = now + RETRY_AFTER if error else 0.0
        return error

    def _send(self, now: float) -> str:
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
