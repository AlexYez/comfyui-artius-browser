from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_ui_settings import TSApplyUISettingsUpdates, TSNormalizeUISettings


class TSUISettingsTests(unittest.TestCase):
    def test_normalize_ui_settings_filters_and_clamps_values(self) -> None:
        ts_ui = TSNormalizeUISettings({
            "browser_section": "bad-section",
            "asset_preview_size": 9999,
            "workflow_preview_size": 12,
            "asset_types": ["image", "bad", "video", 123],
            "selected_folder_path": "\\output\\images\\",
            "workflow_selected_folder_path": "/sub/folder/",
            "expanded_folders": ["root:output", "", None],
            "browser_width": 2000,
        })

        self.assertEqual(ts_ui["browser_section"], "assets")
        self.assertEqual(ts_ui["asset_preview_size"], 512)
        self.assertEqual(ts_ui["workflow_preview_size"], 48)
        self.assertEqual(ts_ui["asset_types"], ["image", "video"])
        self.assertEqual(ts_ui["selected_folder_path"], "output/images")
        self.assertEqual(ts_ui["workflow_selected_folder_path"], "sub/folder")
        self.assertEqual(ts_ui["expanded_folders"], ["root:output", "None"])
        self.assertEqual(ts_ui["browser_width"], 1600)

    def test_apply_ui_settings_updates_validates_section_specific_sorting(self) -> None:
        ts_ui = {}

        TSApplyUISettingsUpdates(ts_ui, {
            "browser_section": "workflows",
            "asset_view_mode": "tree",
            "workflow_view_mode": "flat",
            "asset_sort_key": "size_bytes",
            "workflow_sort_key": "size_bytes",
            "asset_sort_direction": "asc",
            "workflow_sort_direction": "sideways",
            "asset_search": "cat",
            "workflow_search": "render",
        })

        self.assertEqual(ts_ui["browser_section"], "workflows")
        self.assertEqual(ts_ui["asset_view_mode"], "tree")
        self.assertEqual(ts_ui["workflow_view_mode"], "flat")
        self.assertEqual(ts_ui["asset_sort_key"], "size_bytes")
        self.assertEqual(ts_ui["workflow_sort_key"], "created_at")
        self.assertEqual(ts_ui["asset_sort_direction"], "asc")
        self.assertEqual(ts_ui["workflow_sort_direction"], "desc")
        self.assertEqual(ts_ui["asset_search"], "cat")
        self.assertEqual(ts_ui["workflow_search"], "render")

    def test_apply_ui_settings_updates_preserves_existing_values_on_invalid_numbers(self) -> None:
        ts_ui = {
            "asset_preview_size": 160,
            "workflow_preview_size": 180,
            "browser_width": 420,
        }

        TSApplyUISettingsUpdates(ts_ui, {
            "asset_preview_size": "not-a-number",
            "workflow_preview_size": object(),
            "browser_width": object(),
        })

        self.assertEqual(ts_ui["asset_preview_size"], 160)
        self.assertEqual(ts_ui["workflow_preview_size"], 180)
        self.assertEqual(ts_ui["browser_width"], 420)

    def test_apply_ui_settings_updates_ignores_non_sequence_asset_types(self) -> None:
        ts_ui = {"asset_types": ["image"]}

        TSApplyUISettingsUpdates(ts_ui, {"asset_types": "video"})

        self.assertEqual(ts_ui["asset_types"], ["image"])


if __name__ == "__main__":
    unittest.main()
