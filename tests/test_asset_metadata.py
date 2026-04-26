from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_asset_metadata import (
    TSResolveAssetNegativePromptText,
    TSResolveAssetPromptText,
    TSResolveAssetWorkflowText,
)


def TSBuildRow(**ts_overrides):
    ts_row = {
        "metadata": "{}",
        "prompt_text": "",
        "workflow_text": "",
    }
    ts_row.update(ts_overrides)
    return ts_row


class TSAssetMetadataTests(unittest.TestCase):
    def test_positive_prompt_from_structured_metadata_wins_over_row_prompt(self) -> None:
        ts_row = TSBuildRow(
            metadata='{"positive_prompt_text":"metadata positive","negative_prompt_text":"metadata negative"}',
            prompt_text="row prompt",
        )

        self.assertEqual(TSResolveAssetPromptText(ts_row), "metadata positive")
        self.assertEqual(TSResolveAssetNegativePromptText(ts_row), "metadata negative")

    def test_row_prompt_is_used_when_structured_positive_prompt_is_missing(self) -> None:
        ts_row = TSBuildRow(metadata='{"negative_prompt_text":"metadata negative"}', prompt_text="row prompt")

        self.assertEqual(TSResolveAssetPromptText(ts_row), "row prompt")
        self.assertEqual(TSResolveAssetNegativePromptText(ts_row), "metadata negative")

    def test_prompt_can_fall_back_to_generic_metadata_prompt_field(self) -> None:
        ts_row = TSBuildRow(metadata='{"Prompt":"metadata prompt"}')

        self.assertEqual(TSResolveAssetPromptText(ts_row), "metadata prompt")

    def test_workflow_text_from_row_wins_over_metadata_workflow(self) -> None:
        ts_row = TSBuildRow(metadata='{"Workflow":"metadata workflow"}', workflow_text="row workflow")

        self.assertEqual(TSResolveAssetWorkflowText(ts_row), "row workflow")

    def test_workflow_text_can_fall_back_to_metadata_workflow(self) -> None:
        ts_row = TSBuildRow(metadata='{"Workflow":"metadata workflow"}')

        self.assertEqual(TSResolveAssetWorkflowText(ts_row), "metadata workflow")

    def test_negative_prompt_requires_dict_metadata(self) -> None:
        ts_row = TSBuildRow(metadata='["not", "a", "dict"]')

        self.assertEqual(TSResolveAssetNegativePromptText(ts_row), "")


if __name__ == "__main__":
    unittest.main()
