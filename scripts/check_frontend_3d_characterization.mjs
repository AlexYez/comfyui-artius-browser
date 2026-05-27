import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const tsScriptDir = path.dirname(fileURLToPath(import.meta.url));
const tsRepoRoot = path.resolve(tsScriptDir, "..");
const ts3DPath = path.join(tsRepoRoot, "js", "ts-artius-browser-3d.js");
const tsWorkerPath = path.join(tsRepoRoot, "js", "ts-artius-browser-3d-worker.js");

let tsAssertions = 0;

function tsEqual(tsActual, tsExpected, tsMessage) {
    const tsNormalizedActual = tsActual && typeof tsActual === "object"
        ? JSON.parse(JSON.stringify(tsActual))
        : tsActual;
    assert.deepEqual(tsNormalizedActual, tsExpected, tsMessage);
    tsAssertions += 1;
}

function tsStripModuleSyntax(tsSource) {
    return tsSource
        .replace(/^\uFEFF/, "")
        .replace(/^import[\s\S]*?;\r?\n/gm, "")
        .replace(/\bexport\s+async\s+function\s+/g, "async function ")
        .replace(/\bexport\s+function\s+/g, "function ");
}

function tsBuild3DHarness() {
    const tsSource = tsStripModuleSyntax(fs.readFileSync(ts3DPath, "utf8"));
    const tsContext = {
        URL,
        document: {
            body: {
                append() {},
            },
            createElement() {
                return {
                    remove() {},
                    style: {},
                };
            },
        },
        tsFetch3DViewerSupport: async () => ({ available: false }),
        window: {
            location: { origin: "http://127.0.0.1:8188" },
            requestAnimationFrame(tsCallback) {
                tsCallback();
            },
        },
    };
    vm.createContext(tsContext);
    vm.runInContext(
        `${tsSource}
        globalThis.__threeDExports = {
            tsResolve3DViewerClass,
            tsResolve3DViewerFileExtension,
        };`,
        tsContext,
        { filename: ts3DPath },
    );
    return tsContext.__threeDExports;
}

function tsBuildWorkerHarness(tsOptions = {}) {
    const tsSource = tsStripModuleSyntax(fs.readFileSync(tsWorkerPath, "utf8"));
    const tsEventListeners = [];
    const tsContext = {
        URLSearchParams,
        api: {
            addEventListener(tsName, tsCallback) {
                tsEventListeners.push([tsName, tsCallback]);
            },
        },
        document: {
            addEventListener() {},
            hidden: Boolean(tsOptions.documentHidden),
            removeEventListener() {},
        },
        tsBrowserRuntimeSettings: {
            initialRescanDelayMs: 600,
        },
        tsEventListeners,
        tsCapture3DThumbnail: tsOptions.capture3DThumbnail || (async () => ""),
        tsConsoleWarn: tsOptions.consoleWarn || (() => {}),
        tsFetchJSON: tsOptions.fetchJSON || (async () => ({ items: [], has_more: false })),
        tsPanelSettings: {
            threeDThumbnails: {
                backgroundPageSize: 8,
                captureSize: 480,
                warmFrames: 2,
            },
        },
        tsRouteBase: "/asset_browser",
        tsSave3DThumbnail: tsOptions.save3DThumbnail || (async () => {}),
        window: {
            addEventListener() {},
            clearTimeout() {},
            setTimeout(tsCallback) {
                if (typeof tsCallback === "function" && tsOptions.runTimersImmediately) {
                    tsCallback();
                }
                return 1;
            },
            removeEventListener() {},
        },
    };
    vm.createContext(tsContext);
    vm.runInContext(
        `${tsSource}
        globalThis.__workerExports = {
            TSGlobal3DThumbnailWorker,
            tsStartGlobal3DThumbnailWorker,
            tsEventListeners,
        };`,
        tsContext,
        { filename: tsWorkerPath },
    );
    return tsContext.__workerExports;
}

function tsRun3DHelperTests() {
    const ts3DExports = tsBuild3DHarness();
    class TsLoad3d {}
    tsEqual(ts3DExports.tsResolve3DViewerClass({ Load3d: TsLoad3d }), TsLoad3d, "3D viewer class resolves named Load3d export");
    tsEqual(ts3DExports.tsResolve3DViewerClass({ n: TsLoad3d }), TsLoad3d, "3D viewer class resolves minified n export");
    tsEqual(ts3DExports.tsResolve3DViewerClass({ default: { Load3d: TsLoad3d } }), TsLoad3d, "3D viewer class resolves default Load3d export");
    tsEqual(ts3DExports.tsResolve3DViewerFileExtension("/view?filename=models%2FAsset.GLB"), "glb", "3D viewer extension resolves from encoded filename");
    tsEqual(ts3DExports.tsResolve3DViewerFileExtension("/view?filename=models/Asset With Spaces.FBX"), "fbx", "3D viewer extension lowercases filenames with spaces");
    tsEqual(ts3DExports.tsResolve3DViewerFileExtension("/view?filename=models/no_extension"), "models/no_extension", "3D viewer extension preserves current no-dot behavior");
    tsEqual(ts3DExports.tsResolve3DViewerFileExtension("::::"), null, "3D viewer extension returns null for malformed URLs");
}

async function tsRun3DWorkerTests() {
    const tsWorkerExports = tsBuildWorkerHarness();
    const tsWorker = new tsWorkerExports.TSGlobal3DThumbnailWorker();
    tsEqual(tsWorker.tsBuildSearchPath(), "/asset_browser/search?limit=8&view=flat&sort=created_at&order=desc&types=3d", "3D worker search path omits cursor on first page");
    tsEqual(tsWorker.tsBuildSearchPath(null), "/asset_browser/search?limit=8&view=flat&sort=created_at&order=desc&types=3d", "3D worker search path omits cursor when null");
    tsEqual(tsWorker.tsBuildSearchPath({ sort_value: 1700000000, id: 42 }), "/asset_browser/search?limit=8&view=flat&sort=created_at&order=desc&types=3d&after_sort=1700000000&after_id=42", "3D worker search path forwards keyset cursor");
    tsEqual(tsWorker.tsBuildSearchPath({ sort_value: 1700000000 }), "/asset_browser/search?limit=8&view=flat&sort=created_at&order=desc&types=3d", "3D worker search path drops partial cursor without id");

    const tsScheduledReasons = [];
    tsWorker.tsScheduleRun = async (tsReason) => {
        tsScheduledReasons.push(tsReason);
        return true;
    };
    tsWorker.tsHandleScanEvent({ detail: { status: { running: true, completed_at: 10 } } });
    tsWorker.tsHandleScanEvent({ detail: { status: { running: false, completed_at: 10 } } });
    tsWorker.tsHandleScanEvent({ detail: { status: { running: false, completed_at: 10 } } });
    tsWorker.tsHandleScanEvent({ detail: { status: { running: false, completed_at: 11 } } });
    tsEqual(tsScheduledReasons, ["scan-complete", "scan-complete"], "3D worker schedules once per completed scan timestamp");

    const tsCaptureCalls = [];
    const tsSaveCalls = [];
    const tsWorkerWithCapture = new (tsBuildWorkerHarness({
        capture3DThumbnail: async (tsViewerURL, tsOptions) => {
            tsCaptureCalls.push([tsViewerURL, tsOptions]);
            return "data:image/png;base64,thumb";
        },
        save3DThumbnail: async (tsAssetId, tsImageDataURL) => {
            tsSaveCalls.push([tsAssetId, tsImageDataURL]);
        },
    }).TSGlobal3DThumbnailWorker)();

    tsEqual(await tsWorkerWithCapture.tsProcessAsset({ type: "image" }), false, "3D worker skips non-3D assets");
    tsEqual(await tsWorkerWithCapture.tsProcessAsset({
        type: "3d",
        viewer_3d_url: "/view?filename=a.glb",
        preview_is_3d_capture: true,
        preview_is_placeholder: false,
    }), false, "3D worker skips completed captured previews");
    tsEqual(await tsWorkerWithCapture.tsProcessAsset({
        id: 7,
        type: "3d",
        viewer_3d_url: "/view?filename=a.glb",
        preview_is_3d_capture: false,
        preview_is_placeholder: true,
    }), true, "3D worker captures missing 3D thumbnail");
    tsEqual(tsCaptureCalls, [["/view?filename=a.glb", { width: 480, height: 480, warmFrames: 2 }]], "3D worker passes thumbnail capture settings");
    tsEqual(tsSaveCalls, [[7, "data:image/png;base64,thumb"]], "3D worker saves captured thumbnail");

    const tsRequestedURLs = [];
    const tsCompletedAsset = {
        type: "3d",
        viewer_3d_url: "/view?filename=a.glb",
        preview_is_3d_capture: true,
        preview_is_placeholder: false,
    };
    const tsPaginatedHarness = tsBuildWorkerHarness({
        fetchJSON: async (tsURL) => {
            tsRequestedURLs.push(tsURL);
            if (tsRequestedURLs.length === 1) {
                return {
                    items: [tsCompletedAsset],
                    has_more: true,
                    next_cursor: { sort_value: 1700000000, id: 99 },
                };
            }
            return { items: [tsCompletedAsset], has_more: false, next_cursor: null };
        },
    });
    const tsPaginatedWorker = new tsPaginatedHarness.TSGlobal3DThumbnailWorker();
    await tsPaginatedWorker.tsRun("test");
    tsEqual(tsRequestedURLs, [
        "/asset_browser/search?limit=8&view=flat&sort=created_at&order=desc&types=3d",
        "/asset_browser/search?limit=8&view=flat&sort=created_at&order=desc&types=3d&after_sort=1700000000&after_id=99",
    ], "3D worker walks pages via next_cursor and stops when has_more is false");
}

tsRun3DHelperTests();
await tsRun3DWorkerTests();

console.log(`frontend 3d characterization: ${tsAssertions} assertions OK`);
