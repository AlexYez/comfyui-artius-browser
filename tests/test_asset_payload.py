from __future__ import annotations

import pathlib
import shutil
import sys
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_asset_payload import TSBuildAssetCard, TSBuildNative3DViewerURL, TSFormatChannelLayout, TSResolveTechnicalInfo

TS_TEST_TEMP_ROOT = pathlib.Path(__file__).resolve().parents[1] / ".codex_tmp_asset_payload_tests"


@contextmanager
def TSTemporaryDirectory():
    TS_TEST_TEMP_ROOT.mkdir(exist_ok=True)
    ts_temp_path = TS_TEST_TEMP_ROOT / uuid.uuid4().hex
    ts_temp_path.mkdir()
    try:
        yield str(ts_temp_path)
    finally:
        shutil.rmtree(ts_temp_path, ignore_errors=True)


class TSFakePreviewCache:
    def __init__(self, ts_base_path: Path, ts_placeholder_paths: set[str] | None = None) -> None:
        self.ts_base_path = ts_base_path
        self.ts_placeholder_paths = ts_placeholder_paths or set()

    def TSResolvePreviewPath(self, ts_preview_path: str) -> Path:
        return self.ts_base_path / ts_preview_path

    def TSIsPlaceholderPreview(self, ts_preview_path: str) -> bool:
        return ts_preview_path in self.ts_placeholder_paths


def TSBuildRow(**ts_overrides):
    ts_row = {
        "id": 42,
        "path": "D:/ComfyUI/output/cat.png",
        "type": "image",
        "filename": "cat.png",
        "extension": ".png",
        "size_bytes": 1234,
        "folder_path": "images",
        "preview_path": "",
        "hash": "hash-token",
        "mtime_ns": 111,
        "scope": "output",
        "root_id": "output",
        "width": 1024,
        "height": 768,
        "duration": None,
        "fps": None,
        "is_indexed": 1,
        "has_preview": 0,
        "has_metadata": 0,
        "workflow_text": "",
        "technical_json": "{}",
        "status": "ready",
    }
    ts_row.update(ts_overrides)
    return ts_row


class TSAssetPayloadTests(unittest.TestCase):
    def test_build_asset_card_preserves_video_urls_flags_and_technical_labels(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_base_path = Path(ts_temp_dir)
            ts_preview_path = Path("cache/thumb.webp")
            (ts_base_path / ts_preview_path).parent.mkdir(parents=True)
            (ts_base_path / ts_preview_path).write_text("preview", encoding="utf-8")
            ts_row = TSBuildRow(
                id=7,
                type="video",
                filename="clip.mov",
                extension=".mov",
                preview_path=str(ts_preview_path).replace("\\", "/"),
                technical_json='{"codec_name":"prores","audio_codec_name":"aac","audio_channels":2}',
                duration=12.5,
                fps=24,
                has_preview=1,
                has_metadata=1,
                workflow_text="{}",
            )
            ts_roots = {"output": {"root_id": "output", "allow_delete": True, "label": "Output"}}

            ts_card = TSBuildAssetCard(ts_row, ts_roots, TSFakePreviewCache(ts_base_path))

            self.assertEqual(ts_card["id"], 7)
            self.assertEqual(ts_card["preview_url"], "/asset_browser/preview/7?v=cache/thumb.webp")
            self.assertEqual(ts_card["file_url"], "/asset_browser/file?id=7&v=hash-token")
            self.assertFalse(ts_card["preview_is_placeholder"])
            self.assertFalse(ts_card["preview_is_3d_capture"])
            self.assertTrue(ts_card["allow_delete"])
            self.assertEqual(ts_card["root_label"], "Output")
            self.assertTrue(ts_card["has_workflow"])
            self.assertEqual(ts_card["codec_name"], "prores")
            self.assertEqual(ts_card["audio_codec_name"], "aac")
            self.assertEqual(ts_card["audio_channel_layout"], "Stereo")
            self.assertFalse(ts_card["detail_loaded"])

    def test_build_asset_card_uses_placeholder_token_when_preview_file_is_missing(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_row = TSBuildRow(id=9, preview_path="cache/missing.webp", hash="", mtime_ns=222, status="")

            ts_card = TSBuildAssetCard(ts_row, {}, TSFakePreviewCache(Path(ts_temp_dir)))

            self.assertEqual(ts_card["preview_url"], "/asset_browser/preview/9?v=placeholder-9")
            self.assertEqual(ts_card["file_url"], "/asset_browser/file?id=9&v=222")
            self.assertTrue(ts_card["preview_is_placeholder"])
            self.assertEqual(ts_card["root_label"], "output")
            self.assertEqual(ts_card["status"], "discovered")

    def test_build_native_3d_viewer_url_matches_comfy_view_endpoint(self) -> None:
        ts_row = TSBuildRow(
            type="3d",
            filename="My Model.glb",
            folder_path="3d/Sub Folder",
            root_id="input",
        )

        ts_url = TSBuildNative3DViewerURL(ts_row, {"root_id": "input"})

        self.assertEqual(ts_url, "/view?filename=My%20Model.glb&type=input&subfolder=3d/Sub%20Folder")

    def test_resolve_technical_info_merges_json_with_database_columns(self) -> None:
        ts_row = TSBuildRow(
            type="audio",
            extension=".wav",
            technical_json='{"codec_name":"pcm_s16le"}',
            duration=3.5,
            width=None,
            height=None,
            fps=None,
        )

        ts_info = TSResolveTechnicalInfo(ts_row)

        self.assertEqual(ts_info["codec_name"], "pcm_s16le")
        self.assertEqual(ts_info["duration"], 3.5)

    def test_resolve_technical_info_falls_back_to_lightweight_columns(self) -> None:
        ts_row = TSBuildRow(type="video", extension=".mp4", technical_json="", duration=2, width=1920, height=1080, fps=30)

        ts_info = TSResolveTechnicalInfo(ts_row)

        self.assertEqual(ts_info, {"kind": "video", "duration": 2, "width": 1920, "height": 1080, "fps": 30, "format_name": "MP4"})

    def test_format_channel_layout_matches_lightbox_labels(self) -> None:
        self.assertEqual(TSFormatChannelLayout(None), "")
        self.assertEqual(TSFormatChannelLayout(1), "Mono")
        self.assertEqual(TSFormatChannelLayout("2"), "Stereo")
        self.assertEqual(TSFormatChannelLayout(6), "6ch")


if __name__ == "__main__":
    unittest.main()
