from __future__ import annotations

import json
import pathlib
import shutil
import sys
import unittest
import uuid
from contextlib import contextmanager

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from PIL import Image
from PIL.PngImagePlugin import PngInfo

from tsab.media.image import TSImageHandler
from tsab.media.prompt_metadata import TSExtractPromptPartsFromPromptField
from tsab.ts_utils import TSJsonLoads

TS_TEST_TEMP_ROOT = pathlib.Path(__file__).resolve().parents[1] / ".codex_tmp_image_prompt_metadata_tests"


@contextmanager
def TSTemporaryDirectory():
    TS_TEST_TEMP_ROOT.mkdir(exist_ok=True)
    ts_temp_path = TS_TEST_TEMP_ROOT / uuid.uuid4().hex
    ts_temp_path.mkdir()
    try:
        yield ts_temp_path
    finally:
        shutil.rmtree(ts_temp_path, ignore_errors=True)


class TSImagePromptMetadataTests(unittest.TestCase):
    def TSParsePromptField(self, ts_payload) -> tuple[str, str]:
        ts_text = ts_payload if isinstance(ts_payload, str) else json.dumps(ts_payload)
        return TSExtractPromptPartsFromPromptField(ts_text)

    def test_plain_prompt_is_positive_only(self) -> None:
        ts_positive, ts_negative = self.TSParsePromptField("cinematic portrait, sunset")

        self.assertEqual(ts_positive, "cinematic portrait, sunset")
        self.assertEqual(ts_negative, "")

    def test_comfy_prompt_splits_positive_and_negative_references(self) -> None:
        ts_positive, ts_negative = self.TSParsePromptField(
            {
                "1": {
                    "class_type": "CLIPTextEncode",
                    "_meta": {"title": "Positive Prompt"},
                    "inputs": {"text": "bright meadow, cinematic light"},
                },
                "2": {
                    "class_type": "CLIPTextEncode",
                    "_meta": {"title": "Negative Prompt"},
                    "inputs": {"text": "low quality, blurry"},
                },
                "3": {
                    "class_type": "KSampler",
                    "inputs": {
                        "positive": ["1", 0],
                        "negative": ["2", 0],
                    },
                },
            }
        )

        self.assertEqual(ts_positive, "bright meadow, cinematic light")
        self.assertEqual(ts_negative, "low quality, blurry")

    def test_negative_prompt_is_not_used_as_positive_fallback(self) -> None:
        ts_positive, ts_negative = self.TSParsePromptField(
            {
                "1": {
                    "class_type": "CLIPTextEncode",
                    "_meta": {"title": "Negative Prompt"},
                    "inputs": {"text": "low quality, blurry"},
                },
                "2": {
                    "class_type": "CLIPTextEncode",
                    "inputs": {"text": "low quality, blurry"},
                },
            }
        )

        self.assertEqual(ts_positive, "")
        self.assertEqual(ts_negative, "low quality, blurry")

    def test_identical_positive_and_negative_hides_negative(self) -> None:
        ts_positive, ts_negative = self.TSParsePromptField(
            {
                "1": {
                    "class_type": "CLIPTextEncode",
                    "_meta": {"title": "Positive Prompt"},
                    "inputs": {"text": "same prompt"},
                },
                "2": {
                    "class_type": "CLIPTextEncode",
                    "_meta": {"title": "Negative Prompt"},
                    "inputs": {"text": "same prompt"},
                },
            }
        )

        self.assertEqual(ts_positive, "same prompt")
        self.assertEqual(ts_negative, "")

    def test_png_text_chunks_extract_comfy_prompt_and_workflow(self) -> None:
        ts_prompt_payload = {
            "1": {
                "class_type": "CLIPTextEncode",
                "_meta": {"title": "Positive Prompt"},
                "inputs": {"text": "Dramatic teal and orange cinematic light"},
            },
            "2": {
                "class_type": "CLIPTextEncode",
                "_meta": {"title": "Negative Prompt"},
                "inputs": {"text": "low quality, ugly, unfinished"},
            },
            "3": {
                "class_type": "KSampler",
                "inputs": {"positive": ["1", 0], "negative": ["2", 0]},
            },
        }
        ts_workflow_payload = {"nodes": [{"id": 1, "type": "KSampler"}]}
        with TSTemporaryDirectory() as ts_temp_path:
            ts_png_path = ts_temp_path / "ComfyUI_00010_.png"
            ts_png_info = PngInfo()
            ts_png_info.add_text("Prompt", json.dumps(ts_prompt_payload))
            ts_png_info.add_text("Workflow", json.dumps(ts_workflow_payload))
            Image.new("RGB", (8, 8), (12, 34, 56)).save(ts_png_path, pnginfo=ts_png_info)

            ts_metadata = TSImageHandler(None, None).TSExtractMetadata({"path": str(ts_png_path)})

        ts_metadata_payload = TSJsonLoads(ts_metadata["metadata"], {})
        self.assertEqual(ts_metadata["prompt_text"], "Dramatic teal and orange cinematic light")
        self.assertIn('"type": "KSampler"', ts_metadata["workflow_text"])
        self.assertTrue(ts_metadata["has_metadata"])
        self.assertEqual(ts_metadata_payload["positive_prompt_text"], "Dramatic teal and orange cinematic light")
        self.assertEqual(ts_metadata_payload["negative_prompt_text"], "low quality, ugly, unfinished")

    def test_png_lowercase_prompt_chunk_is_supported(self) -> None:
        with TSTemporaryDirectory() as ts_temp_path:
            ts_png_path = ts_temp_path / "lowercase_prompt.png"
            ts_png_info = PngInfo()
            ts_png_info.add_text("prompt", "simple lowercase prompt")
            Image.new("RGB", (8, 8), (12, 34, 56)).save(ts_png_path, pnginfo=ts_png_info)

            ts_metadata = TSImageHandler(None, None).TSExtractMetadata({"path": str(ts_png_path)})

        self.assertEqual(ts_metadata["prompt_text"], "simple lowercase prompt")
        self.assertEqual(TSJsonLoads(ts_metadata["metadata"], {})["negative_prompt_text"], "")


if __name__ == "__main__":
    unittest.main()
