export const tsProjectSettings = Object.freeze({
    extensionId: "timesaver.artius.browser",
    sidebarId: "timesaver-artius-browser",
    sidebarIcon: "tsArtiusSidebarIcon",
    title: "Timesaver Artius Browser",
    label: "Browser",
    tooltip: "Timesaver Artius Browser",
    defaultLocale: "en",
});

export const tsBrowserRuntimeSettings = Object.freeze({
    initialRescanDelayMs: 600,
    executionRescanDelayMs: 1200,
    executionRescanRootId: "output",
    enableConsoleDebug: false,
});

export const tsApiSettings = Object.freeze({
    routeBase: "/asset_browser",
    assetDragMime: "application/x-timesaver-artius-asset",
    nativeWorkflowTargets: {
        image: { tsNodeType: "LoadImage", tsWidgetNames: ["image"] },
        video: { tsNodeType: "LoadVideo", tsWidgetNames: ["file"] },
        audio: { tsNodeType: "LoadAudio", tsWidgetNames: ["audio"] },
        "3d": { tsNodeType: "Load3D", tsWidgetNames: ["model_file"] },
    },
    fallbackWorkflowTargets: {},
    annotationSuffixByRootId: {
        output: "[output]",
        input: "[input]",
        temp: "[temp]",
    },
});

export const tsPanelSettings = Object.freeze({
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

export const tsViewerSettings = Object.freeze({
    imageZoom: {
        min: 1,
        max: 8,
        stepIn: 1.14,
        stepOut: 1 / 1.14,
    },
    pagination: {
        prefetchThreshold: 6,
    },
    audio: {
        maxWidth: 1600,
        waveformMaxHeight: 360,
    },
});

