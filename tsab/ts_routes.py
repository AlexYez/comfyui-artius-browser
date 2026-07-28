from __future__ import annotations

import asyncio

from aiohttp import web as TSWeb
from .ts_route_errors import TSWrapRouteHandler
from .ts_settings import TS_DEFAULT_PAGE_SIZE, TS_MAX_3D_CAPTURE_DATA_URL_LENGTH
from .ts_logging import TSLogVerbose
from .ts_utils import TSParseAssetCursor, TSParseDateToEpoch, TSParseMaybeInt, TSParseQueryList

TSRoutesRegistered = False

# Single source of truth for route registration: (HTTP method, path template,
# handler function name). Kept as plain data so tooling (check_release route ↔
# CLAUDE.md Appendix B parity) can read it without importing aiohttp, and so a
# new route is added in exactly one place. Every path is registered for both
# the bare and the "/api"-prefixed variant (see TSBuildRouteVariants).
TS_ROUTE_DEFINITIONS = (
    ("GET", "/asset_browser/assets", "TSHandleAssets"),
    ("GET", "/asset_browser/search", "TSHandleAssets"),
    ("GET", "/asset_browser/asset/{id}", "TSHandleAsset"),
    ("GET", "/asset_browser/preview/{id}", "TSHandlePreview"),
    ("POST", "/asset_browser/preview/{id}/warm", "TSHandlePreviewWarm"),
    ("GET", "/asset_browser/file", "TSHandleFile"),
    ("POST", "/asset_browser/rescan", "TSHandleRescan"),
    ("POST", "/asset_browser/rebuild_cache", "TSHandleRebuildCache"),
    ("POST", "/asset_browser/delete", "TSHandleDelete"),
    ("GET", "/asset_browser/settings", "TSHandleSettingsGet"),
    ("POST", "/asset_browser/settings", "TSHandleSettingsPost"),
    ("POST", "/asset_browser/workflow/delete", "TSHandleWorkflowDelete"),
    ("GET", "/asset_browser/3d/viewer", "TSHandle3DViewer"),
    ("POST", "/asset_browser/3d/thumbnail/{id}", "TSHandle3DThumbnail"),
    ("POST", "/asset_browser/3d/stage/{id}", "TSHandle3DStage"),
    ("GET", "/asset_browser/version", "TSHandleVersion"),
    ("POST", "/asset_browser/client_log", "TSHandleClientLog"),
)

# Frontend client-log body cap (bounded so a runaway page cannot flood the
# backend ring). 64 KiB comfortably fits the 50-entry frontend ring.
TS_MAX_CLIENT_LOG_BYTES = 64 * 1024


def TSBuildRouteVariants(ts_path: str) -> tuple[str, str]:
    return ts_path, f"/api{ts_path}"


def TSParsePositiveInt(ts_value) -> int | None:
    ts_text = str(ts_value or "").strip()
    # isdecimal(), not isdigit(): isdigit() is True for non-decimal Unicode
    # digits such as "2" (superscript) or "(1)" (circled), which int() then
    # rejects - the ValueError would surface as a 500 instead of a 400.
    if not ts_text.isdecimal():
        return None
    ts_parsed = int(ts_text)
    return ts_parsed if ts_parsed > 0 else None


def TSParsePositiveAssetId(ts_value) -> int | None:
    if isinstance(ts_value, bool):
        return None
    if isinstance(ts_value, int):
        return ts_value if ts_value > 0 else None
    return TSParsePositiveInt(ts_value)


def TSParseRouteAssetId(ts_request) -> int:
    ts_asset_id = TSParsePositiveAssetId(ts_request.match_info.get("id"))
    if ts_asset_id is None:
        raise TSWeb.HTTPBadRequest(reason="Invalid asset id")
    return ts_asset_id


async def TSReadJsonObject(ts_request, *, ts_required: bool = False) -> dict:
    if not getattr(ts_request, "can_read_body", False):
        if ts_required:
            raise TSWeb.HTTPBadRequest(reason="Expected JSON object")
        return {}
    try:
        ts_payload = await ts_request.json()
    except ValueError as ts_error:
        # json.JSONDecodeError / UnicodeDecodeError: a malformed body is a
        # client error, not an internal one.
        raise TSWeb.HTTPBadRequest(reason="Invalid JSON body") from ts_error
    if not isinstance(ts_payload, dict):
        raise TSWeb.HTTPBadRequest(reason="Expected JSON object")
    return ts_payload


def TSParseAssetIdList(ts_value) -> list[int]:
    if not isinstance(ts_value, list):
        raise TSWeb.HTTPBadRequest(reason="Expected ids list")
    ts_asset_ids: list[int] = []
    for ts_asset_id_value in ts_value:
        ts_asset_id = TSParsePositiveAssetId(ts_asset_id_value)
        if ts_asset_id is None:
            raise TSWeb.HTTPBadRequest(reason="Invalid asset id")
        ts_asset_ids.append(ts_asset_id)
    return ts_asset_ids


def TSRejectUnsupportedAssetQueryParams(ts_query) -> None:
    if "metadata" in ts_query:
        raise TSWeb.HTTPBadRequest(reason="Unsupported query param: metadata")


def TSEnforceRequestContentLength(ts_request, ts_max_bytes: int) -> None:
    ts_headers = getattr(ts_request, "headers", {}) or {}
    ts_content_length = TSParsePositiveInt(ts_headers.get("Content-Length") or ts_headers.get("content-length"))
    if ts_content_length is not None and ts_content_length > ts_max_bytes:
        raise TSWeb.HTTPRequestEntityTooLarge(max_size=ts_max_bytes, actual_size=ts_content_length)


def _TSBindRouteHandler(ts_handler, ts_runtime):
    # Factory (not an inline lambda in the loop) so ts_handler is captured per
    # call — avoids the classic late-binding closure bug where every route would
    # end up pointing at the last handler in the loop.
    return TSWrapRouteHandler(lambda ts_request: ts_handler(ts_runtime, ts_request))


def TSRegisterRoutes(ts_runtime) -> None:
    global TSRoutesRegistered
    if TSRoutesRegistered:
        TSLogVerbose("routes.register.skipped", reason="already_registered")
        return
    from server import PromptServer

    ts_server = getattr(PromptServer, "instance", None)
    if ts_server is None or getattr(ts_server, "app", None) is None:
        TSLogVerbose("routes.register.skipped", reason="prompt_server_unavailable")
        return

    ts_method_map = {"GET": TSWeb.get, "POST": TSWeb.post}
    ts_module_globals = globals()
    ts_routes = []
    for ts_method, ts_path_template, ts_handler_name in TS_ROUTE_DEFINITIONS:
        ts_register = ts_method_map[ts_method]
        ts_handler = ts_module_globals[ts_handler_name]
        for ts_path in TSBuildRouteVariants(ts_path_template):
            ts_routes.append(ts_register(ts_path, _TSBindRouteHandler(ts_handler, ts_runtime)))

    ts_server.app.add_routes(ts_routes)
    TSRoutesRegistered = True
    TSLogVerbose(
        "routes.registered",
        route_count=len(ts_routes),
        route_groups=sorted({ts_path for _, ts_path, _ in TS_ROUTE_DEFINITIONS}),
    )


async def TSHandleAssets(ts_runtime, ts_request):
    TSLogVerbose("route.assets.request", query=dict(ts_request.query), path=ts_request.path)
    TSRejectUnsupportedAssetQueryParams(ts_request.query)
    ts_filters = {
        "types": TSParseQueryList(ts_request.query.get("types") or ts_request.query.get("filter")),
        "scopes": TSParseQueryList(ts_request.query.get("scope")),
        "root_ids": TSParseQueryList(ts_request.query.get("root_id")),
        "folder": ts_request.query.get("folder"),
        "date_from": TSParseDateToEpoch(ts_request.query.get("date_from")),
        "date_to": TSParseDateToEpoch(ts_request.query.get("date_to"), ts_end_of_day=True),
        "min_width": TSParseMaybeInt(ts_request.query.get("min_width")),
        "max_width": TSParseMaybeInt(ts_request.query.get("max_width")),
        "min_height": TSParseMaybeInt(ts_request.query.get("min_height")),
        "max_height": TSParseMaybeInt(ts_request.query.get("max_height")),
        "sort_key": ts_request.query.get("sort") or "created_at",
        "sort_direction": ts_request.query.get("order") or "desc",
        "search_scope": ts_request.query.get("search_scope") or "filename",
    }
    ts_limit = min(500, max(1, TSParseMaybeInt(ts_request.query.get("limit")) or TS_DEFAULT_PAGE_SIZE))
    ts_view = ts_request.query.get("view") or "flat"
    ts_query = ts_request.query.get("q") or ""
    ts_cursor_after = TSParseAssetCursor(ts_request.query)
    ts_response_payload = await asyncio.to_thread(
        ts_runtime.TSQueryAssets,
        ts_search_text=ts_query,
        ts_filters=ts_filters,
        ts_cursor_after=ts_cursor_after,
        ts_limit=ts_limit,
        ts_view=ts_view,
    )
    TSLogVerbose(
        "route.assets.response",
        path=ts_request.path,
        returned=len(ts_response_payload.get("items", [])),
        has_more=ts_response_payload.get("has_more"),
    )
    return TSWeb.json_response(ts_response_payload)


async def TSHandleAsset(ts_runtime, ts_request):
    ts_asset_id = TSParseRouteAssetId(ts_request)
    TSLogVerbose("route.asset.request", asset_id=ts_asset_id, path=ts_request.path)
    ts_asset_payload = await asyncio.to_thread(ts_runtime.TSGetAssetDetail, ts_asset_id)
    if ts_asset_payload is None:
        raise TSWeb.HTTPNotFound()
    return TSWeb.json_response(ts_asset_payload)


async def TSHandlePreview(ts_runtime, ts_request):
    ts_asset_id = TSParseRouteAssetId(ts_request)
    TSLogVerbose("route.preview.request", asset_id=ts_asset_id, path=ts_request.path)
    return await asyncio.to_thread(ts_runtime.TSBuildPreviewResponse, ts_asset_id)


async def TSHandlePreviewWarm(ts_runtime, ts_request):
    ts_asset_id = TSParseRouteAssetId(ts_request)
    TSLogVerbose("route.preview.warm.request", asset_id=ts_asset_id, path=ts_request.path)
    return TSWeb.json_response(await asyncio.to_thread(ts_runtime.TSWarmPreview, ts_asset_id))


async def TSHandleFile(ts_runtime, ts_request):
    ts_path = ts_request.query.get("path")
    ts_asset_id = TSParseMaybeInt(ts_request.query.get("id"))
    TSLogVerbose("route.file.request", asset_id=ts_asset_id, path=ts_path, request_path=ts_request.path)
    return await asyncio.to_thread(ts_runtime.TSBuildFileResponse, ts_path=ts_path, ts_asset_id=ts_asset_id)


async def TSHandleRescan(ts_runtime, ts_request):
    ts_payload = await TSReadJsonObject(ts_request)
    ts_scope = ts_payload.get("scope")
    ts_root_id = ts_payload.get("root_id")
    TSLogVerbose("route.rescan.request", scope=ts_scope, root_id=ts_root_id, path=ts_request.path)
    ts_started = await ts_runtime.TSRequestScan(ts_scope=ts_scope, ts_root_id=ts_root_id)
    return TSWeb.json_response({"started": ts_started, "status": ts_runtime.TSGetScanStatus()})


async def TSHandleRebuildCache(ts_runtime, ts_request):
    TSLogVerbose("route.rebuild_cache.request", path=ts_request.path)
    return TSWeb.json_response(await ts_runtime.TSRequestCacheRebuild())


async def TSHandleDelete(ts_runtime, ts_request):
    ts_payload = await TSReadJsonObject(ts_request, ts_required=True)
    ts_asset_ids = TSParseAssetIdList(ts_payload.get("ids", []))
    TSLogVerbose("route.delete.request", asset_ids=ts_asset_ids, path=ts_request.path)
    ts_result = await asyncio.to_thread(ts_runtime.TSDeleteAssets, ts_asset_ids)
    return TSWeb.json_response(ts_result)


async def TSHandleSettingsGet(ts_runtime, ts_request):
    TSLogVerbose("route.settings.get", path=ts_request.path)
    return TSWeb.json_response({"ui": ts_runtime.TSGetUISettings()})


async def TSHandleSettingsPost(ts_runtime, ts_request):
    ts_payload = await TSReadJsonObject(ts_request)
    TSLogVerbose("route.settings.post", path=ts_request.path, keys=sorted((ts_payload or {}).keys()))
    ts_ui_updates = ts_payload.get("ui")
    return TSWeb.json_response({"ui": ts_runtime.TSSaveUISettings(ts_ui_updates)})


async def TSHandleWorkflowDelete(ts_runtime, ts_request):
    ts_payload = await TSReadJsonObject(ts_request)
    ts_relative_path = str(ts_payload.get("path") or "")
    TSLogVerbose("route.workflow.delete.request", path=ts_request.path, workflow_path=ts_relative_path)
    return TSWeb.json_response(await asyncio.to_thread(ts_runtime.TSDeleteRequestWorkflowFile, ts_request, ts_relative_path))


async def TSHandle3DViewer(ts_runtime, ts_request):
    TSLogVerbose("route.3d_viewer.get", path=ts_request.path)
    return TSWeb.json_response(ts_runtime.TSGet3DViewerSupport())


async def TSHandle3DThumbnail(ts_runtime, ts_request):
    ts_asset_id = TSParseRouteAssetId(ts_request)
    TSEnforceRequestContentLength(ts_request, TS_MAX_3D_CAPTURE_DATA_URL_LENGTH)
    ts_payload = await TSReadJsonObject(ts_request, ts_required=True)
    ts_image_data_url = ts_payload.get("image_data_url")
    if isinstance(ts_image_data_url, str) and len(ts_image_data_url) > TS_MAX_3D_CAPTURE_DATA_URL_LENGTH:
        raise TSWeb.HTTPRequestEntityTooLarge(
            max_size=TS_MAX_3D_CAPTURE_DATA_URL_LENGTH,
            actual_size=len(ts_image_data_url),
        )
    TSLogVerbose("route.3d_thumbnail.post", asset_id=ts_asset_id, path=ts_request.path)
    return TSWeb.json_response({"asset": await asyncio.to_thread(ts_runtime.TSSave3DThumbnail, ts_asset_id, str(ts_image_data_url or ""))})


async def TSHandle3DStage(ts_runtime, ts_request):
    ts_asset_id = TSParseRouteAssetId(ts_request)
    TSLogVerbose("route.3d_stage.post", asset_id=ts_asset_id, path=ts_request.path)
    return TSWeb.json_response(await asyncio.to_thread(ts_runtime.TSPrepare3DAssetForLoad3D, ts_asset_id))


async def TSHandleClientLog(ts_runtime, ts_request):
    TSEnforceRequestContentLength(ts_request, TS_MAX_CLIENT_LOG_BYTES)
    ts_payload = await TSReadJsonObject(ts_request, ts_required=True)
    TSLogVerbose("route.client_log.post", path=ts_request.path)
    return TSWeb.json_response(await asyncio.to_thread(ts_runtime.TSRecordClientErrors, ts_payload))


async def TSHandleVersion(ts_runtime, ts_request):
    TSLogVerbose("route.version.get", path=ts_request.path)
    ts_payload = await asyncio.to_thread(ts_runtime.TSCollectVersionInfo)
    # Additive diagnostics for bug reports; the version contract keys
    # (local/remote/update_available/repository_url/release_url) are untouched.
    ts_payload["diagnostics"] = await asyncio.to_thread(ts_runtime.TSCollectDiagnostics)
    return TSWeb.json_response(ts_payload)
