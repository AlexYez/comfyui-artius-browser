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


def TSReadMagicBytes(ts_path: Path, ts_size: int = 64) -> bytes:
    try:
        with ts_path.open("rb") as ts_file_handle:
            return ts_file_handle.read(ts_size)
    except OSError:
        return b""


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
    ts_extension = ts_path.suffix.lower()
    ts_type_by_extension = TSGuessTypeByExtension(ts_extension)
    if ts_type_by_extension is None:
        return None

    ts_magic = TSReadMagicBytes(ts_path)
    if not ts_magic:
        return ts_type_by_extension

    if ts_extension == ".png" and ts_magic.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image"
    if ts_extension in {".jpg", ".jpeg"} and ts_magic.startswith(b"\xff\xd8\xff"):
        return "image"
    if ts_extension == ".webp" and ts_magic[:4] == b"RIFF" and ts_magic[8:12] == b"WEBP":
        return "image"
    if ts_extension == ".avif" and ts_magic[4:8] == b"ftyp" and b"avif" in ts_magic[8:16]:
        return "image"
    if ts_extension in {".mp4", ".mov", ".prores"} and ts_magic[4:8] == b"ftyp":
        return "video"
    if ts_extension == ".webm" and ts_magic.startswith(b"\x1a\x45\xdf\xa3"):
        return "video"
    if ts_extension == ".wav" and ts_magic[:4] == b"RIFF" and ts_magic[8:12] == b"WAVE":
        return "audio"
    if ts_extension == ".flac" and ts_magic.startswith(b"fLaC"):
        return "audio"
    if ts_extension in {".ogg", ".opus"} and ts_magic.startswith(b"OggS"):
        return "audio"
    if ts_extension == ".mp3" and (ts_magic.startswith(b"ID3") or ts_magic[:2] == b"\xff\xfb"):
        return "audio"
    if ts_extension == ".glb" and ts_magic.startswith(b"glTF"):
        return "3d"
    if ts_extension == ".obj":
        return "3d"

    return ts_type_by_extension

