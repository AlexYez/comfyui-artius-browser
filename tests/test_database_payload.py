from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_db_payload import TSBuildUpdatedAssetPayload, TSComputeAssetStatus, TSPayloadFromAssetRow


def TSBuildRow(**ts_overrides):
    ts_row = {
        "path": "D:/ComfyUI/output/image.png",
        "type": "image",
        "preview_path": "",
        "metadata": "",
        "technical_json": "",
        "mtime_ns": None,
        "hash": "",
        "folder_path": "sub",
        "duration": None,
        "width": 512,
        "height": 768,
        "fps": None,
        "size_bytes": None,
        "filename": "image.png",
        "extension": ".png",
        "scope": "",
        "root_id": "",
        "prompt_text": None,
        "workflow_text": None,
        "created_at": None,
        "is_indexed": 1,
        "has_preview": 0,
        "has_metadata": 1,
        "tags": None,
        "rating": None,
    }
    ts_row.update(ts_overrides)
    return ts_row


class TSDatabasePayloadTests(unittest.TestCase):
    def test_compute_asset_status_matches_database_states(self) -> None:
        self.assertEqual(TSComputeAssetStatus(False, False, False), "discovered")
        self.assertEqual(TSComputeAssetStatus(True, False, False), "indexed")
        self.assertEqual(TSComputeAssetStatus(True, True, False), "previewed")
        self.assertEqual(TSComputeAssetStatus(True, True, True), "metadata_ready")

    def test_payload_from_row_preserves_fields_and_defaults(self) -> None:
        ts_payload = TSPayloadFromAssetRow(TSBuildRow())

        self.assertEqual(ts_payload.ts_path, "D:/ComfyUI/output/image.png")
        self.assertEqual(ts_payload.ts_type, "image")
        self.assertEqual(ts_payload.ts_metadata, "{}")
        self.assertEqual(ts_payload.ts_technical_json, "{}")
        self.assertEqual(ts_payload.ts_scope, "output")
        self.assertEqual(ts_payload.ts_root_id, "output")
        self.assertEqual(ts_payload.ts_size_bytes, 0)
        self.assertEqual(ts_payload.ts_rating, 0)
        self.assertTrue(ts_payload.ts_is_indexed)
        self.assertFalse(ts_payload.ts_has_preview)
        self.assertTrue(ts_payload.ts_has_metadata)

    def test_build_updated_payload_applies_overrides(self) -> None:
        ts_payload = TSBuildUpdatedAssetPayload(
            TSBuildRow(),
            ts_preview_path="cache/image.webp",
            ts_has_preview=True,
        )

        self.assertEqual(ts_payload.ts_preview_path, "cache/image.webp")
        self.assertTrue(ts_payload.ts_has_preview)
        self.assertEqual(ts_payload.ts_filename, "image.png")


if __name__ == "__main__":
    unittest.main()
