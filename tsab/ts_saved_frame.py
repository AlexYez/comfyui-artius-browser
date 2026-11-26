from __future__ import annotations

import io
import itertools
import os
import tempfile
from pathlib import Path

from aiohttp import web
from PIL import Image


TS_FRAME_FOLDER = Path("Images", "Extracted-Frames")
TS_MAX_FRAME_UPLOAD = 64 * 1024 * 1024


def TSNormalizeBrowserFrame(ts_data: bytes) -> bytes:
    # Only persist decoded pixels. Uploaded metadata, extra chunks and
    # trailing bytes must never become library assets.
    try:
        with Image.open(io.BytesIO(ts_data), formats=["PNG"]) as ts_image:
            if ts_image.width * ts_image.height > 64_000_000 or ts_image.is_animated:
                raise ValueError("Unsupported frame dimensions or animation")
            ts_pixels = ts_image.convert("RGBA" if "A" in ts_image.getbands() or "transparency" in ts_image.info else "RGB")
            ts_pixels.info.clear()
            ts_out = io.BytesIO()
            ts_pixels.save(ts_out, format="PNG")
            return ts_out.getvalue()
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as ts_error:
        raise web.HTTPBadRequest(reason="Invalid PNG frame") from ts_error


def TSBrowserFrameNumber(ts_source: Path, ts_position: str | int, ts_hint: int) -> tuple[int, bool]:
    if ts_position in ("first", 0):
        return 0, False
    # ComfyUI ships PyAV independently of the ffmpeg executable. When the
    # container declares a frame count the last ordinal is an O(1) lookup.
    try:
        import av
        with av.open(str(ts_source), options={"protocol_whitelist": "file"}) as ts_media:
            ts_stream = next(s for s in ts_media.streams.video if not (s.disposition & av.stream.Disposition.attached_pic))
            if ts_position == "last" and ts_stream.frames > 0:
                return ts_stream.frames - 1, False
            ts_origin = ts_media.start_time or 0
            ts_index = -1
            for ts_frame in ts_media.decode(ts_stream):
                if isinstance(ts_position, int):
                    if ts_frame.pts is None:
                        break
                    if round(ts_frame.pts * ts_frame.time_base * 1_000_000) > ts_origin + ts_position:
                        return max(0, ts_index), False
                ts_index += 1
            else:
                if ts_index >= 0:
                    return ts_index, False
    except (ImportError, AttributeError, StopIteration, OSError, ValueError, EOFError):
        pass
    return ts_hint, True


def TSWriteLibraryFrame(ts_root: Path, ts_source: Path, ts_number: int, ts_png: bytes) -> Path:
    ts_dir = ts_root / TS_FRAME_FOLDER
    if not ts_dir.resolve().is_relative_to(ts_root.resolve()):
        raise web.HTTPForbidden(reason="Frame directory outside output")
    ts_dir.mkdir(parents=True, exist_ok=True)
    ts_stem = ts_source.stem.encode("utf-8")[:200].decode("utf-8", "ignore")
    ts_base = f"{ts_stem}_frame_{ts_number:06d}"
    ts_fd, ts_temp_name = tempfile.mkstemp(dir=ts_dir, suffix=".part")
    ts_partial = Path(ts_temp_name)
    try:
        with os.fdopen(ts_fd, "wb") as ts_temp:
            ts_temp.write(ts_png)
        for ts_copy in itertools.count(1):
            ts_name = ts_base if ts_copy == 1 else f"{ts_base}_{ts_copy}"
            ts_path = ts_dir / f"{ts_name}.png"
            try:
                # Exclusive reservation also protects dangling symlinks and
                # concurrent saves from other processes on this output root.
                ts_path.touch(exist_ok=False)
            except FileExistsError:
                continue
            try:
                os.replace(ts_partial, ts_path)
            except OSError:
                ts_path.unlink(missing_ok=True)
                raise
            return ts_path
    finally:
        ts_partial.unlink(missing_ok=True)
