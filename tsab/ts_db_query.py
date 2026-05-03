from __future__ import annotations

from typing import Any

from .ts_utils import TSBuildFTSQuery


def TSBuildAssetQueryParts(
    ts_search_text: str = "",
    ts_filters: dict[str, Any] | None = None,
) -> tuple[str, str, list[Any], str]:
    ts_filters = ts_filters or {}
    ts_where_clauses: list[str] = []
    ts_parameters: list[Any] = []
    ts_from_sql = "assets_view"

    if ts_search_text.strip():
        ts_fts_query = TSBuildFTSQuery(ts_search_text)
        if ts_fts_query:
            ts_from_sql = "assets_view INNER JOIN assets_fts ON assets_fts.rowid = assets_view.id"
            ts_where_clauses.append("assets_fts.filename MATCH ?")
            ts_parameters.append(ts_fts_query)
        else:
            ts_search_value = str(ts_search_text).strip().replace("%", r"\%").replace("_", r"\_")
            ts_where_clauses.append("assets_view.filename LIKE ? ESCAPE '\\' COLLATE NOCASE")
            ts_parameters.append(f"%{ts_search_value}%")

    if ts_filters.get("types"):
        ts_types = list(ts_filters["types"])
        ts_where_clauses.append(f"assets_view.type IN ({','.join('?' for _ in ts_types)})")
        ts_parameters.extend(ts_types)
    if ts_filters.get("scopes"):
        ts_scopes = list(ts_filters["scopes"])
        ts_where_clauses.append(f"assets_view.scope IN ({','.join('?' for _ in ts_scopes)})")
        ts_parameters.extend(ts_scopes)
    if ts_filters.get("root_ids"):
        ts_root_ids = list(ts_filters["root_ids"])
        ts_where_clauses.append(f"assets_view.root_id IN ({','.join('?' for _ in ts_root_ids)})")
        ts_parameters.extend(ts_root_ids)
    if ts_filters.get("folder") is not None:
        ts_folder = str(ts_filters["folder"]).strip()
        if ts_folder:
            ts_where_clauses.append("(assets_view.folder_path = ? OR assets_view.folder_path LIKE ?)")
            ts_parameters.extend([ts_folder, f"{ts_folder}/%"])
    if ts_filters.get("date_from") is not None:
        ts_where_clauses.append("assets_view.created_at >= ?")
        ts_parameters.append(int(ts_filters["date_from"]))
    if ts_filters.get("date_to") is not None:
        ts_where_clauses.append("assets_view.created_at <= ?")
        ts_parameters.append(int(ts_filters["date_to"]))
    if ts_filters.get("min_width") is not None:
        ts_where_clauses.append("assets_view.width >= ?")
        ts_parameters.append(int(ts_filters["min_width"]))
    if ts_filters.get("max_width") is not None:
        ts_where_clauses.append("assets_view.width <= ?")
        ts_parameters.append(int(ts_filters["max_width"]))
    if ts_filters.get("min_height") is not None:
        ts_where_clauses.append("assets_view.height >= ?")
        ts_parameters.append(int(ts_filters["min_height"]))
    if ts_filters.get("max_height") is not None:
        ts_where_clauses.append("assets_view.height <= ?")
        ts_parameters.append(int(ts_filters["max_height"]))
    if ts_filters.get("min_rating") is not None:
        ts_where_clauses.append("assets_view.rating >= ?")
        ts_parameters.append(int(ts_filters["min_rating"]))
    if ts_filters.get("max_rating") is not None:
        ts_where_clauses.append("assets_view.rating <= ?")
        ts_parameters.append(int(ts_filters["max_rating"]))

    ts_where_clauses.append("assets_view.is_companion_image = 0")
    ts_where_sql = f" WHERE {' AND '.join(ts_where_clauses)}" if ts_where_clauses else ""
    ts_sort_key = str(ts_filters.get("sort_key") or "created_at")
    ts_sort_direction = "ASC" if str(ts_filters.get("sort_direction")).lower() == "asc" else "DESC"
    ts_sort_map = {
        "created_at": "assets_view.created_at",
        "mtime": "assets_view.mtime_ns",
        "filename": "assets_view.filename COLLATE NOCASE",
        "size_bytes": "assets_view.size_bytes",
        "rating": "assets_view.rating",
    }
    ts_sort_sql = ts_sort_map.get(ts_sort_key, "assets_view.created_at")
    ts_order_by_sql = f" ORDER BY {ts_sort_sql} {ts_sort_direction}, assets_view.id DESC"
    return ts_from_sql, ts_where_sql, ts_parameters, ts_order_by_sql
