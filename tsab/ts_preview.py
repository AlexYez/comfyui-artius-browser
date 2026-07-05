from __future__ import annotations

import base64
import hashlib
import io
import logging
import shutil
import threading
from importlib.metadata import PackageNotFoundError, distribution
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from .ts_logging import TSLogVerbose


def _TSDetectPillowSimd() -> bool:
    try:
        distribution("Pillow-SIMD")
        return True
    except PackageNotFoundError:
        return False
    except Exception:
        return False


if _TSDetectPillowSimd():
    logging.getLogger("TSArtiusBrowser").info(
        "Pillow-SIMD detected — accelerated image pipeline enabled"
    )
from .ts_settings import (
    TS_DEFAULT_PLACEHOLDER_HEIGHT,
    TS_DEFAULT_PLACEHOLDER_WIDTH,
    TS_DEFAULT_PREVIEW_FORMAT,
    TS_DEFAULT_PREVIEW_QUALITY,
    TS_DEFAULT_THUMBNAIL_SIZE,
    TS_ALLOWED_3D_CAPTURE_MIME_TYPES,
    TS_MAX_3D_CAPTURE_DATA_URL_LENGTH,
    TS_MAX_3D_CAPTURE_DECODED_BYTES,
    TS_MAX_3D_CAPTURE_PIXELS,
    TS_DEFAULT_WAVEFORM_HEIGHT,
    TS_DEFAULT_WAVEFORM_WIDTH,
    TS_PLACEHOLDER_HEIGHT_MAX,
    TS_PLACEHOLDER_HEIGHT_MIN,
    TS_PLACEHOLDER_WIDTH_MAX,
    TS_PLACEHOLDER_WIDTH_MIN,
    TS_THUMBNAIL_SIZE_MAX,
    TS_THUMBNAIL_SIZE_MIN,
    TS_WAVEFORM_HEIGHT_MAX,
    TS_WAVEFORM_HEIGHT_MIN,
    TS_WAVEFORM_WIDTH_MAX,
    TS_WAVEFORM_WIDTH_MIN,
)
from .ts_utils import TSNormalizePathString, TSRelativePosixPath


# SoundCloud-style waveform rendering: discrete vertical bars filled with a
# greenish steel gradient. Geometry is in source pixels (waveform_width/height);
# bar count scales with the configured waveform width.
TS_WAVEFORM_BAR_WIDTH = 5
TS_WAVEFORM_BAR_GAP = 3
TS_WAVEFORM_BAR_MIN_HEIGHT_FRACTION = 0.06
TS_WAVEFORM_VERTICAL_PADDING_FRACTION = 0.08
TS_WAVEFORM_GRADIENT_STOPS = ((168, 222, 200), (78, 156, 128), (34, 84, 72))


def _TSLerpColor(ts_start: tuple[int, int, int], ts_end: tuple[int, int, int], ts_fraction: float) -> tuple[int, int, int]:
    return tuple(round(ts_start[ts_i] + (ts_end[ts_i] - ts_start[ts_i]) * ts_fraction) for ts_i in range(3))


def _TSBuildVerticalGradient(ts_width: int, ts_height: int, ts_stops: tuple) -> Image.Image:
    ts_column = Image.new("RGB", (1, ts_height))
    ts_pixels = ts_column.load()
    ts_segments = max(1, len(ts_stops) - 1)
    for ts_y in range(ts_height):
        ts_fraction = ts_y / max(1, ts_height - 1)
        ts_segment = min(ts_segments - 1, int(ts_fraction * ts_segments))
        ts_local = (ts_fraction * ts_segments) - ts_segment
        ts_pixels[0, ts_y] = _TSLerpColor(ts_stops[ts_segment], ts_stops[ts_segment + 1], ts_local)
    return ts_column.resize((ts_width, ts_height))


class TSPreviewCache:
    def __init__(self, ts_storage_paths, ts_config_store) -> None:
        self.ts_storage_paths = ts_storage_paths
        self.ts_config_store = ts_config_store
        self.ts_resampling = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
        self.ts_box_resampling = getattr(getattr(Image, "Resampling", Image), "BOX", Image.BOX)
        self.ts_placeholder_specs = {
            "image": ("placeholder-image", "IMG"),
            "video": ("placeholder-video", "VID"),
            "audio": ("placeholder-audio", "AUD"),
            "3d": ("placeholder-3d", "3D"),
        }
        self.ts_preview_key_locks: dict[tuple[str, str], threading.Lock] = {}
        self.ts_preview_key_locks_guard = threading.Lock()

    def _TSGetPreviewKeyLock(self, ts_folder_name: str, ts_preview_key: str) -> threading.Lock:
        # Scan hash-workers can hit two identical files concurrently (same
        # content hash => same preview key => same output and temp paths).
        # Serializing generation per output key prevents interleaved writes
        # from persisting a corrupt preview; the second worker then sees the
        # finished file and returns it. Lock objects are tiny and bounded by
        # the number of distinct previews generated in this process.
        ts_lock_key = (ts_folder_name, ts_preview_key)
        with self.ts_preview_key_locks_guard:
            ts_lock = self.ts_preview_key_locks.get(ts_lock_key)
            if ts_lock is None:
                ts_lock = threading.Lock()
                self.ts_preview_key_locks[ts_lock_key] = ts_lock
            return ts_lock

    def TSBuildPreviewPath(self, ts_preview_key: str, ts_folder_name: str, ts_extension: str | None = None) -> Path:
        ts_base_directory = {
            "thumbnails": self.ts_storage_paths.ts_thumbnail_directory,
            "video_frames": self.ts_storage_paths.ts_video_frame_directory,
            "waveforms": self.ts_storage_paths.ts_waveform_directory,
            "placeholders": self.ts_storage_paths.ts_placeholder_directory,
        }[ts_folder_name]
        ts_resolved_extension = ts_extension or self._TSPreviewExtension()
        return ts_base_directory / f"{ts_preview_key}{ts_resolved_extension}"

    def TSRelativePreviewPath(self, ts_preview_path: Path) -> str:
        return TSRelativePosixPath(ts_preview_path, self.ts_storage_paths.ts_asset_browser_directory)

    def TSResolvePreviewPath(self, ts_preview_path: str) -> Path:
        return self.ts_storage_paths.TSResolveCachePath(ts_preview_path)

    def TSIsPlaceholderPreview(self, ts_preview_path: str | None) -> bool:
        if not ts_preview_path:
            return False
        return "/placeholders/" in str(ts_preview_path).replace("\\", "/")

    def TSPurgePreview(self, ts_preview_path: str | None) -> None:
        if not ts_preview_path or self.TSIsPlaceholderPreview(ts_preview_path):
            return
        try:
            ts_absolute_path = self.TSResolvePreviewPath(ts_preview_path)
        except ValueError as ts_error:
            TSLogVerbose("preview.purge.skipped", path=str(ts_preview_path), error=str(ts_error))
            return
        try:
            if ts_absolute_path.exists():
                ts_absolute_path.unlink()
                TSLogVerbose("preview.purged", path=str(ts_absolute_path))
        except OSError as ts_error:
            TSLogVerbose("preview.purge.failed", path=str(ts_absolute_path), error=str(ts_error))

    def TSBuildAssetPreviewKey(self, ts_asset_hash: str, ts_source_path: Path | None = None) -> str:
        if ts_asset_hash:
            return ts_asset_hash
        ts_fallback_text = TSNormalizePathString(ts_source_path) if ts_source_path is not None else "preview"
        return hashlib.blake2b(ts_fallback_text.encode("utf-8"), digest_size=32).hexdigest()

    def TSGetTypePlaceholderPreview(self, ts_kind: str) -> str:
        ts_placeholder_key, ts_label = self.ts_placeholder_specs.get(
            ts_kind,
            (f"placeholder-{ts_kind}", ts_kind.upper()[:3]),
        )
        return self.TSGeneratePlaceholderPreview(ts_placeholder_key, ts_label)

    def TSGenerateImageThumbnail(self, ts_source_path: Path, ts_preview_key: str) -> str:
        with self._TSGetPreviewKeyLock("thumbnails", ts_preview_key):
            ts_output_path = self.TSBuildPreviewPath(ts_preview_key, "thumbnails")
            if ts_output_path.exists():
                return self.TSRelativePreviewPath(ts_output_path)
            try:
                with Image.open(ts_source_path) as ts_image:
                    self._TSPrepareSourceImageForThumbnail(ts_image, self._TSThumbnailSize())
                    ts_image = ImageOps.exif_transpose(ts_image)
                    self._TSApplyThumbnailResize(ts_image)
                    self._TSSavePreviewImage(ts_image, ts_output_path)
            except Exception as ts_error:
                TSLogVerbose("preview.thumbnail.failed", source_path=str(ts_source_path), error=str(ts_error))
                return self.TSGetTypePlaceholderPreview("image")
            return self.TSRelativePreviewPath(ts_output_path)

    def TSGenerateVideoPoster(self, ts_source_path: Path, ts_preview_key: str, ts_tools) -> str:
        with self._TSGetPreviewKeyLock("video_frames", ts_preview_key):
            ts_output_path = self.TSBuildPreviewPath(ts_preview_key, "video_frames")
            if ts_output_path.exists():
                return self.TSRelativePreviewPath(ts_output_path)
            ts_temp_path = self.TSBuildPreviewPath(ts_preview_key, "video_frames", ".source.png")
            ts_frame_time = float(self._TSPreviewConfig().get("video_frame_time", 0.5))
            ts_success = ts_tools.TSExtractVideoFrame(ts_source_path, ts_temp_path, ts_frame_time)
            if not ts_success:
                return self.TSGetTypePlaceholderPreview("video")
            try:
                self._TSNormalizePreviewFile(ts_temp_path, ts_output_path)
            except Exception as ts_error:
                TSLogVerbose("preview.video.normalize.failed", source_path=str(ts_source_path), error=str(ts_error))
                return self.TSGetTypePlaceholderPreview("video")
            return self.TSRelativePreviewPath(ts_output_path)

    def TSGenerateVideoPosterParallel(
        self,
        ts_source_path: Path,
        ts_preview_key: str,
        ts_tools,
    ) -> tuple[dict, str]:
        with self._TSGetPreviewKeyLock("video_frames", ts_preview_key):
            ts_output_path = self.TSBuildPreviewPath(ts_preview_key, "video_frames")
            if ts_output_path.exists():
                ts_probe = ts_tools.TSRunFFProbe(ts_source_path)
                return ts_probe, self.TSRelativePreviewPath(ts_output_path)
            ts_temp_path = self.TSBuildPreviewPath(ts_preview_key, "video_frames", ".source.png")
            ts_frame_time = float(self._TSPreviewConfig().get("video_frame_time", 0.5))
            ts_max_output_dim = max(self._TSThumbnailSize() * 2, 256)
            ts_probe, ts_frame_success = ts_tools.TSRunFFProbeAndExtractFrameParallel(
                ts_source_path, ts_temp_path, ts_frame_time, ts_max_output_dim=ts_max_output_dim
            )
            if not ts_frame_success:
                return ts_probe, self.TSGetTypePlaceholderPreview("video")
            try:
                self._TSNormalizePreviewFile(ts_temp_path, ts_output_path)
            except Exception as ts_error:
                TSLogVerbose("preview.video.normalize.failed", source_path=str(ts_source_path), error=str(ts_error))
                return ts_probe, self.TSGetTypePlaceholderPreview("video")
            return ts_probe, self.TSRelativePreviewPath(ts_output_path)

    def TSGenerateWaveformPreviewParallel(
        self,
        ts_source_path: Path,
        ts_preview_key: str,
        ts_tools,
    ) -> tuple[dict, str]:
        with self._TSGetPreviewKeyLock("waveforms", ts_preview_key):
            ts_output_path = self.TSBuildPreviewPath(ts_preview_key, "waveforms")
            ts_waveform_width, ts_waveform_height = self._TSWaveformSize()
            if ts_output_path.exists() and self._TSPreviewHasMinimumSize(ts_output_path, ts_waveform_width, ts_waveform_height):
                ts_probe = ts_tools.TSRunFFProbe(ts_source_path)
                return ts_probe, self.TSRelativePreviewPath(ts_output_path)
            if ts_output_path.exists():
                try:
                    ts_output_path.unlink()
                except OSError:
                    pass
            ts_temp_path = self.TSBuildPreviewPath(ts_preview_key, "waveforms", ".source.png")
            ts_probe, ts_waveform_success = ts_tools.TSRunFFProbeAndExtractWaveformParallel(
                ts_source_path, ts_temp_path, ts_waveform_width, ts_waveform_height
            )
            if not ts_waveform_success:
                return ts_probe, self.TSGetTypePlaceholderPreview("audio")
            try:
                self._TSStylizeWaveform(ts_temp_path, ts_output_path)
            except Exception as ts_error:
                TSLogVerbose("preview.waveform.normalize.failed", source_path=str(ts_source_path), error=str(ts_error))
                return ts_probe, self.TSGetTypePlaceholderPreview("audio")
            return ts_probe, self.TSRelativePreviewPath(ts_output_path)

    def TSGenerateWaveformPreview(self, ts_source_path: Path, ts_preview_key: str, ts_tools) -> str:
        with self._TSGetPreviewKeyLock("waveforms", ts_preview_key):
            ts_output_path = self.TSBuildPreviewPath(ts_preview_key, "waveforms")
            ts_waveform_width, ts_waveform_height = self._TSWaveformSize()
            if ts_output_path.exists() and self._TSPreviewHasMinimumSize(ts_output_path, ts_waveform_width, ts_waveform_height):
                return self.TSRelativePreviewPath(ts_output_path)
            if ts_output_path.exists():
                try:
                    ts_output_path.unlink()
                except OSError:
                    pass
            ts_temp_path = self.TSBuildPreviewPath(ts_preview_key, "waveforms", ".source.png")
            ts_success = ts_tools.TSExtractWaveform(ts_source_path, ts_temp_path, ts_waveform_width, ts_waveform_height)
            if not ts_success:
                return self.TSGetTypePlaceholderPreview("audio")
            try:
                self._TSStylizeWaveform(ts_temp_path, ts_output_path)
            except Exception as ts_error:
                TSLogVerbose("preview.waveform.normalize.failed", source_path=str(ts_source_path), error=str(ts_error))
                return self.TSGetTypePlaceholderPreview("audio")
            return self.TSRelativePreviewPath(ts_output_path)

    def _TSStylizeWaveform(self, ts_source_preview_path: Path, ts_output_path: Path) -> None:
        try:
            with Image.open(ts_source_preview_path) as ts_source_image:
                ts_waveform = self._TSRenderWaveformBars(ts_source_image.convert("RGBA"))
            self._TSSavePreviewImage(ts_waveform, ts_output_path)
        finally:
            if ts_source_preview_path.exists():
                try:
                    ts_source_preview_path.unlink()
                except OSError as ts_error:
                    TSLogVerbose("preview.temp_cleanup.failed", preview_path=str(ts_source_preview_path), error=str(ts_error))

    def _TSRenderWaveformBars(self, ts_image: Image.Image) -> Image.Image:
        ts_width, ts_height = ts_image.size
        ts_unit = TS_WAVEFORM_BAR_WIDTH + TS_WAVEFORM_BAR_GAP
        ts_bar_count = max(8, ts_width // ts_unit)
        # showwavespic fills the wave symmetrically around the vertical center on a
        # transparent background, so per-bucket mean alpha tracks the amplitude.
        ts_profile = ts_image.getchannel("A").resize((ts_bar_count, 1), self.ts_box_resampling).load()
        ts_amplitudes = [ts_profile[ts_index, 0] for ts_index in range(ts_bar_count)]
        ts_peak = max(ts_amplitudes) or 1
        ts_center_y = ts_height / 2
        ts_usable_half = max(1.0, ts_center_y - ts_height * TS_WAVEFORM_VERTICAL_PADDING_FRACTION)
        ts_radius = max(1, TS_WAVEFORM_BAR_WIDTH // 2)
        ts_start_x = (ts_width - ts_bar_count * ts_unit) // 2 + TS_WAVEFORM_BAR_GAP // 2
        ts_mask = Image.new("L", (ts_width, ts_height), 0)
        ts_draw = ImageDraw.Draw(ts_mask)
        for ts_index, ts_value in enumerate(ts_amplitudes):
            ts_amplitude = TS_WAVEFORM_BAR_MIN_HEIGHT_FRACTION + (1 - TS_WAVEFORM_BAR_MIN_HEIGHT_FRACTION) * (ts_value / ts_peak)
            ts_bar_half = ts_amplitude * ts_usable_half
            ts_x0 = ts_start_x + ts_index * ts_unit
            ts_draw.rounded_rectangle(
                (ts_x0, ts_center_y - ts_bar_half, ts_x0 + TS_WAVEFORM_BAR_WIDTH - 1, ts_center_y + ts_bar_half),
                radius=ts_radius,
                fill=255,
            )
        ts_waveform = _TSBuildVerticalGradient(ts_width, ts_height, TS_WAVEFORM_GRADIENT_STOPS).convert("RGBA")
        ts_waveform.putalpha(ts_mask)
        return ts_waveform

    def TSBuild3DCapturePreviewPath(self, ts_preview_key: str) -> Path:
        return self.TSBuildPreviewPath(f"{ts_preview_key}.3d", "thumbnails")

    def TSGet3DCapturePreview(self, ts_preview_key: str) -> str:
        ts_output_path = self.TSBuild3DCapturePreviewPath(ts_preview_key)
        if ts_output_path.exists():
            return self.TSRelativePreviewPath(ts_output_path)
        return ""

    def TSPersist3DCapturePreview(self, ts_preview_key: str, ts_image_data_url: str) -> str:
        if not isinstance(ts_image_data_url, str) or "," not in ts_image_data_url:
            return ""
        if len(ts_image_data_url) > TS_MAX_3D_CAPTURE_DATA_URL_LENGTH:
            TSLogVerbose("preview.3d_capture.rejected", preview_key=ts_preview_key, reason="data_url_too_large")
            return ""
        ts_header, ts_encoded_data = ts_image_data_url.split(",", 1)
        ts_mime_type = ts_header.removeprefix("data:").split(";", 1)[0].lower()
        if ts_mime_type not in TS_ALLOWED_3D_CAPTURE_MIME_TYPES or ";base64" not in ts_header.lower():
            TSLogVerbose("preview.3d_capture.rejected", preview_key=ts_preview_key, reason="invalid_mime")
            return ""
        if len(ts_encoded_data) > ((TS_MAX_3D_CAPTURE_DECODED_BYTES + 2) // 3) * 4:
            TSLogVerbose("preview.3d_capture.rejected", preview_key=ts_preview_key, reason="encoded_payload_too_large")
            return ""
        try:
            ts_image_bytes = base64.b64decode(ts_encoded_data, validate=True)
            if len(ts_image_bytes) > TS_MAX_3D_CAPTURE_DECODED_BYTES:
                TSLogVerbose("preview.3d_capture.rejected", preview_key=ts_preview_key, reason="decoded_payload_too_large")
                return ""
            with Image.open(io.BytesIO(ts_image_bytes)) as ts_image:
                if ts_image.width * ts_image.height > TS_MAX_3D_CAPTURE_PIXELS:
                    TSLogVerbose("preview.3d_capture.rejected", preview_key=ts_preview_key, reason="image_too_large")
                    return ""
                self._TSPrepareSourceImageForThumbnail(ts_image, self._TSThumbnailSize())
                ts_image = ImageOps.exif_transpose(ts_image)
                self._TSApplyThumbnailResize(ts_image)
                ts_output_path = self.TSBuild3DCapturePreviewPath(ts_preview_key)
                self._TSSavePreviewImage(ts_image, ts_output_path)
            return self.TSRelativePreviewPath(ts_output_path)
        except Exception as ts_error:
            TSLogVerbose("preview.3d_capture.persist.failed", preview_key=ts_preview_key, error=str(ts_error))
            return ""

    def TSGenerate3DPoster(self, ts_source_path: Path, ts_preview_key: str) -> str:
        ts_persistent_preview_path = self.TSGet3DCapturePreview(ts_preview_key)
        if ts_persistent_preview_path:
            return ts_persistent_preview_path
        ts_source_path = Path(ts_source_path)
        for ts_candidate_extension in (".png", ".jpg", ".jpeg", ".webp"):
            ts_candidate_path = ts_source_path.with_suffix(ts_candidate_extension)
            if ts_candidate_path.exists():
                return self.TSGenerateImageThumbnail(ts_candidate_path, ts_preview_key)
        return self.TSGetTypePlaceholderPreview("3d")

    def TSGeneratePlaceholderPreview(self, ts_preview_key: str, ts_label: str) -> str:
        ts_output_path = self.TSBuildPreviewPath(ts_preview_key, "placeholders", ".png")
        try:
            if not ts_output_path.exists():
                ts_output_path.parent.mkdir(parents=True, exist_ok=True)
                ts_width, ts_height = self._TSPlaceholderSize()
                ts_inset = max(18, round(min(ts_width, ts_height) * 0.08))
                ts_radius = max(16, round(min(ts_width, ts_height) * 0.08))
                ts_border = max(3, round(min(ts_width, ts_height) * 0.012))
                ts_border_color = (148, 163, 184, 176)
                ts_text_color = (148, 163, 184, 220)
                ts_image = Image.new("RGBA", (ts_width, ts_height), (0, 0, 0, 0))
                ts_draw = ImageDraw.Draw(ts_image)
                ts_draw.rounded_rectangle(
                    (ts_inset, ts_inset, ts_width - ts_inset, ts_height - ts_inset),
                    radius=ts_radius,
                    fill=(0, 0, 0, 0),
                    outline=ts_border_color,
                    width=ts_border,
                )
                ts_font = ImageFont.load_default()
                ts_bbox = ts_draw.textbbox((0, 0), ts_label, font=ts_font)
                ts_text_width = ts_bbox[2] - ts_bbox[0]
                ts_text_height = ts_bbox[3] - ts_bbox[1]
                ts_draw.text(
                    ((ts_width - ts_text_width) / 2, (ts_height - ts_text_height) / 2),
                    ts_label,
                    fill=ts_text_color,
                    font=ts_font,
                )
                ts_image.save(ts_output_path, format="PNG", optimize=True, compress_level=6)
            return self.TSRelativePreviewPath(ts_output_path)
        except Exception as ts_error:
            TSLogVerbose("preview.placeholder.failed", label=ts_label, preview_path=str(ts_output_path), error=str(ts_error))
            return ""

    def TSClearGeneratedCache(self) -> None:
        ts_cache_directory = self.ts_storage_paths.ts_cache_directory
        try:
            if ts_cache_directory.exists():
                shutil.rmtree(ts_cache_directory)
            self.ts_storage_paths.TSEnsureDirectories()
            TSLogVerbose("preview.cache.cleared", path=str(ts_cache_directory))
        except OSError as ts_error:
            TSLogVerbose("preview.cache.clear_failed", path=str(ts_cache_directory), error=str(ts_error))

    def _TSPreviewConfig(self) -> dict:
        return self.ts_config_store.TSLoadConfig().get("preview", {})

    def _TSThumbnailSize(self) -> int:
        ts_value = int(self._TSPreviewConfig().get("thumbnail_size", TS_DEFAULT_THUMBNAIL_SIZE))
        return max(TS_THUMBNAIL_SIZE_MIN, min(TS_THUMBNAIL_SIZE_MAX, ts_value))

    def _TSWaveformSize(self) -> tuple[int, int]:
        ts_config = self._TSPreviewConfig()
        ts_width = max(TS_WAVEFORM_WIDTH_MIN, min(TS_WAVEFORM_WIDTH_MAX, int(ts_config.get("waveform_width", TS_DEFAULT_WAVEFORM_WIDTH))))
        ts_height = max(TS_WAVEFORM_HEIGHT_MIN, min(TS_WAVEFORM_HEIGHT_MAX, int(ts_config.get("waveform_height", TS_DEFAULT_WAVEFORM_HEIGHT))))
        return ts_width, ts_height

    def _TSPlaceholderSize(self) -> tuple[int, int]:
        ts_config = self._TSPreviewConfig()
        ts_width = max(TS_PLACEHOLDER_WIDTH_MIN, min(TS_PLACEHOLDER_WIDTH_MAX, int(ts_config.get("placeholder_width", TS_DEFAULT_PLACEHOLDER_WIDTH))))
        ts_height = max(TS_PLACEHOLDER_HEIGHT_MIN, min(TS_PLACEHOLDER_HEIGHT_MAX, int(ts_config.get("placeholder_height", TS_DEFAULT_PLACEHOLDER_HEIGHT))))
        return ts_width, ts_height

    def _TSPreviewFormat(self) -> str:
        ts_format = str(self._TSPreviewConfig().get("image_format", TS_DEFAULT_PREVIEW_FORMAT)).strip().lower()
        return ts_format if ts_format in {"webp", "jpeg", "png"} else TS_DEFAULT_PREVIEW_FORMAT

    def _TSPreviewExtension(self) -> str:
        return ".jpg" if self._TSPreviewFormat() == "jpeg" else f".{self._TSPreviewFormat()}"

    def _TSPreviewQuality(self) -> int:
        ts_quality = int(self._TSPreviewConfig().get("image_quality", TS_DEFAULT_PREVIEW_QUALITY))
        return max(40, min(95, ts_quality))

    def _TSSavePreviewImage(self, ts_image: Image.Image, ts_output_path: Path) -> None:
        ts_output_path.parent.mkdir(parents=True, exist_ok=True)
        ts_format = self._TSPreviewFormat()
        ts_quality = self._TSPreviewQuality()
        ts_save_kwargs: dict[str, object]
        if ts_format == "jpeg":
            ts_image = ts_image.convert("RGB")
            ts_save_kwargs = {
                "format": "JPEG",
                "quality": ts_quality,
                "optimize": True,
                "progressive": True,
            }
        elif ts_format == "png":
            ts_save_kwargs = {
                "format": "PNG",
                "optimize": True,
                "compress_level": 6,
            }
        else:
            if ts_image.mode not in {"RGB", "RGBA"}:
                ts_image = ts_image.convert("RGBA" if "A" in ts_image.getbands() else "RGB")
            ts_save_kwargs = {
                "format": "WEBP",
                "quality": ts_quality,
                "method": 0,
            }
        ts_image.save(ts_output_path, **ts_save_kwargs)

    def _TSPreviewHasMinimumSize(self, ts_preview_path: Path, ts_min_width: int, ts_min_height: int) -> bool:
        try:
            with Image.open(ts_preview_path) as ts_image:
                ts_width, ts_height = ts_image.size
            return ts_width >= ts_min_width and ts_height >= ts_min_height
        except Exception as ts_error:
            TSLogVerbose("preview.size_check.failed", preview_path=str(ts_preview_path), error=str(ts_error))
            return False

    def _TSNormalizePreviewFile(
        self,
        ts_source_preview_path: Path,
        ts_output_path: Path,
        ts_resize_to_thumbnail: bool = True,
    ) -> None:
        try:
            with Image.open(ts_source_preview_path) as ts_image:
                self._TSPrepareSourceImageForThumbnail(ts_image, self._TSThumbnailSize())
                ts_image = ImageOps.exif_transpose(ts_image)
                if ts_resize_to_thumbnail:
                    self._TSApplyThumbnailResize(ts_image)
                self._TSSavePreviewImage(ts_image, ts_output_path)
        finally:
            if ts_source_preview_path.exists():
                try:
                    ts_source_preview_path.unlink()
                except OSError as ts_error:
                    TSLogVerbose("preview.temp_cleanup.failed", preview_path=str(ts_source_preview_path), error=str(ts_error))

    def _TSPrepareSourceImageForThumbnail(self, ts_image: Image.Image, ts_thumbnail_size: int) -> None:
        try:
            ts_image.draft("RGB", (ts_thumbnail_size, ts_thumbnail_size))
        except Exception:
            pass

    def _TSApplyThumbnailResize(self, ts_image: Image.Image) -> None:
        ts_thumbnail_size = self._TSThumbnailSize()
        try:
            ts_image.thumbnail(
                (ts_thumbnail_size, ts_thumbnail_size),
                self.ts_resampling,
                reducing_gap=3.0,
            )
        except TypeError:
            ts_image.thumbnail((ts_thumbnail_size, ts_thumbnail_size), self.ts_resampling)
