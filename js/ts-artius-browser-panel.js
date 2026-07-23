import { api } from "/scripts/api.js";
import {
    tsApiURL,
    tsAssetDragMime,
    tsBuildFolderTree,
    tsClamp,
    tsConsoleWarn,
    tsCopyText,
    tsDebounce,
    tsFetchAssetDetail,
    tsFetchVersionInfo,
    tsFetchWorkflowBrowserLibrary,
    tsEnsureCanvasDropBridge,
    tsFetchBrowserSettings,
    tsFetchJSON,
    tsLoadWorkflowIntoComfy,
    tsLoadLocale,
    tsOpenDownload,
    tsDeleteWorkflowFile,
    tsPostJSON,
    tsResolveComfyLocale,
    tsRouteBase,
    tsSave3DThumbnail,
    tsSaveBrowserSettings,
    tsShowToast,
} from "./ts-artius-browser-api.js";
import { tsCapture3DThumbnail } from "./ts-artius-browser-3d.js";
import {
    tsFormatCardDuration,
    tsFormatCardFPS,
} from "./ts-artius-browser-panel-format.js";
import {
    tsApplyGridMetricStyles,
    tsCalculateGridMetrics,
} from "./ts-artius-browser-panel-grid.js";
import { TSAssetResponseCache } from "./ts-artius-browser-panel-cache.js";
import { tsBuildAssetSearchParams } from "./ts-artius-browser-panel-query.js";
import {
    tsApplySectionSettingsToState,
    tsIsBrowserSection,
    tsNormalizeAssetSortKey,
    tsNormalizeAssetTypeSet,
    tsNormalizeFolderPath,
    tsNormalizeSortDirection,
    tsNormalizeViewMode,
    tsNormalizeWorkflowSortKey,
    tsResolveLocaleCode,
    tsResolvePreviewSize,
    tsSyncSectionSettingsFromActiveState,
} from "./ts-artius-browser-panel-state.js";
import {
    tsBuildItemIndexById,
    tsFindItemById,
    tsGetSelectedItems,
    tsResolveDragAssets,
} from "./ts-artius-browser-panel-selection.js";
import {
    tsBuildWorkflowFolders,
    tsBuildWorkflowQueryResult,
    tsBuildWorkflowRootNodes,
} from "./ts-artius-browser-panel-workflows.js";
import { tsEnsureViewerElement, tsGetViewerSingleton } from "./ts-artius-browser-viewer.js";
import { TS3DThumbnailQueue } from "./ts-artius-browser-panel-3d-queue.js";
import { tsPanelSettings, tsProjectSettings } from "./ts-artius-browser-settings.js";
import { tsPanelStyles } from "./ts-artius-browser-panel-styles.js";

const tsTypeOrder = tsPanelSettings.typeOrder;
const tsDefaultLimit = tsPanelSettings.defaultLimit;
const tsPreviewSizeRange = tsPanelSettings.previewSizeRange;
const tsGridLayout = tsPanelSettings.gridLayout;
const tsGridOverscanRows = Math.max(0, Number(tsPanelSettings.gridOverscanRows || 1));
const tsCardChromeScale = tsPanelSettings.cardChromeScale;
const ts3DThumbnailSettings = tsPanelSettings.threeDThumbnails;

export class TSArtiusBrowserPanel extends HTMLElement {
    constructor() {
        super();
        this.tsState = {
            tsItems: [],
            tsHasMore: false,
            tsNextCursor: null,
            tsLoading: false,
            tsSection: "assets",
            tsSearch: "",
            tsAssetSearch: "",
            tsWorkflowSearch: "",
            tsRootId: tsPanelSettings.defaultRootId,
            tsMode: tsPanelSettings.defaultMode,
            tsAssetMode: tsPanelSettings.defaultMode,
            tsWorkflowMode: tsPanelSettings.defaultMode,
            tsAutoscan: Boolean(tsPanelSettings.defaultAutoscan),
            tsFolder: "",
            tsTypes: new Set(),
            tsSortKey: tsPanelSettings.defaultSort.key,
            tsSortDirection: tsPanelSettings.defaultSort.direction,
            tsPreviewSize: tsPreviewSizeRange.default,
            tsAssetSortKey: tsPanelSettings.defaultSort.key,
            tsAssetSortDirection: tsPanelSettings.defaultSort.direction,
            tsAssetPreviewSize: tsPreviewSizeRange.default,
            tsWorkflowSortKey: tsPanelSettings.defaultSort.key === "size_bytes" ? "created_at" : tsPanelSettings.defaultSort.key,
            tsWorkflowSortDirection: tsPanelSettings.defaultSort.direction,
            tsWorkflowPreviewSize: tsPreviewSizeRange.default,
            tsSelection: new Set(),
            tsLastSelectedIndex: -1,
            tsRoots: [],
            tsFolders: [],
            tsHealth: [],
            tsScanStatus: null,
            tsExpandedFolders: new Set(tsPanelSettings.defaultExpandedFolders),
            tsLanguage: "en",
            tsLocale: {},
            tsGridColumns: 1,
            tsGridRowHeight: 296,
            tsBrowserWidth: 0,
            tsTreeWidth: 220,
            tsAssetTreeWidth: 220,
            tsWorkflowTreeWidth: 220,
            tsToolbarScale: 1,
            tsSettingsHydrated: false,
            tsQueuedFetchReset: false,
            tsQueuedFetchAppend: false,
        };
        this.tsBootstrapScanRequested = false;
        this.tsItemsRevision = 0;
        this.tsFoldersRevision = 0;
        this.tsGridRenderFrame = 0;
        this.tsGridRenderForce = false;
        this.tsLastGridMarkupKey = "";
        this.tsLastTreeMarkupKey = "";
        this.tsLastScrollWindowKey = "";
        this.tsLastGalleryViewportWidth = 0;
        this.tsGridMetricsKey = "";
        this.tsGridMetrics = null;
        this.tsItemIndexById = new Map();
        this.tsDebouncedSearch = tsDebounce(() => this.tsFetchAssets(true), tsPanelSettings.debounceMs.search);
        this.tsDebouncedRealtimeRefresh = tsDebounce(() => this.tsFetchAssets(true), tsPanelSettings.debounceMs.realtimeRefresh);
        this.tsDebouncedFilterRefresh = tsDebounce(() => this.tsFetchAssets(true), tsPanelSettings.debounceMs.filterChip);
        this.tsResponseCache = new TSAssetResponseCache({
            tsCapacity: tsPanelSettings.responseCache.capacity,
            tsTtlMs: tsPanelSettings.responseCache.ttlMs,
        });
        this.tsRevalidationsInFlight = new Set();
        // Bumped by tsInvalidateResponseCache. A fetch/revalidation that
        // started before an invalidation must not write its now-stale
        // payload back into the cache, so every cache write is gated on the
        // epoch being unchanged since the request began.
        this.tsResponseCacheEpoch = 0;
        this.tsDebouncedAssetEventRefresh = tsDebounce(() => {
            this.tsScheduleGridRender(true, false);
            this.tsRenderSelectionButtons();
            this.tsRenderProgress();
        }, 80);
        this.tsDebouncedSaveSettings = tsDebounce(() => this.tsPersistUISettings(), 220);
        this.tsCurrentFetchPromise = null;
        this.tsLastAssetRootId = tsPanelSettings.defaultRootId || "all";
        this.tsLastAssetFolder = "";
        this.tsWorkflowSelectedFolder = "";
        this.ts3DQueue = new TS3DThumbnailQueue(ts3DThumbnailSettings, {
            patchThumbnail: (tsAssetId, tsPreviewURL, tsAlt) => this.tsPatchVisibleThumbnail(tsAssetId, tsPreviewURL, tsAlt),
            capture: (tsViewerURL, tsOptions) => tsCapture3DThumbnail(tsViewerURL, tsOptions),
            persistToBackend: (tsAssetId, tsPreviewURL) => tsSave3DThumbnail(tsAssetId, tsPreviewURL),
            applyPersistedAsset: (tsAssetPatch) => this.tsApplyPersisted3DThumbnail(tsAssetPatch),
            warn: (...tsArgs) => tsConsoleWarn(...tsArgs),
        });
        this.tsSidebarRefreshTimers = new Set();
        this.tsWorkflowLibrary = [];
        this.tsWorkflowLibraryLoaded = false;
        this.tsApiEventsBound = false;
        this.tsApiEventListeners = [
            ["tsab:index-start", (tsEvent) => this.tsHandleScanEvent(tsEvent, false)],
            ["tsab:index-progress", (tsEvent) => this.tsHandleScanEvent(tsEvent, false)],
            ["tsab:index-complete", (tsEvent) => this.tsHandleScanEvent(tsEvent, true)],
            ["tsab:health", (tsEvent) => this.tsHandleHealthEvent(tsEvent)],
            ["tsab:asset-upsert", (tsEvent) => this.tsHandleAssetUpsertEvent(tsEvent)],
            ["tsab:asset-remove", (tsEvent) => this.tsHandleAssetRemoveEvent(tsEvent)],
        ];
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        this.ts3DQueue.tsResume();
        if (this.tsConnectedOnce) {
            this.tsBindApiEvents();
            this.tsStartWidthTracking();
            // The gallery/toolbar observers were disconnected in
            // disconnectedCallback (ComfyUI tears the tab out of the DOM when
            // hidden). tsBuildShell only runs once, so re-observe the same
            // shell elements here or toolbar height stops tracking reflow.
            if (this.tsRefs?.tsGalleryScroll) {
                this.tsResizeObserver?.observe?.(this.tsRefs.tsGalleryScroll);
            }
            if (this.tsRefs?.tsToolbarMain) {
                this.tsToolbarResizeObserver?.observe?.(this.tsRefs.tsToolbarMain);
            }
            this.tsScheduleSidebarRefresh(0);
            return;
        }
        this.tsConnectedOnce = true;
        this.style.display = "flex";
        this.style.flex = "1 1 auto";
        this.style.height = "100%";
        this.style.minHeight = "0";
        tsEnsureViewerElement();
        tsEnsureCanvasDropBridge();
        this.tsViewer = tsGetViewerSingleton();
        this.tsBuildShell();
        this.tsBindEvents();
        this.tsInitAsync();
    }

    disconnectedCallback() {
        this.ts3DQueue.tsDispose();
        for (const tsTimerId of this.tsSidebarRefreshTimers) {
            window.clearTimeout(tsTimerId);
        }
        this.tsSidebarRefreshTimers.clear();
        if (this.tsGridRenderFrame) {
            window.cancelAnimationFrame?.(this.tsGridRenderFrame);
            this.tsGridRenderFrame = 0;
        }
        this.tsResizeObserver?.disconnect?.();
        this.tsToolbarResizeObserver?.disconnect?.();
        this.tsBrowserWidthObserver?.disconnect?.();
        if (this.tsToolbarResizerPointerDownHandler && this.tsRefs?.tsToolbarResizer) {
            this.tsRefs.tsToolbarResizer.removeEventListener(
                "pointerdown",
                this.tsToolbarResizerPointerDownHandler,
            );
            this.tsToolbarResizerPointerDownHandler = null;
        }
        this.tsUnbindApiEvents();
    }

    async tsInitAsync() {
        await this.tsLoadUISettings();
        const tsLocaleCode = tsResolveLocaleCode(this.tsState.tsLanguage, tsResolveComfyLocale());
        this.tsState.tsLocale = await tsLoadLocale(tsLocaleCode);
        this.tsHydrateText();
        await this.tsFetchAssets(true);
        void this.tsMaybeBootstrapScan();
        void this.tsCheckForNewVersion();
    }

    tsApplyLocalVersion(tsLocal) {
        const tsVersionEl = this.tsRefs?.tsVersion;
        if (!tsVersionEl) {
            return;
        }
        const tsTrimmed = typeof tsLocal === "string" ? tsLocal.trim() : "";
        if (tsTrimmed) {
            tsVersionEl.textContent = `v${tsTrimmed}`;
            tsVersionEl.title = `Artius Browser v${tsTrimmed}`;
            tsVersionEl.hidden = false;
        } else {
            tsVersionEl.textContent = "";
            tsVersionEl.removeAttribute("title");
            tsVersionEl.hidden = true;
        }
    }

    async tsCheckForNewVersion() {
        const tsBadge = this.tsRefs?.tsUpdateBadge;
        if (!tsBadge) {
            return;
        }
        try {
            const tsInfo = await tsFetchVersionInfo();
            this.tsApplyLocalVersion(tsInfo?.local);
            if (!tsInfo?.update_available) {
                tsBadge.hidden = true;
                return;
            }
            const tsHref = tsInfo.release_url || tsInfo.repository_url;
            if (typeof tsHref === "string" && tsHref) {
                tsBadge.href = tsHref;
            }
            tsBadge.hidden = false;
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser version check failed", tsError);
            tsBadge.hidden = true;
        }
    }

    tsT(tsKey, tsFallback) {
        return this.tsState.tsLocale?.[tsKey] || tsFallback;
    }

    tsAttachMountPoint(tsMountPoint) {
        this.tsMountPoint = tsMountPoint || null;
        this.tsStartWidthTracking();
        this.tsApplyBrowserWidth();
    }

    tsHandleSidebarShown() {
        this.tsApplyBrowserWidth();
        this.tsScheduleSidebarRefresh(0);
        this.tsScheduleSidebarRefresh(32);
        this.tsScheduleSidebarRefresh(96);
        this.tsScheduleSidebarRefresh(180);
        if (this.tsIsWorkflowSection()) {
            this.tsWorkflowLibraryLoaded = false;
            void this.tsFetchAssets(true);
        } else {
            // Re-show of the Assets tab. ComfyUI tears the sidebar tab out of
            // the DOM while another tab is active, so the panel can miss the
            // tsab:index-* events emitted by an autoscan that ran while it was
            // hidden (e.g. the post-generation rescan fired from the extension
            // entry on execution_success). Without this, assets indexed since
            // the last view stay invisible until a manual Rescan. Drop the
            // cached first page and refetch so freshly indexed assets show up
            // on return.
            this.tsInvalidateResponseCache();
            void this.tsFetchAssets(true);
        }
    }

    tsScheduleSidebarRefresh(tsDelayMs = 0) {
        const tsRunRefresh = () => {
            window.requestAnimationFrame(() => {
                if (!this.isConnected || !this.tsRefs?.tsGalleryScroll) {
                    return;
                }
                const tsViewportWidth = Math.round(Number(this.tsRefs.tsGalleryScroll.clientWidth || this.tsMountPoint?.clientWidth || this.clientWidth || 0));
                const tsViewportHeight = Math.round(Number(this.tsRefs.tsGalleryScroll.clientHeight || this.clientHeight || 0));
                if (tsViewportWidth <= 0 || tsViewportHeight <= 0) {
                    return;
                }
                this.tsLastGalleryViewportWidth = tsViewportWidth;
                this.tsInvalidateGridMetrics();
                this.tsRenderAll();
                this.tsHandleGalleryScroll();
            });
        };
        if (tsDelayMs <= 0) {
            tsRunRefresh();
            return;
        }
        // Each delayed refresh gets its own timer: the staggered
        // 0/32/96/180ms cascade after a sidebar show must all fire, so a
        // later call must not cancel an earlier pending one.
        const tsTimerId = window.setTimeout(() => {
            this.tsSidebarRefreshTimers.delete(tsTimerId);
            tsRunRefresh();
        }, tsDelayMs);
        this.tsSidebarRefreshTimers.add(tsTimerId);
    }

    tsStartWidthTracking() {
        this.tsBrowserWidthObserver?.disconnect?.();
        const tsObservedTarget = this.tsMountPoint || this.parentElement || this;
        if (!tsObservedTarget || typeof ResizeObserver === "undefined") {
            return;
        }
        this.tsBrowserWidthObserver = new ResizeObserver((tsEntries) => {
            const tsEntry = tsEntries?.[0];
            const tsWidth = Math.round(Number(tsEntry?.contentRect?.width || tsObservedTarget.clientWidth || 0));
            this.tsHandleObservedWidth(tsWidth);
        });
        this.tsBrowserWidthObserver.observe(tsObservedTarget);
    }

    tsHandleObservedWidth(tsWidth) {
        if (!this.tsState.tsSettingsHydrated) {
            return;
        }
        const tsResolvedWidth = Math.max(0, Math.round(Number(tsWidth || 0)));
        if (tsResolvedWidth < 180) {
            return;
        }
        if (Math.abs(tsResolvedWidth - Number(this.tsState.tsBrowserWidth || 0)) < 2) {
            return;
        }
        this.tsState.tsBrowserWidth = tsResolvedWidth;
        this.tsScheduleGridRender(true, true);
        this.tsDebouncedSaveSettings();
    }

    tsApplyBrowserWidth() {
        if (this.tsMountPoint) {
            this.tsMountPoint.style.width = "";
            this.tsMountPoint.style.flexBasis = "";
            this.tsMountPoint.style.maxWidth = "";
            this.tsMountPoint.style.minWidth = "0";
        }
        this.style.width = "100%";
        this.style.flexBasis = "100%";
        this.style.maxWidth = "100%";
        this.style.minWidth = "0";
    }

    tsApplyTreeWidth() {
        const tsShell = this.tsRefs?.tsShell;
        if (!tsShell) {
            return;
        }
        const tsClampedWidth = Math.max(120, Math.min(700, Math.round(Number(this.tsState.tsTreeWidth) || 220)));
        this.tsState.tsTreeWidth = tsClampedWidth;
        tsShell.style.setProperty("--ts-tree-width", `${tsClampedWidth}px`);
    }

    tsBindTreeResizer() {
        const tsResizer = this.tsRefs?.tsTreeResizer;
        const tsBody = this.tsRefs?.tsBody;
        if (!tsResizer || !tsBody) {
            return;
        }
        let tsDragStartX = 0;
        let tsDragStartWidth = 0;
        let tsActivePointerId = null;
        const tsOnPointerMove = (tsEvent) => {
            if (tsEvent.pointerId !== tsActivePointerId) {
                return;
            }
            const tsBodyRect = tsBody.getBoundingClientRect();
            const tsMaxWidth = Math.min(700, Math.max(120, tsBodyRect.width - 200));
            const tsDelta = tsEvent.clientX - tsDragStartX;
            const tsNewWidth = Math.max(120, Math.min(tsMaxWidth, tsDragStartWidth + tsDelta));
            this.tsState.tsTreeWidth = tsNewWidth;
            this.tsApplyTreeWidth();
            this.tsScheduleGridRender(true, true);
        };
        const tsOnPointerUp = (tsEvent) => {
            if (tsEvent.pointerId !== tsActivePointerId) {
                return;
            }
            tsActivePointerId = null;
            tsResizer.dataset.dragging = "false";
            tsResizer.releasePointerCapture?.(tsEvent.pointerId);
            tsResizer.removeEventListener("pointermove", tsOnPointerMove);
            tsResizer.removeEventListener("pointerup", tsOnPointerUp);
            tsResizer.removeEventListener("pointercancel", tsOnPointerUp);
            this.tsSyncSectionSettingsFromActive();
            this.tsQueueSaveUISettings();
        };
        tsResizer.addEventListener("pointerdown", (tsEvent) => {
            if (this.tsState.tsMode !== "tree") {
                return;
            }
            tsEvent.preventDefault();
            tsActivePointerId = tsEvent.pointerId;
            tsDragStartX = tsEvent.clientX;
            tsDragStartWidth = Number(this.tsState.tsTreeWidth) || 220;
            tsResizer.dataset.dragging = "true";
            tsResizer.setPointerCapture?.(tsEvent.pointerId);
            tsResizer.addEventListener("pointermove", tsOnPointerMove);
            tsResizer.addEventListener("pointerup", tsOnPointerUp);
            tsResizer.addEventListener("pointercancel", tsOnPointerUp);
        });
    }

    async tsLoadUISettings() {
        try {
            const tsPayload = await tsFetchBrowserSettings();
            const tsUI = tsPayload?.ui || {};
            if (typeof tsUI.language === "string" && tsUI.language) {
                this.tsState.tsLanguage = tsUI.language;
            }
            if (tsIsBrowserSection(tsUI.browser_section)) {
                this.tsState.tsSection = tsUI.browser_section;
            }
            this.tsState.tsAssetMode = tsNormalizeViewMode(tsUI.asset_view_mode, tsPanelSettings.defaultMode);
            this.tsState.tsWorkflowMode = tsNormalizeViewMode(tsUI.workflow_view_mode, tsPanelSettings.defaultMode);
            if (typeof tsUI.autoscan === "boolean") {
                this.tsState.tsAutoscan = tsUI.autoscan;
            }
            const tsToolbarScale = Number(tsUI.toolbar_scale);
            if (Number.isFinite(tsToolbarScale) && tsToolbarScale > 0) {
                this.tsState.tsToolbarScale = Math.max(0.6, Math.min(1, tsToolbarScale));
            }
            this.tsState.tsAssetSortKey = tsNormalizeAssetSortKey(tsUI.asset_sort_key, tsPanelSettings.defaultSort.key);
            this.tsState.tsAssetSortDirection = tsNormalizeSortDirection(tsUI.asset_sort_direction, tsPanelSettings.defaultSort.direction);
            this.tsState.tsWorkflowSortKey = tsNormalizeWorkflowSortKey(tsUI.workflow_sort_key, tsPanelSettings.defaultSort.key);
            this.tsState.tsWorkflowSortDirection = tsNormalizeSortDirection(tsUI.workflow_sort_direction, tsPanelSettings.defaultSort.direction);
            this.tsState.tsAssetPreviewSize = tsResolvePreviewSize(tsUI.asset_preview_size, tsPreviewSizeRange.default, tsPreviewSizeRange);
            this.tsState.tsWorkflowPreviewSize = tsResolvePreviewSize(tsUI.workflow_preview_size, tsPreviewSizeRange.default, tsPreviewSizeRange);
            this.tsState.tsAssetSearch = typeof tsUI.asset_search === "string" ? tsUI.asset_search : "";
            this.tsState.tsWorkflowSearch = typeof tsUI.workflow_search === "string" ? tsUI.workflow_search : "";
            const tsAssetTypes = tsNormalizeAssetTypeSet(tsUI.asset_types, tsTypeOrder);
            if (tsAssetTypes) {
                this.tsState.tsTypes = tsAssetTypes;
            }
            if (typeof tsUI.selected_root_id === "string" && tsUI.selected_root_id) {
                this.tsState.tsRootId = tsUI.selected_root_id;
                if (tsUI.selected_root_id !== "workflows") {
                    this.tsLastAssetRootId = tsUI.selected_root_id;
                }
            }
            if (typeof tsUI.selected_folder_path === "string") {
                this.tsState.tsFolder = tsNormalizeFolderPath(tsUI.selected_folder_path);
                this.tsLastAssetFolder = this.tsState.tsFolder;
            }
            if (typeof tsUI.workflow_selected_folder_path === "string") {
                this.tsWorkflowSelectedFolder = tsNormalizeFolderPath(tsUI.workflow_selected_folder_path);
            }
            if (Array.isArray(tsUI.expanded_folders)) {
                this.tsState.tsExpandedFolders = new Set(
                    tsUI.expanded_folders
                        .map((tsKey) => String(tsKey || ""))
                        .filter(Boolean)
                );
            }
            const tsBrowserWidth = Number(tsUI.browser_width || 0);
            if (Number.isFinite(tsBrowserWidth) && tsBrowserWidth > 0) {
                this.tsState.tsBrowserWidth = Math.round(tsBrowserWidth);
            }
            const tsAssetTreeWidth = Number(tsUI.asset_tree_panel_width);
            if (Number.isFinite(tsAssetTreeWidth) && tsAssetTreeWidth > 0) {
                this.tsState.tsAssetTreeWidth = Math.max(120, Math.min(700, Math.round(tsAssetTreeWidth)));
            }
            const tsWorkflowTreeWidth = Number(tsUI.workflow_tree_panel_width);
            if (Number.isFinite(tsWorkflowTreeWidth) && tsWorkflowTreeWidth > 0) {
                this.tsState.tsWorkflowTreeWidth = Math.max(120, Math.min(700, Math.round(tsWorkflowTreeWidth)));
            }
            this.tsApplySectionSettings();
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser settings fetch failed", tsError);
        } finally {
            this.tsState.tsSettingsHydrated = true;
            if (this.tsRefs?.tsSearch) {
                this.tsRefs.tsSearch.value = String(this.tsState.tsSearch || "");
            }
            if (this.tsRefs?.tsPreviewSize) {
                this.tsRefs.tsPreviewSize.value = String(this.tsState.tsPreviewSize);
            }
            if (this.tsRefs?.tsAutoscan) {
                this.tsRefs.tsAutoscan.dataset.active = String(Boolean(this.tsState.tsAutoscan));
            }
            this.tsEmitAutoscanChanged();
            this.tsApplyBrowserWidth();
            this.tsStartWidthTracking();
        }
    }

    tsQueueSaveUISettings() {
        if (!this.tsState.tsSettingsHydrated) {
            return;
        }
        this.tsDebouncedSaveSettings();
    }

    async tsPersistUISettings() {
        if (!this.tsState.tsSettingsHydrated) {
            return;
        }
        this.tsSyncSectionSettingsFromActive();
        const tsSelectedRootId = this.tsIsWorkflowSection()
            ? (this.tsLastAssetRootId || tsPanelSettings.defaultRootId || "all")
            : this.tsState.tsRootId;
        const tsSelectedFolderPath = this.tsIsWorkflowSection()
            ? (this.tsLastAssetFolder || "")
            : (this.tsState.tsMode === "tree" ? this.tsState.tsFolder : "");
        try {
            await tsSaveBrowserSettings({
                autoscan: Boolean(this.tsState.tsAutoscan),
                browser_section: this.tsState.tsSection,
                asset_view_mode: this.tsState.tsAssetMode,
                workflow_view_mode: this.tsState.tsWorkflowMode,
                asset_sort_key: this.tsState.tsAssetSortKey,
                asset_sort_direction: this.tsState.tsAssetSortDirection,
                asset_preview_size: this.tsState.tsAssetPreviewSize,
                asset_search: this.tsState.tsAssetSearch,
                workflow_sort_key: this.tsState.tsWorkflowSortKey,
                workflow_sort_direction: this.tsState.tsWorkflowSortDirection,
                workflow_preview_size: this.tsState.tsWorkflowPreviewSize,
                workflow_search: this.tsState.tsWorkflowSearch,
                asset_types: [...this.tsState.tsTypes],
                selected_root_id: tsSelectedRootId,
                selected_folder_path: tsSelectedFolderPath,
                workflow_selected_folder_path: this.tsWorkflowSelectedFolder || "",
                expanded_folders: [...this.tsState.tsExpandedFolders],
                browser_width: this.tsState.tsBrowserWidth,
                asset_tree_panel_width: this.tsState.tsAssetTreeWidth,
                workflow_tree_panel_width: this.tsState.tsWorkflowTreeWidth,
                toolbar_scale: Number(this.tsState.tsToolbarScale) || 1,
            });
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser settings save failed", tsError);
        }
    }

    tsRememberAssetLocation() {
        if (this.tsIsWorkflowSection()) {
            return;
        }
        this.tsLastAssetRootId = this.tsState.tsRootId || tsPanelSettings.defaultRootId || "all";
        this.tsLastAssetFolder = String(this.tsState.tsFolder || "");
    }

    tsSyncSectionSettingsFromActive() {
        tsSyncSectionSettingsFromActiveState(this.tsState, this.tsIsWorkflowSection());
    }

    tsApplySectionSettings() {
        tsApplySectionSettingsToState(this.tsState, {
            isWorkflowSection: this.tsIsWorkflowSection(),
            workflowSelectedFolder: this.tsWorkflowSelectedFolder,
            lastAssetFolder: this.tsLastAssetFolder,
        });
        this.tsApplyTreeWidth();
    }

    tsApplyToolbarScale() {
        const tsShell = this.tsRefs?.tsShell;
        const tsMain = this.tsRefs?.tsToolbarMain;
        const tsWrap = this.tsRefs?.tsToolbarMainWrap;
        if (!tsShell || !tsMain || !tsWrap) {
            return;
        }
        const tsScale = Math.max(0.6, Math.min(1, Number(this.tsState.tsToolbarScale) || 1));
        tsShell.style.setProperty("--ts-toolbar-scale", String(tsScale));
        const tsRawNaturalHeight = tsMain.scrollHeight || tsMain.offsetHeight || 0;
        if (tsRawNaturalHeight <= 0) {
            // Layout has not produced a measurable size yet (typically the
            // first paint with a hidden sidebar). Skip rather than locking
            // the wrap to a misleading hard-coded fallback — the
            // ResizeObserver below will re-fire as soon as the toolbar
            // gets laid out and call us again with a real height.
            return;
        }
        this.tsToolbarNaturalHeight = tsRawNaturalHeight;
        // Ceil, not round: the scaled content is exactly tsRawNaturalHeight *
        // tsScale tall, and overflow:hidden on the wrap crops anything past
        // its pixel height. Rounding down by up to half a pixel can shave the
        // last button row; ceil guarantees the wrap never sits below the
        // content it must show.
        tsWrap.style.height = `${Math.ceil(tsRawNaturalHeight * tsScale)}px`;
    }

    tsBindToolbarResizer() {
        const tsResizer = this.tsRefs?.tsToolbarResizer;
        if (!tsResizer) {
            return;
        }
        let tsDragStartY = 0;
        let tsDragStartScale = 1;
        let tsActivePointerId = null;
        // Fixed sensitivity (scale units per drag pixel). A full 0.4-unit
        // range (0.6 → 1.0) takes ~100 px of drag regardless of the
        // current toolbar layout. Using a constant avoids the
        // 1.2.0 bug where scrollHeight (captured at drag start) shrank
        // with the inverse-scale width hack, making the slider feel
        // ~2× more sensitive when the user dragged toward larger scale.
        const tsSensitivity = 0.005;
        const tsOnPointerMove = (tsEvent) => {
            if (tsEvent.pointerId !== tsActivePointerId) {
                return;
            }
            const tsDeltaY = tsEvent.clientY - tsDragStartY;
            const tsRawScale = tsDragStartScale + tsDeltaY * tsSensitivity;
            const tsClampedScale = Math.max(0.6, Math.min(1, tsRawScale));
            this.tsState.tsToolbarScale = tsClampedScale;
            this.tsApplyToolbarScale();
        };
        const tsOnPointerUp = (tsEvent) => {
            if (tsEvent.pointerId !== tsActivePointerId) {
                return;
            }
            tsActivePointerId = null;
            tsResizer.dataset.dragging = "false";
            tsResizer.releasePointerCapture?.(tsEvent.pointerId);
            tsResizer.removeEventListener("pointermove", tsOnPointerMove);
            tsResizer.removeEventListener("pointerup", tsOnPointerUp);
            tsResizer.removeEventListener("pointercancel", tsOnPointerUp);
            this.tsQueueSaveUISettings();
        };
        const tsOnPointerDown = (tsEvent) => {
            tsEvent.preventDefault();
            tsActivePointerId = tsEvent.pointerId;
            tsDragStartY = tsEvent.clientY;
            tsDragStartScale = Math.max(0.6, Math.min(1, Number(this.tsState.tsToolbarScale) || 1));
            tsResizer.dataset.dragging = "true";
            tsResizer.setPointerCapture?.(tsEvent.pointerId);
            tsResizer.addEventListener("pointermove", tsOnPointerMove);
            tsResizer.addEventListener("pointerup", tsOnPointerUp);
            tsResizer.addEventListener("pointercancel", tsOnPointerUp);
        };
        // Stash the handler so disconnectedCallback can remove it; required
        // by CLAUDE.md §8 ("every transient ... listener must have
        // teardown") for new listeners added in this code path.
        this.tsToolbarResizerPointerDownHandler = tsOnPointerDown;
        tsResizer.addEventListener("pointerdown", tsOnPointerDown);
    }

    tsEmitAutoscanChanged() {
        window.dispatchEvent(new CustomEvent("tsab:autoscan-changed", {
            detail: {
                autoscan: Boolean(this.tsState.tsAutoscan),
            },
        }));
    }

    tsIsWorkflowSection() {
        return this.tsState.tsSection === "workflows";
    }

    tsGetWorkflowRootNodes() {
        return tsBuildWorkflowRootNodes(this.tsT("section.workflows", "Workflows"));
    }

    async tsEnsureWorkflowLibrary(tsForce = false) {
        if (this.tsWorkflowLibraryLoaded && !tsForce) {
            return this.tsWorkflowLibrary;
        }
        this.tsWorkflowLibrary = await tsFetchWorkflowBrowserLibrary().catch((tsError) => {
            tsConsoleWarn("Timesaver Artius Browser workflow fetch failed", tsError);
            return [];
        });
        this.tsWorkflowLibraryLoaded = true;
        return this.tsWorkflowLibrary;
    }

    tsBuildWorkflowFolders(tsItems) {
        return tsBuildWorkflowFolders(tsItems);
    }

    tsBuildWorkflowQueryResult() {
        return tsBuildWorkflowQueryResult(this.tsWorkflowLibrary, {
            search: this.tsState.tsSearch,
            mode: this.tsState.tsMode,
            folder: this.tsState.tsFolder,
            sortKey: this.tsState.tsSortKey,
            sortDirection: this.tsState.tsSortDirection,
            roots: this.tsGetWorkflowRootNodes(),
        });
    }

    tsBuildShell() {
        this.shadowRoot.innerHTML = `
            ${tsPanelStyles}
            <div class="ts-shell" tabindex="0">
                <div class="ts-toolbar">
                    <div class="ts-title"><a class="ts-title-link" href="https://github.com/AlexYez/comfyui-artius-browser" target="_blank" rel="noreferrer noopener"></a><span class="ts-version" hidden></span><a class="ts-donate" href="https://timesavervfx.com/donate/" target="_blank" rel="noreferrer noopener"></a><a class="ts-update-badge" href="https://github.com/AlexYez/comfyui-artius-browser/releases" target="_blank" rel="noreferrer noopener" hidden></a></div>
                    <div class="ts-toolbar-main-wrap">
                    <div class="ts-toolbar-main">
                        <div class="ts-toolbar-cluster ts-section-group">
                            <button class="ts-section-button ts-section-assets" type="button"></button>
                            <button class="ts-section-button ts-section-workflows" type="button"></button>
                        </div>
                        <input class="ts-search" type="search">
                        <div class="ts-toolbar-cluster ts-root-group">
                            <select class="ts-root-select"></select>
                        </div>
                        <div class="ts-toolbar-cluster ts-type-cluster">
                            <div class="ts-type-chips"></div>
                        </div>
                        <div class="ts-toolbar-cluster ts-sort-group">
                            <select class="ts-sort-select"></select>
                            <select class="ts-sort-direction"></select>
                        </div>
                        <div class="ts-toolbar-cluster ts-mode-group">
                            <button class="ts-mode-button ts-mode-flat" type="button"></button>
                            <button class="ts-mode-button ts-mode-tree" type="button"></button>
                        </div>
                        <input class="ts-preview-size" type="range" min="${tsPreviewSizeRange.min}" max="${tsPreviewSizeRange.max}" step="${tsPreviewSizeRange.step}" value="${tsPreviewSizeRange.default}">
                        <button class="ts-toggle-button ts-autoscan" type="button" data-active="true">
                            <span class="ts-autoscan-label"></span>
                        </button>
                        <button class="ts-rescan" type="button"></button>
                        <button class="ts-delete-selected" type="button"></button>
                        <button class="ts-rebuild-cache" type="button"></button>
                    </div>
                    </div>
                    <div class="ts-toolbar-resizer" role="separator" aria-orientation="horizontal" title=""></div>
                    <div class="ts-progress" data-visible="false" data-indeterminate="false">
                        <div class="ts-progress-track"><div class="ts-progress-fill"></div></div>
                        <div class="ts-progress-caption"></div>
                    </div>
                    <div class="ts-health"></div>
                </div>
                <div class="ts-body" data-mode="flat">
                    <div class="ts-tree-panel"></div>
                    <div class="ts-tree-resizer" role="separator" aria-orientation="vertical"></div>
                    <div class="ts-gallery-wrap">
                        <div class="ts-gallery-scroll">
                            <div class="ts-gallery-spacer"></div>
                            <div class="ts-gallery-content" role="listbox" aria-multiselectable="true"></div>
                        </div>
                        <div class="ts-empty"></div>
                    </div>
                </div>
            </div>
        `;

        this.tsRefs = {
            tsShell: this.shadowRoot.querySelector(".ts-shell"),
            tsToolbar: this.shadowRoot.querySelector(".ts-toolbar"),
            tsToolbarMainWrap: this.shadowRoot.querySelector(".ts-toolbar-main-wrap"),
            tsToolbarMain: this.shadowRoot.querySelector(".ts-toolbar-main"),
            tsToolbarResizer: this.shadowRoot.querySelector(".ts-toolbar-resizer"),
            tsTitle: this.shadowRoot.querySelector(".ts-title"),
            tsTitleLink: this.shadowRoot.querySelector(".ts-title-link"),
            tsVersion: this.shadowRoot.querySelector(".ts-version"),
            tsDonate: this.shadowRoot.querySelector(".ts-donate"),
            tsUpdateBadge: this.shadowRoot.querySelector(".ts-update-badge"),
            tsSectionAssets: this.shadowRoot.querySelector(".ts-section-assets"),
            tsSectionWorkflows: this.shadowRoot.querySelector(".ts-section-workflows"),
            tsSearch: this.shadowRoot.querySelector(".ts-search"),
            tsTypeCluster: this.shadowRoot.querySelector(".ts-type-cluster"),
            tsTypeChips: this.shadowRoot.querySelector(".ts-type-chips"),
            tsRootGroup: this.shadowRoot.querySelector(".ts-root-group"),
            tsRootSelect: this.shadowRoot.querySelector(".ts-root-select"),
            tsSortSelect: this.shadowRoot.querySelector(".ts-sort-select"),
            tsSortDirection: this.shadowRoot.querySelector(".ts-sort-direction"),
            tsModeFlat: this.shadowRoot.querySelector(".ts-mode-flat"),
            tsModeTree: this.shadowRoot.querySelector(".ts-mode-tree"),
            tsPreviewSize: this.shadowRoot.querySelector(".ts-preview-size"),
            tsAutoscan: this.shadowRoot.querySelector(".ts-autoscan"),
            tsAutoscanLabel: this.shadowRoot.querySelector(".ts-autoscan-label"),
            tsRescan: this.shadowRoot.querySelector(".ts-rescan"),
            tsRebuildCache: this.shadowRoot.querySelector(".ts-rebuild-cache"),
            tsDeleteSelected: this.shadowRoot.querySelector(".ts-delete-selected"),
            tsProgress: this.shadowRoot.querySelector(".ts-progress"),
            tsProgressFill: this.shadowRoot.querySelector(".ts-progress-fill"),
            tsProgressCaption: this.shadowRoot.querySelector(".ts-progress-caption"),
            tsHealth: this.shadowRoot.querySelector(".ts-health"),
            tsBody: this.shadowRoot.querySelector(".ts-body"),
            tsTreePanel: this.shadowRoot.querySelector(".ts-tree-panel"),
            tsTreeResizer: this.shadowRoot.querySelector(".ts-tree-resizer"),
            tsGalleryScroll: this.shadowRoot.querySelector(".ts-gallery-scroll"),
            tsGallerySpacer: this.shadowRoot.querySelector(".ts-gallery-spacer"),
            tsGalleryContent: this.shadowRoot.querySelector(".ts-gallery-content"),
            tsEmpty: this.shadowRoot.querySelector(".ts-empty"),
        };

        this.tsResizeObserver = new ResizeObserver((tsEntries) => {
            const tsEntry = tsEntries?.[0];
            const tsWidth = Math.round(Number(tsEntry?.contentRect?.width || this.tsRefs.tsGalleryScroll.clientWidth || 0));
            if (tsWidth === this.tsLastGalleryViewportWidth) {
                return;
            }
            this.tsLastGalleryViewportWidth = tsWidth;
            this.tsInvalidateGridMetrics();
            this.tsScheduleGridRender(true, true);
        });
        this.tsResizeObserver.observe(this.tsRefs.tsGalleryScroll);

        this.tsLastObservedToolbarHeight = 0;
        this.tsToolbarResizeObserver = new ResizeObserver(() => {
            // Don't fire before the persisted scale has been hydrated from
            // settings — otherwise the first observer tick applies the
            // constructor-default scale (1) and the user sees the toolbar
            // snap from full-size to their saved scale a beat later.
            if (!this.tsState.tsSettingsHydrated) {
                return;
            }
            // Dedup against same-height re-fires. Inner .ts-toolbar-main
            // has width: calc(100% / scale), so changing scale also
            // changes its layout width and re-triggers this observer; the
            // natural unscaled height is the only signal we actually care
            // about, and skipping when it hasn't moved breaks the
            // would-be feedback cycle.
            const tsNaturalHeight = this.tsRefs.tsToolbarMain.scrollHeight || 0;
            if (tsNaturalHeight === this.tsLastObservedToolbarHeight) {
                return;
            }
            this.tsLastObservedToolbarHeight = tsNaturalHeight;
            this.tsApplyToolbarScale();
        });
        this.tsToolbarResizeObserver.observe(this.tsRefs.tsToolbarMain);
    }

    tsInvalidateGridMetrics() {
        this.tsGridMetricsKey = "";
        this.tsGridMetrics = null;
        this.tsLastScrollWindowKey = "";
        this.tsLastGridMarkupKey = "";
    }

    tsScheduleGridRender(tsForce = false, tsInvalidateMetrics = false) {
        if (tsForce) {
            this.tsGridRenderForce = true;
            if (tsInvalidateMetrics) {
                this.tsInvalidateGridMetrics();
            } else {
                this.tsLastGridMarkupKey = "";
            }
        }
        if (this.tsGridRenderFrame) {
            return;
        }
        this.tsGridRenderFrame = window.requestAnimationFrame(() => {
            this.tsGridRenderFrame = 0;
            const tsForceNow = this.tsGridRenderForce;
            this.tsGridRenderForce = false;
            this.tsRenderGrid(tsForceNow);
        });
    }

    tsBindEvents() {
        this.tsRefs.tsSectionAssets.addEventListener("click", () => {
            void this.tsSetSection("assets");
        });
        this.tsRefs.tsSectionWorkflows.addEventListener("click", () => {
            void this.tsSetSection("workflows");
        });
        this.tsRefs.tsSearch.addEventListener("input", (tsEvent) => {
            this.tsState.tsSearch = tsEvent.target.value;
            this.tsSyncSectionSettingsFromActive();
            this.tsQueueSaveUISettings();
            this.tsDebouncedSearch();
        });
        this.tsRefs.tsRootSelect.addEventListener("change", (tsEvent) => {
            this.tsState.tsRootId = tsEvent.target.value || "all";
            this.tsState.tsFolder = "";
            this.tsRememberAssetLocation();
            this.tsQueueSaveUISettings();
            this.tsFetchAssets(true);
        });
        this.tsRefs.tsSortSelect.addEventListener("change", (tsEvent) => {
            this.tsState.tsSortKey = tsEvent.target.value;
            this.tsResizeSelectToCurrent(this.tsRefs.tsSortSelect);
            this.tsSyncSectionSettingsFromActive();
            this.tsQueueSaveUISettings();
            this.tsFetchAssets(true);
        });
        this.tsRefs.tsSortDirection.addEventListener("change", (tsEvent) => {
            this.tsState.tsSortDirection = tsEvent.target.value;
            this.tsSyncSectionSettingsFromActive();
            this.tsResizeSelectToCurrent(this.tsRefs.tsSortDirection);
            this.tsQueueSaveUISettings();
            this.tsFetchAssets(true);
        });
        this.tsRefs.tsModeFlat.addEventListener("click", () => this.tsSetMode("flat"));
        this.tsRefs.tsModeTree.addEventListener("click", () => this.tsSetMode("tree"));
        this.tsRefs.tsPreviewSize.addEventListener("input", (tsEvent) => {
            this.tsState.tsPreviewSize = Number(tsEvent.target.value || tsPreviewSizeRange.default);
            this.tsSyncSectionSettingsFromActive();
            this.tsScheduleGridRender(true, true);
            this.tsQueueSaveUISettings();
        });
        this.tsRefs.tsAutoscan.addEventListener("click", async () => {
            this.tsState.tsAutoscan = !this.tsState.tsAutoscan;
            this.tsRefs.tsAutoscan.dataset.active = String(Boolean(this.tsState.tsAutoscan));
            this.tsEmitAutoscanChanged();
            this.tsQueueSaveUISettings();
            if (this.tsState.tsAutoscan) {
                await this.tsMaybeBootstrapScan();
            }
        });
        this.tsRefs.tsRescan.addEventListener("click", () => this.tsRequestRescan());
        this.tsRefs.tsRebuildCache.addEventListener("click", () => this.tsRequestRebuildCache());
        this.tsRefs.tsDeleteSelected.addEventListener("click", () => this.tsDeleteSelected());
        this.tsBindToolbarResizer();
        this.tsRefs.tsGalleryScroll.addEventListener("scroll", () => this.tsHandleGalleryScroll(), { passive: true });
        this.tsRefs.tsGalleryContent.addEventListener("click", (tsEvent) => this.tsHandleGalleryClick(tsEvent));
        this.tsRefs.tsGalleryContent.addEventListener("dblclick", (tsEvent) => this.tsHandleGalleryDoubleClick(tsEvent));
        this.tsRefs.tsGalleryContent.addEventListener(
            "dragstart",
            (tsEvent) => this.tsHandleDragStart(tsEvent),
        );
        this.tsRefs.tsGalleryContent.addEventListener("dragend", () => {
            // The canvas drop bridge clears this fallback only when the drop
            // actually lands on the Comfy canvas. A cancelled drag (Esc, drop
            // outside the canvas) must not leave a stale payload behind: the
            // bridge falls back to it for foreign drops (e.g. an OS file
            // dragged onto the canvas) and would re-insert the previously
            // dragged asset instead of letting ComfyUI handle the drop.
            window.__tsArtiusDraggedAsset = "";
        });
        this.tsRefs.tsTreePanel.addEventListener("click", (tsEvent) => this.tsHandleTreeClick(tsEvent));
        this.tsRefs.tsShell.addEventListener("keydown", (tsEvent) => this.tsHandleKeydown(tsEvent));
        this.tsBindTreeResizer();
        this.tsApplyTreeWidth();
        this.tsBindApiEvents();
    }

    tsBindApiEvents() {
        if (this.tsApiEventsBound) {
            return;
        }
        for (const [tsEventName, tsListener] of this.tsApiEventListeners) {
            api.addEventListener(tsEventName, tsListener);
        }
        this.tsApiEventsBound = true;
    }

    tsUnbindApiEvents() {
        if (!this.tsApiEventsBound) {
            return;
        }
        for (const [tsEventName, tsListener] of this.tsApiEventListeners) {
            api.removeEventListener?.(tsEventName, tsListener);
        }
        this.tsApiEventsBound = false;
    }

    tsReadEventDetail(tsEvent) {
        return tsEvent?.detail || {};
    }

    tsHandleScanEvent(tsEvent, tsShouldRefresh) {
        if (this.tsIsWorkflowSection()) {
            return;
        }
        const tsDetail = this.tsReadEventDetail(tsEvent);
        if (tsDetail.status) {
            this.tsState.tsScanStatus = tsDetail.status;
        }
        this.tsRenderProgress();
        this.tsRenderSelectionButtons();
        if (tsShouldRefresh) {
            this.tsInvalidateResponseCache();
            this.tsDebouncedRealtimeRefresh();
        }
    }

    tsHandleHealthEvent(tsEvent) {
        if (this.tsIsWorkflowSection()) {
            this.tsState.tsHealth = [];
            this.tsRenderHealth();
            return;
        }
        const tsDetail = this.tsReadEventDetail(tsEvent);
        this.tsState.tsHealth = Array.isArray(tsDetail.issues) ? tsDetail.issues : [];
        this.tsRenderHealth();
    }

    tsPatchVisibleCard(tsAssetPatch) {
        if (!tsAssetPatch?.id) {
            return false;
        }
        const tsCard = this.tsRefs.tsGalleryContent.querySelector(`[data-card-id="${tsAssetPatch.id}"]`);
        if (!tsCard) {
            return false;
        }
        const tsImage = tsCard.querySelector("img");
        const tsPreviewURL = this.tsResolveCardPreviewURL(tsAssetPatch);
        if (tsImage && tsPreviewURL && tsImage.getAttribute("src") !== tsPreviewURL) {
            tsImage.setAttribute("src", tsPreviewURL);
        }
        if (tsImage && tsAssetPatch.filename) {
            tsImage.setAttribute("alt", String(tsAssetPatch.filename));
        }
        const tsDeleteButton = tsCard.querySelector('[data-action="delete"]');
        if (tsDeleteButton) {
            tsDeleteButton.disabled = !tsAssetPatch.allow_delete;
        }
        return true;
    }

    tsResolveCardPreviewURL(tsItem) {
        if (tsItem?.type === "3d" && tsItem.viewer_3d_url) {
            const tsCapturedPreviewURL = this.ts3DQueue.tsGetCachedPreviewURL(tsItem.viewer_3d_url);
            if (tsCapturedPreviewURL) {
                return tsCapturedPreviewURL;
            }
        }
        const tsPreviewURL = String(tsItem?.preview_url || "");
        if (!tsPreviewURL) {
            return "";
        }
        return /^https?:\/\//i.test(tsPreviewURL) || tsPreviewURL.startsWith("/api/")
            ? tsPreviewURL
            : tsApiURL(tsPreviewURL);
    }

    tsPatchVisibleThumbnail(tsAssetId, tsPreviewURL, tsAlt = "") {
        if (!tsAssetId || !tsPreviewURL) {
            return false;
        }
        const tsCard = this.tsRefs.tsGalleryContent.querySelector(`[data-card-id="${tsAssetId}"]`);
        if (!tsCard) {
            return false;
        }
        const tsImage = tsCard.querySelector("img");
        if (!tsImage) {
            return false;
        }
        if (tsImage.getAttribute("src") !== tsPreviewURL) {
            tsImage.setAttribute("src", tsPreviewURL);
        }
        if (tsAlt) {
            tsImage.setAttribute("alt", String(tsAlt));
        }
        return true;
    }

    tsApplyPersisted3DThumbnail(tsAssetPatch) {
        // Called by the 3D queue after a capture is saved to the backend: merge
        // the returned card into the panel's item list and repaint its card.
        if (!tsAssetPatch?.id) {
            return;
        }
        const tsIndex = this.tsItemIndexById.get(tsAssetPatch.id);
        if (tsIndex === undefined || tsIndex < 0) {
            return;
        }
        this.tsState.tsItems[tsIndex] = {
            ...this.tsState.tsItems[tsIndex],
            ...tsAssetPatch,
        };
        this.tsItemsRevision += 1;
        this.tsPatchVisibleCard(this.tsState.tsItems[tsIndex]);
    }

    tsHandleAssetUpsertEvent(tsEvent) {
        if (this.tsIsWorkflowSection()) {
            return;
        }
        if (this.tsState.tsScanStatus?.running) {
            return;
        }
        this.tsInvalidateResponseCache();
        const tsDetail = this.tsReadEventDetail(tsEvent);
        const tsAssetPatch = tsDetail?.asset;
        if (!tsAssetPatch?.id) {
            return;
        }
        const tsIndex = this.tsItemIndexById.get(tsAssetPatch.id);
        if (tsIndex === undefined || tsIndex < 0) {
            return;
        }
        this.tsState.tsItems[tsIndex] = {
            ...this.tsState.tsItems[tsIndex],
            ...tsAssetPatch,
        };
        this.tsItemsRevision += 1;
        if (!this.tsPatchVisibleCard(this.tsState.tsItems[tsIndex])) {
            this.tsDebouncedAssetEventRefresh();
        }
    }

    tsHandleAssetRemoveEvent(tsEvent) {
        if (this.tsIsWorkflowSection()) {
            return;
        }
        // Backend remove events during an active scan would be redundant
        // with the scan's own item churn — let the scan's refresh do the
        // work so we don't compete on revisions.
        if (this.tsState.tsScanStatus?.running) {
            return;
        }
        const tsDetail = this.tsReadEventDetail(tsEvent);
        const tsAssetId = Number(tsDetail?.id || 0);
        if (!tsAssetId) {
            return;
        }
        // Single canonical removal path — folder-count decrement, selection
        // cleanup, anchor reset, cache invalidation, and the
        // empty-page-pagination fallback all live in tsRemoveItemsByIds.
        this.tsRemoveItemsByIds([tsAssetId]);
    }
    tsHydrateText() {
        this.tsRefs.tsTitleLink.textContent = this.tsT("panel.title", tsProjectSettings.title);
        this.tsRefs.tsDonate.textContent = this.tsT("button.donate", "Donate");
        this.tsRefs.tsDonate.title = this.tsT("tooltip.donate", "Support the project.");
        this.tsRefs.tsUpdateBadge.textContent = this.tsT("badge.newVersion", "New version available");
        this.tsRefs.tsUpdateBadge.title = this.tsT("tooltip.newVersion", "A newer release of Artius Browser is available on GitHub.");
        this.tsRefs.tsSectionAssets.textContent = this.tsT("button.assets", "Assets");
        this.tsRefs.tsSectionWorkflows.textContent = this.tsT("button.workflows", "Workflows");
        this.tsRefs.tsSortDirection.title = this.tsT("tooltip.sortDirection", "Toggle ascending and descending sorting.");
        this.tsRefs.tsModeFlat.textContent = this.tsT("button.flat", "Flat");
        this.tsRefs.tsModeFlat.title = this.tsT("tooltip.mode.flat", "Switch to the flat feed.");
        this.tsRefs.tsModeTree.textContent = this.tsT("button.tree", "Tree");
        this.tsRefs.tsModeTree.title = this.tsT("tooltip.mode.tree", "Switch to the folder tree.");
        this.tsRefs.tsPreviewSize.title = this.tsT("tooltip.previewSize", "Adjust preview size.");
        this.tsRefs.tsAutoscanLabel.textContent = this.tsT("toggle.autoscan", "Autoscan");
        this.tsRefs.tsAutoscan.title = this.tsT("tooltip.autoscan", "Automatically rescan assets when the browser starts or when ComfyUI finishes execution.");
        this.tsRefs.tsRescan.textContent = this.tsT("button.rescan", "Rescan");
        this.tsRefs.tsRescan.title = this.tsT("tooltip.rescan", "Scan configured asset roots now.");
        this.tsRefs.tsRebuildCache.textContent = this.tsT("button.rebuildCache", "Rebuild Cache");
        this.tsRefs.tsRebuildCache.title = this.tsT("tooltip.rebuildCache", "Delete the current browser cache and rebuild it from scratch.");
        this.tsRefs.tsDeleteSelected.textContent = this.tsT("button.deleteSelected", "Delete Selected");
        this.tsRefs.tsDeleteSelected.title = this.tsT("tooltip.deleteSelected", "Delete selected assets from allowed roots.");
        this.tsRefs.tsToolbarResizer.title = this.tsT("tooltip.toolbarResize", "Drag to resize the toolbar.");
        this.tsRefs.tsGalleryContent.setAttribute("aria-label", this.tsT("aria.gallery", "Asset grid"));
        this.tsApplyToolbarScale();
        this.tsRenderSectionButtons();
        this.tsRenderToolbarForSection();
        this.tsRenderTypeChips();
        this.tsRenderSortOptions();
        this.tsViewer?.tsSetLocale(this.tsState.tsLocale);
    }

    tsRenderSectionButtons() {
        this.tsRefs.tsSectionAssets.dataset.active = String(this.tsState.tsSection === "assets");
        this.tsRefs.tsSectionWorkflows.dataset.active = String(this.tsState.tsSection === "workflows");
        this.tsRefs.tsSectionAssets.title = this.tsT("tooltip.section.assets", "Browse indexed assets.");
        this.tsRefs.tsSectionWorkflows.title = this.tsT("tooltip.section.workflows", "Browse ComfyUI workflows.");
    }

    tsRenderToolbarForSection() {
        const tsWorkflowSection = this.tsIsWorkflowSection();
        const tsWorkflowHiddenDisplay = tsWorkflowSection ? "none" : "";
        this.tsRefs.tsSearch.placeholder = tsWorkflowSection
            ? this.tsT("placeholder.search.workflows", "Search workflow filename...")
            : this.tsT("placeholder.search", "Search filename...");
        this.tsRefs.tsSearch.title = tsWorkflowSection
            ? this.tsT("tooltip.search.workflows", "Search workflows by filename only.")
            : this.tsT("tooltip.search", "Search assets by filename only.");
        this.tsRefs.tsSearch.value = String(this.tsState.tsSearch || "");
        this.tsRefs.tsRootSelect.title = this.tsT("tooltip.root", "Choose a root folder.");
        this.tsRefs.tsTypeCluster.hidden = tsWorkflowSection;
        this.tsRefs.tsRootGroup.hidden = tsWorkflowSection;
        this.tsRefs.tsRootSelect.hidden = tsWorkflowSection;
        this.tsRefs.tsAutoscan.hidden = tsWorkflowSection;
        this.tsRefs.tsRescan.hidden = tsWorkflowSection;
        this.tsRefs.tsRebuildCache.hidden = tsWorkflowSection;
        this.tsRefs.tsDeleteSelected.hidden = tsWorkflowSection;
        this.tsRefs.tsTypeCluster.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsRootGroup.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsRootSelect.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsAutoscan.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsRescan.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsRebuildCache.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsDeleteSelected.style.display = tsWorkflowHiddenDisplay;
        // Assets <-> Workflows toggles a large block of controls (root, type
        // chips, autoscan, rescan, rebuild, delete), which changes the
        // toolbar's natural unscaled height. The scaled wrap clips to a
        // measured pixel height, so without a fresh measure the stale value
        // from the previous section can crop the freshly shown controls
        // (buttons "disappear"). Re-measure on an actual section change and
        // reset the ResizeObserver dedup baseline so the re-measure is never
        // skipped as a no-op.
        if (this.tsLastRenderedToolbarSection !== tsWorkflowSection) {
            this.tsLastRenderedToolbarSection = tsWorkflowSection;
            this.tsLastObservedToolbarHeight = 0;
            this.tsApplyToolbarScale();
        }
    }

    tsRenderSortOptions() {
        const tsIsWorkflow = this.tsIsWorkflowSection();
        const tsFilenameLabel = tsIsWorkflow
            ? this.tsT("sort.filename.workflow", "Names")
            : this.tsT("sort.filename", "Filename");
        const tsOptions = tsIsWorkflow
            ? [
                ["created_at", this.tsT("sort.created_at", "Date")],
                ["filename", tsFilenameLabel],
            ]
            : [
                ["created_at", this.tsT("sort.created_at", "Date")],
                ["filename", tsFilenameLabel],
                ["size_bytes", this.tsT("sort.size_bytes", "Size")],
            ];
        if (!tsOptions.some(([tsValue]) => tsValue === this.tsState.tsSortKey)) {
            this.tsState.tsSortKey = "created_at";
        }
        this.tsRefs.tsSortSelect.innerHTML = tsOptions
            .map(([tsValue, tsLabel]) => `<option value="${tsValue}">${tsLabel}</option>`)
            .join("");
        this.tsRefs.tsSortSelect.value = this.tsState.tsSortKey;
        this.tsResizeSelectToCurrent(this.tsRefs.tsSortSelect);
    }

    tsResizeSelectToCurrent(tsSelect) {
        const tsCurrentOption = tsSelect?.selectedOptions?.[0];
        if (!tsCurrentOption) {
            return;
        }
        if (!this.tsTextMeasureCanvas) {
            this.tsTextMeasureCanvas = document.createElement("canvas");
        }
        const tsCtx = this.tsTextMeasureCanvas.getContext("2d");
        const tsComputed = window.getComputedStyle(tsSelect);
        tsCtx.font = `${tsComputed.fontWeight} ${tsComputed.fontSize} ${tsComputed.fontFamily}`;
        const tsTextWidth = tsCtx.measureText(tsCurrentOption.textContent || "").width;
        // 10px left padding + 20px right padding (arrow zone) + 2px breathing room
        tsSelect.style.width = `${Math.ceil(tsTextWidth + 32)}px`;
    }

    tsRenderTypeChips() {
        this.tsRefs.tsTypeChips.innerHTML = tsTypeOrder
            .map((tsType) => `
                <button
                    class="ts-chip"
                    type="button"
                    data-type="${tsType}"
                    data-active="${String(this.tsState.tsTypes.has(tsType))}"
                    title="${this.tsT(`tooltip.type.${tsType}`, `Toggle ${tsType}`)}"
                >${this.tsT(`type.${tsType}`, tsType)}</button>
            `)
            .join("");
        this.tsRefs.tsTypeChips.querySelectorAll("[data-type]").forEach((tsButton) => {
            tsButton.addEventListener("click", () => {
                const tsType = tsButton.dataset.type;
                if (this.tsState.tsTypes.has(tsType)) {
                    this.tsState.tsTypes.delete(tsType);
                } else {
                    this.tsState.tsTypes.add(tsType);
                }
                this.tsRenderTypeChips();
                this.tsQueueSaveUISettings();
                this.tsDebouncedFilterRefresh();
            });
        });
    }

    tsSetMode(tsMode) {
        this.tsState.tsMode = tsMode;
        if (this.tsIsWorkflowSection()) {
            this.tsState.tsFolder = tsMode === "tree" ? (this.tsWorkflowSelectedFolder || "") : "";
        } else {
            this.tsState.tsFolder = tsMode === "tree" ? (this.tsLastAssetFolder || "") : "";
        }
        this.tsRememberAssetLocation();
        this.tsSyncSectionSettingsFromActive();
        this.tsRenderModeButtons();
        this.tsQueueSaveUISettings();
        this.tsFetchAssets(true);
    }

    async tsSetSection(tsSection) {
        if (!tsIsBrowserSection(tsSection) || this.tsState.tsSection === tsSection) {
            return;
        }
        this.tsSyncSectionSettingsFromActive();
        if (!this.tsIsWorkflowSection()) {
            this.tsRememberAssetLocation();
        }
        this.tsState.tsSection = tsSection;
        if (tsSection === "workflows") {
            this.tsState.tsRootId = "workflows";
            this.tsState.tsFolder = this.tsState.tsMode === "tree" ? (this.tsWorkflowSelectedFolder || "") : "";
        } else {
            this.tsState.tsRootId = this.tsLastAssetRootId || tsPanelSettings.defaultRootId || "all";
            this.tsState.tsFolder = this.tsState.tsMode === "tree" ? (this.tsLastAssetFolder || "") : "";
        }
        this.tsState.tsSelection.clear();
        this.tsState.tsLastSelectedIndex = -1;
        if (tsSection === "workflows") {
            this.tsWorkflowLibraryLoaded = false;
        }
        this.tsApplySectionSettings();
        this.tsQueueSaveUISettings();
        this.tsRenderSectionButtons();
        this.tsRenderToolbarForSection();
        this.tsRenderSortOptions();
        await this.tsFetchAssets(true);
        this.tsRefs.tsGalleryContent.innerHTML = "";
        this.tsLastGridMarkupKey = "";
        this.tsLastScrollWindowKey = "";
        this.tsScheduleGridRender(true, true);
        this.tsHandleGalleryScroll();
        this.tsScheduleSidebarRefresh(0);
        this.tsScheduleSidebarRefresh(48);
        this.tsScheduleSidebarRefresh(120);
    }

    async tsRequestRescan(tsOverridePayload = undefined) {
        if (this.tsState.tsScanStatus?.running) {
            return;
        }
        // With "All Folders" selected an empty payload asks the backend to
        // scan every configured root (output, input, custom) — matching the
        // button tooltip. Automatic rescans (bootstrap, post-execution)
        // still pass an explicit { root_id: "output" } override.
        const tsPayload = tsOverridePayload || (this.tsState.tsRootId !== "all" ? { root_id: this.tsState.tsRootId } : {});
        this.tsState.tsScanStatus = {
            running: true,
            phase: "count",
            scanned: 0,
            changed: 0,
            total_candidates: 0,
            processed_candidates: 0,
            total_files: 0,
            deleted: 0,
            progress_percent: 0,
            progress_message: this.tsT("status.requestingScan", "Starting scan..."),
            started_at: Date.now() / 1000,
            completed_at: null,
            error: null,
        };
        this.tsRenderProgress();
        try {
            this.tsRefs.tsRescan.disabled = true;
            await tsPostJSON(`${tsRouteBase}/rescan`, tsPayload);
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser rescan failed", tsError);
            tsShowToast("error", this.tsT("toast.rescanFailed", "Rescan failed"), String(tsError?.message || tsError || ""));
            // The optimistic local status above never gets corrected by
            // tsab:index-* events when the POST itself failed (no scan
            // started), so drop it here or Rescan/Rebuild stay disabled.
            this.tsState.tsScanStatus = null;
            this.tsRenderProgress();
        } finally {
            this.tsRenderSelectionButtons();
        }
    }

    async tsRequestRebuildCache() {
        if (this.tsIsWorkflowSection()) {
            return;
        }
        if (this.tsState.tsScanStatus?.running) {
            return;
        }
        const tsConfirmed = window.confirm(
            this.tsT(
                "confirm.rebuildCache",
                "Rebuild the browser cache from scratch? This will clear the current cache and start a full rescan.",
            ),
        );
        if (!tsConfirmed) {
            return;
        }
        this.tsState.tsScanStatus = {
            running: true,
            phase: "count",
            scanned: 0,
            changed: 0,
            total_candidates: 0,
            processed_candidates: 0,
            total_files: 0,
            deleted: 0,
            progress_percent: 0,
            progress_message: this.tsT("status.requestingRebuild", "Rebuilding cache..."),
            started_at: Date.now() / 1000,
            completed_at: null,
            error: null,
        };
        this.tsState.tsItems = [];
        this.tsState.tsSelection.clear();
        this.tsState.tsLastSelectedIndex = -1;
        this.tsState.tsHasMore = false;
        this.tsState.tsNextCursor = null;
        this.tsState.tsFolders = [];
        this.tsInvalidateResponseCache();
        this.ts3DQueue.tsClear();
        this.tsRefs.tsGalleryScroll.scrollTop = 0;
        this.tsItemsRevision += 1;
        this.tsFoldersRevision += 1;
        this.tsInvalidateGridMetrics();
        this.tsRebuildItemIndex();
        this.tsRenderAll();
        let tsRebuildStarted = false;
        try {
            this.tsRefs.tsRebuildCache.disabled = true;
            await tsPostJSON(`${tsRouteBase}/rebuild_cache`, {});
            tsRebuildStarted = true;
            await this.tsFetchAssets(true);
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser rebuild cache failed", tsError);
            tsShowToast("error", this.tsT("toast.rebuildFailed", "Rebuild cache failed"), String(tsError?.message || tsError || ""));
            if (!tsRebuildStarted) {
                // POST failed — no scan is running server-side, so no
                // tsab:index-* event will clear the optimistic status.
                this.tsState.tsScanStatus = null;
                this.tsRenderProgress();
            }
        } finally {
            this.tsRenderSelectionButtons();
        }
    }

    async tsMaybeBootstrapScan() {
        if (this.tsIsWorkflowSection()) {
            return;
        }
        if (!this.tsState.tsAutoscan) {
            return;
        }
        if (this.tsBootstrapScanRequested) {
            return;
        }
        const tsStatus = this.tsState.tsScanStatus;
        if (!(this.tsState.tsItems.length === 0 && !tsStatus?.running && !tsStatus?.started_at)) {
            return;
        }
        this.tsBootstrapScanRequested = true;
        await this.tsRequestRescan({ root_id: "output" });
    }

    tsBuildSearchParams(tsCursorAfter, tsOverrides = {}) {
        return tsBuildAssetSearchParams({
            cursorAfter: tsCursorAfter,
            defaultLimit: tsDefaultLimit,
            view: this.tsState.tsMode,
            sortKey: this.tsState.tsSortKey,
            sortDirection: this.tsState.tsSortDirection,
            search: this.tsState.tsSearch,
            rootId: this.tsState.tsRootId,
            types: [...this.tsState.tsTypes],
            folder: this.tsState.tsFolder,
            overrides: tsOverrides,
        });
    }

    tsBuildRequestPath(tsCursorAfter) {
        const tsParams = this.tsBuildSearchParams(tsCursorAfter);
        return `${tsRouteBase}/search?${tsParams.toString()}`;
    }

    async tsFetchAssets(tsReset = true) {
        if (this.tsState.tsLoading) {
            if (tsReset) {
                this.tsState.tsQueuedFetchReset = true;
            } else if (!this.tsState.tsQueuedFetchReset) {
                this.tsState.tsQueuedFetchAppend = true;
            }
            return this.tsCurrentFetchPromise || false;
        }
        const tsFetchPromise = (async () => {
            let tsDidMutate = false;
            this.tsState.tsLoading = true;
            const tsWorkflowOffset = tsReset ? 0 : this.tsState.tsItems.length;
            const tsCursorForFetch = tsReset ? null : this.tsState.tsNextCursor;
            const tsCanUseCache = tsReset && !this.tsIsWorkflowSection();
            const tsCacheKey = tsCanUseCache ? this.tsBuildRequestPath(null) : null;
            const tsCacheEntry = tsCacheKey ? this.tsResponseCache.tsGet(tsCacheKey) : null;
            const tsFetchEpoch = this.tsResponseCacheEpoch;
            try {
                let tsPayload;
                if (tsCacheEntry) {
                    tsPayload = tsCacheEntry.tsPayload;
                } else if (this.tsIsWorkflowSection()) {
                    await this.tsEnsureWorkflowLibrary(false);
                    const tsWorkflowQuery = this.tsBuildWorkflowQueryResult();
                    const tsWindowItems = tsWorkflowQuery.items.slice(tsWorkflowOffset, tsWorkflowOffset + tsDefaultLimit);
                    tsPayload = {
                        items: tsWindowItems,
                        has_more: tsWorkflowOffset + tsWindowItems.length < tsWorkflowQuery.items.length,
                        next_cursor: null,
                        roots: tsWorkflowQuery.roots,
                        folders: tsWorkflowQuery.folders,
                        health: [],
                        scan_status: null,
                    };
                } else {
                    const tsRequestPath = this.tsBuildRequestPath(tsCursorForFetch);
                    tsPayload = await tsFetchJSON(tsRequestPath);
                    if (tsCacheKey && tsRequestPath === tsCacheKey && tsFetchEpoch === this.tsResponseCacheEpoch) {
                        this.tsResponseCache.tsSet(tsCacheKey, tsPayload);
                    }
                }
                const tsIncomingItems = Array.isArray(tsPayload.items) ? tsPayload.items : [];
                if (tsReset) {
                    this.tsState.tsItems = tsIncomingItems;
                    this.tsState.tsSelection.clear();
                    this.tsState.tsLastSelectedIndex = -1;
                    this.tsRefs.tsGalleryScroll.scrollTop = 0;
                    this.tsItemsRevision += 1;
                    tsDidMutate = true;
                } else {
                    const tsSeenIds = new Set(this.tsState.tsItems.map((tsItem) => tsItem.id));
                    let tsAppendedCount = 0;
                    tsIncomingItems.forEach((tsItem) => {
                        if (!tsSeenIds.has(tsItem.id)) {
                            this.tsState.tsItems.push(tsItem);
                            tsAppendedCount += 1;
                        }
                    });
                    if (tsAppendedCount > 0) {
                        this.tsItemsRevision += 1;
                        tsDidMutate = true;
                    }
                }
                this.tsRebuildItemIndex();
                this.tsState.tsHasMore = Boolean(tsPayload.has_more);
                this.tsState.tsNextCursor = tsPayload.next_cursor || null;
                const tsIncomingRoots = Array.isArray(tsPayload.roots) ? tsPayload.roots : [];
                const tsRootsKey = JSON.stringify(tsIncomingRoots);
                const tsRootsChanged = tsRootsKey !== this.tsLastRootsKey;
                this.tsLastRootsKey = tsRootsKey;
                this.tsState.tsRoots = tsIncomingRoots;
                this.tsState.tsFolders = Array.isArray(tsPayload.folders) ? tsPayload.folders : [];
                this.tsFoldersRevision += 1;
                this.tsState.tsHealth = Array.isArray(tsPayload.health) ? tsPayload.health : [];
                this.tsState.tsScanStatus = tsPayload.scan_status || null;
                if (tsRootsChanged) {
                    this.tsRenderRootOptions();
                }
                this.tsRenderListOnly();
                if (tsReset) {
                    void this.tsMaybeBootstrapScan();
                }
                if (tsCacheEntry && tsCacheEntry.tsIsStale && tsCacheKey) {
                    this.tsScheduleRevalidation(tsCacheKey);
                }
            } catch (tsError) {
                tsConsoleWarn("Timesaver Artius Browser fetch failed", tsError);
            } finally {
                this.tsState.tsLoading = false;
                this.tsRenderSelectionButtons();
                const tsShouldReset = this.tsState.tsQueuedFetchReset;
                const tsShouldAppend = !tsShouldReset && this.tsState.tsQueuedFetchAppend;
                this.tsState.tsQueuedFetchReset = false;
                this.tsState.tsQueuedFetchAppend = false;
                if (tsShouldReset) {
                    tsDidMutate = Boolean(await this.tsFetchAssets(true)) || tsDidMutate;
                } else if (tsShouldAppend) {
                    tsDidMutate = Boolean(await this.tsFetchAssets(false)) || tsDidMutate;
                }
            }
            return tsDidMutate;
        })();
        this.tsCurrentFetchPromise = tsFetchPromise;
        try {
            return await tsFetchPromise;
        } finally {
            if (this.tsCurrentFetchPromise === tsFetchPromise) {
                this.tsCurrentFetchPromise = null;
            }
        }
    }

    tsScheduleRevalidation(tsCacheKey) {
        if (!tsCacheKey || this.tsRevalidationsInFlight.has(tsCacheKey)) {
            return;
        }
        this.tsRevalidationsInFlight.add(tsCacheKey);
        const tsRevalidateEpoch = this.tsResponseCacheEpoch;
        window.setTimeout(async () => {
            try {
                const tsPayload = await tsFetchJSON(tsCacheKey);
                if (tsRevalidateEpoch !== this.tsResponseCacheEpoch) {
                    return;
                }
                this.tsResponseCache.tsSet(tsCacheKey, tsPayload);
                if (!this.tsIsWorkflowSection() && this.tsBuildRequestPath(null) === tsCacheKey) {
                    this.tsApplyRevalidatedPayload(tsPayload);
                }
            } catch (tsError) {
                tsConsoleWarn("Timesaver Artius Browser revalidation failed", tsError);
            } finally {
                this.tsRevalidationsInFlight.delete(tsCacheKey);
            }
        }, 0);
    }

    tsApplyRevalidatedPayload(tsPayload) {
        if (this.tsState.tsLoading) {
            return;
        }
        const tsIncomingItems = Array.isArray(tsPayload.items) ? tsPayload.items : [];
        // The revalidated payload is only the first page. If the user scrolled
        // and appended pages while the revalidation was in flight (tsLoading
        // only guards the current fetch), tsItems holds more than one page —
        // replacing it with the first page alone would collapse the list and
        // jump the scroll position. Skip the swap; the appended tail stays
        // authoritative and the next full reset picks up any first-page change.
        if (this.tsState.tsItems.length > tsIncomingItems.length) {
            return;
        }
        const tsBuildItemKey = (tsItem) => `${tsItem?.id ?? ""}:${tsItem?.mtime_ns ?? ""}:${tsItem?.has_preview ?? ""}`;
        const tsCurrentKey = this.tsState.tsItems.map(tsBuildItemKey).join("|");
        const tsIncomingKey = tsIncomingItems.map(tsBuildItemKey).join("|");
        if (tsCurrentKey === tsIncomingKey) {
            this.tsState.tsHasMore = Boolean(tsPayload.has_more);
            this.tsState.tsNextCursor = tsPayload.next_cursor || null;
            return;
        }
        this.tsState.tsItems = tsIncomingItems;
        this.tsState.tsHasMore = Boolean(tsPayload.has_more);
        this.tsState.tsNextCursor = tsPayload.next_cursor || null;
        this.tsState.tsFolders = Array.isArray(tsPayload.folders) ? tsPayload.folders : this.tsState.tsFolders;
        this.tsFoldersRevision += 1;
        this.tsItemsRevision += 1;
        this.tsRebuildItemIndex();
        this.tsRenderListOnly();
    }

    tsInvalidateResponseCache() {
        this.tsResponseCacheEpoch += 1;
        this.tsResponseCache.tsClear();
    }

    tsRenderAll() {
        this.tsRenderSectionButtons();
        this.tsRenderToolbarForSection();
        this.tsRenderRootOptions();
        this.tsRenderModeButtons();
        this.tsRefs.tsPreviewSize.value = String(this.tsState.tsPreviewSize);
        this.tsRefs.tsAutoscan.dataset.active = String(Boolean(this.tsState.tsAutoscan));
        this.tsRenderProgress();
        this.tsRenderHealth();
        this.tsRenderTree(true);
        this.tsRenderGrid(true);
        this.tsRenderSelectionButtons();
    }

    tsRenderListOnly() {
        this.tsRenderProgress();
        this.tsRenderHealth();
        this.tsRenderSortDirection();
        this.tsRenderModeButtons();
        this.tsRenderTree(true);
        this.tsRenderGrid(true);
        this.tsRenderSelectionButtons();
    }

    tsRenderSortDirection() {
        const tsOptions = [
            ["desc", this.tsT("button.sortDesc", "Desc")],
            ["asc", this.tsT("button.sortAsc", "Asc")],
        ];
        this.tsRefs.tsSortDirection.innerHTML = tsOptions
            .map(([tsValue, tsLabel]) => `<option value="${tsValue}">${tsLabel}</option>`)
            .join("");
        this.tsRefs.tsSortDirection.value = this.tsState.tsSortDirection || "desc";
        this.tsResizeSelectToCurrent(this.tsRefs.tsSortDirection);
    }

    tsRenderRootOptions() {
        const tsBuildRootOption = (tsRoot) => `<option value="${this.tsEscapeAttribute(tsRoot.root_id)}">${this.tsEscapeHTML(tsRoot.label)}</option>`;
        const tsOptions = this.tsIsWorkflowSection()
            ? (this.tsState.tsRoots || []).map(tsBuildRootOption)
            : [`<option value="all">${this.tsT("label.allRoots", "All Folders")}</option>`]
                .concat((this.tsState.tsRoots || []).map(tsBuildRootOption));
        this.tsRefs.tsRootSelect.innerHTML = tsOptions.join("");
        const tsKnownRootIds = new Set([
            ...(this.tsIsWorkflowSection() ? [] : ["all"]),
            ...this.tsState.tsRoots.map((tsRoot) => tsRoot.root_id),
        ]);
        if (!tsKnownRootIds.has(this.tsState.tsRootId)) {
            this.tsState.tsRootId = this.tsIsWorkflowSection() ? "workflows" : "all";
            this.tsState.tsFolder = "";
            this.tsQueueSaveUISettings();
        }
        this.tsRefs.tsRootSelect.value = this.tsState.tsRootId;
        this.tsRenderSortDirection();
    }

    tsRenderModeButtons() {
        this.tsRefs.tsBody.dataset.mode = this.tsState.tsMode;
        this.tsRefs.tsModeFlat.dataset.active = String(this.tsState.tsMode === "flat");
        this.tsRefs.tsModeTree.dataset.active = String(this.tsState.tsMode === "tree");
    }

    tsBuildProgressLabel(tsStatus) {
        if (!tsStatus?.running) {
            return "";
        }
        if (tsStatus.phase === "count") {
            return this.tsT("status.countingFiles", "Counting supported files...");
        }
        if (tsStatus.phase === "walk") {
            return `${this.tsT("status.scanningFiles", "Scanning files")}: ${tsStatus.scanned || 0} / ${tsStatus.total_files || 0}`;
        }
        if (tsStatus.phase === "hash") {
            return `${this.tsT("status.processingChanges", "Indexing changed assets")}: ${tsStatus.processed_candidates || 0} / ${tsStatus.total_candidates || 0}`;
        }
        return tsStatus.progress_message || this.tsT("status.indexing", "Indexing");
    }

    tsRenderProgress() {
        const tsStatus = this.tsState.tsScanStatus;
        const tsVisible = Boolean(tsStatus?.running);
        this.tsRefs.tsProgress.dataset.visible = String(tsVisible);
        if (!tsVisible) {
            this.tsRefs.tsProgress.dataset.indeterminate = "false";
            this.tsRefs.tsProgressFill.style.width = "0%";
            this.tsRefs.tsProgressCaption.textContent = "";
            return;
        }
        const tsIndeterminate = (tsStatus.phase === "count" || tsStatus.phase === "walk") && !(Number(tsStatus.total_files) > 0);
        const tsPercent = Math.max(0, Math.min(100, Number(tsStatus.progress_percent || 0)));
        this.tsRefs.tsProgress.dataset.indeterminate = String(tsIndeterminate);
        this.tsRefs.tsProgressFill.style.width = tsIndeterminate ? "34%" : `${tsPercent}%`;
        this.tsRefs.tsProgressCaption.textContent = this.tsBuildProgressLabel(tsStatus);
    }

    tsGetGridMetrics() {
        const tsViewportWidth = Math.max(0, Math.round(Number(this.tsRefs.tsGalleryScroll.clientWidth || 0)));
        const tsCardWidth = tsClamp(this.tsState.tsPreviewSize, tsPreviewSizeRange.min, tsPreviewSizeRange.max);
        const tsMetricsKey = [tsViewportWidth, tsCardWidth, tsGridLayout.spacing].join("::");
        if (this.tsGridMetrics && this.tsGridMetricsKey === tsMetricsKey) {
            return this.tsGridMetrics;
        }
        const tsMetrics = tsCalculateGridMetrics({
            viewportWidth: tsViewportWidth,
            cardWidth: tsCardWidth,
            previewSizeRange: tsPreviewSizeRange,
            gridLayout: tsGridLayout,
            cardChromeScale: tsCardChromeScale,
        });
        this.tsState.tsGridColumns = tsMetrics.tsColumns;
        this.tsState.tsGridRowHeight = tsMetrics.tsRowHeight;
        tsApplyGridMetricStyles(this.tsRefs.tsGalleryContent, tsMetrics);
        this.tsGridMetrics = tsMetrics;
        this.tsGridMetricsKey = tsMetricsKey;
        return tsMetrics;
    }

    tsGetVisibleWindow(tsMetrics) {
        const tsScrollTop = this.tsRefs.tsGalleryScroll.scrollTop;
        const tsViewportHeight = this.tsRefs.tsGalleryScroll.clientHeight;
        const tsEffectiveScrollTop = Math.max(0, tsScrollTop - tsMetrics.tsPaddingTop);
        const tsEffectiveViewportBottom = Math.max(0, tsScrollTop + tsViewportHeight - tsMetrics.tsPaddingTop);
        return {
            tsScrollTop,
            tsViewportHeight,
            tsStartRow: Math.max(0, Math.floor(tsEffectiveScrollTop / tsMetrics.tsRowHeight) - tsGridOverscanRows),
            tsEndRow: Math.ceil(tsEffectiveViewportBottom / tsMetrics.tsRowHeight) + tsGridOverscanRows,
        };
    }

    tsHandleGalleryScroll() {
        if (!this.tsState.tsItems.length) {
            return;
        }
        const tsMetrics = this.tsGetGridMetrics();
        const tsWindow = this.tsGetVisibleWindow(tsMetrics);
        const tsNearEnd = this.tsState.tsHasMore
            && !this.tsState.tsLoading
            && tsWindow.tsScrollTop + tsWindow.tsViewportHeight >= this.tsRefs.tsGallerySpacer.offsetHeight - 480;
        const tsWindowKey = `${tsWindow.tsStartRow}:${tsWindow.tsEndRow}`;
        if (!tsNearEnd && tsWindowKey === this.tsLastScrollWindowKey) {
            return;
        }
        this.tsLastScrollWindowKey = tsWindowKey;
        this.tsScheduleGridRender();
    }

    tsRebuildItemIndex() {
        this.tsItemIndexById = tsBuildItemIndexById(this.tsState.tsItems);
    }

    tsRenderHealth() {
        const tsMissing = (this.tsState.tsHealth || []).filter((tsIssue) => !tsIssue.ts_available);
        this.tsRefs.tsHealth.textContent = tsMissing.length > 0
            ? `${this.tsT("health.missingTools", "Missing tools")}: ${tsMissing.map((tsIssue) => tsIssue.ts_name).join(", ")}`
            : "";
    }


    tsRenderTree(tsForce = false) {
        if (this.tsState.tsMode !== "tree") {
            this.tsRefs.tsTreePanel.innerHTML = "";
            this.tsLastTreeMarkupKey = "";
            return;
        }
        const tsTreeKey = [
            this.tsState.tsMode,
            this.tsState.tsRootId,
            this.tsState.tsFolder,
            this.tsFoldersRevision,
            [...this.tsState.tsExpandedFolders].sort().join("|"),
        ].join("::");
        if (!tsForce && this.tsLastTreeMarkupKey === tsTreeKey) {
            return;
        }
        this.tsLastTreeMarkupKey = tsTreeKey;
        const tsFilteredRoots = this.tsState.tsRootId === "all"
            ? this.tsState.tsRoots
            : this.tsState.tsRoots.filter((tsRoot) => tsRoot.root_id === this.tsState.tsRootId);
        const tsTree = tsBuildFolderTree(this.tsState.tsFolders, tsFilteredRoots);
        const tsRenderNodes = (tsNodes, tsDepth = 0) => tsNodes.map((tsNode) => {
            const tsExpanded = this.tsState.tsExpandedFolders.has(tsNode.tsKey);
            const tsHasChildren = tsNode.tsChildren.length > 0;
            const tsActive = this.tsState.tsRootId !== "all"
                && tsNode.tsRootId === this.tsState.tsRootId
                && (this.tsState.tsFolder || "") === (tsNode.tsFolderPath || "");
            const tsToggleLabel = tsExpanded ? "&#9662;" : "&#9656;";
            const tsToggleMarkup = tsHasChildren
                ? `<button class="ts-tree-toggle" type="button" data-toggle-key="${this.tsEscapeAttribute(tsNode.tsKey)}">${tsToggleLabel}</button>`
                : `<span class="ts-tree-toggle-spacer"></span>`;
            return `
                <div>
                    <div class="ts-tree-row" style="--ts-depth:${tsDepth};">
                        ${tsToggleMarkup}
                        <button
                            class="ts-tree-folder"
                            type="button"
                            data-tree-folder="${this.tsEscapeAttribute(tsNode.tsFolderPath || "")}"
                            data-tree-root="${this.tsEscapeAttribute(tsNode.tsRootId)}"
                            data-active="${String(tsActive)}"
                        >
                            <span class="ts-tree-name">${this.tsEscapeHTML(tsNode.tsLabel)}</span>
                            <span class="ts-tree-count">${tsNode.tsCount}</span>
                        </button>
                    </div>
                    ${tsHasChildren && tsExpanded ? tsRenderNodes(tsNode.tsChildren, tsDepth + 1) : ""}
                </div>
            `;
        }).join("");
        this.tsRefs.tsTreePanel.innerHTML = tsRenderNodes(tsTree);
    }

    tsBuildCardMediaMarkup(tsItem, tsPreviewURL) {
        if (!tsPreviewURL) {
            const tsPlaceholderLabel = this.tsIsWorkflowSection()
                ? String(tsItem?.filename || this.tsT("type.workflow", "WORKFLOW")).replace(/\.json$/i, "")
                : String(tsItem?.type || "").toUpperCase();
            return `<div class="ts-card-placeholder">${this.tsEscapeHTML(tsPlaceholderLabel)}</div>`;
        }
        if (this.tsIsWorkflowSection() && tsItem?.preview_kind === "video" && tsPreviewURL) {
            return `<video class="ts-workflow-preview" src="${this.tsEscapeAttribute(tsPreviewURL)}" muted loop autoplay playsinline preload="metadata"></video>`;
        }
        const tsImageClass = this.tsIsWorkflowSection() ? ` class="ts-workflow-preview"` : "";
        return `<img${tsImageClass} src="${this.tsEscapeAttribute(tsPreviewURL)}" alt="${this.tsEscapeAttribute(tsItem?.filename || "")}" loading="eager" decoding="async" fetchpriority="low" draggable="false">`;
    }

    tsRenderGrid(tsForce = false) {
        const tsItems = this.tsState.tsItems;
        const tsWorkflowSection = this.tsIsWorkflowSection();
        const tsMetrics = this.tsGetGridMetrics();
        const tsGap = tsMetrics.tsGap;
        const tsPaddingTop = tsMetrics.tsPaddingTop;
        const tsPaddingBottom = tsMetrics.tsPaddingBottom;
        const tsPaddingLeft = tsMetrics.tsPaddingLeft;
        const tsCardWidth = tsMetrics.tsCardWidth;
        const tsCardHeight = tsMetrics.tsCardHeight;
        const tsColumns = tsMetrics.tsColumns;
        const tsRowHeight = tsMetrics.tsRowHeight;

        const tsRowCount = Math.ceil(tsItems.length / tsColumns);
        const tsSpacerHeight = Math.max(0, tsPaddingTop + tsPaddingBottom + tsRowCount * tsRowHeight);
        this.tsRefs.tsGallerySpacer.style.height = `${tsSpacerHeight}px`;

        const tsEmptyMessage = tsWorkflowSection
            ? this.tsT("empty.workflows", "No workflows match the current filters.")
            : (tsItems.length === 0 && !this.tsState.tsScanStatus?.running && !this.tsState.tsScanStatus?.started_at
                ? this.tsT("empty.scan", "No indexed assets yet. Click Rescan to scan ComfyUI output.")
                : this.tsT("empty.title", "No assets match the current filters."));
        this.tsRefs.tsEmpty.textContent = tsItems.length === 0 ? tsEmptyMessage : "";
        if (tsItems.length === 0) {
            this.tsRefs.tsGalleryContent.innerHTML = "";
            this.tsLastGridMarkupKey = "empty";
            return;
        }

        const tsWindow = this.tsGetVisibleWindow(tsMetrics);
        const tsScrollTop = tsWindow.tsScrollTop;
        const tsViewportHeight = tsWindow.tsViewportHeight;
        const tsStartRow = tsWindow.tsStartRow;
        const tsEndRow = Math.min(tsRowCount, tsWindow.tsEndRow);
        const tsVisibleStartIndex = tsStartRow * tsColumns;
        const tsVisibleEndIndex = Math.min(tsItems.length, tsEndRow * tsColumns);
        const tsVisibleItems = tsItems.slice(tsVisibleStartIndex, tsVisibleEndIndex);
        const tsMarkupKey = [
            this.tsItemsRevision,
            this.tsState.tsMode,
            tsColumns,
            tsCardWidth,
            tsVisibleStartIndex,
            tsVisibleEndIndex,
            tsItems.length,
        ].join("::");
        const tsCards = [];

        for (let tsIndex = tsVisibleStartIndex; tsIndex < tsVisibleEndIndex; tsIndex += 1) {
            const tsItem = tsItems[tsIndex];
            const tsColumn = tsIndex % tsColumns;
            const tsRow = Math.floor(tsIndex / tsColumns);
            const tsSelected = this.tsState.tsSelection.has(tsItem.id);
            const tsLeft = tsPaddingLeft + tsColumn * (tsCardWidth + tsGap);
            const tsTop = tsPaddingTop + tsRow * tsRowHeight;
            const tsWorkflowFolderBadge = tsWorkflowSection
                ? String(tsItem.folder_path || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")
                : "";
            const tsBadges = tsWorkflowSection ? [] : [tsItem.type.toUpperCase()];
            const tsResolutionBadge = Number(tsItem.width) > 0 && Number(tsItem.height) > 0
                ? `${tsItem.width}x${tsItem.height}`
                : "";
            const tsDurationBadge = tsFormatCardDuration(tsItem.duration);
            const tsFPSBadge = tsItem.type === "video" ? tsFormatCardFPS(tsItem.fps) : "";
            if (tsItem.type === "image" && tsResolutionBadge) {
                tsBadges.push(tsResolutionBadge);
            }
            if (tsItem.type === "video") {
                if (tsResolutionBadge) {
                    tsBadges.push(tsResolutionBadge);
                }
                if (tsFPSBadge) {
                    tsBadges.push(tsFPSBadge);
                }
                if (tsDurationBadge) {
                    tsBadges.push(tsDurationBadge);
                }
            }
            if (tsItem.type === "audio" && tsDurationBadge) {
                tsBadges.push(tsDurationBadge);
            }
            const tsShowActions = true;
            const tsShowCopyAction = !tsWorkflowSection && tsItem.type !== "video" && tsItem.type !== "audio";
            const tsShowWorkflowAction = !tsWorkflowSection && tsItem.type === "image" && String(tsItem.extension || "").toLowerCase() === ".png" && Boolean(tsItem.has_workflow);
            const tsPreviewURL = this.tsResolveCardPreviewURL(tsItem);
            const tsMediaMarkup = this.tsBuildCardMediaMarkup(tsItem, tsPreviewURL);
            tsCards.push(`
                <div
                    class="ts-card"
                    role="option"
                    aria-selected="${String(tsSelected)}"
                    aria-label="${this.tsEscapeAttribute(tsItem.filename || "")}"
                    data-card-id="${tsItem.id}"
                    data-card-index="${tsIndex}"
                    data-selected="${String(tsSelected)}"
                    draggable="${tsWorkflowSection ? "false" : "true"}"
                    style="width:${tsCardWidth}px;height:${tsCardHeight}px;transform:translate(${tsLeft}px,${tsTop}px);"
                >
                    <div class="ts-card-media">
                        ${tsMediaMarkup}
                        ${tsShowActions ? `
                            <div class="ts-card-actions">
                                ${tsWorkflowSection ? `<button type="button" data-action="load-workflow" data-card-id="${tsItem.id}" title="${this.tsT("button.loadWorkflow", "Load Workflow")}">L</button>` : ""}
                                ${tsShowCopyAction ? `<button type="button" data-action="copy" data-card-id="${tsItem.id}" title="${this.tsT("button.copyPrompt", "Copy Prompt")}">P</button>` : ""}
                                ${tsShowWorkflowAction ? `<button type="button" data-action="workflow" data-card-id="${tsItem.id}" title="${this.tsT("button.copyWorkflow", "Copy Workflow")}">W</button>` : ""}
                                <button type="button" data-action="download" data-card-id="${tsItem.id}" title="${this.tsT("button.download", "Download")}">D</button>
                                <button type="button" data-action="delete" data-card-id="${tsItem.id}" title="${this.tsT("button.delete", "Delete")}" ${tsWorkflowSection || tsItem.allow_delete ? "" : "disabled"}>X</button>
                            </div>
                        ` : ""}
                        <div class="ts-card-badges">
                            ${tsWorkflowFolderBadge ? `
                                <div class="ts-card-badge" data-kind="workflow-folder" title="${this.tsEscapeAttribute(tsWorkflowFolderBadge)}">${this.tsEscapeHTML(tsWorkflowFolderBadge)}</div>
                            ` : ""}
                            ${tsBadges.map((tsBadge, tsBadgeIndex) => `
                                <div class="ts-card-badge" data-kind="${tsBadgeIndex === 0 ? "type" : "meta"}">${this.tsEscapeHTML(tsBadge)}</div>
                            `).join("")}
                        </div>
                    </div>
                </div>
            `);
        }

        if (!tsForce && this.tsLastGridMarkupKey === tsMarkupKey) {
            this.ts3DQueue.tsScheduleVisible(tsVisibleItems);
            if (this.tsState.tsHasMore && !this.tsState.tsLoading && tsScrollTop + tsViewportHeight >= this.tsRefs.tsGallerySpacer.offsetHeight - 480) {
                this.tsFetchAssets(false);
            }
            return;
        }
        this.tsLastGridMarkupKey = tsMarkupKey;
        this.tsRefs.tsGalleryContent.innerHTML = tsCards.join("");
        this.ts3DQueue.tsScheduleVisible(tsVisibleItems);
        if (this.tsState.tsHasMore && !this.tsState.tsLoading && tsScrollTop + tsViewportHeight >= this.tsRefs.tsGallerySpacer.offsetHeight - 480) {
            this.tsFetchAssets(false);
        }
    }

    tsRenderSelectionButtons() {
        const tsSelectedItems = this.tsGetSelectedItems();
        const tsWorkflowSection = this.tsIsWorkflowSection();
        const tsHasDeletable = !tsWorkflowSection && tsSelectedItems.some((tsItem) => tsItem.allow_delete);
        this.tsRefs.tsRescan.disabled = tsWorkflowSection || Boolean(this.tsState.tsScanStatus?.running);
        this.tsRefs.tsRebuildCache.disabled = tsWorkflowSection || Boolean(this.tsState.tsScanStatus?.running);
        this.tsRefs.tsDeleteSelected.disabled = !tsHasDeletable;
    }

    tsGetSelectedItems() {
        return tsGetSelectedItems(this.tsState.tsItems, this.tsItemIndexById, this.tsState.tsSelection);
    }

    tsFindItemById(tsAssetId) {
        return tsFindItemById(this.tsState.tsItems, this.tsItemIndexById, tsAssetId);
    }

    async tsEnsureAssetDetail(tsAssetId) {
        const tsIndex = this.tsItemIndexById.get(tsAssetId);
        if (tsIndex === undefined || tsIndex < 0) {
            return null;
        }
        const tsAsset = this.tsState.tsItems[tsIndex];
        if (tsAsset.detail_loaded) {
            return tsAsset;
        }
        try {
            const tsDetail = await tsFetchAssetDetail(tsAssetId);
            if (!tsDetail) {
                return tsAsset;
            }
            this.tsState.tsItems[tsIndex] = { ...tsAsset, ...tsDetail };
            this.tsItemsRevision += 1;
            return this.tsState.tsItems[tsIndex];
        } catch {
            return tsAsset;
        }
    }

    async tsCopyAssetPrompt(tsAssetId) {
        const tsAsset = await this.tsEnsureAssetDetail(tsAssetId);
        if (!tsAsset?.prompt_text) {
            tsShowToast("info", this.tsT("toast.noPrompt", "No prompt to copy"));
            return;
        }
        const tsCopied = await tsCopyText(tsAsset.prompt_text);
        tsShowToast(
            tsCopied ? "success" : "error",
            tsCopied ? this.tsT("toast.promptCopied", "Prompt copied") : this.tsT("toast.copyFailed", "Copy failed"),
        );
    }

    async tsCopyAssetWorkflow(tsAssetId) {
        const tsAsset = await this.tsEnsureAssetDetail(tsAssetId);
        if (!tsAsset?.workflow_text) {
            tsShowToast("info", this.tsT("toast.noWorkflow", "No workflow to copy"));
            return;
        }
        const tsCopied = await tsCopyText(tsAsset.workflow_text);
        tsShowToast(
            tsCopied ? "success" : "error",
            tsCopied ? this.tsT("toast.workflowCopied", "Workflow copied") : this.tsT("toast.copyFailed", "Copy failed"),
        );
    }
    tsRefreshCardSelection() {
        this.tsRefs.tsGalleryContent.querySelectorAll("[data-card-id]").forEach((tsCard) => {
            const tsCardId = Number(tsCard.dataset.cardId);
            const tsIsSelected = this.tsState.tsSelection.has(tsCardId);
            tsCard.dataset.selected = String(tsIsSelected);
            tsCard.setAttribute("aria-selected", String(tsIsSelected));
        });
    }

    tsHandleGalleryClick(tsEvent) {
        const tsActionButton = tsEvent.target.closest("[data-action]");
        if (tsActionButton) {
            const tsAsset = this.tsFindItemById(Number(tsActionButton.dataset.cardId));
            if (!tsAsset) {
                return;
            }
            const tsAction = tsActionButton.dataset.action;
            if (tsAction === "copy") {
                void this.tsCopyAssetPrompt(tsAsset.id);
            } else if (tsAction === "workflow") {
                void this.tsCopyAssetWorkflow(tsAsset.id);
            } else if (tsAction === "load-workflow") {
                void this.tsOpenWorkflowById(tsAsset.id);
            } else if (tsAction === "download") {
                tsOpenDownload(tsAsset);
            } else if (tsAction === "delete") {
                if (this.tsIsWorkflowSection()) {
                    void this.tsDeleteWorkflowById(tsAsset.id);
                } else {
                    this.tsDeleteAssets([tsAsset]);
                }
            }
            return;
        }

        const tsCard = tsEvent.target.closest("[data-card-id]");
        if (!tsCard) {
            return;
        }
        const tsCardId = Number(tsCard.dataset.cardId);
        const tsCardIndex = Number(tsCard.dataset.cardIndex);
        if (tsEvent.shiftKey) {
            this.tsSelectRange(tsCardIndex);
        } else if (tsEvent.ctrlKey || tsEvent.metaKey) {
            if (this.tsState.tsSelection.has(tsCardId)) {
                this.tsState.tsSelection.delete(tsCardId);
            } else {
                this.tsState.tsSelection.add(tsCardId);
            }
            this.tsState.tsLastSelectedIndex = tsCardIndex;
        } else {
            this.tsState.tsSelection.clear();
            this.tsState.tsSelection.add(tsCardId);
            this.tsState.tsLastSelectedIndex = tsCardIndex;
        }
        this.tsRenderSelectionButtons();
        this.tsRefreshCardSelection();
    }

    tsHandleGalleryDoubleClick(tsEvent) {
        const tsCard = tsEvent.target.closest("[data-card-id]");
        if (!tsCard) {
            return;
        }
        tsEvent.preventDefault();
        tsEvent.stopPropagation();
        const tsAssetId = Number(tsCard.dataset.cardId);
        if (this.tsIsWorkflowSection()) {
            void this.tsOpenWorkflowById(tsAssetId);
            return;
        }
        this.tsOpenViewer(tsAssetId);
    }

    tsHandleDragStart(tsEvent) {
        if (this.tsIsWorkflowSection()) {
            tsEvent.preventDefault();
            return;
        }
        const tsCard = tsEvent.target.closest("[data-card-id]");
        if (!tsCard) {
            return;
        }
        const tsDraggedId = Number(tsCard.dataset.cardId);
        // Drag the whole selection when the grabbed card is part of a
        // multi-selection; otherwise just the grabbed card. Single-asset
        // payload stays an object (unchanged); a multi payload is an array.
        const tsDragAssets = tsResolveDragAssets(
            this.tsState.tsItems,
            this.tsItemIndexById,
            this.tsState.tsSelection,
            tsDraggedId,
        );
        if (tsDragAssets.length === 0) {
            return;
        }
        const tsPayload = JSON.stringify(tsDragAssets.length === 1 ? tsDragAssets[0] : tsDragAssets);
        try {
            tsEvent.dataTransfer?.clearData();
        } catch {
            // no-op
        }
        tsEvent.stopPropagation();
        tsEvent.dataTransfer.setData(tsAssetDragMime, tsPayload);
        tsEvent.dataTransfer.effectAllowed = "copy";
        window.__tsArtiusDraggedAsset = tsPayload;
    }

    tsHandleTreeClick(tsEvent) {
        const tsToggleKey = tsEvent.target.closest("[data-toggle-key]")?.dataset.toggleKey;
        if (tsToggleKey) {
            if (this.tsState.tsExpandedFolders.has(tsToggleKey)) {
                this.tsState.tsExpandedFolders.delete(tsToggleKey);
            } else {
                this.tsState.tsExpandedFolders.add(tsToggleKey);
            }
            this.tsQueueSaveUISettings();
            this.tsRenderTree();
            return;
        }
        const tsFolderButton = tsEvent.target.closest("[data-tree-folder]");
        if (!tsFolderButton) {
            return;
        }
        this.tsState.tsRootId = tsFolderButton.dataset.treeRoot || this.tsState.tsRootId;
        this.tsState.tsFolder = tsFolderButton.dataset.treeFolder || "";
        if (this.tsIsWorkflowSection()) {
            this.tsWorkflowSelectedFolder = this.tsState.tsFolder;
        }
        this.tsRememberAssetLocation();
        this.tsQueueSaveUISettings();
        this.tsFetchAssets(true);
    }


    tsHandleKeydown(tsEvent) {
        if (this.tsState.tsItems.length === 0) {
            return;
        }
        const tsCurrentIndex = this.tsState.tsLastSelectedIndex >= 0 ? this.tsState.tsLastSelectedIndex : 0;
        let tsNextIndex = tsCurrentIndex;
        if (tsEvent.key === "ArrowRight") {
            tsNextIndex = Math.min(this.tsState.tsItems.length - 1, tsCurrentIndex + 1);
        }
        if (tsEvent.key === "ArrowLeft") {
            tsNextIndex = Math.max(0, tsCurrentIndex - 1);
        }
        if (tsEvent.key === "ArrowDown") {
            tsNextIndex = Math.min(this.tsState.tsItems.length - 1, tsCurrentIndex + this.tsState.tsGridColumns);
        }
        if (tsEvent.key === "ArrowUp") {
            tsNextIndex = Math.max(0, tsCurrentIndex - this.tsState.tsGridColumns);
        }
        if (tsNextIndex !== tsCurrentIndex) {
            tsEvent.preventDefault();
            this.tsState.tsSelection.clear();
            this.tsState.tsSelection.add(this.tsState.tsItems[tsNextIndex].id);
            this.tsState.tsLastSelectedIndex = tsNextIndex;
            this.tsRenderSelectionButtons();
            this.tsRefreshCardSelection();
            return;
        }
        if (tsEvent.key === "Enter") {
            tsEvent.preventDefault();
            const tsSelectedItem = this.tsGetSelectedItems()[0] || this.tsState.tsItems[0];
            if (tsSelectedItem) {
                if (this.tsIsWorkflowSection()) {
                    void this.tsOpenWorkflowById(tsSelectedItem.id);
                } else {
                    this.tsOpenViewer(tsSelectedItem.id);
                }
            }
        }
    }

    tsSelectRange(tsTargetIndex) {
        const tsStartIndex = this.tsState.tsLastSelectedIndex >= 0 ? this.tsState.tsLastSelectedIndex : tsTargetIndex;
        const tsRangeStart = Math.min(tsStartIndex, tsTargetIndex);
        const tsRangeEnd = Math.max(tsStartIndex, tsTargetIndex);
        this.tsState.tsSelection.clear();
        for (let tsIndex = tsRangeStart; tsIndex <= tsRangeEnd; tsIndex += 1) {
            this.tsState.tsSelection.add(this.tsState.tsItems[tsIndex].id);
        }
        this.tsState.tsLastSelectedIndex = tsTargetIndex;
        this.tsRenderSelectionButtons();
        this.tsRefreshCardSelection();
    }

    tsOpenViewer(tsAssetId) {
        const tsIndex = this.tsItemIndexById.get(tsAssetId);
        if (tsIndex === undefined || tsIndex < 0) {
            return;
        }
        const tsAsset = this.tsState.tsItems[tsIndex];
        const tsCompareTypes = new Set(["image", "video"]);
        const tsSelectedCompareItems = tsCompareTypes.has(tsAsset?.type)
            ? this.tsState.tsItems.filter((tsItem) => this.tsState.tsSelection.has(tsItem.id) && tsItem?.type === tsAsset.type)
            : [];
        const tsCompareCount = tsSelectedCompareItems.length >= 4 ? 4 : (tsSelectedCompareItems.length === 2 ? 2 : 0);
        const tsCompareItems = tsCompareCount > 0 && tsSelectedCompareItems.some((tsItem) => tsItem.id === tsAssetId)
            ? tsSelectedCompareItems.slice(0, tsCompareCount)
            : [];
        const tsCompareIndex = tsCompareItems.length > 0
            ? Math.max(0, tsCompareItems.findIndex((tsItem) => tsItem.id === tsAssetId))
            : -1;
        const tsViewerItems = tsCompareItems.length > 0 ? tsCompareItems : this.tsState.tsItems;
        const tsViewerIndex = tsCompareItems.length > 0 ? (tsCompareIndex >= 0 ? tsCompareIndex : 0) : tsIndex;
        this.tsViewer?.tsOpen(tsViewerItems, tsViewerIndex, (tsNextIndex, tsNextItem = null) => {
            const tsItem = tsNextItem || tsViewerItems[tsNextIndex];
            const tsGlobalIndex = tsItem ? this.tsItemIndexById.get(tsItem.id) : undefined;
            if (!tsItem || tsGlobalIndex === undefined || tsGlobalIndex < 0) {
                return;
            }
            this.tsState.tsSelection.clear();
            this.tsState.tsSelection.add(tsItem.id);
            this.tsState.tsLastSelectedIndex = tsGlobalIndex;
            this.tsRenderSelectionButtons();
            this.tsRefreshCardSelection();
        }, tsCompareItems.length > 0 ? {
            tsCompareItems,
        } : {
            tsGetItems: () => this.tsState.tsItems,
            tsCanLoadMore: () => Boolean(this.tsState.tsHasMore || this.tsState.tsLoading || this.tsState.tsQueuedFetchAppend),
            tsRequestMore: async () => {
                const tsBefore = this.tsState.tsItems.length;
                await this.tsFetchAssets(false);
                return this.tsState.tsItems.length > tsBefore;
            },
        });
    }

    async tsOpenWorkflowById(tsWorkflowId) {
        const tsWorkflow = this.tsFindItemById(tsWorkflowId);
        if (!tsWorkflow?.relative_path) {
            return;
        }
        try {
            const tsLoaded = await tsLoadWorkflowIntoComfy(tsWorkflow.relative_path);
            if (!tsLoaded) {
                tsConsoleWarn("Timesaver Artius Browser workflow load API is unavailable");
                tsShowToast("error", this.tsT("toast.workflowLoadFailed", "Failed to load workflow"));
            }
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser failed to load workflow", tsError);
            tsShowToast("error", this.tsT("toast.workflowLoadFailed", "Failed to load workflow"), String(tsError?.message || tsError || ""));
        }
    }


    async tsDeleteWorkflowById(tsWorkflowId) {
        const tsWorkflow = this.tsFindItemById(tsWorkflowId);
        if (!tsWorkflow?.relative_path) {
            return;
        }
        try {
            await tsDeleteWorkflowFile(tsWorkflow.relative_path);
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser failed to delete workflow", tsError);
            tsShowToast("error", this.tsT("toast.workflowDeleteFailed", "Failed to delete workflow"), String(tsError?.message || tsError || ""));
            return;
        }
        // Surgically remove from the workflow library cache so re-entering the
        // section / folder does not re-show the deleted entry.
        const tsLibraryIndex = this.tsWorkflowLibrary.findIndex(
            (tsEntry) => tsEntry?.relative_path === tsWorkflow.relative_path,
        );
        if (tsLibraryIndex >= 0) {
            this.tsWorkflowLibrary.splice(tsLibraryIndex, 1);
        }
        // Drop from current list without refetching — preserves scroll position.
        this.tsRemoveItemsByIds([tsWorkflowId]);
    }

    async tsDeleteAssets(tsAssets) {
        const tsDeletableAssets = tsAssets.filter((tsAsset) => tsAsset.allow_delete);
        if (tsDeletableAssets.length === 0) {
            return;
        }
        const tsDeletedIds = tsDeletableAssets.map((tsAsset) => tsAsset.id);
        try {
            await tsPostJSON(`${tsRouteBase}/delete`, { ids: tsDeletedIds });
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser failed to delete assets", tsError);
            tsShowToast("error", this.tsT("toast.deleteFailed", "Delete failed"), String(tsError?.message || tsError || ""));
            return;
        }
        // Surgical removal instead of `tsFetchAssets(true)` — preserves scroll
        // position. Backend also emits tsab:asset-remove events; the existing
        // event handler is a safety net but does nothing on already-empty state.
        this.tsRemoveItemsByIds(tsDeletedIds);
    }

    tsRemoveItemsByIds(tsIds) {
        if (!Array.isArray(tsIds) || tsIds.length === 0) {
            return;
        }
        const tsRemovalSet = new Set(tsIds.map((tsId) => Number(tsId)));
        // Partition the current items into removed / kept so the folder-
        // count decrement step can read root_id / folder_path off the
        // removed entries before they are dropped.
        const tsRemovedItems = [];
        const tsNextItems = [];
        for (const tsItem of this.tsState.tsItems) {
            if (tsRemovalSet.has(Number(tsItem.id))) {
                tsRemovedItems.push(tsItem);
            } else {
                tsNextItems.push(tsItem);
            }
        }
        if (tsRemovedItems.length === 0) {
            return;
        }
        this.tsState.tsItems = tsNextItems;
        this.tsItemsRevision += 1;
        this.tsRebuildItemIndex();
        for (const tsId of tsRemovalSet) {
            this.tsState.tsSelection.delete(tsId);
        }
        // Reset the shift-click anchor whenever the array changes shape.
        // Items before the previous anchor may have been removed, shifting
        // it to a different item; the pre-1.2.0 path (tsFetchAssets(true))
        // also reset the anchor to -1, so this matches that behavior and
        // avoids next-shift-click selecting a wrong range.
        this.tsState.tsLastSelectedIndex = -1;
        this.tsApplyFolderCountDecrements(tsRemovedItems);
        this.tsInvalidateResponseCache();
        this.tsDebouncedAssetEventRefresh();
        // If removal drained the visible page but the backend still has
        // more rows, pull the next page so the gallery doesn't get stuck
        // showing the empty state despite tsHasMore=true (the scroll
        // handler short-circuits when tsItems is empty).
        if (this.tsState.tsHasMore
            && !this.tsState.tsLoading
            && this.tsState.tsItems.length === 0
            && !this.tsIsWorkflowSection()) {
            this.tsFetchAssets(false);
        }
    }

    tsApplyFolderCountDecrements(tsRemovedItems) {
        if (!Array.isArray(this.tsState.tsFolders) || this.tsState.tsFolders.length === 0) {
            return;
        }
        const tsNormalizeFolderPath = (tsValue) =>
            String(tsValue || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
        const tsBuckets = new Map();
        for (const tsItem of tsRemovedItems) {
            const tsRootId = String(tsItem?.root_id || "");
            if (!tsRootId) {
                continue;
            }
            const tsKey = `${tsRootId}::${tsNormalizeFolderPath(tsItem?.folder_path)}`;
            tsBuckets.set(tsKey, (tsBuckets.get(tsKey) || 0) + 1);
        }
        if (tsBuckets.size === 0) {
            return;
        }
        let tsChanged = false;
        for (const tsFolder of this.tsState.tsFolders) {
            const tsRootId = String(tsFolder?.root_id || "");
            const tsKey = `${tsRootId}::${tsNormalizeFolderPath(tsFolder?.folder_path)}`;
            const tsDelta = tsBuckets.get(tsKey);
            if (!tsDelta) {
                continue;
            }
            const tsCurrent = Number(tsFolder.asset_count || 0);
            tsFolder.asset_count = Math.max(0, tsCurrent - tsDelta);
            tsChanged = true;
        }
        if (tsChanged) {
            this.tsFoldersRevision += 1;
            // Debounced asset refresh only re-renders the grid; the tree
            // panel needs its own kick so counts in the sidebar move in
            // lockstep with the gallery.
            this.tsRenderTree(true);
        }
    }

    tsDeleteSelected() {
        this.tsDeleteAssets(this.tsGetSelectedItems());
    }

    tsEscapeHTML(tsText) {
        return String(tsText || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    tsEscapeAttribute(tsText) {
        return this.tsEscapeHTML(tsText).replaceAll('"', "&quot;");
    }
}

let tsPanelSingleton = null;

export function tsEnsurePanelElement() {
    if (!customElements.get("ts-artius-browser-panel")) {
        customElements.define("ts-artius-browser-panel", TSArtiusBrowserPanel);
    }
}

export function tsGetPanelSingleton() {
    tsEnsurePanelElement();
    if (!tsPanelSingleton) {
        tsPanelSingleton = document.createElement("ts-artius-browser-panel");
        tsPanelSingleton.style.display = "flex";
        tsPanelSingleton.style.flex = "1 1 auto";
        tsPanelSingleton.style.height = "100%";
        tsPanelSingleton.style.minHeight = "0";
    }
    return tsPanelSingleton;
}







































