from __future__ import annotations

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.media.prompt_metadata import TSExtractPromptPartsFromPromptField


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


if __name__ == "__main__":
    unittest.main()
