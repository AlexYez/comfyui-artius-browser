from __future__ import annotations

import base64
import hashlib
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

from .ts_logging import TSLogVerbose
from .ts_settings import (
    TS_DEFAULT_PLACEHOLDER_HEIGHT,
    TS_DEFAULT_PLACEHOLDER_WIDTH,
    TS_DEFAULT_PREVIEW_FORMAT,
    TS_DEFAULT_PREVIEW_QUALITY,
    TS_DEFAULT_THUMBNAIL_SIZE,
    TS_DEFAULT_WAVEFORM_HEIGHT,
    TS_DEFAULT_WAVEFORM_WIDTH,
)
from .ts_utils import TSNormalizePathString, TSRelativePosixPath


class TSPreviewCache:
    def __init__(self, ts_storage_paths, ts_config_store) -> None:
        self.ts_storage_paths = ts_storage_paths
        self.ts_config_store = ts_config_store
        self.ts_resampling = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
        self.ts_placeholder_specs = {
            "image": ("placeholder-image", "IMG", "#E76F51"),
            "video": ("placeholder-video", "VID", "#2A9D8F"),
            "audio": ("placeholder-audio", "AUD", "#F4A261"),
            "3d": ("placeholder-3d", "3D", "#457B9D"),
        }

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
        ts_absolute_path = self.TSResolvePreviewPath(ts_preview_path)
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
        ts_placeholder_key, ts_label, ts_accent = self.ts_placeholder_specs.get(
            ts_kind,
            (f"placeholder-{ts_kind}", ts_kind.upper()[:3], "#6B7280"),
        )
        return self.TSGeneratePlaceholderPreview(ts_placeholder_key, ts_label, ts_accent)

    def TSGenerateImageThumbnail(self, ts_source_path: Path, ts_preview_key: str) -> str:
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

    def TSGenerateWaveformPreview(self, ts_source_path: Path, ts_preview_key: str, ts_tools) -> str:
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
            self._TSNormalizePreviewFile(ts_temp_path, ts_output_path, ts_resize_to_thumbnail=False)
        except Exception as ts_error:
            TSLogVerbose("preview.waveform.normalize.failed", source_path=str(ts_source_path), error=str(ts_error))
            return self.TSGetTypePlaceholderPreview("audio")
        return self.TSRelativePreviewPath(ts_output_path)

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
        ts_header, ts_encoded_data = ts_image_data_url.split(",", 1)
        if not ts_header.startswith("data:image/"):
            return ""
        try:
            ts_image_bytes = base64.b64decode(ts_encoded_data)
            with Image.open(io.BytesIO(ts_image_bytes)) as ts_image:
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

    def TSGeneratePlaceholderPreview(self, ts_preview_key: str, ts_label: str, ts_accent_color: str) -> str:
        ts_output_path = self.TSBuildPreviewPath(ts_preview_key, "placeholders")
        try:
            if not ts_output_path.exists():
                ts_output_path.parent.mkdir(parents=True, exist_ok=True)
                ts_width, ts_height = self._TSPlaceholderSize()
                ts_inset = max(18, round(min(ts_width, ts_height) * 0.08))
                ts_radius = max(16, round(min(ts_width, ts_height) * 0.08))
                ts_border = max(3, round(min(ts_width, ts_height) * 0.012))
                ts_image = Image.new("RGB", (ts_width, ts_height), "#0F1720")
                ts_draw = ImageDraw.Draw(ts_image)
                ts_draw.rounded_rectangle(
                    (ts_inset, ts_inset, ts_width - ts_inset, ts_height - ts_inset),
                    radius=ts_radius,
                    fill="#16212B",
                    outline=ts_accent_color,
                    width=ts_border,
                )
                ts_font = ImageFont.load_default()
                ts_bbox = ts_draw.textbbox((0, 0), ts_label, font=ts_font)
                ts_text_width = ts_bbox[2] - ts_bbox[0]
                ts_text_height = ts_bbox[3] - ts_bbox[1]
                ts_draw.text(
                    ((ts_width - ts_text_width) / 2, (ts_height - ts_text_height) / 2),
                    ts_label,
                    fill=ts_accent_color,
                    font=ts_font,
                )
                self._TSSavePreviewImage(ts_image, ts_output_path)
            return self.TSRelativePreviewPath(ts_output_path)
        except Exception as ts_error:
            TSLogVerbose("preview.placeholder.failed", label=ts_label, preview_path=str(ts_output_path), error=str(ts_error))
            return ""

    def _TSPreviewConfig(self) -> dict:
        return self.ts_config_store.TSLoadConfig().get("preview", {})

    def _TSThumbnailSize(self) -> int:
        ts_value = int(self._TSPreviewConfig().get("thumbnail_size", TS_DEFAULT_THUMBNAIL_SIZE))
        return max(96, min(1024, ts_value))

    def _TSWaveformSize(self) -> tuple[int, int]:
        ts_config = self._TSPreviewConfig()
        ts_width = max(320, min(2048, int(ts_config.get("waveform_width", TS_DEFAULT_WAVEFORM_WIDTH))))
        ts_height = max(96, min(1024, int(ts_config.get("waveform_height", TS_DEFAULT_WAVEFORM_HEIGHT))))
        return ts_width, ts_height

    def _TSPlaceholderSize(self) -> tuple[int, int]:
        ts_config = self._TSPreviewConfig()
        ts_width = max(160, min(1024, int(ts_config.get("placeholder_width", TS_DEFAULT_PLACEHOLDER_WIDTH))))
        ts_height = max(120, min(768, int(ts_config.get("placeholder_height", TS_DEFAULT_PLACEHOLDER_HEIGHT))))
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
                "method": 4,
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
