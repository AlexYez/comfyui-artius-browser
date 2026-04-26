from __future__ import annotations

import pathlib
import shutil
import sys
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from tsab.ts_asset_technical import TSEnrichAudioTechnicalInfo, TSEnrichVideoTechnicalInfo
from tsab.ts_utils import TSJsonLoads

TS_TEST_TEMP_ROOT = pathlib.Path(__file__).resolve().parents[1] / ".codex_tmp_asset_technical_tests"


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
        self.ts_updated_payloads: list[dict[str, object]] = []

    def TSBuildUpdatedPayload(self, ts_row, **ts_updates):
        ts_payload = dict(ts_row)
        for ts_key, ts_value in ts_updates.items():
            if ts_key == "ts_technical_json":
                ts_payload["technical_json"] = ts_value
            elif ts_key == "ts_fps":
                ts_payload["fps"] = ts_value
            else:
                ts_payload[ts_key] = ts_value
        self.ts_updated_payloads.append(ts_payload)
        return ts_payload

    def TSUpsertAsset(self, ts_payload):
        return ts_payload


class TSFakeTools:
    def __init__(self, ts_probe: dict[str, object]) -> None:
        self.ts_probe = ts_probe
        self.ts_probe_paths: list[Path] = []

    def TSRunFFProbe(self, ts_source_path: Path):
        self.ts_probe_paths.append(ts_source_path)
        return self.ts_probe


def TSBuildRow(**ts_overrides):
    ts_row = {
        "type": "video",
        "path": "",
        "extension": ".mp4",
        "technical_json": "{}",
        "duration": None,
        "width": None,
        "height": None,
        "fps": None,
    }
    ts_row.update(ts_overrides)
    return ts_row


class TSAssetTechnicalTests(unittest.TestCase):
    def test_video_enrichment_skips_non_video_assets(self) -> None:
        ts_row = TSBuildRow(type="image")
        ts_database = TSFakeDatabase()
        ts_tools = TSFakeTools({})

        ts_updated_row, ts_info = TSEnrichVideoTechnicalInfo(ts_row, ts_database, ts_tools)

        self.assertIs(ts_updated_row, ts_row)
        self.assertEqual(ts_info["kind"], "image")
        self.assertEqual(ts_tools.ts_probe_paths, [])
        self.assertEqual(ts_database.ts_updated_payloads, [])

    def test_video_enrichment_skips_probe_when_codec_and_fps_are_present(self) -> None:
        ts_row = TSBuildRow(technical_json='{"codec_name":"h264","fps":30}')
        ts_database = TSFakeDatabase()
        ts_tools = TSFakeTools({})

        ts_updated_row, ts_info = TSEnrichVideoTechnicalInfo(ts_row, ts_database, ts_tools)

        self.assertIs(ts_updated_row, ts_row)
        self.assertEqual(ts_info["codec_name"], "h264")
        self.assertEqual(ts_info["fps"], 30)
        self.assertEqual(ts_tools.ts_probe_paths, [])
        self.assertEqual(ts_database.ts_updated_payloads, [])

    def test_video_enrichment_fills_missing_probe_fields_and_updates_database(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_source_path = Path(ts_temp_dir) / "clip.mov"
            ts_source_path.write_text("video", encoding="utf-8")
            ts_row = TSBuildRow(path=str(ts_source_path), extension=".mov")
            ts_database = TSFakeDatabase()
            ts_tools = TSFakeTools({
                "streams": [
                    {"codec_type": "video", "codec_name": "prores", "avg_frame_rate": "25/1"},
                    {"codec_type": "audio", "codec_name": "aac", "channels": "2"},
                ]
            })

            ts_updated_row, ts_info = TSEnrichVideoTechnicalInfo(ts_row, ts_database, ts_tools)

            self.assertEqual(ts_tools.ts_probe_paths, [ts_source_path])
            self.assertEqual(ts_info["codec_name"], "prores")
            self.assertEqual(ts_info["fps"], 25)
            self.assertEqual(ts_info["audio_codec_name"], "aac")
            self.assertEqual(ts_info["audio_channels"], 2)
            self.assertEqual(ts_updated_row["fps"], 25)
            self.assertEqual(TSJsonLoads(str(ts_updated_row["technical_json"]), {})["codec_name"], "prores")

    def test_audio_enrichment_fills_missing_probe_fields_and_updates_database(self) -> None:
        with TSTemporaryDirectory() as ts_temp_dir:
            ts_source_path = Path(ts_temp_dir) / "voice.wav"
            ts_source_path.write_text("audio", encoding="utf-8")
            ts_row = TSBuildRow(type="audio", path=str(ts_source_path), extension=".wav")
            ts_database = TSFakeDatabase()
            ts_tools = TSFakeTools({
                "streams": [
                    {"codec_type": "audio", "codec_name": "pcm_s16le", "channels": "1", "sample_rate": "48000"},
                ]
            })

            ts_updated_row, ts_info = TSEnrichAudioTechnicalInfo(ts_row, ts_database, ts_tools)

            self.assertEqual(ts_tools.ts_probe_paths, [ts_source_path])
            self.assertEqual(ts_info["codec_name"], "pcm_s16le")
            self.assertEqual(ts_info["channels"], 1)
            self.assertNotIn("sample_rate", ts_info)
            self.assertEqual(TSJsonLoads(str(ts_updated_row["technical_json"]), {})["channels"], 1)


if __name__ == "__main__":
    unittest.main()
