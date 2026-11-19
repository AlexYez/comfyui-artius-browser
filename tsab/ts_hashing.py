from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Literal

from .ts_settings import (
    TS_3D_EXTENSIONS,
    TS_AUDIO_EXTENSIONS,
    TS_IMAGE_EXTENSIONS,
    TS_VIDEO_EXTENSIONS,
)

try:
    from blake3 import blake3 as TSBlake3Factory
except ImportError:
    TSBlake3Factory = None
    logging.getLogger("TSArtiusBrowser").warning(
        "blake3 not installed; falling back to slower blake2b for asset hashing. "
        "Install with: pip install blake3"
    )


def TSComputeFileHash(ts_path: Path, ts_chunk_size: int = 1024 * 1024) -> str:
    ts_hasher = TSBlake3Factory() if TSBlake3Factory is not None else hashlib.blake2b(digest_size=32)
    with ts_path.open("rb") as ts_file_handle:
        while True:
            ts_chunk = ts_file_handle.read(ts_chunk_size)
            if not ts_chunk:
                break
            ts_hasher.update(ts_chunk)
    return ts_hasher.hexdigest()


def TSGuessTypeByExtension(ts_extension: str) -> Literal["image", "video", "audio", "3d"] | None:
    ts_extension = ts_extension.lower()
    if ts_extension in TS_IMAGE_EXTENSIONS:
        return "image"
    if ts_extension in TS_VIDEO_EXTENSIONS:
        return "video"
    if ts_extension in TS_AUDIO_EXTENSIONS:
        return "audio"
    if ts_extension in TS_3D_EXTENSIONS:
        return "3d"
    return None


def TSDetectSupportedType(ts_path: Path) -> Literal["image", "video", "audio", "3d"] | None:
    return TSGuessTypeByExtension(ts_path.suffix)
