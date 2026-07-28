from __future__ import annotations

from typing import Any

from .ts_utils import TSBuildFTSQuery

TS_SORT_KEY_MAP: dict[str, dict[str, Any]] = {
    "created_at": {"column": "assets_view.created_at", "row_field": "created_at", "type": int, "collate": ""},
    "mtime": {"column": "assets_view.mtime_ns", "row_field": "mtime_ns", "type": int, "collate": ""},
    "filename": {"column": "assets_view.filename", "row_field": "filename", "type": str, "collate": "COLLATE NOCASE"},
    "size_bytes": {"column": "assets_view.size_bytes", "row_field": "size_bytes", "type": int, "collate": ""},
}

TS_DEFAULT_SORT_KEY = "created_at"


def TSResolveSortKey(ts_sort_key: str | None) -> str:
    return ts_sort_key if ts_sort_key in TS_SORT_KEY_MAP else TS_DEFAULT_SORT_KEY


def TSCoerceSortValue(ts_sort_key: str, ts_value: Any) -> Any:
    ts_descriptor = TS_SORT_KEY_MAP.get(TSResolveSortKey(ts_sort_key))
    if ts_descriptor is None:
        return ts_value
    ts_python_type = ts_descriptor["type"]
    try:
        return ts_python_type(ts_value)
    except (TypeError, ValueError):
        return None


def TSBuildAssetQueryParts(
    ts_search_text: str = "",
    ts_filters: dict[str, Any] | None = None,
    ts_cursor_after: dict[str, Any] | None = None,
) -> tuple[str, str, list[Any], str]:
    ts_filters = ts_filters or {}
    ts_where_clauses: list[str] = []
    ts_parameters: list[Any] = []
    ts_from_sql = "assets_view"

    if ts_search_text.strip():
        # Opt-in scope: "all" also searches the prompt_text FTS column; the
        # default stays filename-only (the frozen product default). A missing /
        # unknown scope falls back to filename.
        ts_search_prompts = str(ts_filters.get("search_scope") or "filename").lower() == "all"
        ts_fts_query = TSBuildFTSQuery(ts_search_text)
        if ts_fts_query:
            ts_from_sql = "assets_view INNER JOIN assets_fts ON assets_fts.rowid = assets_view.id"
            if ts_search_prompts:
                # Match the whole FTS row (filename + prompt_text columns).
                ts_where_clauses.append("assets_fts MATCH ?")
            else:
                ts_where_clauses.append("assets_fts.filename MATCH ?")
            ts_parameters.append(ts_fts_query)
        else:
            ts_search_value = str(ts_search_text).strip().replace("%", r"\%").replace("_", r"\_")
            if ts_search_prompts:
                ts_where_clauses.append(
                    "(assets_view.filename LIKE ? ESCAPE '\\' COLLATE NOCASE "
                    "OR assets_view.prompt_text LIKE ? ESCAPE '\\' COLLATE NOCASE)"
                )
                ts_parameters.extend([f"%{ts_search_value}%", f"%{ts_search_value}%"])
            else:
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
            # The subtree pattern must escape LIKE wildcards the same way the
            # search clause above does: an unescaped "_" in a folder name is a
            # single-character wildcard, so selecting "img_2024" would also
            # return everything under a sibling "img-2024".
            ts_folder_pattern = ts_folder.replace("\\", r"\\").replace("%", r"\%").replace("_", r"\_")
            ts_where_clauses.append(
                "(assets_view.folder_path = ? OR assets_view.folder_path LIKE ? ESCAPE '\\')"
            )
            ts_parameters.extend([ts_folder, f"{ts_folder_pattern}/%"])
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
    ts_where_clauses.append("assets_view.is_companion_image = 0")

    ts_sort_key = TSResolveSortKey(ts_filters.get("sort_key"))
    ts_sort_descriptor = TS_SORT_KEY_MAP[ts_sort_key]
    ts_sort_column = ts_sort_descriptor["column"]
    ts_sort_collate = ts_sort_descriptor["collate"]
    ts_sort_direction = "ASC" if str(ts_filters.get("sort_direction")).lower() == "asc" else "DESC"

    if ts_cursor_after is not None:
        ts_cursor_value = TSCoerceSortValue(ts_sort_key, ts_cursor_after.get("sort_value"))
        ts_cursor_id = ts_cursor_after.get("id")
        try:
            ts_cursor_id = int(ts_cursor_id) if ts_cursor_id is not None else None
        except (TypeError, ValueError):
            ts_cursor_id = None
        if ts_cursor_value is not None and ts_cursor_id is not None:
            ts_strict_op = "<" if ts_sort_direction == "DESC" else ">"
            ts_id_op = "<" if ts_sort_direction == "DESC" else ">"
            ts_collate_clause = f" {ts_sort_collate}" if ts_sort_collate else ""
            ts_where_clauses.append(
                f"({ts_sort_column} {ts_strict_op} ?{ts_collate_clause} "
                f"OR ({ts_sort_column} = ?{ts_collate_clause} AND assets_view.id {ts_id_op} ?))"
            )
            ts_parameters.extend([ts_cursor_value, ts_cursor_value, ts_cursor_id])

    ts_where_sql = f" WHERE {' AND '.join(ts_where_clauses)}" if ts_where_clauses else ""
    ts_id_direction = "DESC" if ts_sort_direction == "DESC" else "ASC"
    ts_collate_for_order = f" {ts_sort_collate}" if ts_sort_collate else ""
    ts_order_by_sql = (
        f" ORDER BY {ts_sort_column}{ts_collate_for_order} {ts_sort_direction}, "
        f"assets_view.id {ts_id_direction}"
    )
    return ts_from_sql, ts_where_sql, ts_parameters, ts_order_by_sql
