from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any

from .ts_logging import TSLogVerbose
from .ts_settings import (
    TS_BROWSER_AUDIO_CODECS,
    TS_BROWSER_IMAGE_EXTENSIONS,
    TS_BROWSER_VIDEO_CODECS,
    TS_BROWSER_VIDEO_CONTAINERS,
    TS_DISPLAY_PROXY_CACHE_MAX_BYTES,
    TS_DISPLAY_PROXY_IMAGE_MAX_EDGE,
    TS_DISPLAY_PROXY_IMAGE_TIMEOUT_SECONDS,
    TS_DISPLAY_PROXY_VIDEO_MAX_EDGE,
    TS_DISPLAY_PROXY_VIDEO_TIMEOUT_SECONDS,
)
from .ts_utils import TSJsonLoads, TSKeyedLockRegistry, TSRowValue

# Bumped when the conversion itself changes, so old copies are not served.
TS_DISPLAY_PROXY_VERSION = "1"
TS_DISPLAY_MODE_NATIVE = "native"
TS_DISPLAY_MODE_PROXY = "proxy"
TS_DISPLAY_PROXY_CONTENT_TYPES = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".webp": "image/webp",
    ".png": "image/png",
}


def TSResolveDisplayMode(ts_type: str, ts_extension: str, ts_technical: dict[str, Any] | None) -> str:
    """Whether the browser can show the file itself or needs a converted copy.

    ProRes, DNxHD, HEVC, MPEG-4 in AVI, a Matroska container, EXR, TIFF: none
    of them play or display in Chrome, and before this the lightbox simply
    showed an empty player or a broken image for them.
    """
    ts_extension = str(ts_extension or "").lower()
    if ts_type == "image":
        return TS_DISPLAY_MODE_NATIVE if ts_extension in TS_BROWSER_IMAGE_EXTENSIONS else TS_DISPLAY_MODE_PROXY
    if ts_type != "video":
        return TS_DISPLAY_MODE_NATIVE
    if ts_extension not in TS_BROWSER_VIDEO_CONTAINERS:
        return TS_DISPLAY_MODE_PROXY
    ts_technical = ts_technical if isinstance(ts_technical, dict) else {}
    ts_video_codec = str(ts_technical.get("codec_name") or "").strip().lower()
    if not ts_video_codec:
        # Not probed (no ffprobe): let the browser try. The lightbox asks for
        # the converted copy itself if the file then fails to play.
        return TS_DISPLAY_MODE_NATIVE
    if ts_video_codec not in TS_BROWSER_VIDEO_CODECS:
        return TS_DISPLAY_MODE_PROXY
    ts_audio_codec = str(ts_technical.get("audio_codec_name") or "").strip().lower()
    if ts_audio_codec not in TS_BROWSER_AUDIO_CODECS:
        # PCM or ALAC sound in an otherwise playable MOV: Chrome refuses the
        # whole file, not just the sound.
        return TS_DISPLAY_MODE_PROXY
    return TS_DISPLAY_MODE_NATIVE


def TSResolveRowDisplayMode(ts_row: Any) -> str:
    """TSResolveDisplayMode for a database row (codecs from technical_json)."""
    ts_technical = TSJsonLoads(TSRowValue(ts_row, "technical_json", "{}") or "{}", {})
    return TSResolveDisplayMode(
        str(ts_row["type"] or ""),
        str(ts_row["extension"] or ""),
        ts_technical if isinstance(ts_technical, dict) else {},
    )


def TSBuildDisplayProxyKey(ts_row: Any) -> str:
    # The asset hash already changes with the content; mtime and size catch a
    # row whose hash is not computed yet.
    ts_identity = "|".join(
        str(ts_part)
        for ts_part in (
            ts_row["hash"] or ts_row["path"],
            ts_row["mtime_ns"],
            ts_row["size_bytes"],
            TS_DISPLAY_PROXY_VERSION,
        )
    )
    return hashlib.blake2b(ts_identity.encode("utf-8"), digest_size=16).hexdigest()


class TSDisplayProxyService:
    """Converted copies of files the browser cannot show, made on demand.

    Generated when the lightbox first asks for one - never during a scan, where
    a folder of ProRes would turn indexing into hours of transcoding - and kept
    in ``cache/display``, trimmed oldest-first to a size cap.
    """

    def __init__(self, ts_cache_directory: Path, ts_tools) -> None:
        self.ts_directory = Path(ts_cache_directory) / "display"
        self.ts_tools = ts_tools
        self.ts_locks = TSKeyedLockRegistry()
        self.ts_encoders: set[str] | None = None

    def _TSAvailableEncoders(self) -> set[str]:
        if self.ts_encoders is None:
            self.ts_encoders = self.ts_tools.TSListFFmpegEncoders()
        return self.ts_encoders

    def _TSVideoEncoderPlan(self) -> tuple[str, list[str], list[str]] | None:
        # H.264 in MP4 plays everywhere. An LGPL ffmpeg build ships without
        # libx264, so OpenH264 and then VP9/VP8 in WebM are the fallbacks.
        ts_encoders = self._TSAvailableEncoders()
        ts_mp4_audio = ["-c:a", "aac", "-b:a", "192k", "-ac", "2"]
        ts_webm_audio = ["-c:a", "libopus", "-b:a", "160k", "-ac", "2"] if "libopus" in ts_encoders else ["-an"]
        if "libx264" in ts_encoders:
            return ".mp4", ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-g", "12"], ts_mp4_audio + ["-movflags", "+faststart"]
        if "libopenh264" in ts_encoders:
            return ".mp4", ["-c:v", "libopenh264", "-b:v", "12M", "-g", "12"], ts_mp4_audio + ["-movflags", "+faststart"]
        if "libvpx-vp9" in ts_encoders:
            return ".webm", ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "32", "-deadline", "realtime", "-cpu-used", "8", "-g", "12"], ts_webm_audio
        if "libvpx" in ts_encoders:
            return ".webm", ["-c:v", "libvpx", "-b:v", "12M", "-deadline", "realtime", "-cpu-used", "8", "-g", "12"], ts_webm_audio
        return None

    def _TSImageEncoderPlan(self) -> tuple[str, list[str]]:
        if "libwebp" in self._TSAvailableEncoders():
            return ".webp", ["-c:v", "libwebp", "-quality", "92"]
        return ".png", ["-c:v", "png"]

    def TSEnsureProxy(self, ts_row: Any, ts_source_path: Path) -> Path | None:
        ts_type = str(ts_row["type"] or "")
        if ts_type not in {"image", "video"}:
            return None
        ts_key = TSBuildDisplayProxyKey(ts_row)
        with self.ts_locks(ts_key):
            for ts_existing in self.ts_directory.glob(f"{ts_key}.*"):
                if ".part" in ts_existing.name or not ts_existing.is_file() or ts_existing.stat().st_size <= 0:
                    continue
                # Touched on use, so the size cap evicts what nobody opens.
                try:
                    os.utime(ts_existing, None)
                except OSError:
                    pass
                return ts_existing
            self.ts_directory.mkdir(parents=True, exist_ok=True)
            if ts_type == "video":
                ts_proxy_path = self._TSConvertVideo(ts_source_path, ts_key)
            else:
                ts_proxy_path = self._TSConvertImage(ts_source_path, ts_key, str(ts_row["extension"] or ""))
        if ts_proxy_path is not None:
            self._TSTrimCache(ts_keep=ts_proxy_path)
        return ts_proxy_path

    def _TSConvertVideo(self, ts_source_path: Path, ts_key: str) -> Path | None:
        ts_plan = self._TSVideoEncoderPlan()
        if ts_plan is None:
            TSLogVerbose("display_proxy.video.no_encoder", source_path=str(ts_source_path))
            return None
        ts_suffix, ts_video_args, ts_tail_args = ts_plan
        ts_edge = TS_DISPLAY_PROXY_VIDEO_MAX_EDGE
        ts_arguments = [
            "-i", str(ts_source_path),
            "-map", "0:v:0", "-map", "0:a:0?",
            # Fit inside the cap, keep the aspect ratio, even dimensions (4:2:0
            # needs them) and a pixel format every browser decodes.
            "-vf", f"scale='min({ts_edge},iw)':'min({ts_edge},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p",
            *ts_video_args,
            *ts_tail_args,
        ]
        return self._TSRunConversion(ts_source_path, ts_key, ts_suffix, ts_arguments, TS_DISPLAY_PROXY_VIDEO_TIMEOUT_SECONDS)

    def _TSConvertImage(self, ts_source_path: Path, ts_key: str, ts_extension: str) -> Path | None:
        ts_suffix, ts_codec_args = self._TSImageEncoderPlan()
        ts_edge = TS_DISPLAY_PROXY_IMAGE_MAX_EDGE
        for ts_input_args, ts_filter_prefix in TSStillImageDecodeAttempts(ts_extension):
            ts_arguments = [
                *ts_input_args,
                "-i", str(ts_source_path),
                "-frames:v", "1",
                "-vf", f"{ts_filter_prefix}scale='min({ts_edge},iw)':'min({ts_edge},ih)':force_original_aspect_ratio=decrease",
                *ts_codec_args,
            ]
            ts_proxy = self._TSRunConversion(ts_source_path, ts_key, ts_suffix, ts_arguments, TS_DISPLAY_PROXY_IMAGE_TIMEOUT_SECONDS)
            if ts_proxy is not None:
                return ts_proxy
        return None

    def _TSRunConversion(
        self,
        ts_source_path: Path,
        ts_key: str,
        ts_suffix: str,
        ts_arguments: list[str],
        ts_timeout: int,
    ) -> Path | None:
        ts_target = self.ts_directory / f"{ts_key}{ts_suffix}"
        # Written under a temporary name and renamed when complete, so a
        # conversion killed halfway never leaves a truncated file that would
        # be served as if it were whole.
        ts_partial = self.ts_directory / f"{ts_key}.part{ts_suffix}"
        ts_success = self.ts_tools.TSRunFFmpegConversion(ts_arguments, ts_partial, ts_timeout)
        if not ts_success:
            try:
                ts_partial.unlink()
            except OSError:
                pass
            TSLogVerbose("display_proxy.failed", source_path=str(ts_source_path))
            return None
        os.replace(ts_partial, ts_target)
        TSLogVerbose("display_proxy.created", source_path=str(ts_source_path), proxy=ts_target.name)
        return ts_target

    def _TSTrimCache(self, ts_keep: Path | None = None) -> None:
        try:
            ts_files = [ts_path for ts_path in self.ts_directory.iterdir() if ts_path.is_file()]
        except OSError:
            return
        ts_entries = []
        ts_total = 0
        for ts_path in ts_files:
            try:
                ts_stat = ts_path.stat()
            except OSError:
                continue
            ts_total += ts_stat.st_size
            ts_entries.append((ts_stat.st_mtime, ts_stat.st_size, ts_path))
        if ts_total <= TS_DISPLAY_PROXY_CACHE_MAX_BYTES:
            return
        for _ts_mtime, ts_size, ts_path in sorted(ts_entries, key=lambda ts_entry: ts_entry[0]):
            if ts_total <= TS_DISPLAY_PROXY_CACHE_MAX_BYTES:
                break
            if ts_keep is not None and ts_path == ts_keep:
                continue
            try:
                ts_path.unlink()
                ts_total -= ts_size
            except OSError:
                continue


def TSStillImageDecodeAttempts(ts_extension: str) -> list[tuple[list[str], str]]:
    """(input arguments, filter prefix) to try in order when decoding a still.

    OpenEXR holds LINEAR light: mapped straight to 8-bit, every render looks
    dark and flat. ffmpeg up to 8.x converts it with the EXR decoder's
    ``-apply_trc`` option, which 9.0 removed; there the zimg filter does the
    same conversion (measured identical on a linear ramp). A build with
    neither still gets a picture, just a dark one.
    """
    if str(ts_extension or "").lower() == ".exr":
        return [
            (["-apply_trc", "iec61966_2_1"], ""),
            ([], "zscale=transferin=linear:transfer=iec61966-2-1,"),
            ([], ""),
        ]
    return [([], "")]
