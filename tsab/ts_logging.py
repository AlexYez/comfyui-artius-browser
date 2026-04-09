from __future__ import annotations

import logging
from typing import Any

from .ts_settings import TS_ENABLE_PROGRESS_CONSOLE, TS_ENABLE_VERBOSE_LOGGING
from .ts_utils import TSJsonDumps

TSLogger = logging.getLogger("TSArtiusBrowser")

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
    if not TS_ENABLE_VERBOSE_LOGGING:
        return
    if any(ts_action.startswith(ts_prefix) for ts_prefix in TS_SUPPRESSED_VERBOSE_PREFIXES):
        return
    if ts_fields:
        TSLogger.info("[TSAB] %s | %s", ts_action, TSJsonDumps(ts_fields))
    else:
        TSLogger.info("[TSAB] %s", ts_action)



def TSLogInfoIfVerbose(ts_message: str, *ts_args: Any) -> None:
    if not TS_ENABLE_VERBOSE_LOGGING:
        return
    TSLogger.info(ts_message, *ts_args)



def TSLogProgress(ts_message: str, *ts_args: Any) -> None:
    if not TS_ENABLE_PROGRESS_CONSOLE:
        return
    TSLogger.info(ts_message, *ts_args)
