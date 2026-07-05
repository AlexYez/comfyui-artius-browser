from __future__ import annotations

from .ts_types import TSScanStatus


def TSComputeProgressPercent(ts_status: TSScanStatus) -> float:
    if ts_status.ts_phase == "walk":
        if ts_status.ts_total_files <= 0:
            return 0.0
        return min(55.0, 55.0 * (ts_status.ts_scanned / max(1, ts_status.ts_total_files)))
    if ts_status.ts_phase == "hash":
        if ts_status.ts_total_candidates <= 0:
            return 100.0
        return min(100.0, 55.0 + (45.0 * (ts_status.ts_processed_candidates / max(1, ts_status.ts_total_candidates))))
    if ts_status.ts_phase == "idle" and ts_status.ts_completed_at is not None and not ts_status.ts_error:
        return 100.0
    return max(0.0, min(100.0, ts_status.ts_progress_percent))


def TSBuildProgressMessage(ts_status: TSScanStatus) -> str:
    if ts_status.ts_phase == "walk":
        if ts_status.ts_total_files > 0:
            return f"Scanning files {ts_status.ts_scanned}/{ts_status.ts_total_files}"
        return f"Scanning files {ts_status.ts_scanned}"
    if ts_status.ts_phase == "hash":
        if ts_status.ts_total_candidates > 0:
            return f"Indexing changed assets {ts_status.ts_processed_candidates}/{ts_status.ts_total_candidates}"
        return "Finalizing index"
    if ts_status.ts_phase == "error":
        return ts_status.ts_error or "Scan failed"
    if ts_status.ts_phase == "idle" and ts_status.ts_completed_at is not None:
        return "Scan complete"
    return "Idle"


def TSBuildConsoleProgressBar(ts_percent: float, ts_width: int = 24) -> str:
    ts_clamped = max(0.0, min(100.0, ts_percent))
    ts_filled = int(round((ts_clamped / 100.0) * ts_width))
    return f"{'#' * ts_filled}{'-' * max(0, ts_width - ts_filled)}"
