from __future__ import annotations

import hashlib
import os
import shutil
from pathlib import Path
from typing import Any

from aiohttp import web as TSWeb

from .ts_logging import TSLogVerbose
from .ts_utils import TSNormalizePathString

TS_TEXTURE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tga"}
TS_MTL_TEXTURE_KEYWORDS = {"map_Kd", "map_Ka", "map_d", "map_bump", "bump"}


def _TSUniquePaths(ts_paths: list[Path]) -> list[Path]:
    ts_unique_paths: list[Path] = []
    ts_seen = set()
    for ts_path in ts_paths:
        ts_key = str(ts_path.resolve()).lower()
        if ts_key in ts_seen:
            continue
        ts_seen.add(ts_key)
        ts_unique_paths.append(ts_path.resolve())
    return ts_unique_paths


def _TSResolveReferenceCandidates(ts_base_directory: Path, ts_reference_text: str) -> list[Path]:
    ts_base_directory = ts_base_directory.resolve()
    ts_reference_text = str(ts_reference_text or "").strip().strip('"').strip("'").replace("\\", "/")
    if not ts_reference_text:
        return []
    ts_candidates = [ts_reference_text]
    ts_tokens = ts_reference_text.split()
    for ts_start_index in range(1, len(ts_tokens)):
        ts_suffix_candidate = " ".join(ts_tokens[ts_start_index:]).strip().strip('"').strip("'")
        if ts_suffix_candidate and not ts_suffix_candidate.startswith("-"):
            ts_candidates.append(ts_suffix_candidate)
    ts_resolved_paths: list[Path] = []
    for ts_candidate in ts_candidates:
        ts_candidate_path = (ts_base_directory / ts_candidate).resolve()
        try:
            ts_candidate_path.relative_to(ts_base_directory)
        except ValueError:
            TSLogVerbose(
                "load3d_stage.reference.skipped",
                base_directory=str(ts_base_directory),
                reference=ts_candidate,
                reason="outside_base_directory",
            )
            continue
        if ts_candidate_path.exists():
            ts_resolved_paths.append(ts_candidate_path)
    return _TSUniquePaths(ts_resolved_paths)


def _TSCollectOBJMaterialLibraries(ts_source_path: Path) -> list[Path]:
    ts_material_libraries: list[Path] = []
    try:
        with ts_source_path.open("r", encoding="utf-8", errors="ignore") as ts_handle:
            for ts_raw_line in ts_handle:
                ts_line = ts_raw_line.strip()
                if not ts_line or ts_line.startswith("#") or not ts_line.lower().startswith("mtllib "):
                    continue
                ts_material_libraries.extend(_TSResolveReferenceCandidates(ts_source_path.parent, ts_line[7:].strip()))
    except OSError as ts_error:
        TSLogVerbose("load3d_stage.obj.read.failed", source_path=str(ts_source_path), error=str(ts_error))
    ts_default_mtl = ts_source_path.with_suffix(".mtl")
    if not ts_material_libraries and ts_default_mtl.exists():
        ts_material_libraries.append(ts_default_mtl.resolve())
    return _TSUniquePaths(ts_material_libraries)


def _TSCollectMTLTexturePaths(ts_material_path: Path) -> list[Path]:
    ts_texture_paths: list[Path] = []
    try:
        with ts_material_path.open("r", encoding="utf-8", errors="ignore") as ts_handle:
            for ts_raw_line in ts_handle:
                ts_line = ts_raw_line.strip()
                if not ts_line or ts_line.startswith("#"):
                    continue
                ts_keyword, _, ts_reference_text = ts_line.partition(" ")
                if ts_keyword not in TS_MTL_TEXTURE_KEYWORDS or not ts_reference_text.strip():
                    continue
                for ts_candidate in _TSResolveReferenceCandidates(ts_material_path.parent, ts_reference_text.strip()):
                    if ts_candidate.suffix.lower() in TS_TEXTURE_EXTENSIONS:
                        ts_texture_paths.append(ts_candidate)
    except OSError as ts_error:
        TSLogVerbose("load3d_stage.mtl.read.failed", material_path=str(ts_material_path), error=str(ts_error))
    return _TSUniquePaths(ts_texture_paths)


def _TSCopyOrLinkFile(ts_source_path: Path, ts_target_path: Path) -> None:
    ts_target_path.parent.mkdir(parents=True, exist_ok=True)
    if ts_target_path.exists():
        ts_source_stat = ts_source_path.stat()
        ts_target_stat = ts_target_path.stat()
        if ts_source_stat.st_size == ts_target_stat.st_size and ts_source_stat.st_mtime_ns == ts_target_stat.st_mtime_ns:
            return
        ts_target_path.unlink()
    try:
        os.link(str(ts_source_path), str(ts_target_path))
    except OSError:
        shutil.copy2(ts_source_path, ts_target_path)


def _TSStage3DAsset(ts_input_directory: Path, ts_row) -> str:
    ts_source_path = Path(str(ts_row["path"])).resolve()
    if not ts_source_path.exists():
        raise FileNotFoundError(str(ts_source_path))
    try:
        ts_existing_relative = ts_source_path.relative_to(ts_input_directory).as_posix()
        if ts_existing_relative.startswith("3d/"):
            return ts_existing_relative
    except ValueError:
        pass

    # Per-asset stage folder keyed by the source path: two same-named models
    # from different library folders must not overwrite each other's staged
    # files (a previously created Load3D node would silently load the other
    # model). The hash is stable, so re-staging reuses the same folder.
    ts_path_discriminator = hashlib.blake2b(
        TSNormalizePathString(ts_source_path).encode("utf-8"), digest_size=4
    ).hexdigest()
    ts_stage_root = (
        ts_input_directory / "3d" / ".ts_artius_browser" / f"{ts_source_path.stem}-{ts_path_discriminator}"
    )
    ts_stage_root.mkdir(parents=True, exist_ok=True)

    ts_files_to_stage: list[Path] = [ts_source_path]
    if ts_source_path.suffix.lower() == ".obj":
        ts_material_libraries = _TSCollectOBJMaterialLibraries(ts_source_path)
        ts_files_to_stage.extend(ts_material_libraries)
        for ts_material_path in ts_material_libraries:
            ts_files_to_stage.extend(_TSCollectMTLTexturePaths(ts_material_path))

    for ts_file_path in _TSUniquePaths(ts_files_to_stage):
        try:
            ts_relative_from_source = ts_file_path.relative_to(ts_source_path.parent)
        except ValueError:
            ts_relative_from_source = Path(ts_file_path.name)
        _TSCopyOrLinkFile(ts_file_path, ts_stage_root / ts_relative_from_source)

    return (ts_stage_root / ts_source_path.name).relative_to(ts_input_directory).as_posix()

def TSPrepare3DAssetForLoad3D(ts_database, ts_get_asset_lock, ts_input_directory: Path, ts_asset_id: int) -> dict[str, Any]:
    ts_row = ts_database.TSGetAssetById(ts_asset_id)
    if ts_row is None or str(ts_row["type"] or "") != "3d":
        raise TSWeb.HTTPNotFound()
    with ts_get_asset_lock(ts_asset_id):
        try:
            ts_model_file = _TSStage3DAsset(ts_input_directory, ts_row)
        except FileNotFoundError:
            # The row is stale: the user moved or deleted the model since the
            # last scan. That is a 404, not a server fault - letting the
            # FileNotFoundError escape made the route wrapper log a stack trace
            # and report internal_error on every drag of a stale 3D card.
            TSLogVerbose("load3d_stage.source.missing", asset_id=ts_asset_id, path=str(ts_row["path"]))
            raise TSWeb.HTTPNotFound()
    return {
        "asset_id": ts_asset_id,
        "model_file": ts_model_file,
    }
