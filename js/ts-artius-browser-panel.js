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
    tsFetchWorkflowBrowserLibrary,
    tsEnsureCanvasDropBridge,
    tsFetchBrowserSettings,
    tsFetchJSON,
    tsLoadWorkflowIntoComfy,
    tsLoadLocale,
    tsOpenDownload,
    tsPostJSON,
    tsRouteBase,
    tsSave3DThumbnail,
    tsSaveBrowserSettings,
} from "./ts-artius-browser-api.js";
import { tsCapture3DThumbnail } from "./ts-artius-browser-3d.js";
import { tsEnsureViewerElement, tsGetViewerSingleton } from "./ts-artius-browser-viewer.js";
import { tsPanelSettings, tsProjectSettings } from "./ts-artius-browser-settings.js";

const tsTypeOrder = tsPanelSettings.typeOrder;
const tsDefaultLimit = tsPanelSettings.defaultLimit;
const tsPreviewSizeRange = tsPanelSettings.previewSizeRange;
const tsGridLayout = tsPanelSettings.gridLayout;
const tsGridOverscanRows = Math.max(0, Number(tsPanelSettings.gridOverscanRows || 1));
const tsCardChromeScale = tsPanelSettings.cardChromeScale;
const ts3DThumbnailSettings = tsPanelSettings.threeDThumbnails;
const tsBrowserSections = Object.freeze(["assets", "workflows"]);

function tsLerp(tsStart, tsEnd, tsRatio) {
    return tsStart + ((tsEnd - tsStart) * tsRatio);
}

function tsFormatCardDuration(tsSeconds) {
    const tsValue = Number(tsSeconds || 0);
    if (!Number.isFinite(tsValue) || tsValue <= 0) {
        return "";
    }
    const tsRounded = Math.max(1, Math.round(tsValue));
    if (tsRounded < 60) {
        return `${tsRounded}s`;
    }
    const tsHours = Math.floor(tsRounded / 3600);
    const tsMinutes = Math.floor((tsRounded % 3600) / 60);
    const tsSecondsRemainder = tsRounded % 60;
    if (tsHours > 0) {
        return `${tsHours}:${String(tsMinutes).padStart(2, "0")}:${String(tsSecondsRemainder).padStart(2, "0")}`;
    }
    return `${tsMinutes}:${String(tsSecondsRemainder).padStart(2, "0")}`;
}

export class TSArtiusBrowserPanel extends HTMLElement {
    constructor() {
        super();
        this.tsState = {
            tsItems: [],
            tsHasMore: false,
            tsLoading: false,
            tsSection: "assets",
            tsSearch: "",
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
            tsLocale: {},
            tsGridColumns: 1,
            tsGridRowHeight: 296,
            tsBrowserWidth: 0,
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
        this.ts3DThumbnailDisposed = false;
        this.ts3DThumbnailQueue = [];
        this.ts3DThumbnailPending = new Set();
        this.ts3DThumbnailInFlight = new Set();
        this.ts3DThumbnailFailed = new Set();
        this.ts3DThumbnailCache = new Map();
        this.ts3DThumbnailWorkers = 0;
        this.ts3DThumbnailPersisting = new Set();
        this.ts3DThumbnailWarmupPromise = null;
        this.ts3DThumbnailWarmupKey = "";
        this.ts3DThumbnailWarmupToken = 0;
        this.tsSidebarRefreshTimer = 0;
        this.tsWorkflowLibrary = [];
        this.tsWorkflowLibraryLoaded = false;
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        if (this.tsConnectedOnce) {
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
        this.ts3DThumbnailDisposed = true;
        this.ts3DThumbnailWarmupToken += 1;
        this.ts3DThumbnailQueue = [];
        this.ts3DThumbnailPending.clear();
        window.clearTimeout(this.tsSidebarRefreshTimer);
        this.tsResizeObserver?.disconnect?.();
        this.tsBrowserWidthObserver?.disconnect?.();
    }

    async tsInitAsync() {
        await this.tsLoadUISettings();
        this.tsState.tsLocale = await tsLoadLocale(tsProjectSettings.defaultLocale);
        this.tsHydrateText();
        await this.tsFetchAssets(true);
        void this.tsMaybeBootstrapScan();
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
        window.clearTimeout(this.tsSidebarRefreshTimer);
        this.tsSidebarRefreshTimer = window.setTimeout(tsRunRefresh, tsDelayMs);
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

    async tsLoadUISettings() {
        try {
            const tsPayload = await tsFetchBrowserSettings();
            const tsUI = tsPayload?.ui || {};
            if (tsBrowserSections.includes(tsUI.browser_section)) {
                this.tsState.tsSection = tsUI.browser_section;
            }
            this.tsState.tsAssetMode = tsUI.asset_view_mode === "flat" || tsUI.asset_view_mode === "tree"
                ? tsUI.asset_view_mode
                : tsPanelSettings.defaultMode;
            this.tsState.tsWorkflowMode = tsUI.workflow_view_mode === "flat" || tsUI.workflow_view_mode === "tree"
                ? tsUI.workflow_view_mode
                : tsPanelSettings.defaultMode;
            if (typeof tsUI.autoscan === "boolean") {
                this.tsState.tsAutoscan = tsUI.autoscan;
            }
            const tsResolvePreviewSize = (tsValue, tsFallback) => {
                const tsSize = Number(tsValue || 0);
                return Number.isFinite(tsSize) && tsSize > 0
                    ? tsClamp(tsSize, tsPreviewSizeRange.min, tsPreviewSizeRange.max)
                    : tsFallback;
            };
            this.tsState.tsAssetSortKey = tsUI.asset_sort_key === "created_at" || tsUI.asset_sort_key === "filename" || tsUI.asset_sort_key === "size_bytes"
                ? tsUI.asset_sort_key
                : tsPanelSettings.defaultSort.key;
            this.tsState.tsAssetSortDirection = tsUI.asset_sort_direction === "asc" || tsUI.asset_sort_direction === "desc"
                ? tsUI.asset_sort_direction
                : tsPanelSettings.defaultSort.direction;
            this.tsState.tsWorkflowSortKey = tsUI.workflow_sort_key === "created_at" || tsUI.workflow_sort_key === "filename"
                ? tsUI.workflow_sort_key
                : (tsPanelSettings.defaultSort.key === "size_bytes" ? "created_at" : tsPanelSettings.defaultSort.key);
            this.tsState.tsWorkflowSortDirection = tsUI.workflow_sort_direction === "asc" || tsUI.workflow_sort_direction === "desc"
                ? tsUI.workflow_sort_direction
                : tsPanelSettings.defaultSort.direction;
            this.tsState.tsAssetPreviewSize = tsResolvePreviewSize(tsUI.asset_preview_size, tsPreviewSizeRange.default);
            this.tsState.tsWorkflowPreviewSize = tsResolvePreviewSize(tsUI.workflow_preview_size, tsPreviewSizeRange.default);
            if (Array.isArray(tsUI.asset_types)) {
                this.tsState.tsTypes = new Set(
                    tsUI.asset_types
                        .map((tsType) => String(tsType || ""))
                        .filter((tsType) => tsTypeOrder.includes(tsType))
                );
            }
            if (typeof tsUI.selected_root_id === "string" && tsUI.selected_root_id) {
                this.tsState.tsRootId = tsUI.selected_root_id;
                if (tsUI.selected_root_id !== "workflows") {
                    this.tsLastAssetRootId = tsUI.selected_root_id;
                }
            }
            if (typeof tsUI.selected_folder_path === "string") {
                this.tsState.tsFolder = tsUI.selected_folder_path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
                this.tsLastAssetFolder = this.tsState.tsFolder;
            }
            if (typeof tsUI.workflow_selected_folder_path === "string") {
                this.tsWorkflowSelectedFolder = tsUI.workflow_selected_folder_path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
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
            this.tsApplySectionSettings();
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser settings fetch failed", tsError);
        } finally {
            this.tsState.tsSettingsHydrated = true;
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
                workflow_sort_key: this.tsState.tsWorkflowSortKey,
                workflow_sort_direction: this.tsState.tsWorkflowSortDirection,
                workflow_preview_size: this.tsState.tsWorkflowPreviewSize,
                asset_types: [...this.tsState.tsTypes],
                selected_root_id: tsSelectedRootId,
                selected_folder_path: tsSelectedFolderPath,
                workflow_selected_folder_path: this.tsWorkflowSelectedFolder || "",
                expanded_folders: [...this.tsState.tsExpandedFolders],
                browser_width: this.tsState.tsBrowserWidth,
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
        if (this.tsIsWorkflowSection()) {
            this.tsState.tsWorkflowMode = this.tsState.tsMode;
            this.tsState.tsWorkflowSortKey = this.tsState.tsSortKey === "size_bytes" ? "created_at" : this.tsState.tsSortKey;
            this.tsState.tsWorkflowSortDirection = this.tsState.tsSortDirection;
            this.tsState.tsWorkflowPreviewSize = this.tsState.tsPreviewSize;
            return;
        }
        this.tsState.tsAssetMode = this.tsState.tsMode;
        this.tsState.tsAssetSortKey = this.tsState.tsSortKey;
        this.tsState.tsAssetSortDirection = this.tsState.tsSortDirection;
        this.tsState.tsAssetPreviewSize = this.tsState.tsPreviewSize;
    }

    tsApplySectionSettings() {
        if (this.tsIsWorkflowSection()) {
            this.tsState.tsMode = this.tsState.tsWorkflowMode;
            this.tsState.tsSortKey = this.tsState.tsWorkflowSortKey === "size_bytes" ? "created_at" : this.tsState.tsWorkflowSortKey;
            this.tsState.tsSortDirection = this.tsState.tsWorkflowSortDirection;
            this.tsState.tsPreviewSize = this.tsState.tsWorkflowPreviewSize;
            this.tsState.tsFolder = this.tsState.tsMode === "tree" ? (this.tsWorkflowSelectedFolder || "") : "";
            return;
        }
        this.tsState.tsMode = this.tsState.tsAssetMode;
        this.tsState.tsSortKey = this.tsState.tsAssetSortKey;
        this.tsState.tsSortDirection = this.tsState.tsAssetSortDirection;
        this.tsState.tsPreviewSize = this.tsState.tsAssetPreviewSize;
        this.tsState.tsFolder = this.tsState.tsMode === "tree" ? (this.tsLastAssetFolder || "") : "";
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
        return [{
            root_id: "workflows",
            label: this.tsT("section.workflows", "Workflows"),
        }];
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
        const tsFolderCounts = new Map();
        (tsItems || []).forEach((tsItem) => {
            const tsFolderPath = String(tsItem?.folder_path || "");
            tsFolderCounts.set(tsFolderPath, Number(tsFolderCounts.get(tsFolderPath) || 0) + 1);
        });
        return [...tsFolderCounts.entries()].map(([tsFolderPath, tsAssetCount]) => ({
            root_id: "workflows",
            folder_path: tsFolderPath,
            asset_count: tsAssetCount,
        }));
    }

    tsBuildWorkflowQueryResult() {
        const tsSearchNeedle = String(this.tsState.tsSearch || "").trim().toLowerCase();
        const tsSelectedFolder = this.tsState.tsMode === "tree" ? String(this.tsState.tsFolder || "") : "";
        const tsFilteredForTree = this.tsWorkflowLibrary.filter((tsItem) => {
            if (tsSearchNeedle && !String(tsItem?.filename || "").toLowerCase().includes(tsSearchNeedle)) {
                return false;
            }
            return true;
        });
        const tsVisibleItems = tsFilteredForTree.filter((tsItem) => {
            if (!tsSelectedFolder) {
                return true;
            }
            const tsItemFolder = String(tsItem?.folder_path || "");
            return tsItemFolder === tsSelectedFolder || tsItemFolder.startsWith(`${tsSelectedFolder}/`);
        });
        const tsSortDirectionFactor = this.tsState.tsSortDirection === "asc" ? 1 : -1;
        const tsSortedItems = [...tsVisibleItems].sort((tsLeft, tsRight) => {
            if (this.tsState.tsSortKey === "filename") {
                return tsSortDirectionFactor * String(tsLeft?.filename || "").localeCompare(String(tsRight?.filename || ""), undefined, { sensitivity: "base" });
            }
            if (this.tsState.tsSortKey === "size_bytes") {
                return tsSortDirectionFactor * (Number(tsLeft?.size_bytes || 0) - Number(tsRight?.size_bytes || 0));
            }
            return tsSortDirectionFactor * (Number(tsLeft?.modified_at || tsLeft?.created_at || 0) - Number(tsRight?.modified_at || tsRight?.created_at || 0));
        });
        return {
            items: tsSortedItems,
            folders: this.tsBuildWorkflowFolders(tsFilteredForTree),
            roots: this.tsGetWorkflowRootNodes(),
        };
    }

    tsBuildShell() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: flex;
                    flex: 1 1 auto;
                    min-height: 0;
                    height: 100%;
                    color: var(--input-text, var(--fg-color, inherit));
                    font-family: var(--font-family, "Segoe UI", sans-serif);
                    --ts-accent: var(--p-button-primary-background, var(--theme-color, var(--input-text, var(--fg-color, currentColor))));
                    --ts-accent-contrast: var(--p-button-primary-color, var(--comfy-menu-bg, var(--bg-color, inherit)));
                    --ts-bg-0: var(--comfy-menu-bg, var(--bg-color, transparent));
                    --ts-bg-1: var(--comfy-input-bg, var(--comfy-menu-secondary-bg, var(--ts-bg-0)));
                    --ts-bg-2: var(--content-bg, var(--comfy-input-bg, var(--ts-bg-1)));
                    --ts-text: var(--input-text, var(--fg-color, inherit));
                    --ts-bg-3: color-mix(in srgb, var(--ts-text) 5%, var(--ts-bg-0));
                    --ts-border: var(--border-color, color-mix(in srgb, var(--ts-text) 14%, transparent));
                    --ts-muted: var(--descrip-text, color-mix(in srgb, var(--ts-text) 72%, transparent));
                    --ts-shadow-color: color-mix(in srgb, var(--ts-bg-0) 72%, black);
                    --ts-shadow: 0 4px 18px color-mix(in srgb, var(--ts-shadow-color) 22%, transparent);
                    --ts-surface-ghost: color-mix(in srgb, var(--ts-text) 4%, transparent);
                    --ts-surface-soft: color-mix(in srgb, var(--ts-bg-0) 68%, var(--ts-bg-2));
                    --ts-surface-overlay: color-mix(in srgb, var(--ts-bg-0) 72%, transparent);
                    --ts-surface-overlay-strong: color-mix(in srgb, var(--ts-bg-0) 82%, transparent);
                    --ts-surface-overlay-soft: color-mix(in srgb, var(--ts-bg-0) 58%, transparent);
                    --ts-folder-icon: var(--ts-muted);
                    --ts-progress-track: color-mix(in srgb, var(--ts-text) 10%, transparent);
                    --ts-progress-glow: color-mix(in srgb, var(--ts-accent) 72%, var(--ts-text));
                    --ts-card-overlay-top: color-mix(in srgb, var(--ts-bg-0) 16%, transparent);
                    --ts-card-overlay-bottom: color-mix(in srgb, var(--ts-bg-0) 88%, transparent);
                }

                .ts-shell {
                    flex: 1 1 auto;
                    min-height: 0;
                    height: 100%;
                    display: grid;
                    grid-template-rows: auto 1fr;
                    background: var(--ts-bg-0);
                }

                .ts-toolbar {
                    display: grid;
                    gap: 6px;
                    padding: 10px;
                    border-bottom: 1px solid var(--ts-border);
                    background: var(--ts-bg-1);
                }

                .ts-title {
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                }

                .ts-title-link {
                    color: inherit;
                    text-decoration: none;
                }

                .ts-title-link:hover {
                    text-decoration: underline;
                }

                .ts-toolbar-main,
                .ts-toolbar-secondary {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .ts-toolbar-cluster {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                    min-height: 32px;
                    padding: 3px;
                    border: 1px solid var(--ts-border);
                    border-radius: 10px;
                    background: color-mix(in srgb, var(--ts-bg-2) 78%, transparent);
                }

                .ts-type-chips {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .ts-section-button {
                    min-width: 84px;
                }

                .ts-root-select,
                .ts-sort-select {
                    appearance: none;
                    -webkit-appearance: none;
                    font: inherit;
                    cursor: pointer;
                    padding: 0 28px 0 10px;
                    border-radius: 8px;
                    color: var(--ts-text);
                    background: transparent;
                    background-image:
                        linear-gradient(45deg, transparent 50%, var(--ts-muted) 50%),
                        linear-gradient(135deg, var(--ts-muted) 50%, transparent 50%);
                    background-position:
                        calc(100% - 14px) calc(50% - 2px),
                        calc(100% - 9px) calc(50% - 2px);
                    background-size: 5px 5px, 5px 5px;
                    background-repeat: no-repeat;
                }

                .ts-root-select option,
                .ts-sort-select option {
                    color: var(--ts-text);
                    background: var(--ts-bg-1);
                }

                .ts-root-select::-ms-expand,
                .ts-sort-select::-ms-expand {
                    display: none;
                }

                .ts-toolbar-cluster button,
                .ts-toolbar-cluster select,
                .ts-type-chips .ts-chip,
                .ts-sort-group button,
                .ts-sort-group select,
                .ts-mode-group .ts-mode-button {
                    min-height: 26px;
                    border-color: transparent;
                    background: transparent;
                    box-shadow: none;
                }

                .ts-toolbar-cluster button:hover,
                .ts-toolbar-cluster select:hover,
                .ts-type-chips .ts-chip:hover,
                .ts-sort-group button:hover,
                .ts-sort-group select:hover,
                .ts-mode-group .ts-mode-button:hover {
                    border-color: color-mix(in srgb, var(--ts-accent) 52%, transparent);
                    background: color-mix(in srgb, var(--ts-bg-3) 70%, transparent);
                }
                .ts-toggle-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    min-height: 32px;
                    padding: 0 12px;
                    border: 1px solid var(--ts-border);
                    border-radius: 999px;
                    background: var(--ts-bg-2);
                    color: var(--ts-muted);
                    user-select: none;
                    font-size: 12px;
                }

                .ts-toggle-button::before {
                    content: "";
                    width: 10px;
                    height: 10px;
                    flex: 0 0 10px;
                    border-radius: 999px;
                    background: color-mix(in srgb, var(--ts-text) 24%, transparent);
                    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ts-text) 10%, transparent);
                    transition: background 0.14s ease;
                }

                .ts-toggle-button[data-active="true"] {
                    border-color: color-mix(in srgb, var(--ts-accent) 58%, transparent);
                    color: var(--ts-accent-contrast);
                    background: color-mix(in srgb, var(--ts-accent) 22%, var(--ts-bg-2));
                }

                .ts-toggle-button[data-active="true"]::before {
                    background: var(--ts-accent);
                }

                .ts-search {
                    min-width: 180px;
                    flex: 1 1 220px;
                }

                .ts-search,
                select,
                input[type="search"] {
                    color: inherit;
                    background: var(--ts-bg-2);
                    border: 1px solid var(--ts-border);
                    border-radius: 8px;
                    padding: 7px 10px;
                    min-height: 32px;
                    outline: none;
                }

                input[type="range"] {
                    accent-color: var(--ts-accent);
                }

                button,
                .ts-chip {
                    border: 1px solid var(--ts-border);
                    border-radius: 8px;
                    min-height: 32px;
                    padding: 6px 10px;
                    color: inherit;
                    background: var(--ts-bg-2);
                    cursor: pointer;
                    transition: border-color 0.14s ease, background 0.14s ease, opacity 0.14s ease;
                }

                button:hover,
                .ts-chip:hover {
                    border-color: var(--ts-accent);
                }

                button[disabled] {
                    opacity: 0.5;
                    cursor: default;
                }

                .ts-chip[data-active="true"],
                .ts-section-button[data-active="true"],
                .ts-mode-button[data-active="true"] {
                    background: color-mix(in srgb, var(--ts-accent) 20%, var(--ts-bg-2));
                    border-color: var(--ts-accent);
                    color: var(--ts-accent-contrast);
                }

                .ts-status,
                .ts-health,
                .ts-tree-count {
                    color: var(--ts-muted);
                    font-size: 12px;
                }

                .ts-progress {
                    display: none;
                    gap: 6px;
                }

                .ts-progress[data-visible="true"] {
                    display: grid;
                }

                .ts-progress-track {
                    position: relative;
                    height: 6px;
                    border-radius: 999px;
                    background: var(--ts-progress-track);
                    overflow: hidden;
                }

                .ts-progress-fill {
                    position: absolute;
                    inset: 0 auto 0 0;
                    width: 0%;
                    border-radius: inherit;
                    background: linear-gradient(90deg, var(--ts-progress-glow), var(--ts-accent));
                    transition: width 0.16s ease;
                }

                .ts-progress[data-indeterminate="true"] .ts-progress-fill {
                    width: 34%;
                    animation: ts-progress-indeterminate 1.15s ease-in-out infinite;
                }

                .ts-progress-caption {
                    color: var(--ts-muted);
                    font-size: 11px;
                }

                @keyframes ts-progress-indeterminate {
                    0% { transform: translateX(-120%); }
                    100% { transform: translateX(340%); }
                }

                .ts-body {
                    min-height: 0;
                    display: grid;
                    grid-template-columns: minmax(180px, 240px) 1fr;
                }

                .ts-body[data-mode="flat"] {
                    grid-template-columns: 1fr;
                }

                .ts-tree-panel {
                    border-right: 1px solid var(--ts-border);
                    overflow: auto;
                    padding: 10px 8px;
                    background: var(--ts-bg-1);
                }

                .ts-body[data-mode="flat"] .ts-tree-panel {
                    display: none;
                }

                .ts-tree-row {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding-left: calc(var(--ts-depth, 0) * 12px);
                    margin-bottom: 2px;
                }

                .ts-tree-toggle {
                    width: 16px;
                    min-height: 16px;
                    padding: 0;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    font-size: 11px;
                    color: var(--ts-muted);
                    opacity: 0.9;
                }

                .ts-tree-toggle:hover {
                    border: 0;
                    background: transparent;
                    color: inherit;
                }

                .ts-tree-toggle-spacer {
                    width: 16px;
                    flex: 0 0 16px;
                }

                .ts-tree-name {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .ts-tree-name::before {
                    content: "";
                    width: 13px;
                    height: 13px;
                    flex: 0 0 13px;
                    opacity: 0.92;
                    background-color: var(--ts-folder-icon);
                    mask: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Cpath d='M3.75 7.5a2.25 2.25 0 0 1 2.25-2.25h4.09a2.25 2.25 0 0 1 1.59.66l1.06 1.06a2.25 2.25 0 0 0 1.59.66H18a2.25 2.25 0 0 1 2.25 2.25v6.75A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V7.5Z'/%3E%3C/svg%3E");
                    -webkit-mask: no-repeat center / contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Cpath d='M3.75 7.5a2.25 2.25 0 0 1 2.25-2.25h4.09a2.25 2.25 0 0 1 1.59.66l1.06 1.06a2.25 2.25 0 0 0 1.59.66H18a2.25 2.25 0 0 1 2.25 2.25v6.75A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V7.5Z'/%3E%3C/svg%3E");
                }

                .ts-tree-folder {
                    flex: 1 1 auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    min-height: 26px;
                    border-radius: 7px;
                    border: 1px solid transparent;
                    background: transparent;
                    padding: 3px 6px;
                    text-align: left;
                }

                .ts-tree-folder[data-active="true"] {
                    background: var(--ts-bg-3);
                    border-color: var(--ts-accent);
                }

                .ts-gallery-wrap {
                    min-height: 0;
                    position: relative;
                    background: var(--ts-bg-0);
                }

                .ts-gallery-scroll {
                    position: absolute;
                    inset: 0;
                    overflow: auto;
                }

                .ts-gallery-spacer {
                    position: relative;
                    width: 100%;
                }

                .ts-gallery-content {
                    position: absolute;
                    inset: 0 auto auto 0;
                    width: 100%;
                }

                .ts-card {
                    position: absolute;
                    border-radius: var(--ts-card-radius, 10px);
                    border: 1px solid var(--ts-border);
                    background: var(--ts-bg-1);
                    box-shadow: none;
                    overflow: hidden;
                    transition: border-color 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease;
                    user-select: none;
                }

                .ts-card:hover {
                    transform: translateY(-1px);
                    border-color: color-mix(in srgb, var(--ts-accent) 70%, var(--ts-border));
                    box-shadow: 0 8px 24px color-mix(in srgb, var(--ts-shadow-color) 34%, transparent);
                }

                .ts-card[data-selected="true"] {
                    border-color: var(--ts-accent);
                }

                .ts-card-media {
                    position: relative;
                    background: var(--ts-bg-2);
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: var(--ts-card-preview-height, 220px);
                    cursor: pointer;
                }

                .ts-card-media::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, var(--ts-card-overlay-top) 0%, transparent 34%, var(--ts-card-overlay-bottom) 100%);
                    opacity: 0;
                    transition: opacity 0.14s ease;
                    pointer-events: none;
                }

                .ts-card:hover .ts-card-media::after,
                .ts-card[data-selected="true"] .ts-card-media::after {
                    opacity: 1;
                }

                .ts-card-media img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }

                .ts-card-media img.ts-workflow-preview {
                    object-fit: cover;
                }

                .ts-card-media video {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }

                .ts-card-media video.ts-workflow-preview {
                    object-fit: cover;
                }

                .ts-card-placeholder {
                    display: grid;
                    place-items: center;
                    width: 100%;
                    height: 100%;
                    color: var(--ts-muted);
                    padding: 14px;
                    text-align: center;
                    font-size: 16px;
                    line-height: 1.25;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    word-break: break-word;
                    overflow-wrap: anywhere;
                }
                .ts-card-actions {
                    position: absolute;
                    top: var(--ts-card-inset, 8px);
                    right: var(--ts-card-inset, 8px);
                    display: flex;
                    gap: var(--ts-card-action-gap, 4px);
                    opacity: 0;
                    transform: translateY(-2px);
                    transition: opacity 0.14s ease, transform 0.14s ease;
                    z-index: 2;
                }

                .ts-card:hover .ts-card-actions,
                .ts-card[data-selected="true"] .ts-card-actions {
                    opacity: 1;
                    transform: translateY(0);
                }
                .ts-card-actions button {
                    min-height: var(--ts-card-action-size, 22px);
                    width: var(--ts-card-action-size, 22px);
                    padding: 0;
                    border-radius: var(--ts-card-action-radius, 5px);
                    background: var(--ts-surface-overlay-strong);
                    font-size: var(--ts-card-action-font-size, 10px);
                    font-weight: 700;
                }

                .ts-card-badges {
                    position: absolute;
                    left: var(--ts-card-inset, 8px);
                    bottom: var(--ts-card-inset, 8px);
                    display: flex;
                    align-items: center;
                    gap: var(--ts-card-action-gap, 4px);
                    flex-wrap: wrap;
                    z-index: 2;
                    pointer-events: none;
                }

                .ts-card-badge {
                    padding: var(--ts-card-badge-pad-y, 3px) var(--ts-card-badge-pad-x, 6px);
                    border-radius: var(--ts-card-badge-radius, 5px);
                    background: var(--ts-surface-overlay-strong);
                    font-size: var(--ts-card-badge-font-size, 10px);
                    line-height: 1.1;
                    white-space: nowrap;
                }

                .ts-card-badge[data-kind="meta"] {
                    background: var(--ts-surface-overlay-soft);
                }
                .ts-empty {
                    position: absolute;
                    inset: 0;
                    display: grid;
                    place-items: center;
                    pointer-events: none;
                    color: var(--ts-muted);
                    text-align: center;
                    padding: 24px;
                    font-size: 12px;
                }

                @media (max-width: 960px) {
                    .ts-body {
                        grid-template-columns: 1fr;
                    }

                    .ts-tree-panel {
                        max-height: 200px;
                        border-right: 0;
                        border-bottom: 1px solid var(--ts-border);
                    }
                }
            </style>
            <div class="ts-shell" tabindex="0">
                <div class="ts-toolbar">
                    <div class="ts-title"><a class="ts-title-link" href="https://github.com/AlexYez/comfyui-artius-browser" target="_blank" rel="noreferrer noopener"></a></div>
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
                            <button class="ts-sort-direction" type="button"></button>
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
                    </div>
                    <div class="ts-progress" data-visible="false" data-indeterminate="false">
                        <div class="ts-progress-track"><div class="ts-progress-fill"></div></div>
                        <div class="ts-progress-caption"></div>
                    </div>
                    <div class="ts-health"></div>
                </div>
                <div class="ts-body" data-mode="flat">
                    <div class="ts-tree-panel"></div>
                    <div class="ts-gallery-wrap">
                        <div class="ts-gallery-scroll">
                            <div class="ts-gallery-spacer"></div>
                            <div class="ts-gallery-content"></div>
                        </div>
                        <div class="ts-empty"></div>
                    </div>
                </div>
            </div>
        `;

        this.tsRefs = {
            tsShell: this.shadowRoot.querySelector(".ts-shell"),
            tsTitle: this.shadowRoot.querySelector(".ts-title"),
            tsTitleLink: this.shadowRoot.querySelector(".ts-title-link"),
            tsSectionAssets: this.shadowRoot.querySelector(".ts-section-assets"),
            tsSectionWorkflows: this.shadowRoot.querySelector(".ts-section-workflows"),
            tsSearch: this.shadowRoot.querySelector(".ts-search"),
            tsTypeCluster: this.shadowRoot.querySelector(".ts-type-cluster"),
            tsTypeChips: this.shadowRoot.querySelector(".ts-type-chips"),
            tsRootSelect: this.shadowRoot.querySelector(".ts-root-select"),
            tsSortSelect: this.shadowRoot.querySelector(".ts-sort-select"),
            tsSortDirection: this.shadowRoot.querySelector(".ts-sort-direction"),
            tsModeFlat: this.shadowRoot.querySelector(".ts-mode-flat"),
            tsModeTree: this.shadowRoot.querySelector(".ts-mode-tree"),
            tsPreviewSize: this.shadowRoot.querySelector(".ts-preview-size"),
            tsAutoscan: this.shadowRoot.querySelector(".ts-autoscan"),
            tsAutoscanLabel: this.shadowRoot.querySelector(".ts-autoscan-label"),
            tsRescan: this.shadowRoot.querySelector(".ts-rescan"),
            tsDeleteSelected: this.shadowRoot.querySelector(".ts-delete-selected"),
            tsProgress: this.shadowRoot.querySelector(".ts-progress"),
            tsProgressFill: this.shadowRoot.querySelector(".ts-progress-fill"),
            tsProgressCaption: this.shadowRoot.querySelector(".ts-progress-caption"),
            tsHealth: this.shadowRoot.querySelector(".ts-health"),
            tsBody: this.shadowRoot.querySelector(".ts-body"),
            tsTreePanel: this.shadowRoot.querySelector(".ts-tree-panel"),
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
            this.tsSyncSectionSettingsFromActive();
            this.tsQueueSaveUISettings();
            this.tsFetchAssets(true);
        });
        this.tsRefs.tsSortDirection.addEventListener("click", () => {
            this.tsState.tsSortDirection = this.tsState.tsSortDirection === "asc" ? "desc" : "asc";
            this.tsSyncSectionSettingsFromActive();
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
        this.tsRefs.tsDeleteSelected.addEventListener("click", () => this.tsDeleteSelected());
        this.tsRefs.tsGalleryScroll.addEventListener("scroll", () => this.tsHandleGalleryScroll(), { passive: true });
        this.tsRefs.tsGalleryContent.addEventListener("click", (tsEvent) => this.tsHandleGalleryClick(tsEvent));
        this.tsRefs.tsGalleryContent.addEventListener("dblclick", (tsEvent) => this.tsHandleGalleryDoubleClick(tsEvent));
        this.tsRefs.tsGalleryContent.addEventListener("dragstart", (tsEvent) => this.tsHandleDragStart(tsEvent));
        this.tsRefs.tsTreePanel.addEventListener("click", (tsEvent) => this.tsHandleTreeClick(tsEvent));
        this.tsRefs.tsShell.addEventListener("keydown", (tsEvent) => this.tsHandleKeydown(tsEvent));
        api.addEventListener("tsab:index-start", (tsEvent) => this.tsHandleScanEvent(tsEvent, false));
        api.addEventListener("tsab:index-progress", (tsEvent) => this.tsHandleScanEvent(tsEvent, false));
        api.addEventListener("tsab:index-complete", (tsEvent) => this.tsHandleScanEvent(tsEvent, true));
        api.addEventListener("tsab:health", (tsEvent) => this.tsHandleHealthEvent(tsEvent));
        api.addEventListener("tsab:asset-upsert", (tsEvent) => this.tsHandleAssetUpsertEvent(tsEvent));
        api.addEventListener("tsab:asset-remove", (tsEvent) => this.tsHandleAssetRemoveEvent(tsEvent));
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
            const tsCapturedPreviewURL = this.ts3DThumbnailCache.get(tsItem.viewer_3d_url);
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

    tsEnqueue3DThumbnailItems(tsItems, tsMaxCount = Number.POSITIVE_INFINITY) {
        if (this.ts3DThumbnailDisposed || !Array.isArray(tsItems) || tsItems.length === 0) {
            return 0;
        }
        let tsQueuedCount = 0;
        for (const tsItem of tsItems) {
            if (!tsItem || tsItem.type !== "3d" || !tsItem.viewer_3d_url) {
                continue;
            }
            const tsCacheKey = tsItem.viewer_3d_url;
            const tsCachedPreviewURL = this.ts3DThumbnailCache.get(tsCacheKey);
            if (tsCachedPreviewURL) {
                this.tsPatchVisibleThumbnail(tsItem.id, tsCachedPreviewURL, tsItem.filename || "");
                continue;
            }
            if (tsItem.preview_is_3d_capture && !tsItem.preview_is_placeholder) {
                continue;
            }
            if (
                this.ts3DThumbnailFailed.has(tsCacheKey)
                || this.ts3DThumbnailPending.has(tsCacheKey)
                || this.ts3DThumbnailInFlight.has(tsCacheKey)
            ) {
                continue;
            }
            if (tsQueuedCount >= tsMaxCount) {
                break;
            }
            this.ts3DThumbnailPending.add(tsCacheKey);
            this.ts3DThumbnailQueue.push({
                tsAssetId: tsItem.id,
                tsViewerURL: tsCacheKey,
                tsFilename: tsItem.filename || "",
            });
            tsQueuedCount += 1;
        }
        if (tsQueuedCount > 0) {
            this.tsPump3DThumbnailQueue();
        }
        return tsQueuedCount;
    }

    tsScheduleVisible3DThumbnailCapture(tsItems) {
        this.tsEnqueue3DThumbnailItems(tsItems, Number(ts3DThumbnailSettings.visibleLimit || 4));
    }

    async tsWaitFor3DThumbnailIdle(tsWarmupToken) {
        const tsDelayMs = Math.max(40, Number(ts3DThumbnailSettings.idlePollMs || 120));
        while (!this.ts3DThumbnailDisposed && tsWarmupToken === this.ts3DThumbnailWarmupToken) {
            if (
                this.ts3DThumbnailQueue.length === 0
                && this.ts3DThumbnailPending.size === 0
                && this.ts3DThumbnailInFlight.size === 0
                && this.ts3DThumbnailPersisting.size === 0
            ) {
                return true;
            }
            await new Promise((tsResolve) => window.setTimeout(tsResolve, tsDelayMs));
        }
        return false;
    }

    async tsWarm3DThumbnailCache(tsForce = false) {
        if (this.ts3DThumbnailDisposed || this.tsState.tsScanStatus?.running) {
            return false;
        }
        const tsRootWarmupKey = `${this.tsState.tsRootId || "all"}::${Number(this.tsState.tsScanStatus?.completed_at || 0)}`;
        if (!tsForce && this.ts3DThumbnailWarmupPromise) {
            return this.ts3DThumbnailWarmupPromise;
        }
        if (!tsForce && this.ts3DThumbnailWarmupKey === tsRootWarmupKey) {
            return false;
        }
        this.ts3DThumbnailWarmupKey = tsRootWarmupKey;
        const tsWarmupToken = ++this.ts3DThumbnailWarmupToken;
        const tsPageSize = Math.max(4, Number(ts3DThumbnailSettings.backgroundPageSize || 8));
        const tsWarmupPromise = (async () => {
            try {
                let tsOffset = 0;
                while (!this.ts3DThumbnailDisposed && tsWarmupToken === this.ts3DThumbnailWarmupToken) {
                    const tsParams = this.tsBuildSearchParams(tsOffset, {
                        limit: tsPageSize,
                        view: "flat",
                        search: "",
                        types: ["3d"],
                        folder: "",
                        rootId: this.tsState.tsRootId,
                        sortKey: "created_at",
                        sortDirection: "desc",
                    });
                    const tsPayload = await tsFetchJSON(`${tsRouteBase}/search?${tsParams.toString()}`);
                    const tsItems = Array.isArray(tsPayload?.items) ? tsPayload.items : [];
                    if (tsItems.length === 0) {
                        break;
                    }
                    this.tsEnqueue3DThumbnailItems(tsItems, Number.POSITIVE_INFINITY);
                    const tsDidDrain = await this.tsWaitFor3DThumbnailIdle(tsWarmupToken);
                    if (!tsDidDrain) {
                        break;
                    }
                    if (!tsPayload?.has_more) {
                        break;
                    }
                    tsOffset += tsItems.length;
                }
                return true;
            } catch (tsError) {
                this.ts3DThumbnailWarmupKey = "";
                tsConsoleWarn("Timesaver Artius Browser 3D eager warmup failed", tsError);
                return false;
            }
        })();
        this.ts3DThumbnailWarmupPromise = tsWarmupPromise;
        try {
            return await tsWarmupPromise;
        } finally {
            if (this.ts3DThumbnailWarmupPromise === tsWarmupPromise) {
                this.ts3DThumbnailWarmupPromise = null;
            }
        }
    }

    tsPump3DThumbnailQueue() {
        const tsConcurrency = Math.max(1, Number(ts3DThumbnailSettings.concurrency || 1));
        while (!this.ts3DThumbnailDisposed && this.ts3DThumbnailWorkers < tsConcurrency && this.ts3DThumbnailQueue.length > 0) {
            const tsJob = this.ts3DThumbnailQueue.shift();
            if (!tsJob?.tsViewerURL) {
                continue;
            }
            if (this.ts3DThumbnailCache.has(tsJob.tsViewerURL) || this.ts3DThumbnailFailed.has(tsJob.tsViewerURL)) {
                this.ts3DThumbnailPending.delete(tsJob.tsViewerURL);
                continue;
            }
            this.ts3DThumbnailPending.delete(tsJob.tsViewerURL);
            this.ts3DThumbnailInFlight.add(tsJob.tsViewerURL);
            this.ts3DThumbnailWorkers += 1;
            void this.tsRun3DThumbnailJob(tsJob);
        }
    }

    async tsPersist3DThumbnail(tsJob, tsPreviewURL) {
        if (!tsJob?.tsAssetId || !tsPreviewURL || this.ts3DThumbnailPersisting.has(tsJob.tsAssetId)) {
            return;
        }
        this.ts3DThumbnailPersisting.add(tsJob.tsAssetId);
        try {
            const tsPayload = await tsSave3DThumbnail(tsJob.tsAssetId, tsPreviewURL);
            const tsAssetPatch = tsPayload?.asset;
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
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser 3D thumbnail persist failed", tsError);
        } finally {
            this.ts3DThumbnailPersisting.delete(tsJob.tsAssetId);
        }
    }

    async tsRun3DThumbnailJob(tsJob) {
        try {
            const tsPreviewURL = await tsCapture3DThumbnail(tsJob.tsViewerURL, {
                width: ts3DThumbnailSettings.captureSize,
                height: ts3DThumbnailSettings.captureSize,
                warmFrames: ts3DThumbnailSettings.warmFrames,
            });
            if (tsPreviewURL) {
                this.ts3DThumbnailCache.set(tsJob.tsViewerURL, tsPreviewURL);
                if (!this.ts3DThumbnailDisposed) {
                    this.tsPatchVisibleThumbnail(tsJob.tsAssetId, tsPreviewURL, tsJob.tsFilename);
                }
                void this.tsPersist3DThumbnail(tsJob, tsPreviewURL);
            } else {
                this.ts3DThumbnailFailed.add(tsJob.tsViewerURL);
            }
        } catch {
            this.ts3DThumbnailFailed.add(tsJob.tsViewerURL);
        } finally {
            this.ts3DThumbnailInFlight.delete(tsJob.tsViewerURL);
            this.ts3DThumbnailWorkers = Math.max(0, this.ts3DThumbnailWorkers - 1);
            this.tsPump3DThumbnailQueue();
        }
    }

    tsHandleAssetUpsertEvent(tsEvent) {
        if (this.tsIsWorkflowSection()) {
            return;
        }
        if (this.tsState.tsScanStatus?.running) {
            return;
        }
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
        if (this.tsState.tsScanStatus?.running) {
            return;
        }
        const tsDetail = this.tsReadEventDetail(tsEvent);
        const tsAssetId = Number(tsDetail?.id || 0);
        if (!tsAssetId) {
            return;
        }
        const tsIndex = this.tsItemIndexById.get(tsAssetId);
        if (tsIndex === undefined || tsIndex < 0) {
            return;
        }
        this.tsState.tsItems.splice(tsIndex, 1);
        this.tsItemsRevision += 1;
        this.tsRebuildItemIndex();
        this.tsState.tsSelection.delete(tsAssetId);
        if (this.tsState.tsLastSelectedIndex >= this.tsState.tsItems.length) {
            this.tsState.tsLastSelectedIndex = this.tsState.tsItems.length - 1;
        }
        this.tsDebouncedAssetEventRefresh();
    }
    tsHydrateText() {
        this.tsRefs.tsTitleLink.textContent = this.tsT("panel.title", tsProjectSettings.title);
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
        this.tsRefs.tsDeleteSelected.textContent = this.tsT("button.deleteSelected", "Delete Selected");
        this.tsRefs.tsDeleteSelected.title = this.tsT("tooltip.deleteSelected", "Delete selected assets from allowed roots.");
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
        this.tsRefs.tsRootSelect.title = this.tsT("tooltip.root", "Choose a root folder.");
        this.tsRefs.tsTypeCluster.hidden = tsWorkflowSection;
        this.tsRefs.tsRootSelect.hidden = tsWorkflowSection;
        this.tsRefs.tsAutoscan.hidden = tsWorkflowSection;
        this.tsRefs.tsRescan.hidden = tsWorkflowSection;
        this.tsRefs.tsDeleteSelected.hidden = tsWorkflowSection;
        this.tsRefs.tsTypeCluster.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsRootSelect.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsAutoscan.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsRescan.style.display = tsWorkflowHiddenDisplay;
        this.tsRefs.tsDeleteSelected.style.display = tsWorkflowHiddenDisplay;
    }

    tsRenderSortOptions() {
        const tsFilenameLabel = String(this.tsT("sort.filename", "Names") || "Names").replace(/^Filename$/i, "Names");
        const tsOptions = this.tsIsWorkflowSection()
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
        const tsLongestLabelLength = Math.max(...tsOptions.map(([, tsLabel]) => String(tsLabel || "").length), 4);
        this.tsRefs.tsSortSelect.style.width = `${Math.max(9, tsLongestLabelLength + 5)}ch`;
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
                this.tsFetchAssets(true);
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
        this.tsQueueSaveUISettings();
        this.tsFetchAssets(true);
    }

    async tsSetSection(tsSection) {
        if (!tsBrowserSections.includes(tsSection) || this.tsState.tsSection === tsSection) {
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
        const tsPayload = tsOverridePayload || (this.tsState.tsRootId !== "all" ? { root_id: this.tsState.tsRootId } : { root_id: "output" });
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

    tsBuildSearchParams(tsOffset, tsOverrides = {}) {
        const tsParams = new URLSearchParams();
        const tsLimit = Number(tsOverrides.limit ?? tsDefaultLimit);
        const tsView = tsOverrides.view ?? this.tsState.tsMode;
        const tsSortKey = tsOverrides.sortKey ?? this.tsState.tsSortKey;
        const tsSortDirection = tsOverrides.sortDirection ?? this.tsState.tsSortDirection;
        const tsSearch = Object.prototype.hasOwnProperty.call(tsOverrides, "search") ? tsOverrides.search : this.tsState.tsSearch;
        const tsRootId = Object.prototype.hasOwnProperty.call(tsOverrides, "rootId") ? tsOverrides.rootId : this.tsState.tsRootId;
        const tsTypes = Object.prototype.hasOwnProperty.call(tsOverrides, "types") ? tsOverrides.types : [...this.tsState.tsTypes];
        const tsFolder = Object.prototype.hasOwnProperty.call(tsOverrides, "folder")
            ? tsOverrides.folder
            : (this.tsState.tsMode === "tree" ? this.tsState.tsFolder : "");
        tsParams.set("offset", String(Math.max(0, Number(tsOffset) || 0)));
        tsParams.set("limit", String(Math.max(1, tsLimit || tsDefaultLimit)));
        tsParams.set("view", tsView || "flat");
        tsParams.set("sort", tsSortKey || "created_at");
        tsParams.set("order", tsSortDirection || "desc");
        if (tsSearch) {
            tsParams.set("q", String(tsSearch));
        }
        if (tsRootId && tsRootId !== "all") {
            tsParams.set("root_id", String(tsRootId));
        }
        if (Array.isArray(tsTypes) && tsTypes.length > 0) {
            tsParams.set("types", tsTypes.join(","));
        }
        if (tsFolder) {
            tsParams.set("folder", String(tsFolder));
        }
        return tsParams;
    }

    tsBuildRequestPath(tsOffset) {
        const tsParams = this.tsBuildSearchParams(tsOffset);
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
            const tsOffset = tsReset ? 0 : this.tsState.tsItems.length;
            try {
                let tsPayload;
                if (this.tsIsWorkflowSection()) {
                    await this.tsEnsureWorkflowLibrary(false);
                    const tsWorkflowQuery = this.tsBuildWorkflowQueryResult();
                    const tsWindowItems = tsWorkflowQuery.items.slice(tsOffset, tsOffset + tsDefaultLimit);
                    tsPayload = {
                        items: tsWindowItems,
                        has_more: tsOffset + tsWindowItems.length < tsWorkflowQuery.items.length,
                        roots: tsWorkflowQuery.roots,
                        folders: tsWorkflowQuery.folders,
                        health: [],
                        scan_status: null,
                    };
                } else {
                    tsPayload = await tsFetchJSON(this.tsBuildRequestPath(tsOffset));
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
                this.tsState.tsRoots = Array.isArray(tsPayload.roots) ? tsPayload.roots : [];
                this.tsState.tsFolders = Array.isArray(tsPayload.folders) ? tsPayload.folders : [];
                this.tsFoldersRevision += 1;
                this.tsState.tsHealth = Array.isArray(tsPayload.health) ? tsPayload.health : [];
                this.tsState.tsScanStatus = tsPayload.scan_status || null;
                this.tsRenderAll();
                if (tsReset) {
                    void this.tsMaybeBootstrapScan();
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

    tsRenderRootOptions() {
        const tsOptions = this.tsIsWorkflowSection()
            ? (this.tsState.tsRoots || []).map((tsRoot) => `<option value="${tsRoot.root_id}">${tsRoot.label}</option>`)
            : [`<option value="all">${this.tsT("label.allRoots", "All Folders")}</option>`]
                .concat((this.tsState.tsRoots || []).map((tsRoot) => `<option value="${tsRoot.root_id}">${tsRoot.label}</option>`));
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
        this.tsRefs.tsSortDirection.textContent = this.tsState.tsSortDirection === "asc"
            ? this.tsT("button.sortAsc", "Asc")
            : this.tsT("button.sortDesc", "Desc");
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
        const tsGap = tsGridLayout.spacing;
        const tsPaddingTop = tsGridLayout.spacing;
        const tsPaddingRight = tsGridLayout.spacing;
        const tsPaddingBottom = tsGridLayout.spacing;
        const tsPaddingLeft = tsGridLayout.spacing;
        const tsViewportWidth = Math.max(0, Math.round(Number(this.tsRefs.tsGalleryScroll.clientWidth || 0)));
        const tsCardWidth = tsClamp(this.tsState.tsPreviewSize, tsPreviewSizeRange.min, tsPreviewSizeRange.max);
        const tsMetricsKey = [tsViewportWidth, tsCardWidth, tsGap].join("::");
        if (this.tsGridMetrics && this.tsGridMetricsKey === tsMetricsKey) {
            return this.tsGridMetrics;
        }
        const tsContentWidth = Math.max(220, tsViewportWidth - (tsPaddingLeft + tsPaddingRight + 4));
        const tsCardPreviewHeight = Math.round(tsCardWidth * 0.92);
        const tsCardHeight = tsCardPreviewHeight;
        const tsPreviewRatio = tsClamp((tsCardWidth - tsPreviewSizeRange.min) / Math.max(1, tsPreviewSizeRange.max - tsPreviewSizeRange.min), 0, 1);
        const tsMetrics = {
            tsGap,
            tsPaddingTop,
            tsPaddingRight,
            tsPaddingBottom,
            tsPaddingLeft,
            tsContentWidth,
            tsCardWidth,
            tsCardPreviewHeight,
            tsCardHeight,
            tsCardInset: Math.round(tsLerp(tsCardChromeScale.insetMin, tsCardChromeScale.insetMax, tsPreviewRatio)),
            tsActionSize: Math.round(tsLerp(tsCardChromeScale.actionSizeMin, tsCardChromeScale.actionSizeMax, tsPreviewRatio)),
            tsActionRadius: Math.round(tsLerp(tsCardChromeScale.actionRadiusMin, tsCardChromeScale.actionRadiusMax, tsPreviewRatio)),
            tsActionFontSize: Math.round(tsLerp(tsCardChromeScale.actionFontMin, tsCardChromeScale.actionFontMax, tsPreviewRatio)),
            tsActionGap: Math.round(tsLerp(tsCardChromeScale.actionGapMin, tsCardChromeScale.actionGapMax, tsPreviewRatio)),
            tsBadgeFontSize: Math.round(tsLerp(tsCardChromeScale.badgeFontMin, tsCardChromeScale.badgeFontMax, tsPreviewRatio)),
            tsBadgePadY: Math.round(tsLerp(tsCardChromeScale.badgePadYMin, tsCardChromeScale.badgePadYMax, tsPreviewRatio)),
            tsBadgePadX: Math.round(tsLerp(tsCardChromeScale.badgePadXMin, tsCardChromeScale.badgePadXMax, tsPreviewRatio)),
            tsBadgeRadius: Math.round(tsLerp(tsCardChromeScale.badgeRadiusMin, tsCardChromeScale.badgeRadiusMax, tsPreviewRatio)),
            tsOverlayPadX: Math.round(tsLerp(tsCardChromeScale.overlayPadXMin, tsCardChromeScale.overlayPadXMax, tsPreviewRatio)),
            tsOverlayPadBottom: Math.round(tsLerp(tsCardChromeScale.overlayPadBottomMin, tsCardChromeScale.overlayPadBottomMax, tsPreviewRatio)),
            tsOverlayTop: Math.round(tsLerp(tsCardChromeScale.overlayTopMin, tsCardChromeScale.overlayTopMax, tsPreviewRatio)),
            tsOverlayTitleSize: Math.round(tsLerp(tsCardChromeScale.overlayTitleMin, tsCardChromeScale.overlayTitleMax, tsPreviewRatio)),
            tsOverlayMetaSize: Math.round(tsLerp(tsCardChromeScale.overlayMetaMin, tsCardChromeScale.overlayMetaMax, tsPreviewRatio)),
            tsCardRadius: Math.round(tsLerp(tsCardChromeScale.cardRadiusMin, tsCardChromeScale.cardRadiusMax, tsPreviewRatio)),
        };
        tsMetrics.tsColumns = Math.max(1, Math.floor((tsMetrics.tsContentWidth + tsGap) / (tsCardWidth + tsGap)));
        tsMetrics.tsRowHeight = tsMetrics.tsCardHeight + tsGap;
        this.tsState.tsGridColumns = tsMetrics.tsColumns;
        this.tsState.tsGridRowHeight = tsMetrics.tsRowHeight;
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-preview-height", `${tsMetrics.tsCardPreviewHeight}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-radius", `${tsMetrics.tsCardRadius}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-inset", `${tsMetrics.tsCardInset}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-action-size", `${tsMetrics.tsActionSize}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-action-radius", `${tsMetrics.tsActionRadius}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-action-font-size", `${tsMetrics.tsActionFontSize}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-action-gap", `${tsMetrics.tsActionGap}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-badge-font-size", `${tsMetrics.tsBadgeFontSize}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-badge-pad-y", `${tsMetrics.tsBadgePadY}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-badge-pad-x", `${tsMetrics.tsBadgePadX}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-badge-radius", `${tsMetrics.tsBadgeRadius}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-overlay-pad-x", `${tsMetrics.tsOverlayPadX}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-overlay-pad-bottom", `${tsMetrics.tsOverlayPadBottom}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-overlay-top", `${tsMetrics.tsOverlayTop}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-overlay-title-size", `${tsMetrics.tsOverlayTitleSize}px`);
        this.tsRefs.tsGalleryContent.style.setProperty("--ts-card-overlay-meta-size", `${tsMetrics.tsOverlayMetaSize}px`);
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
        this.tsItemIndexById = new Map();
        this.tsState.tsItems.forEach((tsItem, tsIndex) => {
            this.tsItemIndexById.set(tsItem.id, tsIndex);
        });
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
                ? `<button class="ts-tree-toggle" type="button" data-toggle-key="${tsNode.tsKey}">${tsToggleLabel}</button>` 
                : `<span class="ts-tree-toggle-spacer"></span>`;
            return `
                <div>
                    <div class="ts-tree-row" style="--ts-depth:${tsDepth};">
                        ${tsToggleMarkup}
                        <button
                            class="ts-tree-folder"
                            type="button"
                            data-tree-folder="${tsNode.tsFolderPath || ""}"
                            data-tree-root="${tsNode.tsRootId}"
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
            const tsBadges = tsWorkflowSection ? [] : [tsItem.type.toUpperCase()];
            const tsResolutionBadge = Number(tsItem.width) > 0 && Number(tsItem.height) > 0
                ? `${tsItem.width}x${tsItem.height}`
                : "";
            const tsDurationBadge = tsFormatCardDuration(tsItem.duration);
            if (tsItem.type === "image" && tsResolutionBadge) {
                tsBadges.push(tsResolutionBadge);
            }
            if (tsItem.type === "video") {
                if (tsResolutionBadge) {
                    tsBadges.push(tsResolutionBadge);
                }
                if (tsDurationBadge) {
                    tsBadges.push(tsDurationBadge);
                }
            }
            if (tsItem.type === "audio" && tsDurationBadge) {
                tsBadges.push(tsDurationBadge);
            }
            const tsShowActions = !tsWorkflowSection;
            const tsShowCopyAction = tsShowActions && tsItem.type !== "video" && tsItem.type !== "audio";
            const tsShowWorkflowAction = tsShowActions && tsItem.type === "image" && String(tsItem.extension || "").toLowerCase() === ".png" && Boolean(tsItem.has_workflow);
            const tsPreviewURL = this.tsResolveCardPreviewURL(tsItem);
            const tsMediaMarkup = this.tsBuildCardMediaMarkup(tsItem, tsPreviewURL);
            tsCards.push(`
                <div
                    class="ts-card"
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
                                ${tsShowCopyAction ? `<button type="button" data-action="copy" data-card-id="${tsItem.id}" title="${this.tsT("button.copyPrompt", "Copy Prompt")}">P</button>` : ""}
                                ${tsShowWorkflowAction ? `<button type="button" data-action="workflow" data-card-id="${tsItem.id}" title="${this.tsT("button.copyWorkflow", "Copy Workflow")}">W</button>` : ""}
                                <button type="button" data-action="download" data-card-id="${tsItem.id}" title="${this.tsT("button.download", "Download")}">D</button>
                                <button type="button" data-action="delete" data-card-id="${tsItem.id}" title="${this.tsT("button.delete", "Delete")}" ${tsItem.allow_delete ? "" : "disabled"}>X</button>
                            </div>
                        ` : ""}
                        <div class="ts-card-badges">
                            ${tsBadges.map((tsBadge, tsBadgeIndex) => `
                                <div class="ts-card-badge" data-kind="${tsBadgeIndex === 0 ? "type" : "meta"}">${this.tsEscapeHTML(tsBadge)}</div>
                            `).join("")}
                        </div>
                    </div>
                </div>
            `);
        }

        if (!tsForce && this.tsLastGridMarkupKey === tsMarkupKey) {
            this.tsScheduleVisible3DThumbnailCapture(tsVisibleItems);
            if (this.tsState.tsHasMore && !this.tsState.tsLoading && tsScrollTop + tsViewportHeight >= this.tsRefs.tsGallerySpacer.offsetHeight - 480) {
                this.tsFetchAssets(false);
            }
            return;
        }
        this.tsLastGridMarkupKey = tsMarkupKey;
        this.tsRefs.tsGalleryContent.innerHTML = tsCards.join("");
        this.tsScheduleVisible3DThumbnailCapture(tsVisibleItems);
        if (this.tsState.tsHasMore && !this.tsState.tsLoading && tsScrollTop + tsViewportHeight >= this.tsRefs.tsGallerySpacer.offsetHeight - 480) {
            this.tsFetchAssets(false);
        }
    }

    tsRenderSelectionButtons() {
        const tsSelectedItems = this.tsGetSelectedItems();
        const tsWorkflowSection = this.tsIsWorkflowSection();
        const tsHasDeletable = !tsWorkflowSection && tsSelectedItems.some((tsItem) => tsItem.allow_delete);
        this.tsRefs.tsRescan.disabled = tsWorkflowSection || Boolean(this.tsState.tsScanStatus?.running);
        this.tsRefs.tsDeleteSelected.disabled = !tsHasDeletable;
    }

    tsGetSelectedItems() {
        const tsItems = [];
        this.tsState.tsSelection.forEach((tsAssetId) => {
            const tsIndex = this.tsItemIndexById.get(tsAssetId);
            if (tsIndex === undefined) {
                return;
            }
            const tsItem = this.tsState.tsItems[tsIndex];
            if (tsItem) {
                tsItems.push(tsItem);
            }
        });
        return tsItems;
    }

    tsFindItemById(tsAssetId) {
        const tsIndex = this.tsItemIndexById.get(tsAssetId);
        return tsIndex === undefined ? null : (this.tsState.tsItems[tsIndex] || null);
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
            return;
        }
        await tsCopyText(tsAsset.prompt_text);
    }

    async tsCopyAssetWorkflow(tsAssetId) {
        const tsAsset = await this.tsEnsureAssetDetail(tsAssetId);
        if (!tsAsset?.workflow_text) {
            return;
        }
        await tsCopyText(tsAsset.workflow_text);
    }
    tsRefreshCardSelection() {
        this.tsRefs.tsGalleryContent.querySelectorAll("[data-card-id]").forEach((tsCard) => {
            const tsCardId = Number(tsCard.dataset.cardId);
            tsCard.dataset.selected = String(this.tsState.tsSelection.has(tsCardId));
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
            } else if (tsAction === "download") {
                tsOpenDownload(tsAsset);
            } else if (tsAction === "delete") {
                this.tsDeleteAssets([tsAsset]);
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
        const tsAsset = this.tsFindItemById(Number(tsCard.dataset.cardId));
        if (!tsAsset) {
            return;
        }
        const tsPayload = JSON.stringify(tsAsset);
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
        this.tsViewer?.tsOpen(this.tsState.tsItems, tsIndex, (tsNextIndex) => {
            const tsItem = this.tsState.tsItems[tsNextIndex];
            if (!tsItem) {
                return;
            }
            this.tsState.tsSelection.clear();
            this.tsState.tsSelection.add(tsItem.id);
            this.tsState.tsLastSelectedIndex = tsNextIndex;
            this.tsRenderSelectionButtons();
            this.tsRefreshCardSelection();
        }, {
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
            }
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser failed to load workflow", tsError);
        }
    }

    async tsDeleteAssets(tsAssets) {
        const tsDeletableAssets = tsAssets.filter((tsAsset) => tsAsset.allow_delete);
        if (tsDeletableAssets.length === 0) {
            return;
        }
        await tsPostJSON(`${tsRouteBase}/delete`, { ids: tsDeletableAssets.map((tsAsset) => tsAsset.id) });
        this.tsFetchAssets(true);
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







































