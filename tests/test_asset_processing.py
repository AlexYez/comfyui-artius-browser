from __future__ import annotations

import pathlib
import shutil
import sys
import threading
import unittest
import uuid
from contextlib import contextmanager
from dataclasses import replace

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_asset_processing import TSAssetProcessingService
from tsab.ts_types import TSAssetPayload, TSAssetStat, TSRootDefinition

TS_TEST_TEMP_ROOT = pathlib.Path(__file__).resolve().parents[1] / ".codex_tmp_asset_processing_tests"


@contextmanager
def TSTemporaryDirectory():
    TS_TEST_TEMP_ROOT.mkdir(exist_ok=True)
    ts_temp_path = TS_TEST_TEMP_ROOT / uuid.uuid4().hex
    ts_temp_path.mkdir()
    try:
        yield ts_temp_path
    finally:
        shutil.rmtree(ts_temp_path, ignore_errors=True)


def TSBuildRow(**ts_overrides):
    ts_row = {
        "id": 7,
        "path": "D:/missing.png",
        "type": "image",
        "filename": "missing.png",
        "extension": ".png",
        "preview_path": "placeholder-image.webp",
        "metadata": "{}",
        "technical_json": "{}",
        "mtime_ns": 0,
        "size_bytes": 0,
        "hash": "",
        "tags": "",
        "rating": 0,
        "created_at": 123,
        "folder_path": "",
        "duration": None,
        "width": None,
        "height": None,
        "fps": None,
        "scope": "output",
        "root_id": "output",
        "prompt_text": "",
        "workflow_text": "",
        "is_indexed": 0,
        "has_preview": 0,
        "has_metadata": 0,
        "status": "discovered",
    }
    ts_row.update(ts_overrides)
    return ts_row


class TSFakeDatabase:
    def __init__(self, ts_rows: list[dict[str, object]]) -> None:
        self.ts_rows = {int(ts_row["id"]): dict(ts_row) for ts_row in ts_rows}
        self.ts_deleted_ids: list[int] = []

    def TSGetAssetById(self, ts_asset_id: int):
        return self.ts_rows.get(ts_asset_id)

    def TSDeleteAssetIds(self, ts_asset_ids: list[int]) -> None:
        self.ts_deleted_ids.extend(ts_asset_ids)
        for ts_asset_id in ts_asset_ids:
            self.ts_rows.pop(ts_asset_id, None)

    def TSPayloadFromRow(self, ts_row) -> TSAssetPayload:
        return TSAssetPayload(
            ts_path=str(ts_row["path"]),
            ts_type=str(ts_row["type"]),
            ts_preview_path=str(ts_row["preview_path"] or ""),
            ts_metadata=str(ts_row["metadata"] or "{}"),
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
            ts_prompt_text=str(ts_row["prompt_text"] or ""),
            ts_workflow_text=str(ts_row["workflow_text"] or ""),
            ts_created_at=int(ts_row["created_at"] or 0),
            ts_is_indexed=bool(ts_row["is_indexed"]),
            ts_has_preview=bool(ts_row["has_preview"]),
            ts_has_metadata=bool(ts_row["has_metadata"]),
            ts_tags=str(ts_row["tags"] or ""),
            ts_rating=int(ts_row["rating"] or 0),
        )

    def TSBuildUpdatedPayload(self, ts_row, **ts_overrides) -> TSAssetPayload:
        return replace(self.TSPayloadFromRow(ts_row), **ts_overrides)

    def TSUpsertAsset(self, ts_payload: TSAssetPayload):
        ts_existing_id = next(
            (ts_asset_id for ts_asset_id, ts_row in self.ts_rows.items() if str(ts_row["path"]) == ts_payload.ts_path),
            max(self.ts_rows.keys(), default=0) + 1,
        )
        ts_row = TSBuildRow(
            id=ts_existing_id,
            path=ts_payload.ts_path,
            type=ts_payload.ts_type,
            filename=ts_payload.ts_filename,
            extension=ts_payload.ts_extension,
            preview_path=ts_payload.ts_preview_path,
            metadata=ts_payload.ts_metadata,
            technical_json=ts_payload.ts_technical_json,
            mtime_ns=ts_payload.ts_mtime_ns,
            size_bytes=ts_payload.ts_size_bytes,
            hash=ts_payload.ts_hash,
            tags=ts_payload.ts_tags,
            rating=ts_payload.ts_rating,
            created_at=ts_payload.ts_created_at,
            folder_path=ts_payload.ts_folder_path,
            duration=ts_payload.ts_duration,
            width=ts_payload.ts_width,
            height=ts_payload.ts_height,
            fps=ts_payload.ts_fps,
            scope=ts_payload.ts_scope,
            root_id=ts_payload.ts_root_id,
            prompt_text=ts_payload.ts_prompt_text,
            workflow_text=ts_payload.ts_workflow_text,
            is_indexed=1 if ts_payload.ts_is_indexed else 0,
            has_preview=1 if ts_payload.ts_has_preview else 0,
            has_metadata=1 if ts_payload.ts_has_metadata else 0,
        )
        self.ts_rows[ts_existing_id] = ts_row
        return ts_row


class TSFakePreviewCache:
    def __init__(self, ts_cache_root: pathlib.Path) -> None:
        self.ts_cache_root = ts_cache_root

    def TSResolvePreviewPath(self, ts_preview_path: str) -> pathlib.Path:
        return self.ts_cache_root / ts_preview_path

    def TSIsPlaceholderPreview(self, ts_preview_path: str) -> bool:
        return str(ts_preview_path or "").startswith("placeholder")


class TSFakeHandler:
    def __init__(self) -> None:
        self.ts_indexed_hashes: list[str] = []
        self.ts_preview_rows: list[int] = []
        self.ts_metadata_rows: list[int] = []

    def TSBuildIndexedPayload(self, ts_asset_stat: TSAssetStat, ts_asset_hash: str) -> TSAssetPayload:
        self.ts_indexed_hashes.append(ts_asset_hash)
        return TSAssetPayload(
            ts_path=str(ts_asset_stat.ts_path),
            ts_type="image",
            ts_preview_path="placeholder-image.webp",
            ts_metadata="{}",
            ts_technical_json="{}",
            ts_mtime_ns=ts_asset_stat.ts_mtime_ns,
            ts_hash=ts_asset_hash,
            ts_folder_path=ts_asset_stat.ts_folder_path,
            ts_size_bytes=ts_asset_stat.ts_size_bytes,
            ts_filename=ts_asset_stat.ts_filename,
            ts_extension=ts_asset_stat.ts_extension,
            ts_scope=ts_asset_stat.ts_root.ts_scope,
            ts_root_id=ts_asset_stat.ts_root.ts_root_id,
            ts_width=64,
            ts_height=32,
            ts_is_indexed=True,
            ts_has_preview=False,
            ts_has_metadata=False,
        )

    def TSGeneratePreview(self, ts_row) -> str:
        self.ts_preview_rows.append(int(ts_row["id"]))
        return "cache/generated.webp"

    def TSExtractMetadata(self, ts_row) -> dict[str, str]:
        self.ts_metadata_rows.append(int(ts_row["id"]))
        return {
            "metadata": '{"prompt_parts_version": 3, "positive_prompt_text": "fresh prompt"}',
            "prompt_text": "fresh prompt",
            "workflow_text": '{"nodes":[]}',
        }


class TSFakeHandlerRegistry:
    def __init__(self, ts_handler: TSFakeHandler | None = None) -> None:
        self.ts_handler = ts_handler or TSFakeHandler()
        self.ts_requests: list[tuple[str, str | None]] = []

    def TSResolveHandler(self, ts_extension: str, ts_kind: str | None):
        self.ts_requests.append((ts_extension, ts_kind))
        return self.ts_handler


def TSBuildAssetStatFromRow(ts_row) -> TSAssetStat:
    ts_path = pathlib.Path(str(ts_row["path"])).resolve()
    ts_stat = ts_path.stat()
    ts_root = TSRootDefinition(
        ts_root_id=str(ts_row["root_id"]),
        ts_scope=str(ts_row["scope"]),
        ts_path=ts_path.parent,
        ts_allow_delete=True,
        ts_label=str(ts_row["root_id"]),
    )
    return TSAssetStat(
        ts_path=ts_path,
        ts_root=ts_root,
        ts_relative_path=ts_path.name,
        ts_folder_path="",
        ts_filename=ts_path.name,
        ts_extension=ts_path.suffix.lower(),
        ts_size_bytes=int(ts_stat.st_size),
        ts_mtime_ns=int(getattr(ts_stat, "st_mtime_ns", int(ts_stat.st_mtime * 1000000000))),
        ts_ctime_ns=int(getattr(ts_stat, "st_ctime_ns", int(ts_stat.st_ctime * 1000000000))),
    )


def TSBuildService(ts_database: TSFakeDatabase, ts_preview_cache: TSFakePreviewCache, ts_registry: TSFakeHandlerRegistry, ts_events: list[int]):
    ts_locks: dict[int, threading.Lock] = {}
    return TSAssetProcessingService(
        ts_database=ts_database,
        ts_preview_cache=ts_preview_cache,
        ts_handler_registry=ts_registry,
        ts_build_asset_stat=TSBuildAssetStatFromRow,
        ts_get_asset_lock=lambda ts_asset_id: ts_locks.setdefault(ts_asset_id, threading.Lock()),
        ts_emit_asset_upsert=lambda ts_row: ts_events.append(int(ts_row["id"])),
        ts_compute_file_hash=lambda _ts_path: "hash-from-test",
    )


class TSAssetProcessingTests(unittest.TestCase):
    def test_warm_preview_reports_missing_ready_or_disabled(self) -> None:
        with TSTemporaryDirectory() as ts_temp_path:
            (ts_temp_path / "ready.webp").write_text("preview", encoding="utf-8")
            ts_database = TSFakeDatabase([TSBuildRow(id=7, has_preview=1, preview_path="ready.webp")])
            ts_service = TSBuildService(ts_database, TSFakePreviewCache(ts_temp_path), TSFakeHandlerRegistry(), [])

            self.assertEqual(ts_service.TSWarmPreview(99), {"queued": False, "reason": "missing"})
            self.assertEqual(ts_service.TSWarmPreview(7), {"queued": False, "reason": "ready"})
            ts_database.ts_rows[7]["has_preview"] = 0
            self.assertEqual(ts_service.TSWarmPreview(7), {"queued": False, "reason": "disabled"})

    def test_ensure_indexed_deletes_missing_file_rows(self) -> None:
        with TSTemporaryDirectory() as ts_temp_path:
            ts_database = TSFakeDatabase([TSBuildRow(id=7, path=str(ts_temp_path / "missing.png"))])
            ts_service = TSBuildService(ts_database, TSFakePreviewCache(ts_temp_path), TSFakeHandlerRegistry(), [])

            self.assertIsNone(ts_service.TSEnsureIndexed(ts_database.ts_rows[7]))
            self.assertEqual(ts_database.ts_deleted_ids, [7])

    def test_ensure_indexed_builds_index_payload_and_emits_upsert(self) -> None:
        with TSTemporaryDirectory() as ts_temp_path:
            ts_image_path = ts_temp_path / "fresh.png"
            ts_image_path.write_text("image", encoding="utf-8")
            ts_database = TSFakeDatabase([TSBuildRow(id=7, path=str(ts_image_path), filename="fresh.png", extension=".png")])
            ts_events: list[int] = []
            ts_handler = TSFakeHandler()
            ts_service = TSBuildService(ts_database, TSFakePreviewCache(ts_temp_path), TSFakeHandlerRegistry(ts_handler), ts_events)

            ts_row = ts_service.TSEnsureIndexed(ts_database.ts_rows[7])

            self.assertIsNotNone(ts_row)
            self.assertEqual(ts_row["hash"], "hash-from-test")
            self.assertEqual(ts_row["width"], 64)
            self.assertEqual(ts_row["height"], 32)
            self.assertEqual(ts_row["is_indexed"], 1)
            self.assertEqual(ts_row["has_preview"], 0)
            self.assertEqual(ts_events, [7])
            self.assertEqual(ts_handler.ts_indexed_hashes, ["hash-from-test"])

    def test_ensure_preview_generates_preview_after_indexing(self) -> None:
        with TSTemporaryDirectory() as ts_temp_path:
            ts_image_path = ts_temp_path / "fresh.png"
            ts_image_path.write_text("image", encoding="utf-8")
            ts_database = TSFakeDatabase([TSBuildRow(id=7, path=str(ts_image_path), filename="fresh.png", extension=".png")])
            ts_events: list[int] = []
            ts_handler = TSFakeHandler()
            ts_service = TSBuildService(ts_database, TSFakePreviewCache(ts_temp_path), TSFakeHandlerRegistry(ts_handler), ts_events)

            ts_row = ts_service.TSEnsurePreview(ts_database.ts_rows[7])

            self.assertEqual(ts_row["preview_path"], "cache/generated.webp")
            self.assertEqual(ts_row["has_preview"], 1)
            self.assertEqual(ts_handler.ts_preview_rows, [7])
            self.assertEqual(ts_events, [7, 7])

    def test_ensure_metadata_refreshes_old_image_prompt_metadata(self) -> None:
        with TSTemporaryDirectory() as ts_temp_path:
            ts_image_path = ts_temp_path / "fresh.png"
            ts_image_path.write_text("image", encoding="utf-8")
            ts_database = TSFakeDatabase([
                TSBuildRow(
                    id=7,
                    path=str(ts_image_path),
                    filename="fresh.png",
                    extension=".png",
                    is_indexed=1,
                    has_preview=1,
                    has_metadata=1,
                    metadata='{"prompt_parts_version": 2}',
                    preview_path="ready.webp",
                )
            ])
            (ts_temp_path / "ready.webp").write_text("preview", encoding="utf-8")
            ts_events: list[int] = []
            ts_handler = TSFakeHandler()
            ts_service = TSBuildService(ts_database, TSFakePreviewCache(ts_temp_path), TSFakeHandlerRegistry(ts_handler), ts_events)

            ts_row = ts_service.TSEnsureMetadata(ts_database.ts_rows[7])

            self.assertEqual(ts_row["prompt_text"], "fresh prompt")
            self.assertEqual(ts_row["workflow_text"], '{"nodes":[]}')
            self.assertEqual(ts_row["has_metadata"], 1)
            self.assertEqual(ts_handler.ts_metadata_rows, [7])
            self.assertEqual(ts_events, [7])


if __name__ == "__main__":
    unittest.main()
