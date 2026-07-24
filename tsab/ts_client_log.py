from __future__ import annotations

import threading
from collections import deque
from typing import Any

# Bounded, in-memory ring of the most recent FRONTEND warnings, mirrored to the
# backend so a bug report captured through `GET /asset_browser/version` is
# self-contained (backend environment + recent client errors) without asking
# the user to open the browser console. Nothing here is persisted to disk.

TS_MAX_CLIENT_ERRORS = 50
TS_MAX_CLIENT_MESSAGE_LENGTH = 2000
TS_MAX_CLIENT_TIMESTAMP_LENGTH = 64


class TSClientErrorLog:
    def __init__(self, ts_capacity: int = TS_MAX_CLIENT_ERRORS) -> None:
        self._ts_lock = threading.Lock()
        self._ts_entries: deque[dict[str, str]] = deque(maxlen=max(1, int(ts_capacity)))

    def TSRecord(self, ts_errors: Any) -> int:
        # Accepts the frontend ring payload (a list of {at, message}). Anything
        # malformed is skipped, never raised — this feeds a diagnostics surface,
        # not application logic. Returns how many entries were accepted.
        if not isinstance(ts_errors, list):
            return 0
        ts_added = 0
        with self._ts_lock:
            for ts_error in ts_errors:
                if ts_added >= TS_MAX_CLIENT_ERRORS:
                    break
                if not isinstance(ts_error, dict):
                    continue
                ts_message = str(ts_error.get("message") or "").strip()
                if not ts_message:
                    continue
                self._ts_entries.append(
                    {
                        "at": str(ts_error.get("at") or "")[:TS_MAX_CLIENT_TIMESTAMP_LENGTH],
                        "message": ts_message[:TS_MAX_CLIENT_MESSAGE_LENGTH],
                    }
                )
                ts_added += 1
        return ts_added

    def TSSnapshot(self) -> list[dict[str, str]]:
        with self._ts_lock:
            return list(self._ts_entries)

    def TSCount(self) -> int:
        with self._ts_lock:
            return len(self._ts_entries)
