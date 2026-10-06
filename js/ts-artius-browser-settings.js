export const tsProjectSettings = Object.freeze({
    extensionId: "timesaver.artius.browser",
    sidebarId: "timesaver-artius-browser",
    sidebarIcon: "tsArtiusSidebarIcon",
    title: "Artius Browser",
    label: "Browser",
    tooltip: "Timesaver Artius Browser",
    defaultLocale: "en",
});

export const tsBrowserRuntimeSettings = Object.freeze({
    initialRescanDelayMs: 600,
    initialRescanFreshWindowMs: 60000,
    executionRescanDelayMs: 1200,
    executionRescanMaxDeferralMs: 5000,
    executionRescanIdleRetryMs: 250,
    executionRescanRootId: "output",
    // How long one tab's post-generation rescan claim suppresses the
    // others. Comfortably longer than a scan of a large library takes to
    // start, short enough that a tab closed mid-generation cannot mute
    // the next one.
    executionRescanClaimWindowMs: 8000,
    enableConsoleDebug: false,
});

export const tsApiSettings = Object.freeze({
    routeBase: "/asset_browser",
    assetDragMime: "application/x-timesaver-artius-asset",
    nativeWorkflowTargets: {
        image: { tsNodeType: "LoadImage", tsWidgetNames: ["image"] },
        video: { tsNodeType: "LoadVideo", tsWidgetNames: ["file", "video"] },
        audio: { tsNodeType: "LoadAudio", tsWidgetNames: ["audio"] },
        "3d": { tsNodeType: "Load3D", tsWidgetNames: ["model_file"] },
    },
    fallbackWorkflowTargets: {},
    // Node types PREFERRED over the native ComfyUI loader when the pack that
    // publishes them is installed in this ComfyUI. Each list is tried in order
    // and the first entry whose node type is registered wins; with none of them
    // installed the native target above is used and nothing changes.
    //
    // tsValueKind "path" means the node takes the asset's absolute path as it
    // sits on the ComfyUI machine, so the asset is NOT copied into input/.
    // tsHiddenWidgetStash / tsRefreshHook are optional surfaces such a node may
    // expose: a stash of widgets it removed from node.widgets to render its own
    // interface, and a hook that re-reads the persisted value. Both are read
    // through optional access - a node without them still gets its value.
    preferredWorkflowTargets: {
        video: [
            {
                tsNodeType: "TS_VideoLoader",
                tsWidgetNames: ["source_path"],
                tsValueKind: "path",
                tsHiddenWidgetStash: "_tsHiddenWidgets",
                tsRefreshHook: "_tsVideoLoaderRehydrate",
            },
        ],
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
        filterChip: 120,
        // Typed filter values (width, height, dates): long enough to cover
        // the gap between keystrokes of one number.
        filterInput: 450,
    },
    // A refresh of the same query asks for everything already loaded, so the
    // user keeps their place; the listing route caps a page at 500.
    softRefreshMaxItems: 500,
    responseCache: {
        ttlMs: 30000,
        capacity: 10,
    },
    // "Download selected": the "packing..." toast waits this long, so a
    // selection that is packed at once does not flash a message.
    archive: {
        preparingToastDelayMs: 700,
    },
    threeDThumbnails: {
        concurrency: 1,
        visibleLimit: 4,
        captureSize: 480,
        warmFrames: 2,
        backgroundPageSize: 8,
        cacheCapacity: 64,
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
        // Keyboard pan step, in screen pixels. A wheel-free zoom is useless if
        // the only way to reach the corner of the image is the mouse.
        panStep: 60,
        panStepFast: 240,
    },
    imageSwap: {
        // Navigating the lightbox rebuilds the stage, so the new <img> starts
        // empty and the old picture is already gone. Measured on a 1.8 MB
        // ComfyUI output: 30-60 ms with nothing on screen and a stage collapsed
        // to zero height. Decoding the file before the swap closes that gap.
        //
        // maxWaitMs caps how long a swap waits: past it the stage renders
        // exactly as it did before this existed, so a slow disk or a huge file
        // delays the picture but never the navigation.
        maxWaitMs: 400,
        // Neighbours warmed after each render, which is what makes the usual
        // press of the arrow key cost nothing.
        prefetchRadius: 1,
        // Decoded copies are what keep the swap instant; an unbounded map of
        // them is a memory leak in a long browsing session.
        cacheSize: 8,
        // Crossfade between two pictures. A hard cut reads as a blink even
        // when the next file is already decoded; the outgoing picture fades
        // out over the new one instead. 0 turns it off, and so does the
        // system's "reduce motion" preference.
        fadeMs: 220,
    },
    // How long a step onto a video, audio or 3D asset waits before building
    // its player. Key repeat fires every ~30 ms, so a held arrow passes
    // through without starting a download or a WebGL context per step.
    mediaSwapSettleMs: 140,
    pagination: {
        prefetchThreshold: 6,
    },
    audio: {
        maxWidth: 1600,
        waveformMaxHeight: 360,
    },
});

