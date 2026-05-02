import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const tsScriptDir = path.dirname(fileURLToPath(import.meta.url));
const tsRepoRoot = path.resolve(tsScriptDir, "..");
const tsApiPath = path.join(tsRepoRoot, "js", "ts-artius-browser-api.js");

const tsApiSettings = Object.freeze({
    routeBase: "/asset_browser",
    assetDragMime: "application/x-timesaver-artius-asset",
    nativeWorkflowTargets: {
        image: { tsNodeType: "LoadImage", tsWidgetNames: ["image"] },
        video: { tsNodeType: "LoadVideo", tsWidgetNames: ["file", "video"] },
        audio: { tsNodeType: "LoadAudio", tsWidgetNames: ["audio"] },
        "3d": { tsNodeType: "Load3D", tsWidgetNames: ["model_file"] },
    },
    fallbackWorkflowTargets: {},
});

const tsBrowserRuntimeSettings = Object.freeze({
    enableConsoleDebug: false,
});

const tsProjectSettings = Object.freeze({
    defaultLocale: "en",
});

let tsAssertions = 0;

function tsEqual(tsActual, tsExpected, tsMessage) {
    const tsNormalizedActual = tsActual && typeof tsActual === "object"
        ? JSON.parse(JSON.stringify(tsActual))
        : tsActual;
    assert.deepEqual(tsNormalizedActual, tsExpected, tsMessage);
    tsAssertions += 1;
}

function tsBuildResponse(tsPayload, tsOptions = {}) {
    return {
        ok: tsOptions.ok ?? true,
        status: tsOptions.status ?? 200,
        statusText: tsOptions.statusText ?? "OK",
        async json() {
            return tsPayload;
        },
        async blob() {
            return new Blob([JSON.stringify(tsPayload)], { type: "application/json" });
        },
    };
}

async function tsLoadOptionalModule(tsRelativePath) {
    const tsAbsolutePath = path.join(tsRepoRoot, tsRelativePath);
    if (!fs.existsSync(tsAbsolutePath)) {
        return {};
    }
    return import(`${pathToFileURL(tsAbsolutePath).href}?ts=${Date.now()}`);
}

async function tsLoadHelperExports() {
    const tsModules = await Promise.all([
        tsLoadOptionalModule("js/ts-artius-browser-api-paths.js"),
        tsLoadOptionalModule("js/ts-artius-browser-api-tree.js"),
        tsLoadOptionalModule("js/ts-artius-browser-api-utils.js"),
    ]);
    return Object.assign({}, ...tsModules);
}

function tsBuildApiHarness(tsOptions = {}, tsHelperExports = {}) {
    const tsSource = fs.readFileSync(tsApiPath, "utf8")
        .replace(/^import[\s\S]*?;\r?\n/gm, "")
        .replace(/import\.meta\.url/g, JSON.stringify(pathToFileURL(tsApiPath).href))
        .replace(/\bexport\s+const\s+/g, "const ")
        .replace(/\bexport\s+async\s+function\s+/g, "async function ")
        .replace(/\bexport\s+function\s+/g, "function ");
    const tsContext = {
        Blob,
        console,
        File: class {
            constructor(tsParts, tsName, tsFileOptions = {}) {
                this.parts = tsParts;
                this.name = tsName;
                this.type = tsFileOptions.type || "";
            }
        },
        FormData: class {
            constructor() {
                this.entries = [];
            }
            append(tsName, tsValue) {
                this.entries.push([tsName, tsValue]);
            }
        },
        Map,
        Number,
        Promise,
        Set,
        String,
        URL,
        URLSearchParams,
        app: {
            loadGraphData: tsOptions.loadGraphData,
            handleFile: tsOptions.handleFile,
            canvas: tsOptions.canvas,
            graph: tsOptions.graph,
        },
        api: {
            apiURL: tsOptions.apiURL || ((tsPath) => `/api${tsPath}`),
            fetchApi: tsOptions.fetchApi,
            getUserData: tsOptions.getUserData,
        },
        document: {
            body: {
                append(tsElement) {
                    tsOptions.appendedElements?.push(tsElement);
                },
            },
            createElement(tsTagName) {
                return {
                    tagName: tsTagName,
                    clickCount: 0,
                    removeCount: 0,
                    click() {
                        this.clickCount += 1;
                    },
                    remove() {
                        this.removeCount += 1;
                    },
                };
            },
            getElementById() {
                return null;
            },
            head: {
                append() {},
            },
        },
        fetch: tsOptions.fetch,
        navigator: {
            clipboard: {
                writeText: tsOptions.writeText || (async () => {}),
            },
        },
        tsApiSettings,
        tsBrowserRuntimeSettings,
        tsClampImpl: tsHelperExports.tsClamp,
        tsBuildFolderTreeImpl: tsHelperExports.tsBuildFolderTree,
        tsBuildUserdataFileURLBase: tsHelperExports.tsBuildUserdataFileURL,
        tsDebounceImpl: tsHelperExports.tsDebounce,
        tsFormatBytesImpl: tsHelperExports.tsFormatBytes,
        tsProjectSettings,
        window: {
            clearTimeout: tsOptions.clearTimeout || (() => {}),
            setTimeout: tsOptions.setTimeout || ((tsCallback) => {
                if (typeof tsCallback === "function") {
                    tsCallback();
                }
                return 1;
            }),
            LiteGraph: tsOptions.LiteGraph,
        },
        ...tsHelperExports,
    };
    vm.createContext(tsContext);
    vm.runInContext(
        `${tsSource}
        globalThis.__apiExports = {
            tsRouteBase,
            tsAssetDragMime,
            tsApiURL,
            tsNormalizeRelativePath,
            tsBuildUserdataFilePath,
            tsBuildUserdataFileURL,
            tsGetPathExtension,
            tsGetPathStem,
            tsGetParentFolderPath,
            tsParseModifiedEpoch,
            tsPickWorkflowPreview,
            tsToWorkflowBrowserFolderPath,
            tsToWorkflowStorePath,
            tsFetchWorkflowBrowserLibrary,
            tsLoadWorkflowIntoComfy,
            tsDeleteWorkflowFile,
            tsDebounce,
            tsClamp,
            tsFormatBytes,
            tsResolveOpenableURL,
            tsOpenDownload,
            tsOpenAssetInNewTab,
            tsBuildFolderTree,
            tsSplitRelativePath,
            tsBuildAssetFetchPath,
            tsGetRelativeAssetPath,
            tsResolveNodeComfyClass,
            tsIsGraphPointInsideNode,
        };`,
        tsContext,
        { filename: tsApiPath },
    );
    return tsContext.__apiExports;
}

function tsRunPathTests(tsApiExports) {
    tsEqual(tsApiExports.tsNormalizeRelativePath("\\foo/bar\\baz.json/"), "foo/bar/baz.json", "relative path normalizes slashes and trims edges");
    tsEqual(tsApiExports.tsNormalizeRelativePath(""), "", "empty relative path stays empty");
    tsEqual(tsApiExports.tsBuildUserdataFilePath("workflows/Live Portrait Video.webp"), "/userdata/workflows%2FLive%20Portrait%20Video.webp", "userdata path encodes the normalized relative path");
    tsEqual(tsApiExports.tsBuildUserdataFileURL("workflows/a b.json"), "/api/userdata/workflows%2Fa%20b.json", "userdata URL goes through apiURL");
    tsEqual(tsApiExports.tsGetPathExtension("Folder/File.WEBP"), ".webp", "extension is lowercase");
    tsEqual(tsApiExports.tsGetPathStem("Folder/File.Name.json"), "File.Name", "stem preserves dots before extension");
    tsEqual(tsApiExports.tsGetParentFolderPath("workflows/Sub Folder/My Flow.json"), "workflows/Sub Folder", "parent folder preserves spaces");
    tsEqual(tsApiExports.tsToWorkflowBrowserFolderPath("workflows/Sub/Deep/My Flow.json"), "Sub/Deep", "workflow browser folder strips userdata root and filename");
    tsEqual(tsApiExports.tsToWorkflowBrowserFolderPath("other/My Flow.json"), "", "workflow browser folder rejects non-workflow root");
    tsEqual(tsApiExports.tsToWorkflowStorePath("workflows/Sub/My Flow.json"), "Sub/My Flow.json", "workflow store path strips workflows prefix");
    tsEqual(tsApiExports.tsToWorkflowStorePath("Sub/My Flow.json"), "Sub/My Flow.json", "workflow store path leaves already-relative paths unchanged");
}

function tsRunFormattingTests(tsApiExports) {
    tsEqual(tsApiExports.tsParseModifiedEpoch(1234.9), 1234, "numeric modified time is floored");
    tsEqual(tsApiExports.tsParseModifiedEpoch("2026-04-20T10:20:30Z"), 1776680430, "ISO modified time becomes epoch seconds");
    tsEqual(tsApiExports.tsParseModifiedEpoch("not a date"), 0, "invalid modified time becomes zero");
    tsEqual(tsApiExports.tsClamp(12, 0, 10), 10, "clamp caps high values");
    tsEqual(tsApiExports.tsClamp(-1, 0, 10), 0, "clamp caps low values");
    tsEqual(tsApiExports.tsFormatBytes(0), "0 B", "zero bytes label");
    tsEqual(tsApiExports.tsFormatBytes(1536), "1.5 KB", "kilobytes label");
    tsEqual(tsApiExports.tsFormatBytes(5 * 1024 * 1024), "5.0 MB", "megabytes label");
}

function tsRunDebounceTests(tsHelperExports) {
    const tsClearedTimeouts = [];
    const tsScheduledTimeouts = [];
    const tsCalls = [];
    const tsApiExports = tsBuildApiHarness({
        clearTimeout: (tsTimeoutId) => {
            tsClearedTimeouts.push(tsTimeoutId);
        },
        setTimeout: (tsCallback, tsWaitMs) => {
            tsScheduledTimeouts.push({ tsCallback, tsWaitMs });
            return tsScheduledTimeouts.length;
        },
    }, tsHelperExports);
    const tsDebounced = tsApiExports.tsDebounce((...tsArgs) => {
        tsCalls.push(tsArgs);
    }, 123);
    tsDebounced("first");
    tsDebounced("second", "value");
    tsEqual(tsClearedTimeouts, [0, 1], "debounce clears the previous timeout id before scheduling");
    tsEqual(tsScheduledTimeouts.map((tsEntry) => tsEntry.tsWaitMs), [123, 123], "debounce schedules with the requested wait time");
    tsEqual(tsCalls, [], "debounce does not call synchronously when setTimeout is deferred");
    tsScheduledTimeouts[1].tsCallback();
    tsEqual(tsCalls, [["second", "value"]], "debounce callback receives the latest arguments");
}

async function tsRunWorkflowLibraryTests(tsHelperExports) {
    const tsEntries = [
        { type: "directory", path: "workflows/Sub", name: "Sub" },
        { type: "file", path: "workflows/Live Portrait Video.webp", name: "Live Portrait Video.webp", size: 111, modified: "2026-04-20T10:20:30Z" },
        { type: "file", path: "workflows/Live Portrait Video.json", name: "Live Portrait Video.json", size: 222, modified: "2026-04-20T10:20:30Z" },
        { type: "file", path: "workflows/Sub/Deep Flow.mp4", name: "Deep Flow.mp4", size: 333, modified: 77 },
        { type: "file", path: "workflows/Sub/Deep Flow.json", name: "Deep Flow.json", size: 444, modified: 88 },
        { type: "file", path: "other/Outside.json", name: "Outside.json", size: 555, modified: 99 },
        { type: "file", path: "workflows/Sub/Unmatched.txt", name: "Unmatched.txt", size: 666, modified: 100 },
    ];
    const tsFetchCalls = [];
    const tsApiExports = tsBuildApiHarness({
        fetchApi: async (tsPath) => {
            tsFetchCalls.push(tsPath);
            return tsBuildResponse(tsEntries);
        },
    }, tsHelperExports);
    const tsLibrary = await tsApiExports.tsFetchWorkflowBrowserLibrary();
    tsEqual(tsFetchCalls, ["/v2/userdata?path=workflows"], "workflow library requests userdata workflows root");
    tsEqual(tsLibrary.map((tsItem) => tsItem.filename), ["Live Portrait Video.json", "Deep Flow.json"], "workflow library keeps only workflow JSON files sorted by path");
    tsEqual(tsLibrary[0].preview_url, "/api/userdata/workflows%2FLive%20Portrait%20Video.webp", "workflow preview with spaces is matched by stem");
    tsEqual(tsLibrary[0].preview_kind, "image", "image preview is preferred");
    tsEqual(tsLibrary[0].folder_path, "", "root workflow folder is empty");
    tsEqual(tsLibrary[0].modified_at, 1776680430, "workflow modified date is parsed");
    tsEqual(tsLibrary[1].preview_url, "/api/userdata/workflows%2FSub%2FDeep%20Flow.mp4", "video preview sidecar is supported");
    tsEqual(tsLibrary[1].preview_kind, "video", "video preview kind is preserved");
    tsEqual(tsLibrary[1].folder_path, "Sub", "workflow subfolder is relative to workflows root");
}

async function tsRunWorkflowLoadTests(tsHelperExports) {
    const tsLoadCalls = [];
    const tsApiExports = tsBuildApiHarness({
        getUserData: async (tsPath) => tsBuildResponse({ nodes: [], path: tsPath }),
        loadGraphData: async (...tsArgs) => {
            tsLoadCalls.push(tsArgs);
        },
    }, tsHelperExports);
    const tsLoaded = await tsApiExports.tsLoadWorkflowIntoComfy("workflows/Sub/My Flow.json");
    tsEqual(tsLoaded, true, "workflow load reports success when app.loadGraphData exists");
    tsEqual(tsLoadCalls.length, 1, "workflow load calls app.loadGraphData once");
    tsEqual(tsLoadCalls[0][3], "Sub/My Flow.json", "workflow load passes Comfy store path without workflows prefix");
    tsEqual(tsLoadCalls[0][4], {
        openSource: "workflow_browser",
        deferWarnings: false,
        showMissingModelsDialog: true,
        showMissingNodesDialog: true,
    }, "workflow load preserves native Comfy options");
}

function tsRunFolderTreeTests(tsApiExports) {
    const tsTree = tsApiExports.tsBuildFolderTree(
        [
            { root_id: "output", folder_path: "images", asset_count: 0 },
            { root_id: "output", folder_path: "images/artius", asset_count: 5 },
            { root_id: "output", folder_path: "images/flux", asset_count: 7 },
            { root_id: "output", folder_path: "audio/epidemic", asset_count: 9 },
            { root_id: "input", folder_path: "", asset_count: 2 },
        ],
        [
            { root_id: "output", label: "Output" },
            { root_id: "input", label: "Input" },
        ],
    );
    tsEqual(tsTree.map((tsNode) => tsNode.tsLabel), ["Input", "Output"], "root folders are sorted by label");
    const tsOutput = tsTree.find((tsNode) => tsNode.tsRootId === "output");
    const tsImages = tsOutput.tsChildren.find((tsNode) => tsNode.tsLabel === "images");
    const tsAudio = tsOutput.tsChildren.find((tsNode) => tsNode.tsLabel === "audio");
    tsEqual(tsImages.tsDirectCount, 0, "parent folder direct count can stay zero");
    tsEqual(tsImages.tsCount, 12, "parent folder total count includes child folders");
    tsEqual(tsAudio.tsCount, 9, "nested audio folder count rolls up to parent");
    tsEqual(tsTree.find((tsNode) => tsNode.tsRootId === "input").tsCount, 2, "root direct count is preserved");
}

function tsRunOpenableUrlTests() {
    const tsAppended = [];
    const tsApiExports = tsBuildApiHarness({ appendedElements: tsAppended }, tsHelperExports);
    tsEqual(tsApiExports.tsResolveOpenableURL("/asset_browser/file?id=1"), "/api/asset_browser/file?id=1", "relative backend URL goes through apiURL");
    tsEqual(tsApiExports.tsResolveOpenableURL("/api/view?filename=a.png"), "/api/view?filename=a.png", "api URL is already openable");
    tsEqual(tsApiExports.tsResolveOpenableURL("https://example.test/a.png"), "https://example.test/a.png", "absolute HTTPS URL is already openable");
    tsEqual(tsApiExports.tsOpenAssetInNewTab({ file_url: "/asset_browser/file?id=1" }), true, "open in new tab returns true for assets with file_url");
    tsEqual(tsAppended[0].href, "/api/asset_browser/file?id=1", "new tab link uses resolved URL");
    tsEqual(tsAppended[0].target, "_blank", "new tab link target is blank");
    tsApiExports.tsOpenDownload({ file_url: "/asset_browser/file?id=2", filename: "clip.mov" });
    tsEqual(tsAppended[1].href, "/api/asset_browser/file?id=2", "download link uses resolved URL");
    tsEqual(tsAppended[1].download, "clip.mov", "download link preserves filename");
    tsEqual(tsAppended[1].rel, "noopener", "download link keeps noopener rel");
    tsEqual([tsAppended[1].clickCount, tsAppended[1].removeCount], [1, 1], "download link is clicked and removed");
    tsApiExports.tsOpenDownload({});
    tsEqual(tsAppended.length, 2, "download without file_url does not create a link");
}

function tsRunAssetPathTests(tsApiExports) {
    tsEqual(tsApiExports.tsSplitRelativePath("folder\\sub/file.png"), { tsSubfolder: "folder/sub", tsFilename: "file.png" }, "relative path split normalizes backslashes");
    tsEqual(tsApiExports.tsSplitRelativePath("file.png"), { tsSubfolder: "", tsFilename: "file.png" }, "relative path split handles root file");
    tsEqual(tsApiExports.tsBuildAssetFetchPath({ file_url: "/view?filename=a.png" }), "/view?filename=a.png", "asset fetch path prefers file_url");
    tsEqual(tsApiExports.tsBuildAssetFetchPath({ id: 42 }), "/asset_browser/file?id=42", "asset fetch path falls back to asset id");
    tsEqual(tsApiExports.tsGetRelativeAssetPath({ folder_path: "folder\\sub", filename: "file.png" }), "folder/sub/file.png", "relative asset path joins normalized folder and filename");
    tsEqual(tsApiExports.tsResolveNodeComfyClass({ comfyClass: "LoadImage" }), "LoadImage", "node class prefers comfyClass");
    tsEqual(tsApiExports.tsResolveNodeComfyClass({ constructor: { comfyClass: "LoadVideo" } }), "LoadVideo", "node class falls back to constructor comfyClass");
    tsEqual(tsApiExports.tsIsGraphPointInsideNode({ pos: [10, 20], size: [100, 50] }, 25, 30), true, "bounds check accepts point inside node");
    tsEqual(tsApiExports.tsIsGraphPointInsideNode({ pos: [10, 20], size: [100, 50] }, 200, 30), false, "bounds check rejects point outside node");
}

const tsHelperExports = await tsLoadHelperExports();
const tsApiExports = tsBuildApiHarness({}, tsHelperExports);
tsRunPathTests(tsApiExports);
tsRunFormattingTests(tsApiExports);
tsRunDebounceTests(tsHelperExports);
await tsRunWorkflowLibraryTests(tsHelperExports);
await tsRunWorkflowLoadTests(tsHelperExports);
tsRunFolderTreeTests(tsApiExports);
tsRunOpenableUrlTests();
tsRunAssetPathTests(tsApiExports);

console.log(`frontend api characterization: ${tsAssertions} assertions OK`);
