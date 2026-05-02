from __future__ import annotations

TS_DB_SCHEMA_VERSION = 8

TS_DB_DROP_SCHEMA_SQL = """
DROP VIEW IF EXISTS assets_view;
DROP TABLE IF EXISTS assets_fts;
DROP TABLE IF EXISTS asset_metadata;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS asset_folders;
DROP TABLE IF EXISTS asset_roots;
DROP TABLE IF EXISTS asset_extensions;
DROP TABLE IF EXISTS asset_types;
"""

TS_DB_SCHEMA_SQL = """
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

CREATE TABLE IF NOT EXISTS asset_user_fields (
    path TEXT PRIMARY KEY,
    tags TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
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
CREATE INDEX IF NOT EXISTS idx_asset_user_fields_rating ON asset_user_fields(rating);

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
    COALESCE(asset_user_fields.tags, assets.tags) AS tags,
    COALESCE(asset_user_fields.rating, assets.rating) AS rating,
    COALESCE(NULLIF(asset_user_fields.created_at, 0), assets.created_at) AS created_at,
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
LEFT JOIN asset_metadata ON asset_metadata.asset_id = assets.id
LEFT JOIN asset_user_fields ON asset_user_fields.path = assets.path;
"""

TS_DB_RESET_INDEX_SQL = """
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
