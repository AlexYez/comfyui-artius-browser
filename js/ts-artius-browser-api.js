import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

import {
    tsApiSettings,
    tsBrowserRuntimeSettings,
    tsProjectSettings,
} from "./ts-artius-browser-settings.js";

export const tsRouteBase = tsApiSettings.routeBase;
export const tsAssetDragMime = tsApiSettings.assetDragMime;

const tsNativeWorkflowTargets = tsApiSettings.nativeWorkflowTargets;
const tsFallbackWorkflowTargets = tsApiSettings.fallbackWorkflowTargets;
const tsAnnotationSuffixByRootId = tsApiSettings.annotationSuffixByRootId;
const tsLocaleCache = new Map();
const tsEnableConsoleDebug = Boolean(tsBrowserRuntimeSettings.enableConsoleDebug);
const tsWorkflowUserdataRoot = "workflows";
const tsWorkflowPreviewImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);
const tsWorkflowPreviewVideoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);
let tsLoad3DServiceFactoryPromise = null;

export function tsConsoleWarn(...tsArgs) {
    if (tsEnableConsoleDebug) {
        console.warn(...tsArgs);
    }
}

export function tsConsoleDebug(...tsArgs) {
    if (tsEnableConsoleDebug) {
        console.debug(...tsArgs);
    }
}

export function tsApiURL(tsPath) {
    return typeof api?.apiURL === "function" ? api.apiURL(tsPath) : tsPath;
}

function tsNormalizeRelativePath(tsPath) {
    return String(tsPath || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function tsBuildUserdataFilePath(tsRelativePath) {
    const tsNormalizedPath = tsNormalizeRelativePath(tsRelativePath);
    if (!tsNormalizedPath) {
        return "";
    }
    return `/userdata/${encodeURIComponent(tsNormalizedPath)}`;
}

function tsBuildUserdataFileURL(tsRelativePath) {
    const tsPath = tsBuildUserdataFilePath(tsRelativePath);
    return tsPath ? tsApiURL(tsPath) : "";
}

function tsGetPathExtension(tsPath) {
    const tsFilename = tsNormalizeRelativePath(tsPath).split("/").at(-1) || "";
    const tsDotIndex = tsFilename.lastIndexOf(".");
    return tsDotIndex >= 0 ? tsFilename.slice(tsDotIndex).toLowerCase() : "";
}

function tsGetPathStem(tsPath) {
    const tsFilename = tsNormalizeRelativePath(tsPath).split("/").at(-1) || "";
    const tsDotIndex = tsFilename.lastIndexOf(".");
    return tsDotIndex >= 0 ? tsFilename.slice(0, tsDotIndex) : tsFilename;
}

function tsGetParentFolderPath(tsPath) {
    const tsNormalizedPath = tsNormalizeRelativePath(tsPath);
    const tsSegments = tsNormalizedPath.split("/").filter(Boolean);
    return tsSegments.slice(0, -1).join("/");
}

function tsParseModifiedEpoch(tsValue) {
    if (Number.isFinite(tsValue)) {
        return Math.floor(Number(tsValue));
    }
    if (typeof tsValue !== "string" || !tsValue) {
        return 0;
    }
    const tsEpochMs = Date.parse(tsValue);
    return Number.isFinite(tsEpochMs) ? Math.floor(tsEpochMs / 1000) : 0;
}

function tsPickWorkflowPreview(tsCandidates) {
    if (!Array.isArray(tsCandidates) || tsCandidates.length === 0) {
        return null;
    }
    const tsImageCandidate = tsCandidates.find((tsCandidate) => tsCandidate.preview_kind === "image");
    return tsImageCandidate || tsCandidates[0] || null;
}

function tsToWorkflowBrowserFolderPath(tsRelativePath) {
    const tsNormalizedPath = tsNormalizeRelativePath(tsRelativePath);
    if (!tsNormalizedPath.toLowerCase().startsWith(`${tsWorkflowUserdataRoot}/`)) {
        return "";
    }
    return tsNormalizedPath
        .slice(tsWorkflowUserdataRoot.length + 1)
        .split("/")
        .filter(Boolean)
        .slice(0, -1)
        .join("/");
}

function tsToWorkflowStorePath(tsRelativePath) {
    const tsNormalizedPath = tsNormalizeRelativePath(tsRelativePath);
    if (!tsNormalizedPath) {
        return "";
    }
    if (!tsNormalizedPath.toLowerCase().startsWith(`${tsWorkflowUserdataRoot}/`)) {
        return tsNormalizedPath;
    }
    return tsNormalizedPath.slice(tsWorkflowUserdataRoot.length + 1);
}

async function tsLoad3DServiceFactory() {
    if (tsLoad3DServiceFactoryPromise) {
        return tsLoad3DServiceFactoryPromise;
    }
    tsLoad3DServiceFactoryPromise = (async () => {
        const tsSupport = await tsFetch3DViewerSupport().catch(() => null);
        const tsModuleURL = String(tsSupport?.load3d_module_url || "");
        if (!tsModuleURL) {
            return null;
        }
        const tsModule = await import(tsApiURL(tsModuleURL));
        if (typeof tsModule?.useLoad3dService === "function") {
            return tsModule.useLoad3dService;
        }
        return null;
    })().catch((tsError) => {
        tsConsoleWarn("Timesaver Artius Browser failed to load Comfy Load3D service", tsError);
        tsLoad3DServiceFactoryPromise = null;
        return null;
    });
    return tsLoad3DServiceFactoryPromise;
}

async function tsFetchResponse(tsPath, tsOptions = undefined) {
    if (typeof api?.fetchApi === "function") {
        return api.fetchApi(tsPath, tsOptions);
    }
    return fetch(tsApiURL(tsPath), tsOptions);
}

export async function tsFetchJSON(tsPath, tsOptions = undefined) {
    const tsResponse = await tsFetchResponse(tsPath, tsOptions);
    if (!tsResponse.ok) {
        throw new Error(`${tsResponse.status} ${tsResponse.statusText}`);
    }
    return tsResponse.json();
}

export async function tsPostJSON(tsPath, tsBody = {}) {
    return tsFetchJSON(tsPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tsBody),
    });
}

export async function tsFetchAssetDetail(tsAssetId) {
    return tsFetchJSON(`${tsRouteBase}/asset/${tsAssetId}`);
}

export async function tsWarmAssetPreview(tsAssetId) {
    return tsPostJSON(`${tsRouteBase}/preview/${tsAssetId}/warm`, {});
}

export async function tsDeleteAssetIds(tsAssetIds) {
    return tsPostJSON(`${tsRouteBase}/delete`, { ids: tsAssetIds });
}

export async function tsFetch3DViewerSupport() {
    return tsFetchJSON(`${tsRouteBase}/3d/viewer`);
}

export async function tsSave3DThumbnail(tsAssetId, tsImageDataURL) {
    return tsPostJSON(`${tsRouteBase}/3d/thumbnail/${tsAssetId}`, { image_data_url: tsImageDataURL });
}

export async function tsStage3DAssetForLoad3D(tsAssetId) {
    return tsPostJSON(`${tsRouteBase}/3d/stage/${tsAssetId}`, {});
}

export async function tsFetchBrowserSettings() {
    return tsFetchJSON(`${tsRouteBase}/settings`);
}

export async function tsSaveBrowserSettings(tsUISettings = {}) {
    return tsPostJSON(`${tsRouteBase}/settings`, { ui: tsUISettings });
}

export async function tsFetchWorkflowBrowserLibrary() {
    const tsParams = new URLSearchParams({ path: tsWorkflowUserdataRoot });
    const tsPayload = await tsFetchJSON(`/v2/userdata?${tsParams.toString()}`);
    const tsEntries = Array.isArray(tsPayload) ? tsPayload : [];
    const tsFileEntries = tsEntries
        .filter((tsEntry) => String(tsEntry?.type || "").toLowerCase() === "file")
        .map((tsEntry) => {
            const tsPath = tsNormalizeRelativePath(tsEntry?.path || "");
            return {
                ...tsEntry,
                path: tsPath,
                name: String(tsEntry?.name || tsPath.split("/").at(-1) || ""),
            };
        })
        .filter((tsEntry) => tsEntry.path.toLowerCase().startsWith(`${tsWorkflowUserdataRoot}/`));

    const tsPreviewsByKey = new Map();
    const tsWorkflowEntries = [];
    for (const tsEntry of tsFileEntries) {
        const tsExtension = tsGetPathExtension(tsEntry.path);
        const tsFolderKey = tsGetParentFolderPath(tsEntry.path);
        const tsStem = tsGetPathStem(tsEntry.path);
        if (tsExtension === ".json") {
            tsWorkflowEntries.push(tsEntry);
            continue;
        }
        const tsPreviewKind = tsWorkflowPreviewImageExtensions.has(tsExtension)
            ? "image"
            : (tsWorkflowPreviewVideoExtensions.has(tsExtension) ? "video" : "");
        if (!tsPreviewKind) {
            continue;
        }
        const tsPreviewKey = `${tsFolderKey}::${tsStem}`;
        const tsExistingCandidates = tsPreviewsByKey.get(tsPreviewKey) || [];
        tsExistingCandidates.push({
            preview_kind: tsPreviewKind,
            path: tsEntry.path,
            extension: tsExtension,
        });
        tsPreviewsByKey.set(tsPreviewKey, tsExistingCandidates);
    }

    const tsSortedWorkflows = [...tsWorkflowEntries].sort((tsLeft, tsRight) => tsLeft.path.localeCompare(tsRight.path));
    return tsSortedWorkflows.map((tsEntry, tsIndex) => {
        const tsPreviewKey = `${tsGetParentFolderPath(tsEntry.path)}::${tsGetPathStem(tsEntry.path)}`;
        const tsPreview = tsPickWorkflowPreview(tsPreviewsByKey.get(tsPreviewKey));
        const tsModifiedAt = tsParseModifiedEpoch(tsEntry.modified);
        return {
            id: -(tsIndex + 1),
            type: "workflow",
            filename: tsEntry.name,
            extension: ".json",
            folder_path: tsToWorkflowBrowserFolderPath(tsEntry.path),
            relative_path: tsEntry.path,
            file_url: tsBuildUserdataFileURL(tsEntry.path),
            preview_url: tsPreview ? tsBuildUserdataFileURL(tsPreview.path) : "",
            preview_kind: tsPreview?.preview_kind || "",
            size_bytes: Number(tsEntry.size || 0),
            created_at: tsModifiedAt,
            modified_at: tsModifiedAt,
            allow_delete: false,
            detail_loaded: true,
        };
    });
}

export async function tsLoadWorkflowIntoComfy(tsRelativePath) {
    const tsWorkflowPath = tsNormalizeRelativePath(tsRelativePath);
    if (!tsWorkflowPath) {
        return false;
    }
    const tsResponse = typeof api?.getUserData === "function"
        ? await api.getUserData(tsWorkflowPath)
        : await tsFetchResponse(tsBuildUserdataFilePath(tsWorkflowPath));
    if (!tsResponse.ok) {
        throw new Error(`${tsResponse.status} ${tsResponse.statusText}`);
    }
    if (typeof app?.loadGraphData === "function") {
        const tsWorkflowData = await tsResponse.json();
        const tsWorkflowStorePath = tsToWorkflowStorePath(tsWorkflowPath);
        await app.loadGraphData(tsWorkflowData, true, true, tsWorkflowStorePath, {
            openSource: "workflow_browser",
            deferWarnings: false,
            showMissingModelsDialog: true,
            showMissingNodesDialog: true,
        });
        return true;
    }
    const tsWorkflowName = tsWorkflowPath.split("/").at(-1) || "workflow.json";
    const tsWorkflowBlob = await tsResponse.blob();
    if (typeof app?.handleFile === "function") {
        const tsWorkflowFile = new File([tsWorkflowBlob], tsWorkflowName, {
            type: tsWorkflowBlob.type || "application/json",
        });
        await app.handleFile(tsWorkflowFile, "workflow_browser", { deferWarnings: false });
        return true;
    }
    return false;
}

export async function tsDeleteWorkflowFile(tsRelativePath) {
    return tsPostJSON(`${tsRouteBase}/workflow/delete`, { path: tsNormalizeRelativePath(tsRelativePath) });
}

export async function tsLoadLocale(tsLocaleCode = tsProjectSettings.defaultLocale) {
    const tsResolvedCode = tsLocaleCode || tsProjectSettings.defaultLocale;
    if (tsLocaleCache.has(tsResolvedCode)) {
        return tsLocaleCache.get(tsResolvedCode);
    }
    const tsLocaleURL = new URL(`./localization/${tsResolvedCode}.json`, import.meta.url);
    try {
        const tsResponse = await fetch(tsLocaleURL);
        if (!tsResponse.ok) {
            throw new Error(`Locale ${tsResolvedCode} not found`);
        }
        const tsPayload = await tsResponse.json();
        tsLocaleCache.set(tsResolvedCode, tsPayload);
        return tsPayload;
    } catch (tsError) {
        if (tsResolvedCode !== tsProjectSettings.defaultLocale) {
            return tsLoadLocale(tsProjectSettings.defaultLocale);
        }
        tsConsoleWarn("Timesaver Artius Browser locale fallback failed", tsError);
        const tsFallback = {};
        tsLocaleCache.set(tsProjectSettings.defaultLocale, tsFallback);
        return tsFallback;
    }
}

export function tsDebounce(tsFunction, tsWaitMs = 250) {
    let tsTimeoutId = 0;
    return (...tsArgs) => {
        window.clearTimeout(tsTimeoutId);
        tsTimeoutId = window.setTimeout(() => tsFunction(...tsArgs), tsWaitMs);
    };
}

export function tsClamp(tsValue, tsMin, tsMax) {
    return Math.max(tsMin, Math.min(tsMax, tsValue));
}

export function tsFormatBytes(tsBytes) {
    if (!Number.isFinite(tsBytes) || tsBytes <= 0) {
        return "0 B";
    }
    const tsUnits = ["B", "KB", "MB", "GB", "TB"];
    let tsValue = tsBytes;
    let tsUnitIndex = 0;
    while (tsValue >= 1024 && tsUnitIndex < tsUnits.length - 1) {
        tsValue /= 1024;
        tsUnitIndex += 1;
    }
    return `${tsValue.toFixed(tsUnitIndex === 0 ? 0 : 1)} ${tsUnits[tsUnitIndex]}`;
}

export function tsFormatDate(tsEpochSeconds) {
    if (!Number.isFinite(tsEpochSeconds) || tsEpochSeconds <= 0) {
        return "";
    }
    try {
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(tsEpochSeconds * 1000));
    } catch {
        return new Date(tsEpochSeconds * 1000).toLocaleString();
    }
}

export async function tsCopyText(tsText) {
    if (!tsText) {
        return false;
    }
    try {
        await navigator.clipboard.writeText(tsText);
        return true;
    } catch (tsError) {
        tsConsoleWarn("Timesaver Artius Browser clipboard write failed", tsError);
        return false;
    }
}

function tsResolveOpenableURL(tsURL) {
    const tsValue = String(tsURL || "");
    if (!tsValue) {
        return "";
    }
    if (tsValue.startsWith("/api/") || tsValue.startsWith("http://") || tsValue.startsWith("https://") || tsValue.startsWith("blob:") || tsValue.startsWith("data:")) {
        return tsValue;
    }
    return tsApiURL(tsValue);
}

export function tsOpenDownload(tsAsset) {
    if (!tsAsset?.file_url) {
        return;
    }
    const tsLink = document.createElement("a");
    tsLink.href = tsResolveOpenableURL(tsAsset.file_url);
    tsLink.download = tsAsset.filename || "asset";
    tsLink.rel = "noopener";
    document.body.append(tsLink);
    tsLink.click();
    tsLink.remove();
}

function tsClonePlain(tsValue) {
    if (tsValue == null) {
        return tsValue;
    }
    return JSON.parse(JSON.stringify(tsValue));
}

export function tsOpenAssetInNewTab(tsAsset) {
    if (!tsAsset?.file_url) {
        return false;
    }
    const tsLink = document.createElement("a");
    tsLink.href = tsResolveOpenableURL(tsAsset.file_url);
    tsLink.target = "_blank";
    tsLink.rel = "noopener noreferrer";
    document.body.append(tsLink);
    tsLink.click();
    tsLink.remove();
    return true;
}
export function tsEnsureSidebarIconStyle() {
    if (document.getElementById("ts-artius-sidebar-icon-style")) {
        return;
    }
    const tsStyle = document.createElement("style");
    tsStyle.id = "ts-artius-sidebar-icon-style";
    tsStyle.textContent = `
        .tsArtiusSidebarIcon::before {
            content: 'TS';
            font-size: 0.72rem;
            color: currentColor;
            font-weight: 700;
            letter-spacing: 0.04em;
        }
    `;
    document.head.append(tsStyle);
}

export function tsBuildFolderTree(tsFolders, tsRoots) {
    const tsRootNodes = new Map();
    for (const tsRoot of tsRoots || []) {
        tsRootNodes.set(tsRoot.root_id, {
            tsKey: `root:${tsRoot.root_id}`,
            tsRootId: tsRoot.root_id,
            tsFolderPath: "",
            tsLabel: tsRoot.label || tsRoot.root_id,
            tsDirectCount: 0,
            tsCount: 0,
            tsChildren: [],
            tsIndex: new Map(),
        });
    }
    for (const tsFolder of tsFolders || []) {
        const tsRootNode = tsRootNodes.get(tsFolder.root_id);
        if (!tsRootNode) {
            continue;
        }
        const tsDirectCount = Number(tsFolder.asset_count || 0);
        const tsSegments = tsFolder.folder_path ? tsFolder.folder_path.split("/").filter(Boolean) : [];
        let tsParentNode = tsRootNode;
        let tsCurrentPath = "";
        for (const tsSegment of tsSegments) {
            tsCurrentPath = tsCurrentPath ? `${tsCurrentPath}/${tsSegment}` : tsSegment;
            if (!tsParentNode.tsIndex.has(tsCurrentPath)) {
                const tsNode = {
                    tsKey: `${tsRootNode.tsRootId}:${tsCurrentPath}`,
                    tsRootId: tsRootNode.tsRootId,
                    tsFolderPath: tsCurrentPath,
                    tsLabel: tsSegment,
                    tsDirectCount: 0,
                    tsCount: 0,
                    tsChildren: [],
                    tsIndex: new Map(),
                };
                tsParentNode.tsChildren.push(tsNode);
                tsParentNode.tsIndex.set(tsCurrentPath, tsNode);
            }
            tsParentNode = tsParentNode.tsIndex.get(tsCurrentPath);
        }
        tsParentNode.tsDirectCount = tsDirectCount;
    }
    const tsFinalizeCounts = (tsNode) => {
        const tsChildrenCount = tsNode.tsChildren.reduce((tsTotal, tsChild) => tsTotal + tsFinalizeCounts(tsChild), 0);
        tsNode.tsCount = Number(tsNode.tsDirectCount || 0) + tsChildrenCount;
        return tsNode.tsCount;
    };
    const tsSortNodes = (tsNodes) => {
        tsNodes.sort((tsLeft, tsRight) => tsLeft.tsLabel.localeCompare(tsRight.tsLabel));
        for (const tsNode of tsNodes) {
            tsSortNodes(tsNode.tsChildren);
        }
    };
    const tsRootsList = [...tsRootNodes.values()];
    for (const tsRootNode of tsRootsList) {
        tsFinalizeCounts(tsRootNode);
    }
    tsSortNodes(tsRootsList);
    return tsRootsList;
}

function tsGetSelectedNodes() {
    const tsSelected = app?.canvas?.selected_nodes;
    if (!tsSelected) {
        return [];
    }
    if (Array.isArray(tsSelected)) {
        return tsSelected;
    }
    return Object.values(tsSelected);
}

function tsFindWidget(tsNode, tsNames) {
    if (!tsNode?.widgets?.length) {
        return null;
    }
    const tsLowerNames = tsNames.map((tsName) => tsName.toLowerCase());
    return tsNode.widgets.find((tsWidget) => {
        const tsWidgetName = String(tsWidget?.name || "").toLowerCase();
        return tsLowerNames.includes(tsWidgetName);
    }) || null;
}

function tsEnsureWidgetOptionValue(tsWidget, tsValue) {
    const tsValues = tsWidget?.options?.values;
    if (!Array.isArray(tsValues) || !tsValue) {
        return;
    }
    if (!tsValues.includes(tsValue)) {
        tsValues.push(tsValue);
    }
}

function tsSetWidgetValue(tsNode, tsWidget, tsValue) {
    if (!tsWidget) {
        return false;
    }
    tsWidget.value = tsValue;
    if (typeof tsWidget.callback === "function") {
        try {
            tsWidget.callback(tsValue, app, tsNode);
        } catch (tsError) {
            tsConsoleDebug("Timesaver Artius Browser widget callback failed", tsError);
        }
    }
    app?.graph?.setDirtyCanvas?.(true, true);
    app?.canvas?.setDirty?.(true, true);
    return true;
}

function tsSetWidgetValueSilently(tsWidget, tsValue) {
    if (!tsWidget) {
        return false;
    }
    const tsOriginalCallback = tsWidget.callback;
    try {
        tsWidget.callback = null;
        tsWidget.value = tsValue;
    } finally {
        tsWidget.callback = tsOriginalCallback;
    }
    app?.graph?.setDirtyCanvas?.(true, true);
    app?.canvas?.setDirty?.(true, true);
    return true;
}

function tsDelay(tsTimeoutMs) {
    return new Promise((tsResolve) => {
        window.setTimeout(tsResolve, tsTimeoutMs);
    });
}

function tsSplitRelativePath(tsRelativePath) {
    const tsNormalized = String(tsRelativePath || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    if (!tsNormalized) {
        return { tsSubfolder: "", tsFilename: "" };
    }
    const tsParts = tsNormalized.split("/").filter(Boolean);
    if (!tsParts.length) {
        return { tsSubfolder: "", tsFilename: "" };
    }
    return {
        tsSubfolder: tsParts.slice(0, -1).join("/"),
        tsFilename: tsParts.at(-1) || "",
    };
}

function tsBuildInputResourceURL(tsRelativePath) {
    const { tsSubfolder, tsFilename } = tsSplitRelativePath(tsRelativePath);
    if (!tsFilename) {
        return "";
    }
    const tsQuery = new URLSearchParams({
        filename: tsFilename,
        type: "input",
    });
    if (tsSubfolder) {
        tsQuery.set("subfolder", tsSubfolder);
    }
    return `/view?${tsQuery.toString()}`;
}

async function tsSyncNative3DNode(tsNode, tsAsset) {
    const tsNodeClass = String(tsNode?.comfyClass || tsNode?.constructor?.comfyClass || "");
    if (!tsNode || tsNodeClass !== "Load3D" || tsAsset?.type !== "3d") {
        return false;
    }
    const tsStagePayload = await tsStage3DAssetForLoad3D(tsAsset.id).catch((tsError) => {
        tsConsoleWarn("Timesaver Artius Browser failed to stage 3D asset for Load3D", tsError);
        return null;
    });
    const tsModelFile = String(tsStagePayload?.model_file || "");
    if (!tsModelFile) {
        return false;
    }
    const { tsSubfolder } = tsSplitRelativePath(tsModelFile);
    let tsModelWidget = null;
    for (let tsAttempt = 0; tsAttempt < 40; tsAttempt += 1) {
        tsModelWidget = tsFindWidget(tsNode, ["model_file"]);
        if (tsModelWidget) {
            break;
        }
        await tsDelay(100);
    }
    if (!tsModelWidget) {
        return false;
    }
    try {
        if (tsSubfolder) {
            const tsResourceFolder = tsSubfolder.replace(/^3d\/?/i, "");
            if (tsResourceFolder) {
                tsNode.properties = tsNode.properties || {};
                tsNode.properties["Resource Folder"] = tsResourceFolder;
            }
        }
        tsEnsureWidgetOptionValue(tsModelWidget, tsModelFile);
        tsModelWidget.value = tsModelFile;
        app?.graph?.setDirtyCanvas?.(true, true);
        app?.canvas?.setDirty?.(true, true);
        return true;
    } catch (tsError) {
        tsConsoleWarn("Timesaver Artius Browser failed to sync native Load3D node", tsError);
        return false;
    }
}

function tsGetRelativeAssetPath(tsAsset) {
    if (!tsAsset?.filename) {
        return "";
    }
    const tsFolder = String(tsAsset.folder_path || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    return tsFolder ? `${tsFolder}/${tsAsset.filename}` : tsAsset.filename;
}

function tsGetAnnotatedAssetPath(tsAsset) {
    const tsRelativePath = tsGetRelativeAssetPath(tsAsset);
    if (!tsRelativePath) {
        return "";
    }
    if (tsAsset?.type === "3d") {
        return tsRelativePath;
    }
    const tsSuffix = tsAnnotationSuffixByRootId[tsAsset.root_id || tsAsset.scope || ""];
    if (!tsSuffix) {
        return "";
    }
    return `${tsRelativePath} ${tsSuffix}`;
}

async function tsTryLoadIntoSelectedNode(tsAsset) {
    if (tsAsset?.type === "3d") {
        return false;
    }
    const tsSelectedNodes = tsGetSelectedNodes();
    const tsNativeTarget = tsNativeWorkflowTargets[tsAsset?.type];
    const tsAnnotatedPath = tsGetAnnotatedAssetPath(tsAsset);
    for (const tsNode of tsSelectedNodes) {
        if (tsNativeTarget && tsAnnotatedPath) {
            const tsNativeWidget = tsFindWidget(tsNode, tsNativeTarget.tsWidgetNames);
            if (tsNativeWidget && tsAsset?.type !== "3d") {
                tsEnsureWidgetOptionValue(tsNativeWidget, tsAnnotatedPath);
            }
            if (tsNativeWidget && tsSetWidgetValue(tsNode, tsNativeWidget, tsAnnotatedPath)) {
                return true;
            }
        }
        const tsAssetIdWidget = tsFindWidget(tsNode, ["asset_id"]);
        if (tsAssetIdWidget && tsSetWidgetValue(tsNode, tsAssetIdWidget, Number(tsAsset.id))) {
            const tsPathWidget = tsFindWidget(tsNode, ["path"]);
            if (tsPathWidget) {
                tsSetWidgetValue(tsNode, tsPathWidget, tsAsset.path);
            }
            return true;
        }
        const tsPathWidget = tsFindWidget(tsNode, ["path", "file_path", "asset_path"]);
        if (tsPathWidget && tsSetWidgetValue(tsNode, tsPathWidget, tsAsset.path)) {
            return true;
        }
    }
    return false;
}

async function tsCreateWorkflowNode(tsAsset, tsEvent = undefined) {
    const tsLiteGraph = window.LiteGraph;
    if (!tsLiteGraph) {
        return false;
    }
    const tsNativeTarget = tsNativeWorkflowTargets[tsAsset.type] || null;
    const tsFallbackTarget = tsFallbackWorkflowTargets[tsAsset.type] || null;
    const tsTarget = tsNativeTarget || tsFallbackTarget;
    if (!tsTarget) {
        return false;
    }
    const tsNode = tsLiteGraph.createNode(tsTarget.tsNodeType);
    if (!tsNode) {
        return false;
    }
    const tsGraph = app?.canvas?.graph || app?.graph;
    if (!tsGraph) {
        return false;
    }
    tsGraph.add(tsNode);
    let tsPosition = app?.canvas?.graph_mouse ? [...app.canvas.graph_mouse] : [160, 160];
    if (tsEvent && typeof app?.canvas?.convertEventToCanvasOffset === "function") {
        tsPosition = app.canvas.convertEventToCanvasOffset(tsEvent);
    }
    tsNode.pos = tsPosition;
    window.setTimeout(async () => {
        if (tsNativeTarget) {
            const tsAnnotatedPath = tsGetAnnotatedAssetPath(tsAsset);
            if (!tsAnnotatedPath) {
                return;
            }
            const tsNativeWidget = tsFindWidget(tsNode, tsNativeTarget.tsWidgetNames);
            if (tsAsset?.type === "3d") {
                await tsSyncNative3DNode(tsNode, tsAsset);
                return;
            }
            if (tsNativeWidget) {
                tsEnsureWidgetOptionValue(tsNativeWidget, tsAnnotatedPath);
                tsSetWidgetValue(tsNode, tsNativeWidget, tsAnnotatedPath);
            }
            return;
        }
        const tsAssetIdWidget = tsFindWidget(tsNode, ["asset_id"]);
        const tsPathWidget = tsFindWidget(tsNode, ["path"]);
        if (tsAssetIdWidget) {
            tsSetWidgetValue(tsNode, tsAssetIdWidget, Number(tsAsset.id));
        }
        if (tsPathWidget) {
            tsSetWidgetValue(tsNode, tsPathWidget, tsAsset.path);
        }
    }, 0);
    app?.graph?.setDirtyCanvas?.(true, true);
    app?.canvas?.setDirty?.(true, true);
    return true;
}

export async function tsLoadAssetIntoWorkflow(tsAsset, tsEvent = undefined) {
    if (!tsAsset) {
        return false;
    }
    if (await tsTryLoadIntoSelectedNode(tsAsset)) {
        return true;
    }
    return tsCreateWorkflowNode(tsAsset, tsEvent);
}

export function tsEnsureCanvasDropBridge() {
    const tsCanvasElement = app?.canvas?.canvas;
    if (!tsCanvasElement || tsCanvasElement.__tsArtiusDropBridgeBound) {
        return;
    }
    tsCanvasElement.__tsArtiusDropBridgeBound = true;

    const tsHandleDragOver = (tsEvent) => {
        const tsTypes = [...(tsEvent.dataTransfer?.types || [])];
        if (!tsTypes.includes(tsAssetDragMime)) {
            return;
        }
        tsEvent.preventDefault();
        tsEvent.stopPropagation();
        tsEvent.stopImmediatePropagation?.();
        tsEvent.dataTransfer.dropEffect = "copy";
    };

    const tsHandleDrop = (tsEvent) => {
        const tsRawPayload = tsEvent.dataTransfer?.getData(tsAssetDragMime) || window.__tsArtiusDraggedAsset || "";
        if (!tsRawPayload) {
            return;
        }
        tsEvent.preventDefault();
        tsEvent.stopPropagation();
        tsEvent.stopImmediatePropagation?.();
        try {
            const tsAsset = typeof tsRawPayload === "string" ? JSON.parse(tsRawPayload) : tsRawPayload;
            void tsLoadAssetIntoWorkflow(tsAsset, tsEvent);
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser drag payload parse failed", tsError);
        } finally {
            window.__tsArtiusDraggedAsset = "";
        }
    };

    tsCanvasElement.addEventListener("dragover", tsHandleDragOver, true);
    tsCanvasElement.addEventListener("drop", tsHandleDrop, true);
}



