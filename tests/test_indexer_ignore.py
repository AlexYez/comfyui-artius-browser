from __future__ import annotations

import pathlib
import shutil
import sys
import unittest
import uuid
from contextlib import contextmanager

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_indexer import TSIndexer
from tsab.ts_types import TSRootDefinition

TS_TEST_TEMP_ROOT = pathlib.Path(__file__).resolve().parents[1] / ".codex_tmp_indexer_ignore_tests"


@contextmanager
def TSTemporaryDirectory():
    TS_TEST_TEMP_ROOT.mkdir(exist_ok=True)
    ts_temp_path = TS_TEST_TEMP_ROOT / uuid.uuid4().hex
    ts_temp_path.mkdir()
    try:
        yield ts_temp_path
    finally:
        shutil.rmtree(ts_temp_path, ignore_errors=True)


class TSFakeStoragePaths:
    def TSIgnorePathsForRoot(self, _ts_root):
        return []


class TSIndexerIgnoreTests(unittest.TestCase):
    def test_iter_asset_stats_skips_technical_storage_directories_anywhere_in_root(self) -> None:
        with TSTemporaryDirectory() as ts_root_path:
            (ts_root_path / "keep").mkdir()
            (ts_root_path / "keep" / "visible.png").write_text("image", encoding="utf-8")
            (ts_root_path / ".ts_artius_browser" / "video" / "output").mkdir(parents=True)
            (ts_root_path / ".ts_artius_browser" / "video" / "output" / "hidden.mp4").write_text("video", encoding="utf-8")
            (ts_root_path / "3d" / ".ts_artius_browser").mkdir(parents=True)
            (ts_root_path / "3d" / ".ts_artius_browser" / "hidden.glb").write_text("3d", encoding="utf-8")
            (ts_root_path / ".asset_browser").mkdir()
            (ts_root_path / ".asset_browser" / "legacy.png").write_text("legacy", encoding="utf-8")
            ts_indexer = object.__new__(TSIndexer)
            ts_indexer.ts_storage_paths = TSFakeStoragePaths()
            ts_root = TSRootDefinition(
                ts_root_id="input",
                ts_scope="input",
                ts_path=ts_root_path,
                ts_allow_delete=True,
                ts_label="Input",
            )

            ts_stats = list(ts_indexer._TSIterAssetStats(ts_root))

            self.assertEqual([ts_stat.ts_relative_path for ts_stat in ts_stats], ["keep/visible.png"])


if __name__ == "__main__":
    unittest.main()
