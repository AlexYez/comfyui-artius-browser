from __future__ import annotations

import pathlib
import shutil
import sys
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path

from aiohttp import web as TSWeb

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_delete import TSDeleteService

TS_TEST_TEMP_ROOT = pathlib.Path(__file__).resolve().parents[1] / ".codex_tmp_delete_tests"


@contextmanager
def TSTemporaryDirectory():
    TS_TEST_TEMP_ROOT.mkdir(exist_ok=True)
    ts_temp_path = TS_TEST_TEMP_ROOT / uuid.uuid4().hex
    ts_temp_path.mkdir()
    try:
        yield str(ts_temp_path)
    finally:
        shutil.rmtree(ts_temp_path, ignore_errors=True)


class TSFakeDatabase:
    def __init__(self) -> None:
        self.ts_rows: dict[int, dict[str, object]] = {}
        self.ts_preview_refs: dict[tuple[str, int], int] = {}
        self.ts_deleted_ids: list[int] = []

    def TSGetAssetById(self, ts_asset_id: int):
        return self.ts_rows.get(ts_asset_id)

    def TSCountPreviewReferences(self, ts_preview_path: str, ts_asset_id: int) -> int:
        return self.ts_preview_refs.get((ts_preview_path, ts_asset_id), 0)

    def TSDeleteAssetIds(self, ts_asset_ids: list[int]) -> None:
        self.ts_deleted_ids.extend(ts_asset_ids)
        for ts_asset_id in ts_asset_ids:
            self.ts_rows.pop(ts_asset_id, None)


class TSFakePreviewCache:
    def __init__(self) -> None:
        self.ts_purged_paths: list[str] = []

    def TSPurgePreview(self, ts_preview_path: str) -> None:
        self.ts_purged_paths.append(ts_preview_path)


class TSDeleteServiceTests(unittest.TestCase):
    def _TSBuildService(self, ts_roots: list[dict[str, object]]):
        ts_database = TSFakeDatabase()
        ts_cache = TSFakePreviewCache()
        ts_events: list[tuple[str, dict[str, object]]] = []
        ts_trashed_paths: list[str] = []
        ts_service = TSDeleteService(
            ts_database=ts_database,
            ts_preview_cache=ts_cache,
            ts_get_roots=lambda: ts_roots,
            ts_emit_event=lambda ts_name, ts_payload: ts_events.append((ts_name, ts_payload)),
            ts_send_to_trash=lambda ts_path: ts_trashed_paths.append(ts_path),
        )
        return ts_service, ts_database, ts_cache, ts_events, ts_trashed_paths

    def test_delete_asset_trashes_file_purges_preview_and_emits_event(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_root_path = Path(ts_temp_dir) / "output"
            ts_root_path.mkdir()
            ts_file_path = ts_root_path / "image.png"
            ts_file_path.write_text("asset", encoding="utf-8")
            ts_service, ts_database, ts_cache, ts_events, ts_trashed_paths = self._TSBuildService([
                {"root_id": "output", "path": str(ts_root_path), "allow_delete": True}
            ])
            ts_database.ts_rows[7] = {
                "root_id": "output",
                "path": str(ts_file_path),
                "preview_path": "cache/thumb.webp",
            }

            ts_result = ts_service.TSDeleteAssets([7])

            self.assertEqual(ts_result, {"deleted": [7], "skipped": []})
            self.assertEqual(ts_trashed_paths, [str(ts_file_path)])
            self.assertEqual(ts_cache.ts_purged_paths, ["cache/thumb.webp"])
            self.assertEqual(ts_database.ts_deleted_ids, [7])
            self.assertEqual(ts_events, [("tsab:asset-remove", {"id": 7, "path": str(ts_file_path)})])

    def test_delete_asset_skips_files_outside_root(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_root_path = Path(ts_temp_dir) / "output"
            ts_root_path.mkdir()
            ts_outside_path = Path(ts_temp_dir) / "outside.png"
            ts_outside_path.write_text("asset", encoding="utf-8")
            ts_service, ts_database, _ts_cache, _ts_events, ts_trashed_paths = self._TSBuildService([
                {"root_id": "output", "path": str(ts_root_path), "allow_delete": True}
            ])
            ts_database.ts_rows[7] = {
                "root_id": "output",
                "path": str(ts_outside_path),
                "preview_path": "cache/thumb.webp",
            }

            ts_result = ts_service.TSDeleteAssets([7])

            self.assertEqual(ts_result, {"deleted": [], "skipped": [7]})
            self.assertEqual(ts_trashed_paths, [])
            self.assertEqual(ts_database.ts_deleted_ids, [])

    def test_delete_asset_skips_roots_without_delete_permission(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_root_path = Path(ts_temp_dir) / "input"
            ts_root_path.mkdir()
            ts_file_path = ts_root_path / "image.png"
            ts_file_path.write_text("asset", encoding="utf-8")
            ts_service, ts_database, _ts_cache, _ts_events, ts_trashed_paths = self._TSBuildService([
                {"root_id": "input", "path": str(ts_root_path), "allow_delete": False}
            ])
            ts_database.ts_rows[9] = {
                "root_id": "input",
                "path": str(ts_file_path),
                "preview_path": "cache/thumb.webp",
            }

            ts_result = ts_service.TSDeleteAssets([9])

            self.assertEqual(ts_result, {"deleted": [], "skipped": [9]})
            self.assertEqual(ts_trashed_paths, [])
            self.assertEqual(ts_database.ts_deleted_ids, [])

    def test_delete_asset_keeps_shared_preview_cache_file(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_root_path = Path(ts_temp_dir) / "output"
            ts_root_path.mkdir()
            ts_file_path = ts_root_path / "image.png"
            ts_file_path.write_text("asset", encoding="utf-8")
            ts_service, ts_database, ts_cache, _ts_events, _ts_trashed_paths = self._TSBuildService([
                {"root_id": "output", "path": str(ts_root_path), "allow_delete": True}
            ])
            ts_database.ts_rows[7] = {
                "root_id": "output",
                "path": str(ts_file_path),
                "preview_path": "cache/shared.webp",
            }
            ts_database.ts_preview_refs[("cache/shared.webp", 7)] = 1

            ts_result = ts_service.TSDeleteAssets([7])

            self.assertEqual(ts_result, {"deleted": [7], "skipped": []})
            self.assertEqual(ts_cache.ts_purged_paths, [])

    def test_delete_workflow_trashes_json_and_matching_preview_sidecars(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_workflow_path = Path(ts_temp_dir) / "Live Portrait Video.json"
            ts_workflow_path.write_text("{}", encoding="utf-8")
            (Path(ts_temp_dir) / "Live Portrait Video.webp").write_text("preview", encoding="utf-8")
            (Path(ts_temp_dir) / "Live Portrait Video.mp4").write_text("preview", encoding="utf-8")
            (Path(ts_temp_dir) / "Live Portrait Video.txt").write_text("not preview", encoding="utf-8")
            (Path(ts_temp_dir) / "Other.webp").write_text("other", encoding="utf-8")
            ts_service, _ts_database, _ts_cache, _ts_events, ts_trashed_paths = self._TSBuildService([])

            ts_result = ts_service.TSDeleteWorkflowFile(ts_workflow_path)

            self.assertEqual(ts_result, {"deleted": ["Live Portrait Video.json", "Live Portrait Video.mp4", "Live Portrait Video.webp"]})
            self.assertEqual([Path(ts_path).name for ts_path in ts_trashed_paths], ts_result["deleted"])

    def test_delete_workflow_missing_file_raises_not_found(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_service, _ts_database, _ts_cache, _ts_events, _ts_trashed_paths = self._TSBuildService([])

            with self.assertRaises(TSWeb.HTTPNotFound):
                ts_service.TSDeleteWorkflowFile(Path(ts_temp_dir) / "missing.json")


if __name__ == "__main__":
    unittest.main()
