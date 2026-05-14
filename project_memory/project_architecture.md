---
name: Project architecture — Artius Browser
description: High-level architecture map of the Artius Browser ComfyUI extension — entry points, backend services, frontend modules, storage, invariants
type: project
originSessionId: a2d6a6c9-e2d8-46d7-87d2-82cc7de3c081
---
**Project identity** (from `pyproject.toml` / `ts_settings.py`):
- Display name: `Timesaver Artius Browser`
- Package: `comfyui-artius-browser`
- Publisher: `timesaver`
- Python package: `tsab` (prefix `TS` / `ts_`)
- Frontend prefix: `ts-artius-browser-*` (helpers `ts*`)
- Extension/sidebar id: `timesaver.artius.browser` / `timesaver-artius-browser`
- Event prefix: `tsab:`
- Drag MIME: `application/x-timesaver-artius-asset`
- Repo: https://github.com/AlexYez/comfyui-artius-browser

**Type:** ComfyUI sidebar extension (NOT a node pack — `TSArtiusBrowserExtension.get_node_list()` returns `[]`). Native Comfy nodes are used: `LoadImage`, `LoadVideo`, `LoadAudio`, `Load3D`.

**Two tabs:**
- `Assets` — backend-indexed (DB + cache), filename-only search
- `Workflows` — **frontend-only**, reads `GET /v2/userdata?path=workflows`, NEVER touches asset DB

Tabs keep independent persisted UI state (search, sort, preview size, Flat/Tree, selected folder).

## Lifecycle / entry points

- [__init__.py](__init__.py) — `WEB_DIRECTORY = "./js"`, creates singleton via `TSGetRuntime() → TSBootstrap()`, exposes `comfy_entrypoint() → TSStart()`. Heavy work happens at startup but no full-library scan.
- [tsab/ts_nodes.py](tsab/ts_nodes.py) — `TSArtiusBrowserExtension(ComfyExtension)`, returns no nodes.
- [js/ts-artius-browser.js](js/ts-artius-browser.js) — frontend bootstrap: registers sidebar tab, mounts panel, starts global 3D worker, schedules autoscan + post-execution rescan (debounced).

## Backend (`tsab/`) — composition root + focused services

`TSAssetBrowserRuntime` ([tsab/ts_runtime.py](tsab/ts_runtime.py)) is the route-facing facade. It owns shared infrastructure and delegates business logic to:

- [ts_asset_catalog.py](tsab/ts_asset_catalog.py) — `TSAssetCatalogService`: list/detail payloads, health, roots, tree folders, video/audio enrichment
- [ts_asset_processing.py](tsab/ts_asset_processing.py) — `TSAssetProcessingService`: per-asset ensure indexed/preview/metadata, asset-upsert events
- [ts_scan_service.py](tsab/ts_scan_service.py) — `TSScanService`: autoscan scheduling, manual rescan, rebuild-cache orchestration
- [ts_browser_settings.py](tsab/ts_browser_settings.py) — `TSBrowserSettingsService`: UI settings + autoscan flag
- [ts_workflows.py](tsab/ts_workflows.py) — `TSWorkflowService`: workflow path resolution + workflow/sidecar trashing
- [ts_delete.py](tsab/ts_delete.py) — `TSDeleteService`: asset deletion through system trash + preview cache purge

Runtime keeps: service construction, route-facing public method names, websocket events, preview/file HTTP responses, root list, 3D viewer support discovery, 3D thumbnail save wiring. **Do not move asset-list/detail, scan/rebuild, settings, or workflow-file deletion back into runtime.**

### Storage / config / database

- [ts_storage.py](tsab/ts_storage.py) — `TSStoragePaths`: resolves `output`, `input`, base; cache layout under `<output>/.ts_artius_browser/`:
  - `db.sqlite`, `config.json`
  - `cache/{thumbnails, video_frames, waveforms, placeholders}`
  - Ignored scan paths: `.ts_artius_browser`, legacy `.asset_browser`
  - 3D staging: `<input>/3d/.ts_artius_browser/...`
- [ts_config.py](tsab/ts_config.py) — `TSConfigStore`: loads/saves `config.json`, version `13`
- [ts_settings.py](tsab/ts_settings.py) — defaults; `TS_DEFAULT_CONFIG` (UI keys: `autoscan`, `browser_section`, `asset_view_mode`, `workflow_view_mode`, `asset_sort_*`, `workflow_sort_*`, `*_preview_size`, `*_search`, `asset_types`, `selected_root_id`, `selected_folder_path`, `workflow_selected_folder_path`, `expanded_folders`, `browser_width`)
- Supported extensions: image `.png .jpg .jpeg .webp .avif`; video `.mp4 .mov .webm .prores`; audio `.mp3 .wav .flac .opus .ogg`; 3d `.glb .obj`
- [ts_db.py](tsab/ts_db.py) — `TSDatabase` repository facade
  - [ts_db_schema.py](tsab/ts_db_schema.py) — DDL/reset SQL/version
  - [ts_db_query.py](tsab/ts_db_query.py) — list/search/filter/order SQL + companion-image suppression
  - [ts_db_payload.py](tsab/ts_db_payload.py) — `Row → TSAssetPayload`
  - PRAGMAs: WAL, synchronous=NORMAL, temp_store=MEMORY, cache_size=-8000, mmap_size=256MB, foreign_keys=ON
  - Tables: lookup (`asset_types`, `asset_extensions`, `asset_roots`, `asset_folders`); main (`assets`, `asset_metadata`, `assets_fts`); view (`assets_view`). Schema version: `10`.
  - `assets.is_companion_image` + `assets.companion_stem` columns drive companion-image suppression. Recomputed by `_TSRecomputeCompanionFlags(folder_keys)` after batch upsert and after delete. Listing filters `WHERE assets_view.is_companion_image = 0` via `idx_assets_companion_filter`.
  - Tags / rating / `asset_user_fields` were removed in v10. No user-annotation surface today.
  - FTS is filename-only (no prompt/workflow/metadata)
  - Status: `discovered → indexed → previewed → metadata_ready` (derived from flags `is_indexed`, `has_preview`, `has_metadata`)
  - Companion images for video/audio/3d are suppressed in queries

### Indexing / handlers

- [ts_indexer.py](tsab/ts_indexer.py) — `TSIndexer`: scan orchestration, ThreadPoolExecutor, eager processing
  - [ts_indexer_discovery.py](tsab/ts_indexer_discovery.py) — directory walk, ignored paths, companion sidecar filtering
  - [ts_indexer_progress.py](tsab/ts_indexer_progress.py) — percent/message/bar formatting
  - [ts_indexer_payload.py](tsab/ts_indexer_payload.py) — carries `created_at` from existing rows
  - Cheap-compare via `mtime_ns + size_bytes + kind`; hash only when needed
  - Pipeline: discovered payload → write → resolve handler → hash → indexed payload → preview → metadata → batch upsert
  - Events: `tsab:index-start`, `tsab:index-progress`, `tsab:index-complete`, `tsab:health`, `tsab:asset-upsert`, `tsab:asset-remove`
- [ts_handlers.py](tsab/ts_handlers.py) — `TSHandlerRegistry`, `TSAssetHandler` protocol (`TSBuildDiscoveredPayload`, `TSBuildIndexedPayload`, `TSGeneratePreview`, `TSExtractMetadata`)
- [tsab/media/](tsab/media/): `common.py` (shared builders), `image.py`, `video.py`, `audio.py`, `three_d.py`, `probe.py`, `prompt_metadata.py`
  - Image: dimensions + thumbnail; PNG `Prompt` → prompt + negative prompt (split, hide negative if identical to positive); PNG `Workflow` → workflow JSON. **No seed field.** No `exiftool`.
  - Video/audio: ffprobe + ffmpeg
  - 3D: backend creates placeholder/sidecar only; **real thumbnail is frontend-captured**
- [ts_metadata_extract.py](tsab/ts_metadata_extract.py) — generic prompt/workflow text extraction (do NOT put media-specific parsing back into `ts_utils.py`)

### Preview / tools / 3D

- [ts_preview.py](tsab/ts_preview.py) — `TSPreviewCache`: builds/resolves preview paths, generates by type, persists frontend 3D captures, theme-friendly transparent placeholders, reference-counted deletion
- [ts_tools.py](tsab/ts_tools.py) — `TSToolLocator`: resolves `ffmpeg`/`ffprobe` from config → PATH → portable Comfy candidates, runs bounded subprocess
- [ts_load3d_stage.py](tsab/ts_load3d_stage.py) — stages `.glb`/`.obj` (+`.obj` deps) into `<input>/3d/.ts_artius_browser/...` so native `Load3D` can consume them
- [ts_3d_thumbnail.py](tsab/ts_3d_thumbnail.py) — receives data URL captures from frontend, validates size/MIME, persists into cache

### Routes ([ts_routes.py](tsab/ts_routes.py))

All registered in plain and `/api` variants. Thin wrappers over runtime.

- `GET  /asset_browser/assets` and `/search` — filename-only; **rejects `metadata` query param with 400**. Pagination is keyset: client sends `after_sort`+`after_id`; server returns `next_cursor` in payload. No `offset`.
- `GET  /asset_browser/asset/{id}`
- `GET  /asset_browser/preview/{id}` ; `POST /asset_browser/preview/{id}/warm`
- `GET  /asset_browser/file?path=&id=`
- `POST /asset_browser/rescan`, `/rebuild_cache`, `/delete`, `/workflow/delete`
- `GET/POST /asset_browser/settings`
- `GET  /asset_browser/3d/viewer`
- `POST /asset_browser/3d/thumbnail/{id}` (data URL bounded by `TS_MAX_3D_CAPTURE_DATA_URL_LENGTH = 8 MiB`)
- `POST /asset_browser/3d/stage/{id}`

## Frontend (`js/`) — modules

- [ts-artius-browser.js](js/ts-artius-browser.js) — entry: registers sidebar tab via `app.extensionManager.registerSidebarTab`, drag-drop bridge, 3D worker, autoscan on `execution_success`
- [ts-artius-browser-settings.js](js/ts-artius-browser-settings.js) — frozen config: `tsProjectSettings`, `tsApiSettings` (routeBase `/asset_browser`, drag MIME, native node mappings), `tsBrowserRuntimeSettings`, `tsPanelSettings`, `tsViewerSettings`
- [ts-artius-browser-api.js](js/ts-artius-browser-api.js) — fetch wrappers, locale loading, generic utils, folder-tree builder, workflow/node integration, canvas drop bridge. Helpers: `tsFetchJSON`, `tsPostJSON`, `tsFetchAssetDetail`, `tsDeleteAssetIds`, `tsFetchWorkflowBrowserLibrary`, `tsLoadWorkflowIntoComfy`, `tsFetch3DViewerSupport`, `tsSave3DThumbnail`, `tsStage3DAssetForLoad3D`, `tsBuildFolderTree` (bottom-up parent counts), drag-drop with custom MIME
- [ts-artius-browser-api-workflow.js](js/ts-artius-browser-api-workflow.js) — **THE Comfy graph/canvas adapter**. Direct `app.graph`, `app.graph._nodes`, `app.canvas.graph_mouse`, `app.canvas.visible_nodes`, `window.LiteGraph` access lives ONLY here. Other modules must call: `tsGetComfyCanvasElement`, `tsGetComfyGraph`, `tsGetComfyCanvasDropGraphPosition`, `tsGetComfyVisibleNodes`, `tsCreateComfyGraphNode`, `tsAddComfyGraphNode`, `tsMarkComfyGraphDirty`
- API helper splits: `ts-artius-browser-api-{open,paths,tree,utils,widgets,workflow}.js`
- [ts-artius-browser-panel.js](js/ts-artius-browser-panel.js) (~117 KB) — `TSArtiusBrowserPanel extends HTMLElement` (Shadow DOM): section switcher, toolbar, root selector, type filters, sort, Flat/Tree, autoscan toggle, rebuild-cache, virtualized grid, selection, card actions, viewer open. Post-fetch render uses lighter `tsRenderListOnly` (filter/sort/search) vs full `tsRenderAll` (resize / rebuild). Type-chip clicks go through `tsDebouncedFilterRefresh` (120ms).
  - Panel helpers: `ts-artius-browser-panel-{cache,format,grid,query,selection,state,workflows}.js`
- [ts-artius-browser-panel-cache.js](js/ts-artius-browser-panel-cache.js) — `TSAssetResponseCache`: LRU 10 + TTL 30s. Used by `tsFetchAssets(true)` for stale-while-revalidate (cache hit = sync render; stale → background `tsScheduleRevalidation` updates cache + grid only if items changed). Cache invalidated by `tsab:asset-upsert/remove/index-complete` and Rebuild Cache.
- [ts-artius-browser-viewer.js](js/ts-artius-browser-viewer.js) (~82 KB) — `TSArtiusBrowserViewer extends HTMLElement`: lightbox, zoom/pan, video frame stepping, audio waveform, native 3D, compare mode (`2`/`4`)
  - Viewer helpers: `ts-artius-browser-viewer-{format,meta,stage,state}.js`
  - Stage cleanup MUST go through `tsStageCleanup` callback
- [ts-artius-browser-3d.js](js/ts-artius-browser-3d.js) — locates Comfy 3D viewer module, instantiates hidden viewer, calls `captureThumbnail()`
- [ts-artius-browser-3d-worker.js](js/ts-artius-browser-3d-worker.js) — `TSGlobal3DThumbnailWorker`: runs whenever ComfyUI page is open (NOT just sidebar). `tsStop()` MUST remove API/document/window listeners.
- [js/localization/en.json](js/localization/en.json) — only `en` locale present

## Card / quick actions

Asset cards: `P` copy prompt, `W` copy workflow (only if PNG has workflow), `D` download, `X` delete (only if root allows).
Workflow cards: `L` load into ComfyUI (uses `app.loadGraphData(..., workflowStorePath)` when available — preserves save-back), `D` download JSON, `X` trash JSON + sidecar previews.

## Where to patch what (cheat sheet)

| Concern | Primary file |
|---|---|
| Scan logic | `tsab/ts_indexer.py` |
| Discovery / ignore / companion sidecar | `tsab/ts_indexer_discovery.py` |
| Scan progress text/bar | `tsab/ts_indexer_progress.py` |
| `created_at` carry-over in scan | `tsab/ts_indexer_payload.py` |
| Companion stem (Python helper) | `tsab/ts_companion.py` |
| Companion stem write + flag recompute | `_TSDoUpsertAsset`, `_TSRecomputeCompanionFlags` in `tsab/ts_db.py` |
| Keyset cursor build/parse | `TSBuildAssetQueryParts`, `_TSBuildNextCursor` (`tsab/ts_db_query.py`, `tsab/ts_db.py`); `TSParseAssetCursor` in `tsab/ts_utils.py` |
| DB facade | `tsab/ts_db.py` |
| DB schema/reset | `tsab/ts_db_schema.py` |
| DB queries/filters | `tsab/ts_db_query.py` |
| DB row → payload | `tsab/ts_db_payload.py` |
| Preview generation/cache | `tsab/ts_preview.py` |
| PNG prompt/workflow | `tsab/media/image.py` (+ `tsab/ts_metadata_extract.py`) |
| Browser UI | `js/ts-artius-browser-panel.js` |
| Frontend response cache (SWR + LRU) | `js/ts-artius-browser-panel-cache.js`; `tsResponseCache`, `tsScheduleRevalidation`, `tsApplyRevalidatedPayload`, `tsInvalidateResponseCache` in panel |
| Lightbox | `js/ts-artius-browser-viewer.js` |
| Workflow library/load | `js/ts-artius-browser-api.js` |
| Comfy graph/canvas/drop | `js/ts-artius-browser-api-workflow.js` |
| 3D | `js/ts-artius-browser-3d{,-worker}.js`, `tsab/ts_load3d_stage.py` |

## Local-only artifacts (gitignored, do NOT publish)

`agents.md`, `doc/`, `tests/`, `.ts_artius_browser/`, `.codex_tmp*/`. The `.gitignore` enforces this.

## Tooling / verification

- `python scripts/check_release.py` — Python+JS syntax, JSON, localization keys, unit tests, whitespace, frontend characterization (when Node.js available). Run before commits.
- `python -m unittest discover tests` — local tests live in `tests/` and use real DB/filesystem (no mocks).
- Characterization scripts: `scripts/check_frontend_*_characterization.mjs` (require Node.js).
