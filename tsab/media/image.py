from __future__ import annotations

from pathlib import Path

from PIL import Image

from .common import TSBuildDiscoveredPayload, TSBuildIndexedPayload
from .image_generation import TS_GENERATION_TEXT_KEYS, TSResolveImageGeneration
from .png_text import TS_PNG_SIGNATURE, TSReadPngText
from ..ts_display_proxy import TSStillImageDecodeAttempts
from ..ts_settings import (
    TS_FFMPEG_IMAGE_EXTENSIONS, TS_IMAGE_EXTENSIONS, TS_IMAGE_METADATA_VERSION, TS_PROMPT_PARTS_VERSION,
)
from ..ts_types import TSAssetPayload, TSAssetStat
from ..ts_utils import TSJsonDumps

def _TSDecodeImageComment(ts_value) -> str:
    if isinstance(ts_value, str):
        return ts_value.strip("\0")
    if not isinstance(ts_value, bytes):
        return ""
    ts_prefix, ts_body = ts_value[:8], ts_value[8:]
    if ts_prefix == b"UNICODE\0":
        if ts_body.startswith((b"\xff\xfe", b"\xfe\xff")):
            return ts_body.decode("utf-16", errors="replace").strip("\0")
        # EXIF writers use either byte order; an unmarked UTF-16 string
        # containing ASCII reveals the order in its NUL bytes.
        ts_encoding = "utf-16-le" if ts_body[1::2].count(0) >= ts_body[::2].count(0) else "utf-16-be"
    elif ts_prefix == b"JIS\0\0\0\0\0":
        ts_encoding = "shift_jis"
    else:
        ts_encoding = "utf-8"
        if ts_prefix not in {b"ASCII\0\0\0", b"\0" * 8}:
            ts_body = ts_value
    return ts_body.decode(ts_encoding, errors="replace").strip("\0")


class TSImageHandler:
    ts_kind = "image"
    ts_extensions = TS_IMAGE_EXTENSIONS

    def __init__(self, ts_preview_cache, ts_tools) -> None:
        self.ts_preview_cache = ts_preview_cache
        self.ts_tools = ts_tools

    def TSBuildDiscoveredPayload(self, ts_asset_stat: TSAssetStat) -> TSAssetPayload:
        return TSBuildDiscoveredPayload(
            ts_asset_stat,
            self.ts_kind,
            self.ts_preview_cache.TSGetTypePlaceholderPreview(self.ts_kind),
        )

    def TSBuildIndexedPayload(self, ts_asset_stat: TSAssetStat, ts_asset_hash: str) -> TSAssetPayload:
        ts_width = None
        ts_height = None
        try:
            with Image.open(ts_asset_stat.ts_path) as ts_image:
                ts_width, ts_height = ts_image.size
                try:
                    ts_orientation = int(ts_image.getexif().get(274, 1))
                except Exception:
                    ts_orientation = 1
                if ts_orientation in {5, 6, 7, 8}:
                    ts_width, ts_height = ts_height, ts_width
        except Exception:
            ts_width = None
            ts_height = None
        if (ts_width is None or ts_height is None) and ts_asset_stat.ts_extension in TS_FFMPEG_IMAGE_EXTENSIONS:
            # Pillow cannot open OpenEXR at all; ffprobe reads its header.
            ts_width, ts_height = self._TSProbeStillSize(ts_asset_stat.ts_path)
        return TSBuildIndexedPayload(
            ts_asset_stat,
            self.ts_kind,
            self.ts_preview_cache.TSGetTypePlaceholderPreview(self.ts_kind),
            ts_asset_hash,
            ts_width=ts_width,
            ts_height=ts_height,
            ts_has_preview=False,
            ts_has_metadata=False,
        )

    def _TSProbeStillSize(self, ts_path) -> tuple[int | None, int | None]:
        if self.ts_tools is None:
            return None, None
        ts_probe = self.ts_tools.TSRunFFProbe(ts_path)
        for ts_stream in ts_probe.get("streams") or []:
            if isinstance(ts_stream, dict) and ts_stream.get("codec_type") == "video":
                try:
                    return int(ts_stream.get("width") or 0) or None, int(ts_stream.get("height") or 0) or None
                except (TypeError, ValueError):
                    return None, None
        return None, None

    def TSGeneratePreview(self, ts_row) -> str:
        ts_preview_key = self.ts_preview_cache.TSBuildAssetPreviewKey(str(ts_row["hash"] or ""), ts_row["path"])
        ts_extension = str(ts_row["extension"] or "").lower()
        if ts_extension in TS_FFMPEG_IMAGE_EXTENSIONS:
            return self.ts_preview_cache.TSGenerateFFmpegImageThumbnail(
                Path(str(ts_row["path"])),
                ts_preview_key,
                self.ts_tools,
                TSStillImageDecodeAttempts(ts_extension),
            )
        return self.ts_preview_cache.TSGenerateImageThumbnail(ts_row["path"], ts_preview_key)

    def _TSReadImageMetadata(self, ts_image_path) -> dict[str, str]:
        ts_metadata: dict[str, str] = {}
        try:
            with Path(ts_image_path).open("rb") as ts_file:
                if ts_file.read(len(TS_PNG_SIGNATURE)) == TS_PNG_SIGNATURE:
                    return TSReadPngText(ts_file, TS_GENERATION_TEXT_KEYS)
            with Image.open(ts_image_path) as ts_image:
                for ts_key, ts_value in ts_image.info.items():
                    ts_name = str(ts_key).lower()
                    if ts_name in TS_GENERATION_TEXT_KEYS:
                        ts_metadata[ts_name] = _TSDecodeImageComment(ts_value)[:4_194_304]
                ts_exif = ts_image.getexif()
                ts_exif_subifd = ts_exif.get_ifd(34665)
                for ts_name, ts_value in (
                    ("description", ts_exif.get(270)),
                    ("usercomment", ts_exif_subifd.get(37510) or ts_exif.get(37510)),
                ):
                    ts_text = _TSDecodeImageComment(ts_value)
                    if ts_text:
                        ts_metadata.setdefault(ts_name, ts_text[:4_194_304])
        except Exception:
            # Corrupt or vanished files yield "no metadata" instead of
            # raising through the on-demand ensure chain (mirrors the
            # unreadable-image handling in TSBuildIndexedPayload above).
            pass
        return ts_metadata

    def TSExtractMetadata(self, ts_row) -> dict[str, str]:
        ts_generation = TSResolveImageGeneration(self._TSReadImageMetadata(ts_row["path"]))
        ts_metadata_payload: dict = {"image_metadata_version": TS_IMAGE_METADATA_VERSION}
        if any((ts_generation.ts_positive, ts_generation.ts_negative, ts_generation.ts_seed,
                ts_generation.ts_models, ts_generation.ts_workflow, ts_generation.ts_parameters)):
            ts_metadata_payload.update(
                prompt_parts_version=TS_PROMPT_PARTS_VERSION,
                positive_prompt_text=ts_generation.ts_positive,
                negative_prompt_text=ts_generation.ts_negative,
                seed=ts_generation.ts_seed,
                models=ts_generation.ts_models,
            )
        if ts_generation.ts_parameters:
            ts_metadata_payload["generation_parameters"] = ts_generation.ts_parameters
            if ts_generation.ts_parameters_are_defaults:
                ts_metadata_payload["generation_parameters_are_defaults"] = True
        return {
            "metadata": TSJsonDumps(ts_metadata_payload),
            "prompt_text": ts_generation.ts_positive,
            "workflow_text": ts_generation.ts_workflow,
            # Newline-joined for the FTS "model_text" column; the structured
            # list stays in the metadata blob for display.
            "model_text": "\n".join(ts_generation.ts_models),
            "has_metadata": True,
        }
