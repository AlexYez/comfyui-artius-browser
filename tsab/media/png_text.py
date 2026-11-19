"""Read supported PNG text chunks without inflating image pixels."""
from __future__ import annotations

import struct
import zlib
from typing import BinaryIO


TS_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_TS_TEXT_LIMIT = 4 * 1024 * 1024
_TS_FILE_TEXT_BUDGET = 12 * 1024 * 1024


def _TSDecodeText(ts_kind: bytes, ts_body: bytes) -> bytes:
    if ts_kind == b"tEXt":
        return ts_body
    if ts_kind == b"zTXt":
        if ts_body[:1] != b"\0":
            return b""
        ts_body = ts_body[1:]
    else:
        ts_header = ts_body[:2]
        if ts_header not in (b"\0\0", b"\1\0"):
            return b""
        # Language tag and translated keyword precede the actual text.
        ts_fields = ts_body[2:].split(b"\0", 2)
        if len(ts_fields) != 3:
            return b""
        ts_body = ts_fields[2]
        if ts_header == b"\0\0":
            return ts_body
    ts_decoder = zlib.decompressobj()
    ts_text = ts_decoder.decompress(ts_body, _TS_TEXT_LIMIT + 1)
    return ts_text if ts_decoder.eof and len(ts_text) <= _TS_TEXT_LIMIT else b""


def TSReadPngText(ts_file: BinaryIO, ts_keys: frozenset[str]) -> dict[str, str]:
    """Read text before and after IDAT, skipping unrelated and oversized chunks."""
    ts_entries: dict[str, str] = {}
    ts_budget = _TS_FILE_TEXT_BUDGET
    # The caller already consumed the signature. Cap chunks as well as bytes
    # so a file with many tiny chunks cannot hold the indexing worker forever.
    for _ in range(65_536):
        ts_header = ts_file.read(8)
        if len(ts_header) != 8:
            break
        ts_size, ts_kind = struct.unpack(">I4s", ts_header)
        if ts_kind == b"IEND" or ts_size >= 2**31 or ts_budget <= 0:
            break
        ts_end = ts_file.tell() + ts_size
        if ts_kind in {b"tEXt", b"zTXt", b"iTXt"} and 0 < ts_size <= min(_TS_TEXT_LIMIT, ts_budget):
            ts_prefix = ts_file.read(min(80, ts_size))
            ts_key, ts_separator, _ = ts_prefix.partition(b"\0")
            ts_name = ts_key.decode("latin-1").lower()
            if ts_separator and ts_name in ts_keys:
                ts_chunk = ts_prefix + ts_file.read(ts_size - len(ts_prefix))
                ts_crc = ts_file.read(4)
                ts_budget -= ts_size
                if len(ts_crc) != 4:
                    break
                if zlib.crc32(ts_chunk, zlib.crc32(ts_kind)) == int.from_bytes(ts_crc, "big"):
                    try:
                        ts_text = _TSDecodeText(ts_kind, ts_chunk[len(ts_key) + 1:])
                    except zlib.error:
                        ts_text = b""
                    ts_budget -= len(ts_text)
                    if ts_text:
                        ts_encoding = "utf-8" if ts_kind == b"iTXt" else "latin-1"
                        ts_entries.setdefault(ts_name, ts_text.decode(ts_encoding, errors="replace"))
                continue
        ts_file.seek(ts_end + 4)
    return ts_entries
