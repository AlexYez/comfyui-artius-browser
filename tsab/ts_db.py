from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any

from .ts_companion import TSComputeCompanionStemFromFilename
from .ts_db_payload import TSBuildUpdatedAssetPayload, TSComputeAssetStatus, TSPayloadFromAssetRow
from .ts_db_query import TS_SORT_KEY_MAP, TSBuildAssetQueryParts, TSResolveSortKey
from .ts_db_schema import TS_DB_DROP_SCHEMA_SQL, TS_DB_RESET_INDEX_SQL, TS_DB_SCHEMA_SQL, TS_DB_SCHEMA_VERSION
from .ts_logging import TSLogVerbose
from .ts_types import TSAssetPayload

TS_COMPANION_NON_IMAGE_TYPE_KEYS = ("video", "audio", "3d")


class TSDatabase:
    def __init__(self, ts_database_path: Path) -> None:
        self.ts_database_path = ts_database_path
        self.ts_thread_local = threading.local()
        self.TSMigrate()

    def TSGetConnection(self) -> sqlite3.Connection:
        ts_connection = getattr(self.ts_thread_local, "ts_connection", None)
        if ts_connection is None:
            ts_connection = sqlite3.connect(self.ts_database_path, timeout=30, isolation_level=None)
            ts_connection.row_factory = sqlite3.Row
            ts_connection.execute("PRAGMA journal_mode=WAL")
            ts_connection.execute("PRAGMA synchronous=NORMAL")
            ts_connection.execute("PRAGMA temp_store=MEMORY")
            ts_connection.execute("PRAGMA cache_size=-8000")
            ts_connection.execute("PRAGMA mmap_size=268435456")
            ts_connection.execute("PRAGMA foreign_keys=ON")
            self.ts_thread_local.ts_connection = ts_connection
            TSLogVerbose("db.connection.opened", database=str(self.ts_database_path))
        return ts_connection

    def _TSChunkedValues(self, ts_values: list[Any], ts_chunk_size: int = 500) -> list[list[Any]]:
        if not ts_values:
            return []
        ts_size = max(1, int(ts_chunk_size))
        return [ts_values[ts_index : ts_index + ts_size] for ts_index in range(0, len(ts_values), ts_size)]

    def TSMigrate(self) -> None:
        ts_connection = self.TSGetConnection()
        ts_user_version = int(ts_connection.execute("PRAGMA user_version").fetchone()[0])
        try:
            ts_connection.executescript(TS_DB_SCHEMA_SQL)
        except sqlite3.DatabaseError as ts_error:
            TSLogVerbose(
                "db.migration.additive_failed",
                database=str(self.ts_database_path),
                from_schema_version=ts_user_version,
                to_schema_version=TS_DB_SCHEMA_VERSION,
                error=str(ts_error),
            )
            self._TSRebuildSchema(ts_connection, ts_user_version, "additive_failed")
        if ts_user_version != TS_DB_SCHEMA_VERSION:
            ts_connection.execute(f"PRAGMA user_version = {TS_DB_SCHEMA_VERSION}")
        TSLogVerbose("db.migrated", database=str(self.ts_database_path), schema_version=TS_DB_SCHEMA_VERSION)

    def _TSRebuildSchema(
        self,
        ts_connection: sqlite3.Connection,
        ts_user_version: int,
        ts_reason: str,
    ) -> None:
        ts_connection.executescript(TS_DB_DROP_SCHEMA_SQL)
        ts_connection.executescript(TS_DB_SCHEMA_SQL)
        TSLogVerbose(
            "db.migration.rebuilt",
            database=str(self.ts_database_path),
            from_schema_version=ts_user_version,
            to_schema_version=TS_DB_SCHEMA_VERSION,
            reason=ts_reason,
        )

    def TSResetIndex(self) -> None:
        ts_connection = self.TSGetConnection()
        ts_connection.executescript(TS_DB_RESET_INDEX_SQL)
        try:
            ts_connection.execute("VACUUM")
        except sqlite3.DatabaseError as ts_error:
            TSLogVerbose("db.reset.vacuum_failed", database=str(self.ts_database_path), error=str(ts_error))
        TSLogVerbose("db.reset", database=str(self.ts_database_path))

    def _TSEnsureLookupId(self, ts_table_name: str, ts_key_column: str, ts_value: str) -> int:
        ts_connection = self.TSGetConnection()
        ts_connection.execute(
            f"INSERT OR IGNORE INTO {ts_table_name}({ts_key_column}) VALUES (?)",
            (ts_value,),
        )
        ts_row = ts_connection.execute(
            f"SELECT id FROM {ts_table_name} WHERE {ts_key_column} = ?",
            (ts_value,),
        ).fetchone()
        if ts_row is None:
            raise RuntimeError(f"Unable to resolve lookup {ts_table_name}:{ts_value}")
        return int(ts_row["id"])

    def _TSEnsureRootLookupId(self, ts_root_id: str, ts_scope: str) -> int:
        ts_connection = self.TSGetConnection()
        ts_connection.execute(
            "INSERT OR IGNORE INTO asset_roots(root_key, scope) VALUES (?, ?)",
            (ts_root_id, ts_scope),
        )
        ts_connection.execute(
            "UPDATE asset_roots SET scope = ? WHERE root_key = ?",
            (ts_scope, ts_root_id),
        )
        ts_row = ts_connection.execute(
            "SELECT id FROM asset_roots WHERE root_key = ?",
            (ts_root_id,),
        ).fetchone()
        if ts_row is None:
            raise RuntimeError(f"Unable to resolve root lookup {ts_root_id}")
        return int(ts_row["id"])

    def _TSEnsureFolderLookupId(self, ts_root_lookup_id: int, ts_folder_path: str) -> int:
        ts_connection = self.TSGetConnection()
        ts_connection.execute(
            "INSERT OR IGNORE INTO asset_folders(root_lookup_id, folder_path) VALUES (?, ?)",
            (ts_root_lookup_id, ts_folder_path),
        )
        ts_row = ts_connection.execute(
            "SELECT id FROM asset_folders WHERE root_lookup_id = ? AND folder_path = ?",
            (ts_root_lookup_id, ts_folder_path),
        ).fetchone()
        if ts_row is None:
            raise RuntimeError(f"Unable to resolve folder lookup {ts_root_lookup_id}:{ts_folder_path}")
        return int(ts_row["id"])

    def TSPayloadFromRow(self, ts_row: sqlite3.Row) -> TSAssetPayload:
        return TSPayloadFromAssetRow(ts_row)

    def TSGetSnapshotBatch(self, ts_paths: list[str]) -> dict[str, sqlite3.Row]:
        if not ts_paths:
            return {}
        ts_connection = self.TSGetConnection()
        ts_rows: list[sqlite3.Row] = []
        for ts_path_batch in self._TSChunkedValues(list(dict.fromkeys(ts_paths)), 500):
            ts_placeholders = ",".join("?" for _ in ts_path_batch)
            ts_rows.extend(
                ts_connection.execute(
                    f"SELECT * FROM assets_view WHERE path IN ({ts_placeholders})",
                    ts_path_batch,
                ).fetchall()
            )
        TSLogVerbose("db.snapshot.batch", requested=len(ts_paths), returned=len(ts_rows))
        return {str(ts_row["path"]): ts_row for ts_row in ts_rows}

    def TSGetRootAssetRefs(self, ts_root_ids: list[str]) -> list[sqlite3.Row]:
        if not ts_root_ids:
            return []
        ts_connection = self.TSGetConnection()
        ts_placeholders = ",".join("?" for _ in ts_root_ids)
        ts_rows = ts_connection.execute(
            f"""
            SELECT
                assets.id AS id,
                assets.path AS path,
                assets.preview_path AS preview_path,
                asset_roots.root_key AS root_id
            FROM assets
            INNER JOIN asset_roots ON asset_roots.id = assets.root_lookup_id
            WHERE asset_roots.root_key IN ({ts_placeholders})
            """,
            ts_root_ids,
        ).fetchall()
        TSLogVerbose("db.root_asset_refs", root_ids=ts_root_ids, rows=len(ts_rows))
        return ts_rows

    def _TSCachedEnsure(self, ts_lookup_cache: dict | None, ts_cache_key: tuple, ts_factory):
        if ts_lookup_cache is None:
            return ts_factory()
        ts_value = ts_lookup_cache.get(ts_cache_key)
        if ts_value is None:
            ts_value = ts_factory()
            ts_lookup_cache[ts_cache_key] = ts_value
        return ts_value

    def _TSDoUpsertAsset(
        self,
        ts_payload: TSAssetPayload,
        ts_lookup_cache: dict | None = None,
    ) -> tuple[int, int, int]:
        ts_connection = self.TSGetConnection()
        ts_root_lookup_id = self._TSCachedEnsure(
            ts_lookup_cache,
            ("root", ts_payload.ts_root_id, ts_payload.ts_scope),
            lambda: self._TSEnsureRootLookupId(ts_payload.ts_root_id, ts_payload.ts_scope),
        )
        ts_type_lookup_id = self._TSCachedEnsure(
            ts_lookup_cache,
            ("type", ts_payload.ts_type),
            lambda: self._TSEnsureLookupId("asset_types", "type_key", ts_payload.ts_type),
        )
        ts_extension_lookup_id = self._TSCachedEnsure(
            ts_lookup_cache,
            ("ext", ts_payload.ts_extension),
            lambda: self._TSEnsureLookupId("asset_extensions", "extension_key", ts_payload.ts_extension),
        )
        ts_folder_lookup_id = self._TSCachedEnsure(
            ts_lookup_cache,
            ("folder", ts_root_lookup_id, ts_payload.ts_folder_path),
            lambda: self._TSEnsureFolderLookupId(ts_root_lookup_id, ts_payload.ts_folder_path),
        )
        ts_companion_stem = TSComputeCompanionStemFromFilename(ts_payload.ts_filename, ts_payload.ts_extension)
        ts_status = TSComputeAssetStatus(
            bool(ts_payload.ts_is_indexed),
            bool(ts_payload.ts_has_preview),
            bool(ts_payload.ts_has_metadata),
        )
        ts_connection.execute(
            """
            INSERT INTO assets (
                path, filename, preview_path, mtime_ns, size_bytes, hash, created_at,
                duration, width, height, fps, technical_json,
                type_lookup_id, extension_lookup_id, root_lookup_id, folder_lookup_id,
                is_indexed, has_preview, has_metadata, companion_stem, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                filename = excluded.filename,
                preview_path = excluded.preview_path,
                mtime_ns = excluded.mtime_ns,
                size_bytes = excluded.size_bytes,
                hash = excluded.hash,
                created_at = excluded.created_at,
                duration = excluded.duration,
                width = excluded.width,
                height = excluded.height,
                fps = excluded.fps,
                technical_json = excluded.technical_json,
                type_lookup_id = excluded.type_lookup_id,
                extension_lookup_id = excluded.extension_lookup_id,
                root_lookup_id = excluded.root_lookup_id,
                folder_lookup_id = excluded.folder_lookup_id,
                is_indexed = excluded.is_indexed,
                has_preview = excluded.has_preview,
                has_metadata = excluded.has_metadata,
                companion_stem = excluded.companion_stem,
                status = excluded.status
            """,
            (
                ts_payload.ts_path,
                ts_payload.ts_filename,
                ts_payload.ts_preview_path,
                ts_payload.ts_mtime_ns,
                ts_payload.ts_size_bytes,
                ts_payload.ts_hash,
                ts_payload.ts_created_at,
                ts_payload.ts_duration,
                ts_payload.ts_width,
                ts_payload.ts_height,
                ts_payload.ts_fps,
                ts_payload.ts_technical_json or "{}",
                ts_type_lookup_id,
                ts_extension_lookup_id,
                ts_root_lookup_id,
                ts_folder_lookup_id,
                1 if ts_payload.ts_is_indexed else 0,
                1 if ts_payload.ts_has_preview else 0,
                1 if ts_payload.ts_has_metadata else 0,
                ts_companion_stem,
                ts_status,
            ),
        )
        ts_id_row = ts_connection.execute(
            "SELECT id FROM assets WHERE path = ?",
            (ts_payload.ts_path,),
        ).fetchone()
        if ts_id_row is None:
            raise RuntimeError(f"Unable to upsert asset {ts_payload.ts_path}")
        ts_asset_id = int(ts_id_row["id"])
        ts_has_stored_metadata = bool(
            (ts_payload.ts_metadata or "{}") != "{}"
            or ts_payload.ts_prompt_text
            or ts_payload.ts_workflow_text
        )
        if ts_has_stored_metadata:
            ts_connection.execute(
                """
                INSERT INTO asset_metadata(asset_id, metadata_json, prompt_text, workflow_text)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(asset_id) DO UPDATE SET
                    metadata_json = excluded.metadata_json,
                    prompt_text = excluded.prompt_text,
                    workflow_text = excluded.workflow_text
                """,
                (
                    ts_asset_id,
                    ts_payload.ts_metadata or "{}",
                    ts_payload.ts_prompt_text or "",
                    ts_payload.ts_workflow_text or "",
                ),
            )
        else:
            ts_connection.execute("DELETE FROM asset_metadata WHERE asset_id = ?", (ts_asset_id,))
        self._TSSyncFTSRow(ts_asset_id, ts_payload.ts_filename)
        return ts_asset_id, ts_root_lookup_id, ts_folder_lookup_id

    def TSUpsertAsset(self, ts_payload: TSAssetPayload) -> sqlite3.Row:
        ts_asset_id, ts_root_lookup_id, ts_folder_lookup_id = self._TSDoUpsertAsset(ts_payload)
        self._TSRecomputeCompanionFlags({(ts_root_lookup_id, ts_folder_lookup_id)})
        ts_row = self.TSGetAssetById(ts_asset_id)
        if ts_row is None:
            raise RuntimeError(f"Unable to fetch asset after upsert {ts_payload.ts_path}")
        TSLogVerbose(
            "db.asset.upserted",
            asset_id=int(ts_row["id"]),
            path=str(ts_row["path"]),
            type=str(ts_row["type"]),
            root_id=str(ts_row["root_id"]),
            status=str(ts_row["status"]),
        )
        return ts_row

    def TSUpsertAssets(self, ts_payloads: list[TSAssetPayload], ts_return_rows: bool = True) -> list[sqlite3.Row]:
        if not ts_payloads:
            return []
        ts_connection = self.TSGetConnection()
        ts_asset_ids: list[int] = []
        ts_touched_folders: set[tuple[int, int]] = set()
        ts_lookup_cache: dict = {}
        ts_connection.execute("BEGIN IMMEDIATE")
        try:
            for ts_payload in ts_payloads:
                ts_asset_id, ts_root_lookup_id, ts_folder_lookup_id = self._TSDoUpsertAsset(ts_payload, ts_lookup_cache)
                ts_asset_ids.append(ts_asset_id)
                ts_touched_folders.add((ts_root_lookup_id, ts_folder_lookup_id))
        except Exception:
            ts_connection.execute("ROLLBACK")
            raise
        ts_connection.execute("COMMIT")
        self._TSRecomputeCompanionFlags(ts_touched_folders)
        if not ts_return_rows:
            # Hot-path variant for callers that ignore the rows (scan hash
            # phase): skips one assets_view SELECT per upserted asset.
            TSLogVerbose("db.assets.upserted.batch", count=len(ts_asset_ids), affected_folders=len(ts_touched_folders))
            return []
        ts_rows: list[sqlite3.Row] = []
        for ts_asset_id in ts_asset_ids:
            ts_row = self.TSGetAssetById(ts_asset_id)
            if ts_row is not None:
                ts_rows.append(ts_row)
        TSLogVerbose("db.assets.upserted.batch", count=len(ts_rows), affected_folders=len(ts_touched_folders))
        return ts_rows

    def _TSRecomputeCompanionFlags(self, ts_folder_keys: set[tuple[int, int]]) -> None:
        if not ts_folder_keys:
            return
        ts_connection = self.TSGetConnection()
        ts_image_row = ts_connection.execute(
            "SELECT id FROM asset_types WHERE type_key = 'image'"
        ).fetchone()
        if ts_image_row is None:
            return
        ts_image_type_id = int(ts_image_row["id"])
        ts_non_image_placeholders = ",".join("?" for _ in TS_COMPANION_NON_IMAGE_TYPE_KEYS)
        ts_non_image_rows = ts_connection.execute(
            f"SELECT id FROM asset_types WHERE type_key IN ({ts_non_image_placeholders})",
            TS_COMPANION_NON_IMAGE_TYPE_KEYS,
        ).fetchall()
        ts_non_image_type_ids = [int(ts_row["id"]) for ts_row in ts_non_image_rows]
        if not ts_non_image_type_ids:
            for ts_root_lookup_id, ts_folder_lookup_id in ts_folder_keys:
                ts_connection.execute(
                    "UPDATE assets SET is_companion_image = 0 "
                    "WHERE root_lookup_id = ? AND folder_lookup_id = ? AND type_lookup_id = ?",
                    (ts_root_lookup_id, ts_folder_lookup_id, ts_image_type_id),
                )
            return
        ts_id_placeholders = ",".join("?" for _ in ts_non_image_type_ids)
        ts_update_sql = f"""
            UPDATE assets
            SET is_companion_image = CASE WHEN companion_stem != '' AND EXISTS (
                SELECT 1 FROM assets AS sib
                WHERE sib.id != assets.id
                  AND sib.root_lookup_id = assets.root_lookup_id
                  AND sib.folder_lookup_id = assets.folder_lookup_id
                  AND sib.companion_stem = assets.companion_stem
                  AND sib.type_lookup_id IN ({ts_id_placeholders})
            ) THEN 1 ELSE 0 END
            WHERE root_lookup_id = ?
              AND folder_lookup_id = ?
              AND type_lookup_id = ?
        """
        for ts_root_lookup_id, ts_folder_lookup_id in ts_folder_keys:
            ts_connection.execute(
                ts_update_sql,
                (*ts_non_image_type_ids, ts_root_lookup_id, ts_folder_lookup_id, ts_image_type_id),
            )

    def TSBuildUpdatedPayload(self, ts_row: sqlite3.Row, **ts_overrides: Any) -> TSAssetPayload:
        return TSBuildUpdatedAssetPayload(ts_row, **ts_overrides)

    def _TSSyncFTSRow(self, ts_asset_id: int, ts_filename: str) -> None:
        ts_connection = self.TSGetConnection()
        ts_connection.execute("DELETE FROM assets_fts WHERE rowid = ?", (ts_asset_id,))
        ts_connection.execute(
            "INSERT INTO assets_fts(rowid, filename) VALUES (?, ?)",
            (ts_asset_id, ts_filename),
        )

    def TSGetAssetById(self, ts_asset_id: int) -> sqlite3.Row | None:
        return self.TSGetConnection().execute(
            "SELECT * FROM assets_view WHERE id = ?",
            (ts_asset_id,),
        ).fetchone()

    def TSGetAssetByPath(self, ts_path: str) -> sqlite3.Row | None:
        return self.TSGetConnection().execute(
            "SELECT * FROM assets_view WHERE path = ?",
            (ts_path,),
        ).fetchone()

    def TSGetAllPreviewPaths(self) -> set[str]:
        ts_connection = self.TSGetConnection()
        ts_rows = ts_connection.execute(
            "SELECT DISTINCT preview_path FROM assets WHERE preview_path != ''"
        ).fetchall()
        ts_paths = {str(ts_row["preview_path"]) for ts_row in ts_rows if ts_row["preview_path"]}
        TSLogVerbose("db.preview_paths.collected", count=len(ts_paths))
        return ts_paths

    def TSCountPreviewReferences(self, ts_preview_path: str, ts_exclude_asset_id: int | None = None) -> int:
        if not ts_preview_path:
            return 0
        ts_connection = self.TSGetConnection()
        if ts_exclude_asset_id is None:
            ts_row = ts_connection.execute(
                "SELECT COUNT(*) AS ref_count FROM assets WHERE preview_path = ?",
                (ts_preview_path,),
            ).fetchone()
        else:
            ts_row = ts_connection.execute(
                "SELECT COUNT(*) AS ref_count FROM assets WHERE preview_path = ? AND id != ?",
                (ts_preview_path, int(ts_exclude_asset_id)),
            ).fetchone()
        return int((ts_row["ref_count"] if ts_row is not None else 0) or 0)

    def TSDeleteAssetIds(self, ts_asset_ids: list[int]) -> None:
        if not ts_asset_ids:
            return
        ts_connection = self.TSGetConnection()
        ts_touched_folders: set[tuple[int, int]] = set()
        for ts_id_batch in self._TSChunkedValues(list(ts_asset_ids), 500):
            ts_placeholders = ",".join("?" for _ in ts_id_batch)
            ts_touched_folders.update(
                (int(ts_row["root_lookup_id"]), int(ts_row["folder_lookup_id"]))
                for ts_row in ts_connection.execute(
                    f"SELECT root_lookup_id, folder_lookup_id FROM assets WHERE id IN ({ts_placeholders})",
                    ts_id_batch,
                ).fetchall()
            )
            ts_connection.execute(f"DELETE FROM assets_fts WHERE rowid IN ({ts_placeholders})", ts_id_batch)
            ts_connection.execute(f"DELETE FROM assets WHERE id IN ({ts_placeholders})", ts_id_batch)
        self._TSRecomputeCompanionFlags(ts_touched_folders)
        TSLogVerbose("db.asset_ids.deleted", count=len(ts_asset_ids), asset_ids=ts_asset_ids)

    def TSCountVisibleByType(self, ts_root_ids: list[str] | None = None) -> dict[str, int]:
        # "Visible" matches the asset listing: companion images suppressed
        # from the grid must not inflate the scan summary counts either.
        ts_where_clauses: list[str] = ["assets_view.is_companion_image = 0"]
        ts_parameters: list[Any] = []
        if ts_root_ids is not None:
            if not ts_root_ids:
                return {"image": 0, "video": 0, "audio": 0, "3d": 0}
            ts_placeholders = ",".join("?" for _ in ts_root_ids)
            ts_where_clauses.append(f"assets_view.root_id IN ({ts_placeholders})")
            ts_parameters.extend(ts_root_ids)
        ts_where_sql = f" WHERE {' AND '.join(ts_where_clauses)}" if ts_where_clauses else ""
        ts_rows = self.TSGetConnection().execute(
            f"""
            SELECT assets_view.type, COUNT(*) AS asset_count
            FROM assets_view
            {ts_where_sql}
            GROUP BY assets_view.type
            """,
            ts_parameters,
        ).fetchall()
        ts_result = {"image": 0, "video": 0, "audio": 0, "3d": 0}
        for ts_row in ts_rows:
            ts_result[str(ts_row["type"])] = int(ts_row["asset_count"])
        TSLogVerbose("db.assets.counted_by_type", root_ids=ts_root_ids, counts=ts_result)
        return ts_result

    def TSQueryAssetsPage(
        self,
        ts_search_text: str = "",
        ts_filters: dict[str, Any] | None = None,
        ts_cursor_after: dict[str, Any] | None = None,
        ts_limit: int = 120,
    ) -> tuple[list[sqlite3.Row], bool, dict[str, Any] | None]:
        ts_from_sql, ts_where_sql, ts_parameters, ts_order_by_sql = TSBuildAssetQueryParts(
            ts_search_text, ts_filters, ts_cursor_after,
        )
        ts_connection = self.TSGetConnection()
        ts_page_limit = max(1, int(ts_limit)) + 1
        ts_list_query = f"""
            SELECT assets_view.*
            FROM {ts_from_sql}
            {ts_where_sql}
            {ts_order_by_sql}
            LIMIT ?
        """
        ts_rows = ts_connection.execute(ts_list_query, [*ts_parameters, ts_page_limit]).fetchall()
        ts_has_more = len(ts_rows) > ts_limit
        ts_page_rows = ts_rows[:ts_limit] if ts_has_more else ts_rows
        ts_next_cursor = self._TSBuildNextCursor(ts_page_rows, ts_filters) if ts_has_more else None
        TSLogVerbose(
            "db.assets.page_queried",
            search_text=ts_search_text,
            filters=ts_filters,
            cursor_after=ts_cursor_after,
            limit=ts_limit,
            returned=len(ts_page_rows),
            has_more=ts_has_more,
        )
        return ts_page_rows, ts_has_more, ts_next_cursor

    def _TSBuildNextCursor(
        self,
        ts_rows: list[sqlite3.Row],
        ts_filters: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        if not ts_rows:
            return None
        ts_last_row = ts_rows[-1]
        ts_sort_key = TSResolveSortKey((ts_filters or {}).get("sort_key"))
        ts_field = TS_SORT_KEY_MAP[ts_sort_key]["row_field"]
        return {
            "sort_key": ts_sort_key,
            "sort_value": ts_last_row[ts_field],
            "id": int(ts_last_row["id"]),
        }

    def TSListFolders(
        self,
        ts_scope: str | None = None,
        ts_root_id: str | None = None,
    ) -> list[dict[str, Any]]:
        ts_where_clauses: list[str] = []
        ts_parameters: list[Any] = []
        if ts_scope:
            ts_where_clauses.append("assets_view.scope = ?")
            ts_parameters.append(ts_scope)
        if ts_root_id:
            ts_where_clauses.append("assets_view.root_id = ?")
            ts_parameters.append(ts_root_id)
        ts_where_sql = f" WHERE {' AND '.join(ts_where_clauses)}" if ts_where_clauses else ""
        ts_rows = self.TSGetConnection().execute(
            f"""
            SELECT assets_view.root_id, assets_view.scope, assets_view.folder_path, COUNT(*) AS asset_count
            FROM assets_view
            {ts_where_sql}
            GROUP BY assets_view.root_id, assets_view.scope, assets_view.folder_path
            ORDER BY assets_view.root_id, assets_view.folder_path
            """,
            ts_parameters,
        ).fetchall()
        ts_result = [
            {
                "root_id": ts_row["root_id"],
                "scope": ts_row["scope"],
                "folder_path": ts_row["folder_path"],
                "asset_count": ts_row["asset_count"],
            }
            for ts_row in ts_rows
        ]
        TSLogVerbose("db.folders.listed", scope=ts_scope, root_id=ts_root_id, count=len(ts_result))
        return ts_result
