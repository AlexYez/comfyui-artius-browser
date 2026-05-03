import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const tsScriptDir = path.dirname(fileURLToPath(import.meta.url));
const tsRepoRoot = path.resolve(tsScriptDir, "..");
const tsPanelPath = path.join(tsRepoRoot, "js", "ts-artius-browser-panel.js");

const tsPanelSettings = Object.freeze({
    typeOrder: ["image", "video", "audio", "3d"],
    defaultLimit: 60,
    defaultRootId: "all",
    defaultMode: "flat",
    defaultAutoscan: true,
    defaultSort: {
        key: "created_at",
        direction: "desc",
    },
    defaultExpandedFolders: ["root:output", "root:input"],
    debounceMs: {
        search: 220,
        realtimeRefresh: 350,
    },
    previewWarmup: {
        concurrency: 2,
        maxVisibleRequests: 8,
        debounceMs: 120,
    },
    threeDThumbnails: {
        concurrency: 1,
        visibleLimit: 4,
        captureSize: 320,
        warmFrames: 2,
        backgroundPageSize: 8,
        idlePollMs: 120,
    },
    previewSizeRange: {
        min: 96,
        max: 320,
        step: 8,
        default: 120,
    },
    gridLayout: {
        spacing: 10,
    },
    gridOverscanRows: 1,
    cardChromeScale: {
        insetMin: 5,
        insetMax: 9,
        actionSizeMin: 16,
        actionSizeMax: 24,
        actionRadiusMin: 4,
        actionRadiusMax: 6,
        actionFontMin: 8,
        actionFontMax: 10,
        actionGapMin: 3,
        actionGapMax: 5,
        badgeFontMin: 8,
        badgeFontMax: 10,
        badgePadYMin: 2,
        badgePadYMax: 4,
        badgePadXMin: 5,
        badgePadXMax: 8,
        badgeRadiusMin: 5,
        badgeRadiusMax: 7,
        overlayPadXMin: 10,
        overlayPadXMax: 14,
        overlayPadBottomMin: 10,
        overlayPadBottomMax: 14,
        overlayTopMin: 28,
        overlayTopMax: 40,
        overlayTitleMin: 12,
        overlayTitleMax: 14,
        overlayMetaMin: 10,
        overlayMetaMax: 12,
        cardRadiusMin: 10,
        cardRadiusMax: 14,
    },
});

const tsProjectSettings = Object.freeze({
    defaultLocale: "en",
});

async function tsLoadOptionalModule(tsRelativePath) {
    const tsAbsolutePath = path.join(tsRepoRoot, tsRelativePath);
    if (!fs.existsSync(tsAbsolutePath)) {
        return {};
    }
    return import(`${pathToFileURL(tsAbsolutePath).href}?ts=${Date.now()}`);
}

async function tsLoadHelperExports() {
    const tsModules = await Promise.all([
        tsLoadOptionalModule("js/ts-artius-browser-panel-format.js"),
        tsLoadOptionalModule("js/ts-artius-browser-panel-state.js"),
        tsLoadOptionalModule("js/ts-artius-browser-panel-selection.js"),
        tsLoadOptionalModule("js/ts-artius-browser-panel-query.js"),
        tsLoadOptionalModule("js/ts-artius-browser-panel-workflows.js"),
        tsLoadOptionalModule("js/ts-artius-browser-panel-grid.js"),
    ]);
    return Object.assign({}, ...tsModules);
}

function tsBuildPanelHarness(tsHelperExports) {
    const tsSource = fs.readFileSync(tsPanelPath, "utf8")
        .replace(/import[\s\S]*?;\r?\n/g, "")
        .replace(/\bexport\s+class\s+/g, "class ")
        .replace(/\bexport\s+function\s+/g, "function ");
    const tsContext = {
        console,
        URLSearchParams,
        CustomEvent: class {},
        HTMLElement: class {
            attachShadow() {
                this.shadowRoot = { innerHTML: "" };
                return this.shadowRoot;
            }
        },
        document: {
            body: { append() {} },
            createElement() {
                return {
                    addEventListener() {},
                    append() {},
                    click() {},
                    remove() {},
                    setAttribute() {},
                    style: { setProperty() {} },
                };
            },
        },
        window: {
            clearTimeout() {},
            dispatchEvent() {},
            requestAnimationFrame(tsCallback) {
                tsCallback();
                return 1;
            },
            setTimeout(tsCallback) {
                if (typeof tsCallback === "function") {
                    tsCallback();
                }
                return 1;
            },
        },
        tsApiURL: (tsPath) => tsPath,
        tsAssetDragMime: "application/x-timesaver-artius-asset",
        tsBuildFolderTree: () => [],
        tsClamp: (tsValue, tsMin, tsMax) => Math.max(tsMin, Math.min(tsMax, tsValue)),
        tsConsoleWarn: () => {},
        tsCopyText: async () => true,
        tsDebounce: (tsFunction) => tsFunction,
        tsDeleteWorkflowFile: async () => ({}),
        tsFetchAssetDetail: async () => ({}),
        tsFetchBrowserSettings: async () => ({ ui: {} }),
        tsFetchJSON: async () => ({}),
        tsFetchWorkflowBrowserLibrary: async () => [],
        tsEnsureCanvasDropBridge: () => {},
        tsEnsureViewerElement: () => {},
        tsGetViewerSingleton: () => ({}),
        tsLoadLocale: async () => ({}),
        tsLoadWorkflowIntoComfy: async () => true,
        tsOpenDownload: () => {},
        tsPostJSON: async () => ({}),
        tsRouteBase: "/asset_browser",
        tsSave3DThumbnail: async () => ({}),
        tsSaveBrowserSettings: async () => ({}),
        tsCapture3DThumbnail: async () => "",
        tsPanelSettings,
        tsProjectSettings,
        ...tsHelperExports,
    };
    vm.createContext(tsContext);
    vm.runInContext(
        `${tsSource}
        globalThis.__panelExports = {
            TSArtiusBrowserPanel,
            tsLerp: typeof tsLerp !== "undefined" ? tsLerp : globalThis.tsLerp,
            tsFormatCardFPS: typeof tsFormatCardFPS !== "undefined" ? tsFormatCardFPS : globalThis.tsFormatCardFPS,
            tsFormatCardDuration: typeof tsFormatCardDuration !== "undefined" ? tsFormatCardDuration : globalThis.tsFormatCardDuration,
        };`,
        tsContext,
        { filename: tsPanelPath },
    );
    return tsContext.__panelExports;
}

function tsBuildPanelProbe(tsPanelClass, tsStateOverrides = {}) {
    const tsProbe = Object.create(tsPanelClass.prototype);
    tsProbe.tsState = {
        tsMode: "flat",
        tsSearch: "",
        tsRootId: "all",
        tsTypes: new Set(),
        tsSortKey: "created_at",
        tsSortDirection: "desc",
        tsPreviewSize: 120,
        tsFolder: "",
        tsSection: "assets",
        tsAssetMode: "flat",
        tsWorkflowMode: "flat",
        tsAssetSortKey: "created_at",
        tsAssetSortDirection: "desc",
        tsWorkflowSortKey: "created_at",
        tsWorkflowSortDirection: "desc",
        tsAssetPreviewSize: 120,
        tsWorkflowPreviewSize: 120,
        tsAssetSearch: "",
        tsWorkflowSearch: "",
        tsGridColumns: 1,
        tsGridRowHeight: 296,
        tsItems: [],
        tsSelection: new Set(),
        tsLastSelectedIndex: -1,
        ...tsStateOverrides,
    };
    tsProbe.tsWorkflowLibrary = [];
    tsProbe.tsWorkflowSelectedFolder = "";
    tsProbe.tsLastAssetFolder = "";
    tsProbe.tsLastAssetRootId = "all";
    tsProbe.tsGridMetrics = null;
    tsProbe.tsGridMetricsKey = "";
    tsProbe.tsQueueSaveUISettings = () => {};
    return tsProbe;
}

let tsAssertions = 0;

function tsEqual(tsActual, tsExpected, tsMessage) {
    const tsNormalize = (tsValue) => {
        if (!tsValue || typeof tsValue !== "object") {
            return tsValue;
        }
        return JSON.parse(JSON.stringify(tsValue));
    };
    assert.deepEqual(tsNormalize(tsActual), tsNormalize(tsExpected), tsMessage);
    tsAssertions += 1;
}

function tsAssert(tsCondition, tsMessage) {
    assert.ok(tsCondition, tsMessage);
    tsAssertions += 1;
}

function tsAssertParams(tsParams, tsExpectedEntries) {
    for (const [tsKey, tsExpectedValue] of Object.entries(tsExpectedEntries)) {
        tsEqual(tsParams.get(tsKey), tsExpectedValue, `Expected query param ${tsKey}`);
    }
}

function tsRunFormatTests(tsExports) {
    tsEqual(tsExports.tsLerp(10, 20, 0.25), 12.5, "tsLerp preserves linear interpolation");
    tsEqual(tsExports.tsFormatCardFPS(0), "", "zero FPS stays hidden");
    tsEqual(tsExports.tsFormatCardFPS("bad"), "", "invalid FPS stays hidden");
    tsEqual(tsExports.tsFormatCardFPS(24), "24 FPS", "integer FPS has no decimals");
    tsEqual(tsExports.tsFormatCardFPS(23.976), "24 FPS", "near-integer FPS rounds to an integer label");
    tsEqual(tsExports.tsFormatCardFPS(12.5), "12.5 FPS", "double-digit fractional FPS uses one decimal");
    tsEqual(tsExports.tsFormatCardFPS(7.5), "7.50 FPS", "single-digit fractional FPS uses two decimals");
    tsEqual(tsExports.tsFormatCardDuration(0), "", "zero duration stays hidden");
    tsEqual(tsExports.tsFormatCardDuration(59.4), "59s", "seconds duration is rounded");
    tsEqual(tsExports.tsFormatCardDuration(60), "1:00", "minute duration uses m:ss");
    tsEqual(tsExports.tsFormatCardDuration(3661), "1:01:01", "hour duration uses h:mm:ss");
}

function tsRunSearchParamTests(tsPanelClass) {
    const tsDefaultProbe = tsBuildPanelProbe(tsPanelClass);
    const tsDefaultParams = tsDefaultProbe.tsBuildSearchParams(null);
    tsAssertParams(tsDefaultParams, {
        limit: "60",
        view: "flat",
        sort: "created_at",
        order: "desc",
    });
    tsEqual(tsDefaultParams.has("offset"), false, "offset is no longer sent");
    tsEqual(tsDefaultParams.has("after_sort"), false, "first page omits cursor");
    tsEqual(tsDefaultParams.has("after_id"), false, "first page omits cursor id");
    tsEqual(tsDefaultParams.has("q"), false, "empty search is omitted");
    tsEqual(tsDefaultParams.has("root_id"), false, "all roots are omitted");
    tsEqual(tsDefaultParams.has("types"), false, "empty type filter is omitted");
    tsEqual(tsDefaultParams.has("folder"), false, "flat folder is omitted");

    const tsFilteredProbe = tsBuildPanelProbe(tsPanelClass, {
        tsMode: "tree",
        tsSearch: "cat",
        tsRootId: "output",
        tsTypes: new Set(["image", "video"]),
        tsSortKey: "filename",
        tsSortDirection: "asc",
        tsFolder: "renders/day one",
    });
    const tsFilteredParams = tsFilteredProbe.tsBuildSearchParams({ sort_key: "filename", sort_value: "shot.png", id: 42 });
    tsAssertParams(tsFilteredParams, {
        limit: "60",
        view: "tree",
        sort: "filename",
        order: "asc",
        q: "cat",
        root_id: "output",
        types: "image,video",
        folder: "renders/day one",
        after_sort: "shot.png",
        after_id: "42",
    });

    const tsOverrideParams = tsFilteredProbe.tsBuildSearchParams(null, {
        limit: 5,
        search: "",
        rootId: "all",
        types: [],
        folder: "",
        cursorAfter: null,
    });
    tsAssertParams(tsOverrideParams, {
        limit: "5",
        view: "tree",
        sort: "filename",
        order: "asc",
    });
    tsEqual(tsOverrideParams.has("q"), false, "override can clear search");
    tsEqual(tsOverrideParams.has("root_id"), false, "override can clear root");
    tsEqual(tsOverrideParams.has("types"), false, "override can clear types");
    tsEqual(tsOverrideParams.has("folder"), false, "override can clear folder");
    tsEqual(tsOverrideParams.has("after_sort"), false, "override can clear cursor");
}

function tsRunWorkflowTests(tsPanelClass) {
    const tsProbe = tsBuildPanelProbe(tsPanelClass, {
        tsSection: "workflows",
        tsMode: "tree",
        tsSearch: "shot",
        tsFolder: "jobs",
        tsSortKey: "filename",
        tsSortDirection: "asc",
    });
    tsProbe.tsWorkflowLibrary = [
        { id: 1, filename: "Shot B.json", folder_path: "jobs", modified_at: 20, created_at: 10, size_bytes: 100 },
        { id: 2, filename: "shot A.json", folder_path: "jobs/sub", modified_at: 30, created_at: 10, size_bytes: 200 },
        { id: 3, filename: "Other.json", folder_path: "jobs", modified_at: 40, created_at: 10, size_bytes: 300 },
        { id: 4, filename: "Shot Root.json", folder_path: "", modified_at: 50, created_at: 10, size_bytes: 400 },
    ];
    const tsResult = tsProbe.tsBuildWorkflowQueryResult();
    tsEqual(tsResult.items.map((tsItem) => tsItem.id), [2, 1], "workflow query searches by filename and keeps selected tree folder");
    tsEqual(tsResult.roots, [{ root_id: "workflows", label: "Workflows" }], "workflow root node is stable");
    tsEqual(
        tsResult.folders.sort((tsLeft, tsRight) => tsLeft.folder_path.localeCompare(tsRight.folder_path)),
        [
            { root_id: "workflows", folder_path: "", asset_count: 1 },
            { root_id: "workflows", folder_path: "jobs", asset_count: 1 },
            { root_id: "workflows", folder_path: "jobs/sub", asset_count: 1 },
        ],
        "workflow folder counts are direct counts for searched items",
    );

    tsProbe.tsState.tsSortKey = "created_at";
    tsProbe.tsState.tsSortDirection = "desc";
    tsProbe.tsState.tsFolder = "";
    const tsDateSorted = tsProbe.tsBuildWorkflowQueryResult();
    tsEqual(tsDateSorted.items.map((tsItem) => tsItem.id), [4, 2, 1], "workflow date sorting uses modified_at fallback order");
}

function tsRunSectionStateTests(tsPanelClass) {
    const tsWorkflowProbe = tsBuildPanelProbe(tsPanelClass, {
        tsSection: "workflows",
        tsMode: "tree",
        tsSortKey: "size_bytes",
        tsSortDirection: "asc",
        tsPreviewSize: 184,
        tsSearch: "workflow search",
    });
    tsWorkflowProbe.tsSyncSectionSettingsFromActive();
    tsEqual(tsWorkflowProbe.tsState.tsWorkflowMode, "tree", "workflow mode sync is section-specific");
    tsEqual(tsWorkflowProbe.tsState.tsWorkflowSortKey, "created_at", "workflow sort sync rejects size sort");
    tsEqual(tsWorkflowProbe.tsState.tsWorkflowSortDirection, "asc", "workflow sort direction sync is preserved");
    tsEqual(tsWorkflowProbe.tsState.tsWorkflowPreviewSize, 184, "workflow preview size sync is preserved");
    tsEqual(tsWorkflowProbe.tsState.tsWorkflowSearch, "workflow search", "workflow search sync is preserved");

    const tsAssetProbe = tsBuildPanelProbe(tsPanelClass, {
        tsSection: "assets",
        tsMode: "tree",
        tsSortKey: "size_bytes",
        tsSortDirection: "asc",
        tsPreviewSize: 160,
        tsSearch: "asset search",
    });
    tsAssetProbe.tsSyncSectionSettingsFromActive();
    tsEqual(tsAssetProbe.tsState.tsAssetMode, "tree", "asset mode sync is section-specific");
    tsEqual(tsAssetProbe.tsState.tsAssetSortKey, "size_bytes", "asset sort sync preserves size sort");
    tsEqual(tsAssetProbe.tsState.tsAssetSortDirection, "asc", "asset sort direction sync is preserved");
    tsEqual(tsAssetProbe.tsState.tsAssetPreviewSize, 160, "asset preview size sync is preserved");
    tsEqual(tsAssetProbe.tsState.tsAssetSearch, "asset search", "asset search sync is preserved");

    const tsApplyWorkflowProbe = tsBuildPanelProbe(tsPanelClass, {
        tsSection: "workflows",
        tsWorkflowMode: "tree",
        tsWorkflowSortKey: "size_bytes",
        tsWorkflowSortDirection: "asc",
        tsWorkflowPreviewSize: 144,
        tsWorkflowSearch: "wf",
    });
    tsApplyWorkflowProbe.tsWorkflowSelectedFolder = "folder/sub";
    tsApplyWorkflowProbe.tsApplySectionSettings();
    tsEqual(tsApplyWorkflowProbe.tsState.tsMode, "tree", "workflow apply restores workflow mode");
    tsEqual(tsApplyWorkflowProbe.tsState.tsSortKey, "created_at", "workflow apply rejects size sort");
    tsEqual(tsApplyWorkflowProbe.tsState.tsFolder, "folder/sub", "workflow apply restores selected folder in tree mode");

    const tsApplyAssetProbe = tsBuildPanelProbe(tsPanelClass, {
        tsSection: "assets",
        tsAssetMode: "tree",
        tsAssetSortKey: "filename",
        tsAssetSortDirection: "asc",
        tsAssetPreviewSize: 152,
        tsAssetSearch: "asset",
    });
    tsApplyAssetProbe.tsLastAssetFolder = "asset/folder";
    tsApplyAssetProbe.tsApplySectionSettings();
    tsEqual(tsApplyAssetProbe.tsState.tsMode, "tree", "asset apply restores asset mode");
    tsEqual(tsApplyAssetProbe.tsState.tsSortKey, "filename", "asset apply restores asset sort");
    tsEqual(tsApplyAssetProbe.tsState.tsFolder, "asset/folder", "asset apply restores selected folder in tree mode");
}

async function tsRunSectionSwitchTests(tsPanelClass) {
    const tsCalls = [];
    const tsProbe = tsBuildPanelProbe(tsPanelClass, {
        tsSection: "assets",
        tsMode: "tree",
        tsAssetMode: "tree",
        tsWorkflowMode: "tree",
        tsRootId: "output",
        tsFolder: "images",
        tsSelection: new Set([10]),
        tsLastSelectedIndex: 2,
    });
    tsProbe.tsWorkflowSelectedFolder = "jobs/sub";
    tsProbe.tsLastAssetRootId = "output";
    tsProbe.tsLastAssetFolder = "images";
    tsProbe.tsWorkflowLibraryLoaded = true;
    tsProbe.tsRefs = {
        tsGalleryContent: {
            innerHTML: "stale cards",
        },
    };
    tsProbe.tsQueueSaveUISettings = () => {
        tsCalls.push("save");
    };
    tsProbe.tsRenderSectionButtons = () => {
        tsCalls.push("sections");
    };
    tsProbe.tsRenderToolbarForSection = () => {
        tsCalls.push("toolbar");
    };
    tsProbe.tsRenderSortOptions = () => {
        tsCalls.push("sort");
    };
    tsProbe.tsFetchAssets = async (tsReset) => {
        tsCalls.push(`fetch:${tsReset}`);
    };
    tsProbe.tsScheduleGridRender = (tsForce, tsRefreshMetrics) => {
        tsCalls.push(`grid:${tsForce}:${tsRefreshMetrics}`);
    };
    tsProbe.tsHandleGalleryScroll = () => {
        tsCalls.push("scroll");
    };
    tsProbe.tsScheduleSidebarRefresh = (tsDelay) => {
        tsCalls.push(`sidebar:${tsDelay}`);
    };

    await tsProbe.tsSetSection("workflows");

    tsEqual(tsProbe.tsState.tsSection, "workflows", "section switch sets workflows as active section");
    tsEqual(tsProbe.tsState.tsRootId, "workflows", "workflow section uses the virtual workflows root");
    tsEqual(tsProbe.tsState.tsFolder, "jobs/sub", "workflow section restores workflow tree folder");
    tsEqual(tsProbe.tsState.tsSelection.size, 0, "section switch clears selected asset ids");
    tsEqual(tsProbe.tsState.tsLastSelectedIndex, -1, "section switch clears selection anchor");
    tsEqual(tsProbe.tsWorkflowLibraryLoaded, false, "workflow section switch forces workflow library reload");
    tsEqual(tsProbe.tsRefs.tsGalleryContent.innerHTML, "", "section switch clears stale gallery markup");
    tsEqual(
        tsCalls,
        ["save", "sections", "toolbar", "sort", "fetch:true", "grid:true:true", "scroll", "sidebar:0", "sidebar:48", "sidebar:120"],
        "section switch refreshes the toolbar, data, grid, and sidebar",
    );
}

function tsRunGridTests(tsPanelClass) {
    const tsStyleWrites = [];
    const tsProbe = tsBuildPanelProbe(tsPanelClass, {
        tsPreviewSize: 120,
    });
    tsProbe.tsRefs = {
        tsGalleryScroll: {
            clientWidth: 500,
        },
        tsGalleryContent: {
            style: {
                setProperty(tsName, tsValue) {
                    tsStyleWrites.push([tsName, tsValue]);
                },
            },
        },
    };
    const tsMetrics = tsProbe.tsGetGridMetrics();
    tsEqual(tsMetrics.tsContentWidth, 476, "grid metrics subtract stable padding and guard rail");
    tsEqual(tsMetrics.tsColumns, 3, "grid metrics calculate stable column count");
    tsEqual(tsMetrics.tsCardPreviewHeight, 110, "grid metrics keep preview aspect ratio");
    tsEqual(tsMetrics.tsRowHeight, 120, "grid metrics row height includes gap");
    tsEqual(tsMetrics.tsActionSize, 17, "grid metrics preserve chrome scaling");
    tsEqual(tsProbe.tsState.tsGridColumns, 3, "grid metrics update state columns");
    tsEqual(tsProbe.tsState.tsGridRowHeight, 120, "grid metrics update state row height");
    tsAssert(tsStyleWrites.some(([tsName, tsValue]) => tsName === "--ts-card-preview-height" && tsValue === "110px"), "grid metrics write preview CSS variable");
}

function tsRunSelectionTests(tsPanelClass) {
    const tsProbe = tsBuildPanelProbe(tsPanelClass, {
        tsItems: [
            { id: 10, filename: "first.png" },
            { id: 20, filename: "second.png" },
            { id: null, filename: "null-id.png" },
        ],
        tsSelection: new Set([20, 999, null]),
    });
    tsProbe.tsRebuildItemIndex();
    tsEqual([...tsProbe.tsItemIndexById.entries()], [[10, 0], [20, 1], [null, 2]], "item index preserves every current item id, including null");
    tsEqual(tsProbe.tsFindItemById(10), { id: 10, filename: "first.png" }, "find item by id uses the index map");
    tsEqual(tsProbe.tsFindItemById(999), null, "find item by id returns null for missing ids");
    tsEqual(
        tsProbe.tsGetSelectedItems(),
        [{ id: 20, filename: "second.png" }, { id: null, filename: "null-id.png" }],
        "selected items preserve selection insertion order and skip missing ids",
    );
}

const tsHelperExports = await tsLoadHelperExports();
const tsPanelExports = tsBuildPanelHarness(tsHelperExports);

tsRunFormatTests(tsPanelExports);
tsRunSearchParamTests(tsPanelExports.TSArtiusBrowserPanel);
tsRunWorkflowTests(tsPanelExports.TSArtiusBrowserPanel);
tsRunSectionStateTests(tsPanelExports.TSArtiusBrowserPanel);
await tsRunSectionSwitchTests(tsPanelExports.TSArtiusBrowserPanel);
tsRunGridTests(tsPanelExports.TSArtiusBrowserPanel);
tsRunSelectionTests(tsPanelExports.TSArtiusBrowserPanel);

console.log(`frontend panel characterization: ${tsAssertions} assertions OK`);
