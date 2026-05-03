from __future__ import annotations

import json
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any

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

    def TSRunCommandsParallel(
        self,
        ts_specs: list[tuple[threading.BoundedSemaphore | None, list[str], int]],
    ) -> list[subprocess.CompletedProcess[str] | None]:
        if not ts_specs:
            return []
        ts_acquired_semaphores: list[threading.BoundedSemaphore] = []
        for ts_semaphore, _, _ in ts_specs:
            if ts_semaphore is not None:
                ts_semaphore.acquire()
                ts_acquired_semaphores.append(ts_semaphore)
        try:
            ts_processes: list[tuple[subprocess.Popen[str] | None, list[str], int]] = []
            for _, ts_arguments, ts_timeout in ts_specs:
                if not ts_arguments or not ts_arguments[0]:
                    ts_processes.append((None, ts_arguments, ts_timeout))
                    continue
                try:
                    ts_process = subprocess.Popen(
                        ts_arguments,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        encoding="utf-8",
                        errors="replace",
                    )
                    ts_processes.append((ts_process, ts_arguments, ts_timeout))
                except OSError as ts_error:
                    TSLogVerbose("tools.popen.spawn.failed", arguments=ts_arguments, error=str(ts_error))
                    ts_processes.append((None, ts_arguments, ts_timeout))
            ts_results: list[subprocess.CompletedProcess[str] | None] = []
            for ts_process, ts_arguments, ts_timeout in ts_processes:
                if ts_process is None:
                    ts_results.append(None)
                    continue
                try:
                    ts_stdout, ts_stderr = ts_process.communicate(timeout=ts_timeout)
                    ts_results.append(
                        subprocess.CompletedProcess(
                            args=ts_arguments,
                            returncode=ts_process.returncode,
                            stdout=ts_stdout,
                            stderr=ts_stderr,
                        )
                    )
                except subprocess.TimeoutExpired:
                    ts_process.kill()
                    try:
                        ts_process.communicate(timeout=5)
                    except (subprocess.SubprocessError, OSError):
                        pass
                    TSLogVerbose("tools.popen.timeout", arguments=ts_arguments, timeout=ts_timeout)
                    ts_results.append(None)
                except (subprocess.SubprocessError, OSError) as ts_error:
                    TSLogVerbose("tools.popen.wait.failed", arguments=ts_arguments, error=str(ts_error))
                    ts_results.append(None)
            return ts_results
        finally:
            for ts_semaphore in reversed(ts_acquired_semaphores):
                ts_semaphore.release()

    def _TSParseProbeJson(self, ts_completed: subprocess.CompletedProcess[str] | None, ts_source_path: Path) -> dict[str, Any]:
        if not ts_completed or ts_completed.returncode != 0 or not ts_completed.stdout.strip():
            return {}
        try:
            ts_payload = json.loads(ts_completed.stdout)
        except json.JSONDecodeError:
            TSLogVerbose("tools.ffprobe.invalid_json", path=str(ts_source_path))
            return {}
        return ts_payload if isinstance(ts_payload, dict) else {}

    def TSRunFFProbeAndExtractFrameParallel(
        self,
        ts_source_path: Path,
        ts_frame_output_path: Path,
        ts_seconds: float,
        ts_max_output_dim: int | None = None,
    ) -> tuple[dict[str, Any], bool]:
        ts_ffprobe_path = self.TSResolveTool("ffprobe")
        ts_ffmpeg_path = self.TSResolveTool("ffmpeg")
        if not ts_ffprobe_path and not ts_ffmpeg_path:
            return {}, False
        ts_specs: list[tuple[threading.BoundedSemaphore | None, list[str], int]] = []
        if ts_ffprobe_path:
            ts_specs.append((
                self.ts_ffprobe_semaphore,
                [
                    ts_ffprobe_path,
                    "-v", "error",
                    "-print_format", "json",
                    "-show_streams", "-show_format",
                    str(ts_source_path),
                ],
                120,
            ))
        if ts_ffmpeg_path:
            ts_frame_output_path.parent.mkdir(parents=True, exist_ok=True)
            ts_ffmpeg_arguments = [
                ts_ffmpeg_path,
                "-y",
                "-ss", str(ts_seconds),
                "-i", str(ts_source_path),
                "-frames:v", "1",
            ]
            if ts_max_output_dim and ts_max_output_dim > 0:
                ts_ffmpeg_arguments.extend([
                    "-vf",
                    f"scale='min({ts_max_output_dim},iw)':'min({ts_max_output_dim},ih)':force_original_aspect_ratio=decrease",
                ])
            ts_ffmpeg_arguments.append(str(ts_frame_output_path))
            ts_specs.append((self.ts_ffmpeg_semaphore, ts_ffmpeg_arguments, 180))
        ts_results = self.TSRunCommandsParallel(ts_specs)
        ts_index = 0
        ts_probe_dict: dict[str, Any] = {}
        if ts_ffprobe_path:
            ts_probe_dict = self._TSParseProbeJson(ts_results[ts_index], ts_source_path)
            ts_index += 1
        ts_frame_success = False
        if ts_ffmpeg_path:
            ts_frame_result = ts_results[ts_index]
            ts_frame_success = bool(
                ts_frame_result
                and ts_frame_result.returncode == 0
                and ts_frame_output_path.exists()
            )
            TSLogVerbose(
                "tools.ffmpeg.video_frame",
                source_path=str(ts_source_path),
                output_path=str(ts_frame_output_path),
                seconds=ts_seconds,
                success=ts_frame_success,
            )
        return ts_probe_dict, ts_frame_success

    def TSRunFFProbeAndExtractWaveformParallel(
        self,
        ts_source_path: Path,
        ts_waveform_output_path: Path,
        ts_width: int,
        ts_height: int,
    ) -> tuple[dict[str, Any], bool]:
        ts_ffprobe_path = self.TSResolveTool("ffprobe")
        ts_ffmpeg_path = self.TSResolveTool("ffmpeg")
        if not ts_ffprobe_path and not ts_ffmpeg_path:
            return {}, False
        ts_specs: list[tuple[threading.BoundedSemaphore | None, list[str], int]] = []
        if ts_ffprobe_path:
            ts_specs.append((
                self.ts_ffprobe_semaphore,
                [
                    ts_ffprobe_path,
                    "-v", "error",
                    "-print_format", "json",
                    "-show_streams", "-show_format",
                    str(ts_source_path),
                ],
                120,
            ))
        if ts_ffmpeg_path:
            ts_waveform_output_path.parent.mkdir(parents=True, exist_ok=True)
            ts_filter = f"aformat=channel_layouts=mono,showwavespic=s={ts_width}x{ts_height}:colors=8B7FC4"
            ts_specs.append((
                self.ts_ffmpeg_semaphore,
                [
                    ts_ffmpeg_path,
                    "-y",
                    "-i", str(ts_source_path),
                    "-filter_complex", ts_filter,
                    "-frames:v", "1",
                    str(ts_waveform_output_path),
                ],
                180,
            ))
        ts_results = self.TSRunCommandsParallel(ts_specs)
        ts_index = 0
        ts_probe_dict: dict[str, Any] = {}
        if ts_ffprobe_path:
            ts_probe_dict = self._TSParseProbeJson(ts_results[ts_index], ts_source_path)
            ts_index += 1
        ts_waveform_success = False
        if ts_ffmpeg_path:
            ts_waveform_result = ts_results[ts_index]
            ts_waveform_success = bool(
                ts_waveform_result
                and ts_waveform_result.returncode == 0
                and ts_waveform_output_path.exists()
            )
            TSLogVerbose(
                "tools.ffmpeg.waveform",
                source_path=str(ts_source_path),
                output_path=str(ts_waveform_output_path),
                width=ts_width,
                height=ts_height,
                success=ts_waveform_success,
            )
        return ts_probe_dict, ts_waveform_success

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
        ts_filter = f"aformat=channel_layouts=mono,showwavespic=s={ts_width}x{ts_height}:colors=8B7FC4"
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
