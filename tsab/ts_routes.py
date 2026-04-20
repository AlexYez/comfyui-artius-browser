from __future__ import annotations

from aiohttp import web as TSWeb
from pathlib import Path

from .ts_settings import TS_DEFAULT_PAGE_SIZE
from .ts_logging import TSLogVerbose
from .ts_load3d_stage import TSPrepare3DAssetForLoad3D
from .ts_utils import TSParseDateToEpoch, TSParseMaybeInt, TSParseQueryList

TSRoutesRegistered = False


def TSBuildRouteVariants(ts_path: str) -> tuple[str, str]:
    return ts_path, f"/api{ts_path}"


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

    ts_routes = []
    for ts_path in TSBuildRouteVariants("/asset_browser/assets"):
        ts_routes.append(TSWeb.get(ts_path, lambda ts_request: TSHandleAssets(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/search"):
        ts_routes.append(TSWeb.get(ts_path, lambda ts_request: TSHandleAssets(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/asset/{id}"):
        ts_routes.append(TSWeb.get(ts_path, lambda ts_request: TSHandleAsset(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/preview/{id}"):
        ts_routes.append(TSWeb.get(ts_path, lambda ts_request: TSHandlePreview(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/preview/{id}/warm"):
        ts_routes.append(TSWeb.post(ts_path, lambda ts_request: TSHandlePreviewWarm(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/file"):
        ts_routes.append(TSWeb.get(ts_path, lambda ts_request: TSHandleFile(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/rescan"):
        ts_routes.append(TSWeb.post(ts_path, lambda ts_request: TSHandleRescan(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/delete"):
        ts_routes.append(TSWeb.post(ts_path, lambda ts_request: TSHandleDelete(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/settings"):
        ts_routes.append(TSWeb.get(ts_path, lambda ts_request: TSHandleSettingsGet(ts_runtime, ts_request)))
        ts_routes.append(TSWeb.post(ts_path, lambda ts_request: TSHandleSettingsPost(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/workflow/delete"):
        ts_routes.append(TSWeb.post(ts_path, lambda ts_request: TSHandleWorkflowDelete(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/3d/viewer"):
        ts_routes.append(TSWeb.get(ts_path, lambda ts_request: TSHandle3DViewer(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/3d/thumbnail/{id}"):
        ts_routes.append(TSWeb.post(ts_path, lambda ts_request: TSHandle3DThumbnail(ts_runtime, ts_request)))
    for ts_path in TSBuildRouteVariants("/asset_browser/3d/stage/{id}"):
        ts_routes.append(TSWeb.post(ts_path, lambda ts_request: TSHandle3DStage(ts_runtime, ts_request)))

    ts_server.app.add_routes(ts_routes)
    TSRoutesRegistered = True
    TSLogVerbose(
        "routes.registered",
        route_count=len(ts_routes),
        route_groups=[
            "/asset_browser/assets",
            "/asset_browser/search",
            "/asset_browser/asset/{id}",
            "/asset_browser/preview/{id}",
            "/asset_browser/preview/{id}/warm",
            "/asset_browser/file",
            "/asset_browser/rescan",
            "/asset_browser/delete",
            "/asset_browser/settings",
            "/asset_browser/workflow/delete",
            "/asset_browser/3d/viewer",
            "/asset_browser/3d/thumbnail/{id}",
            "/asset_browser/3d/stage/{id}",
        ],
    )


async def TSHandleAssets(ts_runtime, ts_request):
    TSLogVerbose("route.assets.request", query=dict(ts_request.query), path=ts_request.path)
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
        "min_rating": TSParseMaybeInt(ts_request.query.get("min_rating")),
        "max_rating": TSParseMaybeInt(ts_request.query.get("max_rating")),
        "metadata_filter": ts_request.query.get("metadata"),
        "sort_key": ts_request.query.get("sort") or "created_at",
        "sort_direction": ts_request.query.get("order") or "desc",
    }
    ts_offset = max(0, TSParseMaybeInt(ts_request.query.get("offset")) or 0)
    ts_limit = min(500, max(1, TSParseMaybeInt(ts_request.query.get("limit")) or TS_DEFAULT_PAGE_SIZE))
    ts_view = ts_request.query.get("view") or "flat"
    ts_query = ts_request.query.get("q") or ""
    ts_response_payload = ts_runtime.TSQueryAssets(
        ts_search_text=ts_query,
        ts_filters=ts_filters,
        ts_offset=ts_offset,
        ts_limit=ts_limit,
        ts_view=ts_view,
    )
    TSLogVerbose(
        "route.assets.response",
        path=ts_request.path,
        total=ts_response_payload.get("total"),
        returned=len(ts_response_payload.get("items", [])),
    )
    return TSWeb.json_response(ts_response_payload)


async def TSHandleAsset(ts_runtime, ts_request):
    ts_asset_id = int(ts_request.match_info["id"])
    TSLogVerbose("route.asset.request", asset_id=ts_asset_id, path=ts_request.path)
    ts_asset_payload = ts_runtime.TSGetAssetDetail(ts_asset_id)
    if ts_asset_payload is None:
        raise TSWeb.HTTPNotFound()
    return TSWeb.json_response(ts_asset_payload)


async def TSHandlePreview(ts_runtime, ts_request):
    ts_asset_id = int(ts_request.match_info["id"])
    TSLogVerbose("route.preview.request", asset_id=ts_asset_id, path=ts_request.path)
    return ts_runtime.TSBuildPreviewResponse(ts_asset_id)


async def TSHandlePreviewWarm(ts_runtime, ts_request):
    ts_asset_id = int(ts_request.match_info["id"])
    TSLogVerbose("route.preview.warm.request", asset_id=ts_asset_id, path=ts_request.path)
    return TSWeb.json_response(ts_runtime.TSWarmPreview(ts_asset_id))


async def TSHandleFile(ts_runtime, ts_request):
    ts_path = ts_request.query.get("path")
    ts_asset_id = TSParseMaybeInt(ts_request.query.get("id"))
    TSLogVerbose("route.file.request", asset_id=ts_asset_id, path=ts_path, request_path=ts_request.path)
    return ts_runtime.TSBuildFileResponse(ts_path=ts_path, ts_asset_id=ts_asset_id)


async def TSHandleRescan(ts_runtime, ts_request):
    ts_payload = await ts_request.json() if ts_request.can_read_body else {}
    ts_scope = ts_payload.get("scope") if isinstance(ts_payload, dict) else None
    ts_root_id = ts_payload.get("root_id") if isinstance(ts_payload, dict) else None
    TSLogVerbose("route.rescan.request", scope=ts_scope, root_id=ts_root_id, path=ts_request.path)
    ts_started = await ts_runtime.TSRequestScan(ts_scope=ts_scope, ts_root_id=ts_root_id)
    return TSWeb.json_response({"started": ts_started, "status": ts_runtime.TSGetScanStatus()})


async def TSHandleDelete(ts_runtime, ts_request):
    ts_payload = await ts_request.json()
    ts_asset_ids = [int(ts_asset_id) for ts_asset_id in ts_payload.get("ids", [])]
    TSLogVerbose("route.delete.request", asset_ids=ts_asset_ids, path=ts_request.path)
    ts_result = ts_runtime.TSDeleteAssets(ts_asset_ids)
    return TSWeb.json_response(ts_result)


async def TSHandleSettingsGet(ts_runtime, ts_request):
    TSLogVerbose("route.settings.get", path=ts_request.path)
    return TSWeb.json_response({"ui": ts_runtime.TSGetUISettings()})


async def TSHandleSettingsPost(ts_runtime, ts_request):
    ts_payload = await ts_request.json() if ts_request.can_read_body else {}
    TSLogVerbose("route.settings.post", path=ts_request.path, keys=sorted((ts_payload or {}).keys()))
    ts_ui_updates = ts_payload.get("ui") if isinstance(ts_payload, dict) else {}
    return TSWeb.json_response({"ui": ts_runtime.TSSaveUISettings(ts_ui_updates)})


def _TSResolveWorkflowAbsolutePath(ts_request, ts_relative_path: str) -> Path:
    from server import PromptServer

    ts_normalized_path = str(ts_relative_path or "").replace("\\", "/").strip("/")
    if not ts_normalized_path.lower().startswith("workflows/") or not ts_normalized_path.lower().endswith(".json"):
        raise TSWeb.HTTPBadRequest(reason="Invalid workflow path")
    ts_server = getattr(PromptServer, "instance", None)
    ts_user_manager = getattr(ts_server, "user_manager", None)
    if ts_user_manager is None:
        raise TSWeb.HTTPInternalServerError(reason="User manager unavailable")
    ts_absolute_path = ts_user_manager.get_request_user_filepath(ts_request, ts_normalized_path, create_dir=False)
    if not ts_absolute_path:
        raise TSWeb.HTTPBadRequest(reason="Invalid workflow path")
    return Path(str(ts_absolute_path)).resolve()


async def TSHandleWorkflowDelete(ts_runtime, ts_request):
    ts_payload = await ts_request.json() if ts_request.can_read_body else {}
    ts_relative_path = str(ts_payload.get("path") or "") if isinstance(ts_payload, dict) else ""
    TSLogVerbose("route.workflow.delete.request", path=ts_request.path, workflow_path=ts_relative_path)
    ts_workflow_path = _TSResolveWorkflowAbsolutePath(ts_request, ts_relative_path)
    return TSWeb.json_response(ts_runtime.TSDeleteWorkflowFile(ts_workflow_path))


async def TSHandle3DViewer(ts_runtime, ts_request):
    TSLogVerbose("route.3d_viewer.get", path=ts_request.path)
    return TSWeb.json_response(ts_runtime.TSGet3DViewerSupport())


async def TSHandle3DThumbnail(ts_runtime, ts_request):
    ts_asset_id = int(ts_request.match_info["id"])
    ts_payload = await ts_request.json() if ts_request.can_read_body else {}
    ts_image_data_url = ts_payload.get("image_data_url") if isinstance(ts_payload, dict) else ""
    TSLogVerbose("route.3d_thumbnail.post", asset_id=ts_asset_id, path=ts_request.path)
    return TSWeb.json_response({"asset": ts_runtime.TSSave3DThumbnail(ts_asset_id, str(ts_image_data_url or ""))})


async def TSHandle3DStage(ts_runtime, ts_request):
    ts_asset_id = int(ts_request.match_info["id"])
    TSLogVerbose("route.3d_stage.post", asset_id=ts_asset_id, path=ts_request.path)
    return TSWeb.json_response(TSPrepare3DAssetForLoad3D(ts_runtime, ts_asset_id))
