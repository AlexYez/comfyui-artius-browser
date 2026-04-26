from __future__ import annotations

import pathlib
import sys
import unittest
from dataclasses import replace

from aiohttp import web as TSWeb

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_3d_thumbnail import TSSave3DThumbnail
from tsab.ts_types import TSAssetPayload


def TSBuildRow(**ts_overrides):
    ts_row = {
        "id": 7,
        "path": "D:/ComfyUI/output/3d/model.glb",
        "type": "3d",
        "filename": "model.glb",
        "extension": ".glb",
        "size_bytes": 1234,
        "folder_path": "3d",
        "preview_path": "placeholder-3d.webp",
        "hash": "hash-token",
        "mtime_ns": 111,
        "scope": "output",
        "root_id": "output",
        "width": None,
        "height": None,
        "duration": None,
        "fps": None,
        "is_indexed": 1,
        "has_preview": 0,
        "has_metadata": 1,
        "workflow_text": "",
        "technical_json": "{}",
        "status": "ready",
    }
    ts_row.update(ts_overrides)
    return ts_row


class TSFakeDatabase:
    def __init__(self, ts_rows: list[dict[str, object]]) -> None:
        self.ts_rows = {int(ts_row["id"]): dict(ts_row) for ts_row in ts_rows}
        self.ts_upserted_payloads: list[TSAssetPayload] = []

    def TSGetAssetById(self, ts_asset_id: int):
        return self.ts_rows.get(ts_asset_id)

    def TSBuildUpdatedPayload(self, ts_row, **ts_overrides) -> TSAssetPayload:
        return replace(
            TSAssetPayload(
                ts_path=str(ts_row["path"]),
                ts_type=str(ts_row["type"]),
                ts_preview_path=str(ts_row["preview_path"] or ""),
                ts_metadata="{}",
                ts_technical_json=str(ts_row["technical_json"] or "{}"),
                ts_mtime_ns=int(ts_row["mtime_ns"] or 0),
                ts_hash=str(ts_row["hash"] or ""),
                ts_folder_path=str(ts_row["folder_path"] or ""),
                ts_duration=ts_row["duration"],
                ts_width=ts_row["width"],
                ts_height=ts_row["height"],
                ts_fps=ts_row["fps"],
                ts_size_bytes=int(ts_row["size_bytes"] or 0),
                ts_filename=str(ts_row["filename"] or ""),
                ts_extension=str(ts_row["extension"] or ""),
                ts_scope=str(ts_row["scope"] or "output"),
                ts_root_id=str(ts_row["root_id"] or "output"),
                ts_created_at=0,
                ts_is_indexed=bool(ts_row["is_indexed"]),
                ts_has_preview=bool(ts_row["has_preview"]),
                ts_has_metadata=bool(ts_row["has_metadata"]),
            ),
            **ts_overrides,
        )

    def TSUpsertAsset(self, ts_payload: TSAssetPayload):
        self.ts_upserted_payloads.append(ts_payload)
        ts_row = TSBuildRow(
            id=7,
            path=ts_payload.ts_path,
            type=ts_payload.ts_type,
            preview_path=ts_payload.ts_preview_path,
            has_preview=1 if ts_payload.ts_has_preview else 0,
            hash=ts_payload.ts_hash,
            folder_path=ts_payload.ts_folder_path,
            filename=ts_payload.ts_filename,
            extension=ts_payload.ts_extension,
            scope=ts_payload.ts_scope,
            root_id=ts_payload.ts_root_id,
        )
        self.ts_rows[7] = ts_row
        return ts_row


class TSFakePreviewCache:
    def __init__(self, ts_persisted_path: str) -> None:
        self.ts_persisted_path = ts_persisted_path
        self.ts_preview_key_inputs: list[tuple[str, pathlib.Path]] = []
        self.ts_capture_inputs: list[tuple[str, str]] = []
        self.ts_existing_paths: set[str] = set()

    def TSBuildAssetPreviewKey(self, ts_asset_hash: str, ts_source_path: pathlib.Path) -> str:
        self.ts_preview_key_inputs.append((ts_asset_hash, ts_source_path))
        return "preview-key"

    def TSPersist3DCapturePreview(self, ts_preview_key: str, ts_image_data_url: str) -> str:
        self.ts_capture_inputs.append((ts_preview_key, ts_image_data_url))
        if self.ts_persisted_path:
            self.ts_existing_paths.add(self.ts_persisted_path)
        return self.ts_persisted_path

    def TSResolvePreviewPath(self, ts_preview_path: str) -> pathlib.Path:
        class TSFakeResolvedPath:
            def exists(self) -> bool:
                return ts_preview_path in self.ts_existing_paths

        ts_resolved_path = TSFakeResolvedPath()
        ts_resolved_path.ts_existing_paths = self.ts_existing_paths
        return ts_resolved_path

    def TSIsPlaceholderPreview(self, _ts_preview_path: str) -> bool:
        return False


class TS3DThumbnailTests(unittest.TestCase):
    def test_save_3d_thumbnail_rejects_missing_asset(self) -> None:
        with self.assertRaises(TSWeb.HTTPNotFound):
            TSSave3DThumbnail(
                ts_asset_id=404,
                ts_image_data_url="data:image/png;base64,abc",
                ts_database=TSFakeDatabase([]),
                ts_preview_cache=TSFakePreviewCache("cache/model.3d.webp"),
                ts_get_roots=lambda: [],
                ts_emit_asset_upsert=lambda _ts_row: None,
            )

    def test_save_3d_thumbnail_rejects_non_3d_asset(self) -> None:
        with self.assertRaises(TSWeb.HTTPBadRequest):
            TSSave3DThumbnail(
                ts_asset_id=7,
                ts_image_data_url="data:image/png;base64,abc",
                ts_database=TSFakeDatabase([TSBuildRow(type="image")]),
                ts_preview_cache=TSFakePreviewCache("cache/model.3d.webp"),
                ts_get_roots=lambda: [],
                ts_emit_asset_upsert=lambda _ts_row: None,
            )

    def test_save_3d_thumbnail_rejects_invalid_capture_payload(self) -> None:
        with self.assertRaises(TSWeb.HTTPBadRequest):
            TSSave3DThumbnail(
                ts_asset_id=7,
                ts_image_data_url="bad-data",
                ts_database=TSFakeDatabase([TSBuildRow()]),
                ts_preview_cache=TSFakePreviewCache(""),
                ts_get_roots=lambda: [],
                ts_emit_asset_upsert=lambda _ts_row: None,
            )

    def test_save_3d_thumbnail_persists_preview_updates_row_and_returns_card(self) -> None:
        ts_database = TSFakeDatabase([TSBuildRow()])
        ts_preview_cache = TSFakePreviewCache("cache/model.3d.webp")
        ts_events: list[int] = []

        ts_card = TSSave3DThumbnail(
            ts_asset_id=7,
            ts_image_data_url="data:image/png;base64,abc",
            ts_database=ts_database,
            ts_preview_cache=ts_preview_cache,
            ts_get_roots=lambda: [{"root_id": "output", "label": "Output", "allow_delete": True}],
            ts_emit_asset_upsert=lambda ts_row: ts_events.append(int(ts_row["id"])),
        )

        self.assertEqual(ts_preview_cache.ts_preview_key_inputs, [("hash-token", pathlib.Path("D:/ComfyUI/output/3d/model.glb"))])
        self.assertEqual(ts_preview_cache.ts_capture_inputs, [("preview-key", "data:image/png;base64,abc")])
        self.assertEqual(ts_database.ts_upserted_payloads[0].ts_preview_path, "cache/model.3d.webp")
        self.assertTrue(ts_database.ts_upserted_payloads[0].ts_has_preview)
        self.assertEqual(ts_events, [7])
        self.assertEqual(ts_card["preview_url"], "/asset_browser/preview/7?v=cache/model.3d.webp")
        self.assertEqual(ts_card["viewer_3d_url"], "/view?filename=model.glb&type=output&subfolder=3d")
        self.assertFalse(ts_card["preview_is_placeholder"])
        self.assertTrue(ts_card["preview_is_3d_capture"])


if __name__ == "__main__":
    unittest.main()
