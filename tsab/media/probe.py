from __future__ import annotations

from typing import Any

from ..ts_utils import TSParseMaybeFloat, TSParseMaybeInt


def TSGetProbeFormat(ts_probe: Any) -> dict[str, Any]:
    return ts_probe.get("format", {}) if isinstance(ts_probe, dict) and isinstance(ts_probe.get("format"), dict) else {}


def TSFindProbeStream(ts_probe: Any, ts_codec_type: str) -> dict[str, Any]:
    ts_streams = ts_probe.get("streams", []) if isinstance(ts_probe, dict) else []
    return next(
        (
            ts_stream
            for ts_stream in ts_streams
            if isinstance(ts_stream, dict) and ts_stream.get("codec_type") == ts_codec_type
        ),
        {},
    )


def TSParseFirstFloat(*ts_values: Any) -> float | None:
    # Candidates must be parsed one at a time. A plain `a or b` compares the RAW
    # ffprobe strings, and ffprobe writes the literal "0/0" for an unknown
    # avg_frame_rate - a truthy string that short-circuits the fallback and then
    # parses to None, so fps stayed permanently unknown for VFR/WebM sources.
    for ts_value in ts_values:
        ts_parsed = TSParseMaybeFloat(ts_value)
        if ts_parsed is not None:
            return ts_parsed
    return None


def TSParseFirstInt(*ts_values: Any) -> int | None:
    # Same rule as TSParseFirstFloat: parse each candidate before falling back.
    for ts_value in ts_values:
        ts_parsed = TSParseMaybeInt(ts_value)
        if ts_parsed is not None:
            return ts_parsed
    return None


def TSProbeCodecName(ts_stream: dict[str, Any]) -> str:
    return str(ts_stream.get("codec_name") or ts_stream.get("codec_tag_string") or "").strip()


def TSProbeFormatName(ts_probe_format: dict[str, Any], ts_extension: str) -> str:
    return str(
        ts_probe_format.get("format_long_name")
        or ts_probe_format.get("format_name")
        or str(ts_extension or "").lstrip(".").upper()
    )


def TSBuildVideoTechnicalInfo(ts_probe: Any, ts_extension: str) -> dict[str, Any]:
    ts_format = TSGetProbeFormat(ts_probe)
    ts_video_stream = TSFindProbeStream(ts_probe, "video")
    ts_audio_stream = TSFindProbeStream(ts_probe, "audio")
    ts_duration = TSParseFirstFloat(ts_format.get("duration"), ts_video_stream.get("duration"))
    return {
        "kind": "video",
        "format_name": TSProbeFormatName(ts_format, ts_extension),
        "codec_name": TSProbeCodecName(ts_video_stream),
        "audio_codec_name": TSProbeCodecName(ts_audio_stream),
        "audio_channels": TSParseMaybeInt(ts_audio_stream.get("channels")),
        "bit_rate": TSParseFirstInt(ts_format.get("bit_rate"), ts_video_stream.get("bit_rate")),
        "duration": ts_duration,
        "width": TSParseMaybeInt(ts_video_stream.get("width")),
        "height": TSParseMaybeInt(ts_video_stream.get("height")),
        "fps": TSParseFirstFloat(ts_video_stream.get("avg_frame_rate"), ts_video_stream.get("r_frame_rate")),
    }


def TSBuildAudioTechnicalInfo(ts_probe: Any, ts_extension: str) -> dict[str, Any]:
    ts_format = TSGetProbeFormat(ts_probe)
    ts_audio_stream = TSFindProbeStream(ts_probe, "audio")
    ts_duration = TSParseFirstFloat(ts_format.get("duration"), ts_audio_stream.get("duration"))
    return {
        "kind": "audio",
        "format_name": TSProbeFormatName(ts_format, ts_extension),
        "codec_name": TSProbeCodecName(ts_audio_stream),
        "bit_rate": TSParseFirstInt(ts_format.get("bit_rate"), ts_audio_stream.get("bit_rate")),
        "duration": ts_duration,
        "sample_rate": TSParseMaybeInt(ts_audio_stream.get("sample_rate")),
        "channels": TSParseMaybeInt(ts_audio_stream.get("channels")),
    }


def TSMergeMissingTechnicalFields(
    ts_current_technical: dict[str, Any],
    ts_probe_technical: dict[str, Any],
    ts_field_names: tuple[str, ...],
) -> tuple[dict[str, Any], bool]:
    ts_result = dict(ts_current_technical)
    ts_changed = False
    for ts_field_name in ts_field_names:
        ts_probe_value = ts_probe_technical.get(ts_field_name)
        if ts_probe_value and not ts_result.get(ts_field_name):
            ts_result[ts_field_name] = ts_probe_value
            ts_changed = True
    return ts_result, ts_changed


def TSMergeMissingVideoTechnicalInfo(
    ts_current_technical: dict[str, Any],
    ts_probe: Any,
    ts_extension: str,
) -> tuple[dict[str, Any], bool]:
    return TSMergeMissingTechnicalFields(
        ts_current_technical,
        TSBuildVideoTechnicalInfo(ts_probe, ts_extension),
        ("codec_name", "audio_codec_name", "audio_channels", "fps"),
    )


def TSMergeMissingAudioTechnicalInfo(
    ts_current_technical: dict[str, Any],
    ts_probe: Any,
    ts_extension: str,
) -> tuple[dict[str, Any], bool]:
    return TSMergeMissingTechnicalFields(
        ts_current_technical,
        TSBuildAudioTechnicalInfo(ts_probe, ts_extension),
        ("codec_name", "channels"),
    )
