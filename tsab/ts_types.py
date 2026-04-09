from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class TSRootDefinition:
    ts_root_id: str
    ts_scope: str
    ts_path: Path
    ts_allow_delete: bool
    ts_enabled: bool = True
    ts_label: str = ""


@dataclass(slots=True)
class TSAssetStat:
    ts_path: Path
    ts_root: TSRootDefinition
    ts_relative_path: str
    ts_folder_path: str
    ts_filename: str
    ts_extension: str
    ts_size_bytes: int
    ts_mtime_ns: int
    ts_ctime_ns: int


@dataclass(slots=True)
class TSAssetPayload:
    ts_path: str
    ts_type: str
    ts_preview_path: str = ""
    ts_metadata: str = "{}"
    ts_technical_json: str = "{}"
    ts_mtime_ns: int = 0
    ts_hash: str = ""
    ts_folder_path: str = ""
    ts_duration: float | None = None
    ts_width: int | None = None
    ts_height: int | None = None
    ts_fps: float | None = None
    ts_size_bytes: int = 0
    ts_filename: str = ""
    ts_extension: str = ""
    ts_scope: str = "output"
    ts_root_id: str = "output"
    ts_prompt_text: str = ""
    ts_workflow_text: str = ""
    ts_created_at: int = 0
    ts_is_indexed: bool = False
    ts_has_preview: bool = False
    ts_has_metadata: bool = False
    ts_tags: str = ""
    ts_rating: int = 0


@dataclass(slots=True)
class TSHealthIssue:
    ts_name: str
    ts_available: bool
    ts_path: str | None
    ts_message: str

    def TSAsDict(self) -> dict[str, Any]:
        return {
            "ts_name": self.ts_name,
            "ts_available": self.ts_available,
            "ts_path": self.ts_path,
            "ts_message": self.ts_message,
        }


@dataclass(slots=True)
class TSScanStatus:
    ts_running: bool
    ts_phase: str
    ts_scanned: int
    ts_changed: int
    ts_total_candidates: int
    ts_processed_candidates: int
    ts_total_files: int
    ts_deleted: int
    ts_progress_percent: float
    ts_progress_message: str
    ts_started_at: float | None
    ts_completed_at: float | None
    ts_error: str | None

    def TSAsDict(self) -> dict[str, Any]:
        return {
            "running": self.ts_running,
            "phase": self.ts_phase,
            "scanned": self.ts_scanned,
            "changed": self.ts_changed,
            "total_candidates": self.ts_total_candidates,
            "processed_candidates": self.ts_processed_candidates,
            "total_files": self.ts_total_files,
            "deleted": self.ts_deleted,
            "progress_percent": self.ts_progress_percent,
            "progress_message": self.ts_progress_message,
            "started_at": self.ts_started_at,
            "completed_at": self.ts_completed_at,
            "error": self.ts_error,
        }
