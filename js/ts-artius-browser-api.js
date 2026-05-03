import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

import {
    tsApiSettings,
    tsBrowserRuntimeSettings,
    tsProjectSettings,
} from "./ts-artius-browser-settings.js";
import {
    tsOpenAssetInNewTab as tsOpenAssetInNewTabImpl,
    tsOpenDownload as tsOpenDownloadImpl,
    tsResolveOpenableURL as tsResolveOpenableURLImpl,
} from "./ts-artius-browser-api-open.js";
import { tsBuildFolderTree as tsBuildFolderTreeImpl } from "./ts-artius-browser-api-tree.js";
import {
    tsClamp as tsClampImpl,
    tsDebounce as tsDebounceImpl,
    tsFormatBytes as tsFormatBytesImpl,
} from "./ts-artius-browser-api-utils.js";
import {
    tsAddComfyGraphNode,
    tsBuildAssetFetchPath,
    tsCreateComfyGraphNode,
    tsGetComfyCanvasDropGraphPosition,
    tsGetComfyCanvasElement,
    tsGetComfyVisibleNodes,
    tsGetRelativeAssetPath,
    tsIsGraphPointInsideNode,
    tsMarkComfyGraphDirty,
    tsResolveNodeComfyClass,
    tsSplitRelativePath,
} from "./ts-artius-browser-api-workflow.js";
import {
    tsEnsureWidgetOptionValue as tsEnsureWidgetOptionValueImpl,
    tsFindWidget as tsFindWidgetImpl,
    tsGetSelectedNodes as tsGetSelectedNodesImpl,
    tsSetWidgetValue as tsSetWidgetValueImpl,
} from "./ts-artius-browser-api-widgets.js";
import {
    tsBuildUserdataFilePath,
    tsBuildUserdataFileURL as tsBuildUserdataFileURLBase,
    tsBuildWorkflowBrowserLibraryItems,
    tsNormalizeRelativePath,
    tsToWorkflowStorePath,
} from "./ts-artius-browser-api-paths.js";

export const tsRouteBase = tsApiSettings.routeBase;
export const tsAssetDragMime = tsApiSettings.assetDragMime;

const tsNativeWorkflowTargets = tsApiSettings.nativeWorkflowTargets;
const tsFallbackWorkflowTargets = tsApiSettings.fallbackWorkflowTargets;
const tsLocaleCache = new Map();
const tsEnableConsoleDebug = Boolean(tsBrowserRuntimeSettings.enableConsoleDebug);
const tsWorkflowUserdataRoot = "workflows";

function tsComfyAdapterDeps() {
    return {
        app,
        consoleDebug: tsConsoleDebug,
        window,
    };
}

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

function tsBuildUserdataFileURL(tsRelativePath) {
    return tsBuildUserdataFileURLBase(tsRelativePath, tsApiURL);
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
    return tsBuildWorkflowBrowserLibraryItems(tsEntries, tsBuildUserdataFileURL);
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
    return tsDebounceImpl(tsFunction, tsWaitMs, window);
}

export function tsClamp(tsValue, tsMin, tsMax) {
    return tsClampImpl(tsValue, tsMin, tsMax);
}

export function tsFormatBytes(tsBytes) {
    return tsFormatBytesImpl(tsBytes);
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
    return tsResolveOpenableURLImpl(tsURL, tsApiURL);
}

export function tsOpenDownload(tsAsset) {
    return tsOpenDownloadImpl(tsAsset, { document, apiURL: tsApiURL });
}

export function tsOpenAssetInNewTab(tsAsset) {
    return tsOpenAssetInNewTabImpl(tsAsset, { document, apiURL: tsApiURL });
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
    return tsBuildFolderTreeImpl(tsFolders, tsRoots);
}

function tsGetSelectedNodes() {
    return tsGetSelectedNodesImpl(app);
}

function tsFindWidget(tsNode, tsNames) {
    return tsFindWidgetImpl(tsNode, tsNames);
}

function tsEnsureWidgetOptionValue(tsWidget, tsValue) {
    return tsEnsureWidgetOptionValueImpl(tsWidget, tsValue);
}

async function tsWaitForWidget(tsNode, tsNames, tsAttempts = 40) {
    for (let tsAttempt = 0; tsAttempt < tsAttempts; tsAttempt += 1) {
        const tsWidget = tsFindWidget(tsNode, tsNames);
        if (tsWidget) {
            return tsWidget;
        }
        await tsDelay(50);
    }
    return null;
}
function tsSetWidgetValue(tsNode, tsWidget, tsValue) {
    return tsSetWidgetValueImpl(tsNode, tsWidget, tsValue, { app, consoleDebug: tsConsoleDebug });
}

function tsDelay(tsTimeoutMs) {
    return new Promise((tsResolve) => {
        window.setTimeout(tsResolve, tsTimeoutMs);
    });
}

async function tsEnsureNativeInputPath(tsAsset) {
    const tsRelativePath = tsGetRelativeAssetPath(tsAsset);
    if ((tsAsset?.root_id === "input" || tsAsset?.scope === "input") && tsRelativePath) {
        return tsRelativePath;
    }
    const tsSourcePath = tsBuildAssetFetchPath(tsAsset, tsRouteBase);
    if (!tsSourcePath) {
        return "";
    }
    const tsSourceResponse = await tsFetchResponse(tsSourcePath);
    if (!tsSourceResponse.ok) {
        throw new Error(`${tsSourceResponse.status} ${tsSourceResponse.statusText}`);
    }
    const tsBlob = await tsSourceResponse.blob();
    const tsFile = new File([tsBlob], String(tsAsset?.filename || "asset"), {
        type: tsBlob.type || "application/octet-stream",
    });
    const tsFormData = new FormData();
    tsFormData.append("image", tsFile);
    tsFormData.append("type", "input");
    const tsUploadResponse = await tsFetchResponse("/upload/image", {
        method: "POST",
        body: tsFormData,
    });
    if (!tsUploadResponse.ok) {
        throw new Error(`${tsUploadResponse.status} ${tsUploadResponse.statusText}`);
    }
    const tsUploadPayload = await tsUploadResponse.json();
    const tsUploadedPath = [
        String(tsUploadPayload?.subfolder || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, ""),
        String(tsUploadPayload?.name || ""),
    ].filter(Boolean).join("/");
    return tsUploadedPath;
}

async function tsApplyNativeAssetToNode(tsNode, tsAsset, tsWidgetNames) {
    const tsNativeValue = await tsResolveNativeWidgetValue(tsAsset, tsNode);
    if (!tsNativeValue) {
        return false;
    }
    const tsNativeWidget = await tsWaitForWidget(tsNode, tsWidgetNames);
    if (!tsNativeWidget) {
        return false;
    }
    tsEnsureWidgetOptionValue(tsNativeWidget, tsNativeValue);
    return tsSetWidgetValue(tsNode, tsNativeWidget, tsNativeValue);
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
        tsMarkComfyGraphDirty(tsComfyAdapterDeps());
        return true;
    } catch (tsError) {
        tsConsoleWarn("Timesaver Artius Browser failed to sync native Load3D node", tsError);
        return false;
    }
}

async function tsResolveNativeWidgetValue(tsAsset, tsNode) {
    if (!tsAsset || tsAsset?.type === "3d") {
        return "";
    }
    const tsNodeClass = tsResolveNodeComfyClass(tsNode);
    const tsNormalizedNodeClass = String(tsNodeClass || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (
        tsAsset?.type === "video"
        && (
            tsNormalizedNodeClass === "vhsloadvideopath"
            || tsNormalizedNodeClass === "vhsloadvideoffmpegpath"
            || tsNormalizedNodeClass === "loadvideopath"
        )
    ) {
        return String(tsAsset?.path || "");
    }
    try {
        return await tsEnsureNativeInputPath(tsAsset);
    } catch (tsError) {
        tsConsoleWarn("Timesaver Artius Browser failed to prepare native asset path", tsError);
        return "";
    }
}

function tsGetCanvasDropGraphPosition(tsEvent) {
    return tsGetComfyCanvasDropGraphPosition(tsEvent, tsComfyAdapterDeps());
}

function tsResolveDropTargetNode(tsAsset, tsEvent) {
    if (!tsAsset || !tsEvent) {
        return null;
    }
    const tsNativeTarget = tsNativeWorkflowTargets[tsAsset?.type] || null;
    const tsGraphPosition = tsGetCanvasDropGraphPosition(tsEvent);
    if (!tsGraphPosition) {
        return null;
    }
    const [tsGraphX, tsGraphY] = tsGraphPosition;
    const tsCanvasNodes = tsGetComfyVisibleNodes(tsComfyAdapterDeps());
    for (const tsNode of [...tsCanvasNodes].reverse()) {
        if (!tsIsGraphPointInsideNode(tsNode, tsGraphX, tsGraphY)) {
            continue;
        }
        if (!tsNativeTarget) {
            return tsNode;
        }
        if (tsResolveNodeComfyClass(tsNode) === tsNativeTarget.tsNodeType) {
            return tsNode;
        }
        if (tsFindWidget(tsNode, tsNativeTarget.tsWidgetNames)) {
            return tsNode;
        }
    }
    return null;
}

async function tsTryLoadIntoNodes(tsAsset, tsNodes) {
    if (tsAsset?.type === "3d") {
        return false;
    }
    const tsNativeTarget = tsNativeWorkflowTargets[tsAsset?.type];
    for (const tsNode of Array.isArray(tsNodes) ? tsNodes : []) {
        if (tsNativeTarget && await tsApplyNativeAssetToNode(tsNode, tsAsset, tsNativeTarget.tsWidgetNames)) {
            return true;
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

async function tsTryLoadIntoSelectedNode(tsAsset, tsExcludedNodes = []) {
    const tsExcludedNodeSet = new Set((Array.isArray(tsExcludedNodes) ? tsExcludedNodes : []).filter(Boolean));
    const tsSelectedNodes = tsGetSelectedNodes().filter((tsNode) => !tsExcludedNodeSet.has(tsNode));
    return tsTryLoadIntoNodes(tsAsset, tsSelectedNodes);
}

async function tsCreateWorkflowNode(tsAsset, tsEvent = undefined) {
    const tsNativeTarget = tsNativeWorkflowTargets[tsAsset.type] || null;
    const tsFallbackTarget = tsFallbackWorkflowTargets[tsAsset.type] || null;
    const tsTarget = tsNativeTarget || tsFallbackTarget;
    if (!tsTarget) {
        return false;
    }
    const tsDeps = tsComfyAdapterDeps();
    const tsNode = tsCreateComfyGraphNode(tsTarget.tsNodeType, tsDeps);
    if (!tsNode) {
        return false;
    }
    if (!tsAddComfyGraphNode(tsNode, tsDeps)) {
        return false;
    }
    const tsPosition = tsGetComfyCanvasDropGraphPosition(tsEvent, tsDeps) || [160, 160];
    tsNode.pos = tsPosition;
    window.setTimeout(async () => {
        if (tsNativeTarget) {
            if (tsAsset?.type === "3d") {
                await tsSyncNative3DNode(tsNode, tsAsset);
                return;
            }
            await tsApplyNativeAssetToNode(tsNode, tsAsset, tsNativeTarget.tsWidgetNames);
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
    tsMarkComfyGraphDirty(tsDeps);
    return true;
}

export async function tsLoadAssetIntoWorkflow(tsAsset, tsEvent = undefined) {
    if (!tsAsset) {
        return false;
    }
    if (tsAsset.type !== "image") {
        return tsCreateWorkflowNode(tsAsset, tsEvent);
    }
    const tsDropTargetNode = tsResolveDropTargetNode(tsAsset, tsEvent);
    if (await tsTryLoadIntoNodes(tsAsset, tsDropTargetNode ? [tsDropTargetNode] : [])) {
        return true;
    }
    if (await tsTryLoadIntoSelectedNode(tsAsset, tsDropTargetNode ? [tsDropTargetNode] : [])) {
        return true;
    }
    return tsCreateWorkflowNode(tsAsset, tsEvent);
}

export function tsEnsureCanvasDropBridge() {
    const tsCanvasElement = tsGetComfyCanvasElement(tsComfyAdapterDeps());
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



