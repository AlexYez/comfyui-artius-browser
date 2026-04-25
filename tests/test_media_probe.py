from __future__ import annotations

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.media.probe import (
    TSBuildAudioTechnicalInfo,
    TSBuildVideoTechnicalInfo,
    TSMergeMissingAudioTechnicalInfo,
    TSMergeMissingVideoTechnicalInfo,
)


class TSMediaProbeTests(unittest.TestCase):
    def test_video_technical_info_extracts_video_and_audio_fields(self) -> None:
        ts_payload = {
            "format": {
                "format_long_name": "QuickTime / MOV",
                "duration": "12.5",
                "bit_rate": "4200000",
            },
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "prores",
                    "width": "1920",
                    "height": "1080",
                    "avg_frame_rate": "24000/1001",
                },
                {
                    "codec_type": "audio",
                    "codec_name": "aac",
                    "channels": "2",
                },
            ],
        }

        ts_info = TSBuildVideoTechnicalInfo(ts_payload, ".mov")

        self.assertEqual(ts_info["kind"], "video")
        self.assertEqual(ts_info["format_name"], "QuickTime / MOV")
        self.assertEqual(ts_info["codec_name"], "prores")
        self.assertEqual(ts_info["audio_codec_name"], "aac")
        self.assertEqual(ts_info["audio_channels"], 2)
        self.assertEqual(ts_info["bit_rate"], 4200000)
        self.assertEqual(ts_info["duration"], 12.5)
        self.assertEqual(ts_info["width"], 1920)
        self.assertEqual(ts_info["height"], 1080)
        self.assertAlmostEqual(ts_info["fps"], 23.976023976, places=6)

    def test_audio_technical_info_extracts_audio_fields(self) -> None:
        ts_payload = {
            "format": {
                "format_name": "wav",
                "duration": "3.25",
                "bit_rate": "1411200",
            },
            "streams": [
                {
                    "codec_type": "audio",
                    "codec_name": "pcm_s16le",
                    "sample_rate": "44100",
                    "channels": "1",
                },
            ],
        }

        ts_info = TSBuildAudioTechnicalInfo(ts_payload, ".wav")

        self.assertEqual(ts_info["kind"], "audio")
        self.assertEqual(ts_info["format_name"], "wav")
        self.assertEqual(ts_info["codec_name"], "pcm_s16le")
        self.assertEqual(ts_info["bit_rate"], 1411200)
        self.assertEqual(ts_info["duration"], 3.25)
        self.assertEqual(ts_info["sample_rate"], 44100)
        self.assertEqual(ts_info["channels"], 1)

    def test_video_merge_fills_only_missing_lightbox_fields(self) -> None:
        ts_current = {"codec_name": "h264", "fps": 30}
        ts_probe = {
            "streams": [
                {"codec_type": "video", "codec_name": "prores", "avg_frame_rate": "25/1"},
                {"codec_type": "audio", "codec_name": "pcm_s16le", "channels": "2"},
            ],
        }

        ts_merged, ts_changed = TSMergeMissingVideoTechnicalInfo(ts_current, ts_probe, ".mov")

        self.assertTrue(ts_changed)
        self.assertEqual(ts_merged["codec_name"], "h264")
        self.assertEqual(ts_merged["fps"], 30)
        self.assertEqual(ts_merged["audio_codec_name"], "pcm_s16le")
        self.assertEqual(ts_merged["audio_channels"], 2)

    def test_audio_merge_preserves_existing_values(self) -> None:
        ts_current = {"codec_name": "aac", "channels": 2}
        ts_probe = {"streams": [{"codec_type": "audio", "codec_name": "pcm_s16le", "channels": "1"}]}

        ts_merged, ts_changed = TSMergeMissingAudioTechnicalInfo(ts_current, ts_probe, ".wav")

        self.assertFalse(ts_changed)
        self.assertEqual(ts_merged, ts_current)


if __name__ == "__main__":
    unittest.main()
