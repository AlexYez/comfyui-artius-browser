from __future__ import annotations

import sqlite3
import threading
from dataclasses import replace
from pathlib import Path
from typing import Any

from .ts_db_query import TSBuildAssetQueryParts
from .ts_logging import TSLogVerbose
from .ts_types import TSAssetPayload

TS_DB_SCHEMA_VERSION = 7


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
        ts_user_version = int(ts_connection.execute("PRAGMA user_version").fetchone()[0] or 0)
        if ts_user_version != TS_DB_SCHEMA_VERSION:
            ts_connection.executescript(
                """
                DROP VIEW IF EXISTS assets_view;
                DROP TABLE IF EXISTS assets_fts;
                DROP TABLE IF EXISTS asset_metadata;
                DROP TABLE IF EXISTS assets;
                DROP TABLE IF EXISTS asset_folders;
                DROP TABLE IF EXISTS asset_roots;
                DROP TABLE IF EXISTS asset_extensions;
                DROP TABLE IF EXISTS asset_types;
                """
            )
        ts_connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS asset_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type_key TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS asset_extensions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                extension_key TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS asset_roots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                root_key TEXT NOT NULL UNIQUE,
                scope TEXT NOT NULL DEFAULT 'output'
            );

            CREATE TABLE IF NOT EXISTS asset_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                root_lookup_id INTEGER NOT NULL,
                folder_path TEXT NOT NULL DEFAULT '',
                UNIQUE(root_lookup_id, folder_path),
                FOREIGN KEY(root_lookup_id) REFERENCES asset_roots(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL UNIQUE,
                filename TEXT NOT NULL DEFAULT '',
                preview_path TEXT NOT NULL DEFAULT '',
                mtime_ns INTEGER NOT NULL DEFAULT 0,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                hash TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '',
                rating INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT 0,
                duration REAL,
                width INTEGER,
                height INTEGER,
                fps REAL,
                technical_json TEXT NOT NULL DEFAULT '{}',
                type_lookup_id INTEGER NOT NULL,
                extension_lookup_id INTEGER NOT NULL,
                root_lookup_id INTEGER NOT NULL,
                folder_lookup_id INTEGER NOT NULL,
                is_indexed INTEGER NOT NULL DEFAULT 0,
                has_preview INTEGER NOT NULL DEFAULT 0,
                has_metadata INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'discovered',
                FOREIGN KEY(type_lookup_id) REFERENCES asset_types(id),
                FOREIGN KEY(extension_lookup_id) REFERENCES asset_extensions(id),
                FOREIGN KEY(root_lookup_id) REFERENCES asset_roots(id),
                FOREIGN KEY(folder_lookup_id) REFERENCES asset_folders(id)
            );

            CREATE TABLE IF NOT EXISTS asset_metadata (
                asset_id INTEGER PRIMARY KEY,
                metadata_json TEXT NOT NULL DEFAULT '{}',
                prompt_text TEXT NOT NULL DEFAULT '',
                workflow_text TEXT NOT NULL DEFAULT '',
                FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_assets_path ON assets(path);
            CREATE INDEX IF NOT EXISTS idx_assets_filename ON assets(filename);
            CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
            CREATE INDEX IF NOT EXISTS idx_assets_hash ON assets(hash);
            CREATE INDEX IF NOT EXISTS idx_assets_root_lookup_id ON assets(root_lookup_id);
            CREATE INDEX IF NOT EXISTS idx_assets_folder_lookup_id ON assets(folder_lookup_id);
            CREATE INDEX IF NOT EXISTS idx_assets_mtime_ns ON assets(mtime_ns);
            CREATE INDEX IF NOT EXISTS idx_assets_size_bytes ON assets(size_bytes);
            CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
            CREATE INDEX IF NOT EXISTS idx_assets_preview_ready ON assets(has_preview);
            CREATE INDEX IF NOT EXISTS idx_asset_folders_root_lookup_id ON asset_folders(root_lookup_id);

            CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts
            USING fts5(
                filename,
                tokenize = 'unicode61'
            );

            DROP VIEW IF EXISTS assets_view;
            CREATE VIEW assets_view AS
            SELECT
                assets.id AS id,
                assets.path AS path,
                asset_types.type_key AS type,
                assets.preview_path AS preview_path,
                COALESCE(asset_metadata.metadata_json, '{}') AS metadata,
                assets.technical_json AS technical_json,
                assets.mtime_ns AS mtime_ns,
                assets.size_bytes AS size_bytes,
                assets.hash AS hash,
                assets.tags AS tags,
                assets.rating AS rating,
                assets.created_at AS created_at,
                COALESCE(asset_folders.folder_path, '') AS folder_path,
                assets.duration AS duration,
                assets.width AS width,
                assets.height AS height,
                assets.fps AS fps,
                assets.filename AS filename,
                asset_extensions.extension_key AS extension,
                asset_roots.scope AS scope,
                asset_roots.root_key AS root_id,
                COALESCE(asset_metadata.prompt_text, '') AS prompt_text,
                COALESCE(asset_metadata.workflow_text, '') AS workflow_text,
                assets.is_indexed AS is_indexed,
                assets.has_preview AS has_preview,
                assets.has_metadata AS has_metadata,
                assets.status AS status
            FROM assets
            INNER JOIN asset_types ON asset_types.id = assets.type_lookup_id
            INNER JOIN asset_extensions ON asset_extensions.id = assets.extension_lookup_id
            INNER JOIN asset_roots ON asset_roots.id = assets.root_lookup_id
            INNER JOIN asset_folders ON asset_folders.id = assets.folder_lookup_id
            LEFT JOIN asset_metadata ON asset_metadata.asset_id = assets.id;
            """
        )
        if ts_user_version != TS_DB_SCHEMA_VERSION:
            ts_connection.execute(f"PRAGMA user_version = {TS_DB_SCHEMA_VERSION}")
        TSLogVerbose("db.migrated", database=str(self.ts_database_path), schema_version=TS_DB_SCHEMA_VERSION)

    def TSResetIndex(self) -> None:
        ts_connection = self.TSGetConnection()
        ts_connection.executescript(
            """
            DELETE FROM assets_fts;
            DELETE FROM asset_metadata;
            DELETE FROM assets;
            DELETE FROM asset_folders;
            DELETE FROM asset_roots;
            DELETE FROM asset_extensions;
            DELETE FROM asset_types;
            DELETE FROM sqlite_sequence
            WHERE name IN ('assets', 'asset_folders', 'asset_roots', 'asset_extensions', 'asset_types');
            """
        )
        try:
            ts_connection.execute("VACUUM")
        except sqlite3.DatabaseError as ts_error:
            TSLogVerbose("db.reset.vacuum_failed", database=str(self.ts_database_path), error=str(ts_error))
        TSLogVerbose("db.reset", database=str(self.ts_database_path))

    def _TSComputeStatus(self, ts_is_indexed: bool, ts_has_preview: bool, ts_has_metadata: bool) -> str:
        if ts_is_indexed and ts_has_preview and ts_has_metadata:
            return "metadata_ready"
        if ts_is_indexed and ts_has_preview:
            return "previewed"
        if ts_is_indexed:
            return "indexed"
        return "discovered"

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
        return TSAssetPayload(
            ts_path=str(ts_row["path"]),
            ts_type=str(ts_row["type"]),
            ts_preview_path=str(ts_row["preview_path"] or ""),
            ts_metadata=str(ts_row["metadata"] or "{}"),
            ts_technical_json=str(ts_row["technical_json"] or "{}"),
            ts_mtime_ns=int(ts_row["mtime_ns"] or 0),
            ts_hash=str(ts_row["hash"] or ""),
            ts_folder_path=str(ts_row["folder_path"] or ""),
            ts_duration=ts_row["duration"],
            ts_width=ts_row["width"],
            ts_height=ts_row["height"],
            ts_fps=ts_row["fps"],
            ts_size_bytes=int(ts_row["size_bytes"] or 0),
            ts_filename=str(ts_row["filename"] or ""),
            ts_extension=str(ts_row["extension"] or ""),
            ts_scope=str(ts_row["scope"] or "output"),
            ts_root_id=str(ts_row["root_id"] or "output"),
            ts_prompt_text=str(ts_row["prompt_text"] or ""),
            ts_workflow_text=str(ts_row["workflow_text"] or ""),
            ts_created_at=int(ts_row["created_at"] or 0),
            ts_is_indexed=bool(ts_row["is_indexed"]),
            ts_has_preview=bool(ts_row["has_preview"]),
            ts_has_metadata=bool(ts_row["has_metadata"]),
            ts_tags=str(ts_row["tags"] or ""),
            ts_rating=int(ts_row["rating"] or 0),
        )

    def TSGetSnapshot(self, ts_root_ids: list[str] | None = None) -> dict[str, sqlite3.Row]:
        ts_connection = self.TSGetConnection()
        ts_query = "SELECT * FROM assets_view"
        ts_params: list[Any] = []
        if ts_root_ids is not None:
            if not ts_root_ids:
                TSLogVerbose("db.snapshot", root_ids=[], rows=0)
                return {}
            ts_placeholders = ",".join("?" for _ in ts_root_ids)
            ts_query += f" WHERE root_id IN ({ts_placeholders})"
            ts_params.extend(ts_root_ids)
        ts_rows = ts_connection.execute(ts_query, ts_params).fetchall()
        TSLogVerbose("db.snapshot", root_ids=ts_root_ids, rows=len(ts_rows))
        return {str(ts_row["path"]): ts_row for ts_row in ts_rows}

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

    def TSUpsertAsset(self, ts_payload: TSAssetPayload) -> sqlite3.Row:
        ts_connection = self.TSGetConnection()
        ts_root_lookup_id = self._TSEnsureRootLookupId(ts_payload.ts_root_id, ts_payload.ts_scope)
        ts_type_lookup_id = self._TSEnsureLookupId("asset_types", "type_key", ts_payload.ts_type)
        ts_extension_lookup_id = self._TSEnsureLookupId("asset_extensions", "extension_key", ts_payload.ts_extension)
        ts_folder_lookup_id = self._TSEnsureFolderLookupId(ts_root_lookup_id, ts_payload.ts_folder_path)
        ts_status = self._TSComputeStatus(
            bool(ts_payload.ts_is_indexed),
            bool(ts_payload.ts_has_preview),
            bool(ts_payload.ts_has_metadata),
        )
        ts_connection.execute(
            """
            INSERT INTO assets (
                path, filename, preview_path, mtime_ns, size_bytes, hash, tags, rating, created_at,
                duration, width, height, fps, technical_json,
                type_lookup_id, extension_lookup_id, root_lookup_id, folder_lookup_id,
                is_indexed, has_preview, has_metadata, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET
                filename = excluded.filename,
                preview_path = excluded.preview_path,
                mtime_ns = excluded.mtime_ns,
                size_bytes = excluded.size_bytes,
                hash = excluded.hash,
                tags = excluded.tags,
                rating = excluded.rating,
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
                status = excluded.status
            """,
            (
                ts_payload.ts_path,
                ts_payload.ts_filename,
                ts_payload.ts_preview_path,
                ts_payload.ts_mtime_ns,
                ts_payload.ts_size_bytes,
                ts_payload.ts_hash,
                ts_payload.ts_tags,
                ts_payload.ts_rating,
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
                ts_status,
            ),
        )
        ts_row = self.TSGetAssetByPath(ts_payload.ts_path)
        if ts_row is None:
            raise RuntimeError(f"Unable to upsert asset {ts_payload.ts_path}")
        ts_asset_id = int(ts_row["id"])
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

    def TSUpsertAssets(self, ts_payloads: list[TSAssetPayload]) -> list[sqlite3.Row]:
        if not ts_payloads:
            return []
        ts_connection = self.TSGetConnection()
        ts_rows: list[sqlite3.Row] = []
        ts_connection.execute("BEGIN IMMEDIATE")
        try:
            for ts_payload in ts_payloads:
                ts_rows.append(self.TSUpsertAsset(ts_payload))
        except Exception:
            ts_connection.execute("ROLLBACK")
            raise
        ts_connection.execute("COMMIT")
        TSLogVerbose("db.assets.upserted.batch", count=len(ts_rows))
        return ts_rows

    def TSBuildUpdatedPayload(self, ts_row: sqlite3.Row, **ts_overrides: Any) -> TSAssetPayload:
        ts_payload = self.TSPayloadFromRow(ts_row)
        return replace(ts_payload, **ts_overrides)

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
        ts_placeholders = ",".join("?" for _ in ts_asset_ids)
        ts_connection = self.TSGetConnection()
        ts_connection.execute(f"DELETE FROM assets_fts WHERE rowid IN ({ts_placeholders})", ts_asset_ids)
        ts_connection.execute(f"DELETE FROM assets WHERE id IN ({ts_placeholders})", ts_asset_ids)
        TSLogVerbose("db.asset_ids.deleted", count=len(ts_asset_ids), asset_ids=ts_asset_ids)

    def TSDeleteAssetPaths(self, ts_paths: list[str]) -> None:
        if not ts_paths:
            return
        ts_connection = self.TSGetConnection()
        ts_asset_ids: list[int] = []
        for ts_path_batch in self._TSChunkedValues(list(dict.fromkeys(ts_paths)), 500):
            ts_placeholders = ",".join("?" for _ in ts_path_batch)
            ts_rows = ts_connection.execute(
                f"SELECT id FROM assets WHERE path IN ({ts_placeholders})",
                ts_path_batch,
            ).fetchall()
            ts_asset_ids.extend(int(ts_row["id"]) for ts_row in ts_rows)
        self.TSDeleteAssetIds(ts_asset_ids)
        TSLogVerbose("db.asset_paths.deleted", count=len(ts_paths), paths=ts_paths)

    def TSCountVisibleByType(self, ts_root_ids: list[str] | None = None) -> dict[str, int]:
        ts_where_clauses: list[str] = []
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

    def TSQueryAssets(
        self,
        ts_search_text: str = "",
        ts_filters: dict[str, Any] | None = None,
        ts_offset: int = 0,
        ts_limit: int = 120,
    ) -> tuple[list[sqlite3.Row], int]:
        ts_from_sql, ts_where_sql, ts_parameters, ts_order_by_sql = TSBuildAssetQueryParts(ts_search_text, ts_filters)

        ts_connection = self.TSGetConnection()
        ts_count_query = f"SELECT COUNT(*) FROM {ts_from_sql}{ts_where_sql}"
        ts_total = int(ts_connection.execute(ts_count_query, ts_parameters).fetchone()[0])

        ts_list_query = f"""
            SELECT assets_view.*
            FROM {ts_from_sql}
            {ts_where_sql}
            {ts_order_by_sql}
            LIMIT ? OFFSET ?
        """
        ts_rows = ts_connection.execute(ts_list_query, [*ts_parameters, ts_limit, ts_offset]).fetchall()
        TSLogVerbose(
            "db.assets.queried",
            search_text=ts_search_text,
            filters=ts_filters,
            offset=ts_offset,
            limit=ts_limit,
            total=ts_total,
            returned=len(ts_rows),
        )
        return ts_rows, ts_total

    def TSQueryAssetsPage(
        self,
        ts_search_text: str = "",
        ts_filters: dict[str, Any] | None = None,
        ts_offset: int = 0,
        ts_limit: int = 120,
    ) -> tuple[list[sqlite3.Row], bool]:
        ts_from_sql, ts_where_sql, ts_parameters, ts_order_by_sql = TSBuildAssetQueryParts(ts_search_text, ts_filters)
        ts_connection = self.TSGetConnection()
        ts_page_limit = max(1, int(ts_limit)) + 1
        ts_list_query = f"""
            SELECT assets_view.*
            FROM {ts_from_sql}
            {ts_where_sql}
            {ts_order_by_sql}
            LIMIT ? OFFSET ?
        """
        ts_rows = ts_connection.execute(ts_list_query, [*ts_parameters, ts_page_limit, ts_offset]).fetchall()
        ts_has_more = len(ts_rows) > ts_limit
        ts_page_rows = ts_rows[:ts_limit] if ts_has_more else ts_rows
        TSLogVerbose(
            "db.assets.page_queried",
            search_text=ts_search_text,
            filters=ts_filters,
            offset=ts_offset,
            limit=ts_limit,
            returned=len(ts_page_rows),
            has_more=ts_has_more,
        )
        return ts_page_rows, ts_has_more

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
