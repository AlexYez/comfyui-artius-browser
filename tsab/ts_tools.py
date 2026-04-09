from __future__ import annotations

import json
import shutil
import subprocess
import threading
from pathlib import Path

import folder_paths

from .ts_logging import TSLogVerbose
from .ts_settings import TS_DEFAULT_FFMPEG_WORKERS, TS_DEFAULT_FFPROBE_WORKERS
from .ts_types import TSHealthIssue


class TSToolLocator:
    def __init__(self, ts_config_store) -> None:
        self.ts_config_store = ts_config_store
        self.ts_cached_paths: dict[str, str | None] = {}
        ts_config = self.ts_config_store.TSLoadConfig()
        ts_tools_config = ts_config.get("tools", {}) if isinstance(ts_config, dict) else {}
        self.ts_ffprobe_semaphore = threading.BoundedSemaphore(
            max(1, int(ts_tools_config.get("ffprobe_workers", TS_DEFAULT_FFPROBE_WORKERS)))
        )
        self.ts_ffmpeg_semaphore = threading.BoundedSemaphore(
            max(1, int(ts_tools_config.get("ffmpeg_workers", TS_DEFAULT_FFMPEG_WORKERS)))
        )
        ts_base_candidate = Path(getattr(folder_paths, "base_path", Path(folder_paths.get_output_directory()).parent))
        self.ts_base_directory = ts_base_candidate.resolve() if ts_base_candidate.is_absolute() else (Path.cwd() / ts_base_candidate).resolve()
        self.ts_portable_roots = [self.ts_base_directory]
        if self.ts_base_directory.parent != self.ts_base_directory:
            self.ts_portable_roots.append(self.ts_base_directory.parent)

    def _TSPortableCandidates(self, ts_tool_name: str) -> list[Path]:
        ts_relative_map = {
            "ffmpeg": [
                Path("ffmpeg/ffmpeg.exe"),
                Path("ffmpeg/bin/ffmpeg.exe"),
                Path("ffmpeg/ffmpeg"),
                Path("ffmpeg/bin/ffmpeg"),
            ],
            "ffprobe": [
                Path("ffmpeg/ffprobe.exe"),
                Path("ffmpeg/bin/ffprobe.exe"),
                Path("ffmpeg/ffprobe"),
                Path("ffmpeg/bin/ffprobe"),
            ],
        }
        ts_candidates: list[Path] = []
        for ts_root in self.ts_portable_roots:
            for ts_relative_path in ts_relative_map.get(ts_tool_name, []):
                ts_candidates.append((ts_root / ts_relative_path).resolve())
        return ts_candidates

    def TSResolveTool(self, ts_tool_name: str) -> str | None:
        if ts_tool_name in self.ts_cached_paths:
            return self.ts_cached_paths[ts_tool_name]
        ts_config = self.ts_config_store.TSLoadConfig()
        ts_configured = str(ts_config.get("tools", {}).get(ts_tool_name, "")).strip()
        ts_tool_path = None
        ts_resolution_source = "missing"
        if ts_configured:
            ts_candidate = Path(ts_configured).expanduser()
            if ts_candidate.exists():
                ts_tool_path = str(ts_candidate.resolve())
                ts_resolution_source = "config"
        if ts_tool_path is None:
            ts_tool_path = shutil.which(ts_tool_name)
            if ts_tool_path is not None:
                ts_resolution_source = "path"
        if ts_tool_path is None:
            for ts_candidate in self._TSPortableCandidates(ts_tool_name):
                if ts_candidate.exists():
                    ts_tool_path = str(ts_candidate)
                    ts_resolution_source = "portable_fallback"
                    break
        self.ts_cached_paths[ts_tool_name] = ts_tool_path
        TSLogVerbose(
            "tools.resolve",
            tool=ts_tool_name,
            configured_path=ts_configured or None,
            resolved_path=ts_tool_path,
            source=ts_resolution_source,
        )
        return ts_tool_path

    def TSRunCommand(self, ts_arguments: list[str], ts_timeout: int = 120) -> subprocess.CompletedProcess[str] | None:
        if not ts_arguments or not ts_arguments[0]:
            return None
        try:
            return subprocess.run(
                ts_arguments,
                capture_output=True,
                text=True,
                timeout=ts_timeout,
                check=False,
                encoding="utf-8",
                errors="replace",
            )
        except (subprocess.SubprocessError, OSError) as ts_error:
            TSLogVerbose("tools.run.failed", arguments=ts_arguments, error=str(ts_error))
            return None

    def _TSRunBoundedCommand(
        self,
        ts_semaphore: threading.BoundedSemaphore,
        ts_arguments: list[str],
        ts_timeout: int,
    ) -> subprocess.CompletedProcess[str] | None:
        with ts_semaphore:
            return self.TSRunCommand(ts_arguments, ts_timeout=ts_timeout)

    def TSRunFFProbe(self, ts_path: Path) -> dict[str, Any]:
        ts_executable = self.TSResolveTool("ffprobe")
        if not ts_executable:
            return {}
        ts_result = self._TSRunBoundedCommand(
            self.ts_ffprobe_semaphore,
            [
                ts_executable,
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_streams",
                "-show_format",
                str(ts_path),
            ],
            ts_timeout=120,
        )
        if not ts_result or ts_result.returncode != 0 or not ts_result.stdout.strip():
            return {}
        try:
            ts_payload = json.loads(ts_result.stdout)
        except json.JSONDecodeError:
            TSLogVerbose("tools.ffprobe.invalid_json", path=str(ts_path))
            return {}
        return ts_payload if isinstance(ts_payload, dict) else {}

    def TSExtractVideoFrame(self, ts_source_path: Path, ts_output_path: Path, ts_seconds: float) -> bool:
        ts_executable = self.TSResolveTool("ffmpeg")
        if not ts_executable:
            return False
        ts_output_path.parent.mkdir(parents=True, exist_ok=True)
        ts_result = self._TSRunBoundedCommand(
            self.ts_ffmpeg_semaphore,
            [
                ts_executable,
                "-y",
                "-ss",
                str(ts_seconds),
                "-i",
                str(ts_source_path),
                "-frames:v",
                "1",
                str(ts_output_path),
            ],
            ts_timeout=180,
        )
        ts_success = bool(ts_result and ts_result.returncode == 0 and ts_output_path.exists())
        TSLogVerbose(
            "tools.ffmpeg.video_frame",
            source_path=str(ts_source_path),
            output_path=str(ts_output_path),
            seconds=ts_seconds,
            success=ts_success,
        )
        return ts_success

    def TSExtractWaveform(
        self,
        ts_source_path: Path,
        ts_output_path: Path,
        ts_width: int,
        ts_height: int,
    ) -> bool:
        ts_executable = self.TSResolveTool("ffmpeg")
        if not ts_executable:
            return False
        ts_output_path.parent.mkdir(parents=True, exist_ok=True)
        ts_filter = f"aformat=channel_layouts=mono,showwavespic=s={ts_width}x{ts_height}:colors=F4A261"
        ts_result = self._TSRunBoundedCommand(
            self.ts_ffmpeg_semaphore,
            [
                ts_executable,
                "-y",
                "-i",
                str(ts_source_path),
                "-filter_complex",
                ts_filter,
                "-frames:v",
                "1",
                str(ts_output_path),
            ],
            ts_timeout=180,
        )
        ts_success = bool(ts_result and ts_result.returncode == 0 and ts_output_path.exists())
        TSLogVerbose(
            "tools.ffmpeg.waveform",
            source_path=str(ts_source_path),
            output_path=str(ts_output_path),
            width=ts_width,
            height=ts_height,
            success=ts_success,
        )
        return ts_success

    def TSGetHealth(self) -> list[TSHealthIssue]:
        ts_issues: list[TSHealthIssue] = []
        for ts_tool_name in ("ffmpeg", "ffprobe"):
            ts_tool_path = self.TSResolveTool(ts_tool_name)
            ts_issues.append(
                TSHealthIssue(
                    ts_name=ts_tool_name,
                    ts_available=ts_tool_path is not None,
                    ts_path=ts_tool_path,
                    ts_message=(
                        f"{ts_tool_name} available"
                        if ts_tool_path is not None
                        else f"{ts_tool_name} not found in config, PATH or portable fallback"
                    ),
                )
            )
        TSLogVerbose("tools.health", issues=[ts_issue.TSAsDict() for ts_issue in ts_issues])
        return ts_issues
