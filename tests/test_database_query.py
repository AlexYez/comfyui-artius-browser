from __future__ import annotations

import pathlib
import shutil
import sys
import unittest
import uuid
from contextlib import contextmanager

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_db import TSDatabase
from tsab.ts_types import TSAssetPayload

TS_TEST_TEMP_ROOT = pathlib.Path(__file__).resolve().parents[1] / ".codex_tmp_database_query_tests"


@contextmanager
def TSTemporaryDirectory():
    TS_TEST_TEMP_ROOT.mkdir(exist_ok=True)
    ts_temp_path = TS_TEST_TEMP_ROOT / uuid.uuid4().hex
    ts_temp_path.mkdir()
    try:
        yield ts_temp_path
    finally:
        shutil.rmtree(ts_temp_path, ignore_errors=True)


def TSAsset(
    ts_filename: str,
    ts_type: str,
    ts_folder_path: str,
    *,
    ts_root_id: str = "output",
    ts_scope: str = "output",
    ts_created_at: int = 100,
    ts_size_bytes: int = 1000,
    ts_mtime_ns: int = 1000,
    ts_width: int | None = None,
    ts_height: int | None = None,
    ts_rating: int = 0,
) -> TSAssetPayload:
    ts_extension = pathlib.Path(ts_filename).suffix.lower()
    ts_path = f"D:/ComfyUI/{ts_root_id}/{ts_folder_path}/{ts_filename}".replace("//", "/")
    return TSAssetPayload(
        ts_path=ts_path,
        ts_type=ts_type,
        ts_folder_path=ts_folder_path,
        ts_size_bytes=ts_size_bytes,
        ts_filename=ts_filename,
        ts_extension=ts_extension,
        ts_scope=ts_scope,
        ts_root_id=ts_root_id,
        ts_created_at=ts_created_at,
        ts_mtime_ns=ts_mtime_ns,
        ts_width=ts_width,
        ts_height=ts_height,
        ts_rating=ts_rating,
        ts_is_indexed=True,
        ts_has_preview=True,
        ts_has_metadata=True,
    )


class TSDatabaseQueryTests(unittest.TestCase):
    def TSBuildDatabase(self) -> TSDatabase:
        self.ts_temp_context = TSTemporaryDirectory()
        self.ts_temp_path = self.ts_temp_context.__enter__()
        self.addCleanup(self.ts_temp_context.__exit__, None, None, None)
        ts_database = TSDatabase(self.ts_temp_path / "db.sqlite")
        ts_database.TSUpsertAssets([
            TSAsset("alpha cat.png", "image", "images/cats", ts_created_at=10, ts_size_bytes=100, ts_width=512, ts_height=512, ts_rating=2),
            TSAsset("beta dog.png", "image", "images/dogs", ts_created_at=20, ts_size_bytes=300, ts_width=768, ts_height=512, ts_rating=4),
            TSAsset("cat movie.mp4", "video", "video/cats", ts_created_at=30, ts_size_bytes=900, ts_mtime_ns=3000),
            TSAsset("ambient loop.wav", "audio", "audio/music", ts_created_at=40, ts_size_bytes=500, ts_mtime_ns=4000),
            TSAsset("robot model.glb", "3d", "3d/models", ts_created_at=50, ts_size_bytes=700, ts_mtime_ns=5000),
            TSAsset("input sketch.png", "image", "sketches", ts_root_id="input", ts_scope="input", ts_created_at=60, ts_size_bytes=50),
        ])
        return ts_database

    def test_flat_query_filters_by_type_root_folder_and_search(self) -> None:
        ts_database = self.TSBuildDatabase()

        ts_rows, ts_has_more = ts_database.TSQueryAssetsPage(
            ts_search_text="cat",
            ts_filters={
                "types": ["image"],
                "root_ids": ["output"],
                "folder": "images",
                "sort_key": "filename",
                "sort_direction": "asc",
            },
            ts_offset=0,
            ts_limit=10,
        )

        self.assertFalse(ts_has_more)
        self.assertEqual([ts_row["filename"] for ts_row in ts_rows], ["alpha cat.png"])

    def test_flat_query_sorting_and_pagination_are_stable(self) -> None:
        ts_database = self.TSBuildDatabase()

        ts_first_page, ts_has_more = ts_database.TSQueryAssetsPage(
            ts_filters={"root_ids": ["output"], "sort_key": "size_bytes", "sort_direction": "desc"},
            ts_offset=0,
            ts_limit=2,
        )
        ts_second_page, ts_second_has_more = ts_database.TSQueryAssetsPage(
            ts_filters={"root_ids": ["output"], "sort_key": "size_bytes", "sort_direction": "desc"},
            ts_offset=2,
            ts_limit=3,
        )

        self.assertTrue(ts_has_more)
        self.assertFalse(ts_second_has_more)
        self.assertEqual([ts_row["filename"] for ts_row in ts_first_page], ["cat movie.mp4", "robot model.glb"])
        self.assertEqual([ts_row["filename"] for ts_row in ts_second_page], ["ambient loop.wav", "beta dog.png", "alpha cat.png"])

    def test_flat_query_supports_dimension_rating_and_scope_filters(self) -> None:
        ts_database = self.TSBuildDatabase()

        ts_rows, ts_has_more = ts_database.TSQueryAssetsPage(
            ts_filters={
                "types": ["image"],
                "scopes": ["output"],
                "min_width": 700,
                "max_height": 600,
                "min_rating": 3,
                "sort_key": "created_at",
                "sort_direction": "asc",
            },
            ts_offset=0,
            ts_limit=10,
        )

        self.assertFalse(ts_has_more)
        self.assertEqual([ts_row["filename"] for ts_row in ts_rows], ["beta dog.png"])

    def test_tree_folder_listing_counts_leaf_folders_per_root(self) -> None:
        ts_database = self.TSBuildDatabase()

        ts_output_folders = ts_database.TSListFolders(ts_scope="output", ts_root_id="output")
        ts_input_folders = ts_database.TSListFolders(ts_scope="input", ts_root_id="input")

        self.assertEqual(
            [(ts_folder["folder_path"], ts_folder["asset_count"]) for ts_folder in ts_output_folders],
            [
                ("3d/models", 1),
                ("audio/music", 1),
                ("images/cats", 1),
                ("images/dogs", 1),
                ("video/cats", 1),
            ],
        )
        self.assertEqual(
            [(ts_folder["folder_path"], ts_folder["asset_count"]) for ts_folder in ts_input_folders],
            [("sketches", 1)],
        )


if __name__ == "__main__":
    unittest.main()
