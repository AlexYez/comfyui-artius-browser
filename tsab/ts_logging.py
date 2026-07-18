from __future__ import annotations

import logging
import os
from typing import Any

from .ts_settings import TS_ENABLE_PROGRESS_CONSOLE, TS_ENABLE_VERBOSE_LOGGING
from .ts_utils import TSJsonDumps

TSLogger = logging.getLogger("TSArtiusBrowser")

# Verbose logging is runtime-toggleable so support can enable diagnostics
# without editing source. Resolution order: the TS_ARTIUS_VERBOSE environment
# variable wins (an explicit "set this and restart" for bug reports); otherwise
# the value comes from config.json (logging.enable_verbose), applied once at
# bootstrap via TSSetVerboseLogging; the compile-time default is the fallback.
_TS_VERBOSE_ENV_RAW = os.environ.get("TS_ARTIUS_VERBOSE")
_TS_VERBOSE_ENV_SET = _TS_VERBOSE_ENV_RAW is not None
_TS_VERBOSE_ENABLED = (
    _TS_VERBOSE_ENV_RAW.strip().lower() in {"1", "true", "yes", "on"}
    if _TS_VERBOSE_ENV_SET
    else TS_ENABLE_VERBOSE_LOGGING
)


def TSSetVerboseLogging(ts_enabled: bool) -> None:
    # The environment variable is an intentional hard override: config must not
    # silently turn diagnostics back off (or on) once an operator set the var.
    global _TS_VERBOSE_ENABLED
    if _TS_VERBOSE_ENV_SET:
        return
    _TS_VERBOSE_ENABLED = bool(ts_enabled)


def TSIsVerboseLogging() -> bool:
    return _TS_VERBOSE_ENABLED


# The scan progress bar is on by default. It is runtime-toggleable through the
# same mechanism as verbose logging (config.json logging.enable_progress_console,
# or the TS_ARTIUS_PROGRESS_CONSOLE env var override) so an operator can silence
# it without editing source.
_TS_PROGRESS_ENV_RAW = os.environ.get("TS_ARTIUS_PROGRESS_CONSOLE")
_TS_PROGRESS_ENV_SET = _TS_PROGRESS_ENV_RAW is not None
_TS_PROGRESS_ENABLED = (
    _TS_PROGRESS_ENV_RAW.strip().lower() in {"1", "true", "yes", "on"}
    if _TS_PROGRESS_ENV_SET
    else TS_ENABLE_PROGRESS_CONSOLE
)


def TSSetProgressConsole(ts_enabled: bool) -> None:
    global _TS_PROGRESS_ENABLED
    if _TS_PROGRESS_ENV_SET:
        return
    _TS_PROGRESS_ENABLED = bool(ts_enabled)


def TSIsProgressConsole() -> bool:
    return _TS_PROGRESS_ENABLED

# Verbose actions whose prefix matches any entry here are dropped even when
# verbose logging is ON — they are high-frequency, low-signal events (per-asset
# upserts, per-request route hits, scan bookkeeping) that would drown out the
# rare events worth reading. This is an UNCONDITIONAL filter: enabling verbose
# will not surface these. To debug one of them, temporarily remove its prefix
# from this tuple.
TS_SUPPRESSED_VERBOSE_PREFIXES = (
    "storage.",
    "db.connection.",
    "db.migrated",
    "db.snapshot",
    "db.asset.upserted",
    "db.assets.",
    "db.folders.",
    "routes.",
    "route.assets.",
    "route.asset.",
    "route.rescan.",
    "route.delete.",
    "route.preview.request",
    "route.file.request",
    "tools.resolve",
    "tools.health",
    "tools.run.",
    "tools.ffmpeg.",
    "tools.ffprobe.complete",
    "preview.thumbnail.",
    "preview.video.",
    "preview.waveform.",
    "preview.placeholder.",
    "runtime.initialized",
    "runtime.bootstrap.",
    "runtime.start.",
    "runtime.scan.",
    "runtime.assets.",
    "runtime.event.emit",
    "runtime.roots",
    "runtime.asset.detail",
    "runtime.assets.delete.request",
    "runtime.asset.delete.",
    "indexer.scan.started_async",
    "indexer.scan.queued",
    "indexer.scan.dequeued",
    "indexer.scan.start",
    "indexer.scan.no_roots",
    "indexer.root.walk.",
    "indexer.hash.phase",
    "indexer.batch.",
    "indexer.path.ignored",
    "indexer.asset.upserted",
    "indexer.candidate.",
)


def TSLogVerbose(ts_action: str, **ts_fields: Any) -> None:
    if not _TS_VERBOSE_ENABLED:
        return
    if any(ts_action.startswith(ts_prefix) for ts_prefix in TS_SUPPRESSED_VERBOSE_PREFIXES):
        return
    if ts_fields:
        TSLogger.info("[TSAB] %s | %s", ts_action, TSJsonDumps(ts_fields))
    else:
        TSLogger.info("[TSAB] %s", ts_action)



def TSLogInfoIfVerbose(ts_message: str, *ts_args: Any) -> None:
    if not _TS_VERBOSE_ENABLED:
        return
    TSLogger.info(ts_message, *ts_args)



def TSLogProgress(ts_message: str, *ts_args: Any) -> None:
    if not _TS_PROGRESS_ENABLED:
        return
    TSLogger.info(ts_message, *ts_args)
