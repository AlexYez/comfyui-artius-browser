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

    def test_common_video_codec_cases_extract_expected_fields(self) -> None:
        ts_cases = [
            (
                "h264",
                {
                    "format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2"},
                    "streams": [
                        {"codec_type": "video", "codec_name": "h264", "avg_frame_rate": "30000/1001"},
                        {"codec_type": "audio", "codec_name": "aac", "channels": "2"},
                    ],
                },
                ".mp4",
                {"codec_name": "h264", "audio_codec_name": "aac", "audio_channels": 2, "fps": 29.970029970},
            ),
            (
                "hevc",
                {
                    "format": {"format_name": "matroska,webm"},
                    "streams": [
                        {"codec_type": "video", "codec_name": "hevc", "r_frame_rate": "24/1"},
                    ],
                },
                ".mov",
                {"codec_name": "hevc", "audio_codec_name": "", "audio_channels": None, "fps": 24},
            ),
            (
                "prores_pcm",
                {
                    "format": {"format_long_name": "QuickTime / MOV"},
                    "streams": [
                        {"codec_type": "video", "codec_name": "prores", "avg_frame_rate": "25/1"},
                        {"codec_type": "audio", "codec_name": "pcm_s16le", "channels": "1"},
                    ],
                },
                ".mov",
                {"codec_name": "prores", "audio_codec_name": "pcm_s16le", "audio_channels": 1, "fps": 25},
            ),
        ]

        for ts_name, ts_payload, ts_extension, ts_expected in ts_cases:
            with self.subTest(ts_name=ts_name):
                ts_info = TSBuildVideoTechnicalInfo(ts_payload, ts_extension)

                self.assertEqual(ts_info["codec_name"], ts_expected["codec_name"])
                self.assertEqual(ts_info["audio_codec_name"], ts_expected["audio_codec_name"])
                self.assertEqual(ts_info["audio_channels"], ts_expected["audio_channels"])
                self.assertAlmostEqual(ts_info["fps"], ts_expected["fps"], places=6)

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

    def test_common_audio_codec_cases_extract_expected_fields(self) -> None:
        ts_cases = [
            (
                "aac_stereo",
                {
                    "format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2", "duration": "8.5"},
                    "streams": [{"codec_type": "audio", "codec_name": "aac", "sample_rate": "48000", "channels": "2"}],
                },
                ".m4a",
                {"codec_name": "aac", "sample_rate": 48000, "channels": 2, "duration": 8.5},
            ),
            (
                "pcm_s16le_mono",
                {
                    "format": {"format_name": "wav"},
                    "streams": [{"codec_type": "audio", "codec_name": "pcm_s16le", "sample_rate": "44100", "channels": "1"}],
                },
                ".wav",
                {"codec_name": "pcm_s16le", "sample_rate": 44100, "channels": 1, "duration": None},
            ),
        ]

        for ts_name, ts_payload, ts_extension, ts_expected in ts_cases:
            with self.subTest(ts_name=ts_name):
                ts_info = TSBuildAudioTechnicalInfo(ts_payload, ts_extension)

                self.assertEqual(ts_info["codec_name"], ts_expected["codec_name"])
                self.assertEqual(ts_info["sample_rate"], ts_expected["sample_rate"])
                self.assertEqual(ts_info["channels"], ts_expected["channels"])
                self.assertEqual(ts_info["duration"], ts_expected["duration"])

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
