import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const tsScriptDir = path.dirname(fileURLToPath(import.meta.url));
const tsRepoRoot = path.resolve(tsScriptDir, "..");
const tsViewerPath = path.join(tsRepoRoot, "js", "ts-artius-browser-viewer.js");

const tsViewerSettings = Object.freeze({
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

async function tsLoadOptionalModule(tsRelativePath) {
    const tsAbsolutePath = path.join(tsRepoRoot, tsRelativePath);
    if (!fs.existsSync(tsAbsolutePath)) {
        return {};
    }
    return import(`${pathToFileURL(tsAbsolutePath).href}?ts=${Date.now()}`);
}

async function tsLoadHelperExports() {
    const tsModules = await Promise.all([
        tsLoadOptionalModule("js/ts-artius-browser-viewer-format.js"),
        tsLoadOptionalModule("js/ts-artius-browser-viewer-meta.js"),
        tsLoadOptionalModule("js/ts-artius-browser-viewer-state.js"),
    ]);
    return Object.assign({}, ...tsModules);
}

function tsFormatBytes(tsBytes) {
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

function tsBuildViewerHarness(tsHelperExports) {
    const tsSource = fs.readFileSync(tsViewerPath, "utf8")
        .replace(/import[\s\S]*?;\r?\n/g, "")
        .replace(/\bexport\s+class\s+/g, "class ")
        .replace(/\bexport\s+function\s+/g, "function ");
    const tsContext = {
        console,
        URL,
        HTMLElement: class {
            attachShadow() {
                this.shadowRoot = { innerHTML: "" };
                return this.shadowRoot;
            }
        },
        customElements: {
            define() {},
            get() {
                return null;
            },
        },
        document: {
            body: { append() {} },
            documentElement: { append() {} },
            createElement() {
                return {};
            },
        },
        window: {
            addEventListener() {},
            clearInterval() {},
            clearTimeout() {},
            removeEventListener() {},
            requestAnimationFrame(tsCallback) {
                if (typeof tsCallback === "function") {
                    tsCallback();
                }
                return 1;
            },
            setInterval() {
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
        tsCopyText: async () => true,
        tsDeleteAssetIds: async () => ({}),
        tsFetchAssetDetail: async () => ({}),
        tsFormatBytes,
        tsLoad3DViewerClass: async () => null,
        tsOpenAssetInNewTab: () => true,
        tsOpenDownload: () => {},
        tsResolve3DViewerFileExtension: () => "glb",
        tsViewerSettings,
        ...tsHelperExports,
    };
    vm.createContext(tsContext);
    vm.runInContext(
        `${tsSource}
        globalThis.__viewerExports = {
            TSArtiusBrowserViewer,
            tsFormatTime: typeof tsFormatTime !== "undefined" ? tsFormatTime : globalThis.tsFormatTime,
            tsFormatBitrate: typeof tsFormatBitrate !== "undefined" ? tsFormatBitrate : globalThis.tsFormatBitrate,
        };`,
        tsContext,
        { filename: tsViewerPath },
    );
    return tsContext.__viewerExports;
}

function tsBuildViewerProbe(tsViewerClass, tsOverrides = {}) {
    const tsProbe = Object.create(tsViewerClass.prototype);
    tsProbe.tsLocale = {
        "label.mono": "MonoLoc",
        "label.stereo": "StereoLoc",
    };
    tsProbe.tsItems = [];
    tsProbe.tsIndex = -1;
    tsProbe.tsCompareItems = [];
    tsProbe.tsGetItems = null;
    tsProbe.tsRequestMore = null;
    tsProbe.tsCanLoadMore = null;
    tsProbe.tsMoreRequestPromise = null;
    tsProbe.tsDetailRequestToken = 0;
    tsProbe.tsRender = () => {};
    Object.assign(tsProbe, tsOverrides);
    return tsProbe;
}

function tsNormalizeMarkup(tsMarkup) {
    return String(tsMarkup || "").replace(/\s+/g, " ").trim();
}

let tsAssertions = 0;

function tsEqual(tsActual, tsExpected, tsMessage) {
    assert.deepEqual(JSON.parse(JSON.stringify(tsActual)), JSON.parse(JSON.stringify(tsExpected)), tsMessage);
    tsAssertions += 1;
}

function tsIncludes(tsText, tsNeedle, tsMessage) {
    assert.ok(tsNormalizeMarkup(tsText).includes(tsNeedle), tsMessage);
    tsAssertions += 1;
}

function tsRunFormatTests(tsExports) {
    tsEqual(tsExports.tsFormatTime(-5), "0:00", "negative time clamps to zero");
    tsEqual(tsExports.tsFormatTime(0), "0:00", "zero time is m:ss");
    tsEqual(tsExports.tsFormatTime(65.9), "1:05", "time floors seconds");
    tsEqual(tsExports.tsFormatTime(3661), "61:01", "time keeps minute-based display");
    tsEqual(tsExports.tsFormatBitrate(0), "", "zero bitrate is hidden");
    tsEqual(tsExports.tsFormatBitrate(999), "999 bps", "sub-kilobit bitrate uses bps");
    tsEqual(tsExports.tsFormatBitrate(1000), "1 kbps", "kilobit bitrate uses kbps");
    tsEqual(tsExports.tsFormatBitrate(1500), "2 kbps", "kbps bitrate rounds to integer");
    tsEqual(tsExports.tsFormatBitrate(1_500_000), "1.50 Mbps", "megabit bitrate uses two decimals");
}

function tsRunChannelLayoutTests(tsViewerClass) {
    const tsProbe = tsBuildViewerProbe(tsViewerClass);
    tsEqual(tsProbe.tsResolveChannelLayoutLabel(1), "MonoLoc", "one channel resolves mono locale");
    tsEqual(tsProbe.tsResolveChannelLayoutLabel(2), "StereoLoc", "two channels resolves stereo locale");
    tsEqual(tsProbe.tsResolveChannelLayoutLabel(6), "6ch", "surround channel count resolves compact label");
    tsEqual(tsProbe.tsResolveChannelLayoutLabel(0), "", "empty channel count stays blank");
}

function tsRunCompareModeTests(tsViewerClass) {
    const tsVideoProbe = tsBuildViewerProbe(tsViewerClass, {
        tsItems: [{ id: 1, type: "video" }],
        tsIndex: 0,
        tsCompareItems: [{ id: 1 }, { id: 2 }],
    });
    tsEqual(tsVideoProbe.tsIsVideoCompareMode(), true, "two selected videos enable video compare");
    tsEqual(tsVideoProbe.tsIsCompareMode(), true, "video compare contributes to generic compare mode");

    const tsVideoThreeProbe = tsBuildViewerProbe(tsViewerClass, {
        tsItems: [{ id: 1, type: "video" }],
        tsIndex: 0,
        tsCompareItems: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    tsEqual(tsVideoThreeProbe.tsIsVideoCompareMode(), false, "three selected videos do not enable compare");

    const tsImageProbe = tsBuildViewerProbe(tsViewerClass, {
        tsItems: [{ id: 1, type: "image" }],
        tsIndex: 0,
        tsCompareItems: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    });
    tsEqual(tsImageProbe.tsIsImageCompareMode(), true, "four selected images enable image compare");
    tsEqual(tsImageProbe.tsIsCompareMode(), true, "image compare contributes to generic compare mode");

    const tsAudioProbe = tsBuildViewerProbe(tsViewerClass, {
        tsItems: [{ id: 1, type: "audio" }],
        tsIndex: 0,
        tsCompareItems: [{ id: 1 }, { id: 2 }],
    });
    tsEqual(tsAudioProbe.tsIsCompareMode(), false, "audio never enters compare mode");
}

function tsRunSyncItemsTests(tsViewerClass) {
    const tsEmptyProbe = tsBuildViewerProbe(tsViewerClass, {
        tsItems: [{ id: 1 }, { id: 2 }],
        tsIndex: 1,
    });
    tsEqual(tsEmptyProbe.tsSyncItemsFromSource(), false, "sync without source function returns false");

    const tsPreferredProbe = tsBuildViewerProbe(tsViewerClass, {
        tsItems: [{ id: 1 }, { id: 2 }],
        tsIndex: 0,
        tsGetItems: () => [{ id: 3 }, { id: 2 }, { id: 4 }],
    });
    tsEqual(tsPreferredProbe.tsSyncItemsFromSource(2), true, "sync with matching preferred id returns true");
    tsEqual(tsPreferredProbe.tsIndex, 1, "sync moves index to preferred item");
    tsEqual(tsPreferredProbe.tsItems, [{ id: 3 }, { id: 2 }, { id: 4 }], "sync replaces items from source");

    const tsClampProbe = tsBuildViewerProbe(tsViewerClass, {
        tsItems: [{ id: 1 }, { id: 2 }],
        tsIndex: 5,
        tsGetItems: () => [{ id: 8 }],
    });
    tsEqual(tsClampProbe.tsSyncItemsFromSource(999), true, "sync with missing preferred id still succeeds");
    tsEqual(tsClampProbe.tsIndex, 0, "sync clamps index to new source length");
}

function tsRunMetaMarkupTests(tsViewerClass) {
    const tsProbe = tsBuildViewerProbe(tsViewerClass);
    const tsImageMarkup = tsProbe.tsBuildImageMetaMarkup({
        type: "image",
        prompt_text: "positive <prompt>",
        negative_prompt_text: "negative",
        workflow_text: "{\"nodes\":[]}",
    });
    tsIncludes(tsImageMarkup, "Positive Prompt", "image markup contains positive prompt title");
    tsIncludes(tsImageMarkup, "positive &lt;prompt&gt;", "image markup escapes positive prompt");
    tsIncludes(tsImageMarkup, "Negative Prompt", "image markup contains negative prompt title");
    tsIncludes(tsImageMarkup, "Copy Workflow", "image markup exposes workflow copy action");

    const tsVideoMarkup = tsProbe.tsBuildTechnicalMetaMarkup({
        type: "video",
        audio_codec_name: "aac",
        audio_channel_layout: "Stereo",
        technical_info: {
            format_name: "QuickTime / MOV",
            width: 1920,
            height: 1080,
            codec_name: "prores",
            fps: 23.976,
            duration: 65.9,
            bit_rate: 1_500_000,
        },
    });
    tsIncludes(tsVideoMarkup, "QuickTime / MOV", "video metadata includes format");
    tsIncludes(tsVideoMarkup, "1920x1080", "video metadata includes resolution");
    tsIncludes(tsVideoMarkup, "PRORES", "video metadata uppercases codec");
    tsIncludes(tsVideoMarkup, "23.98", "video metadata rounds FPS to two decimals");
    tsIncludes(tsVideoMarkup, "AAC / Stereo", "video metadata includes audio track");
    tsIncludes(tsVideoMarkup, "1:05", "video metadata includes duration");
    tsIncludes(tsVideoMarkup, "1.50 Mbps", "video metadata includes bitrate");

    const tsAudioMarkup = tsProbe.tsBuildTechnicalMetaMarkup({
        type: "audio",
        channel_layout: "Mono",
        technical_info: {
            codec_name: "pcm_s16le",
            channels: 1,
            duration: 1,
            bit_rate: 999,
        },
    });
    tsIncludes(tsAudioMarkup, "PCM_S16LE", "audio metadata uppercases codec");
    tsIncludes(tsAudioMarkup, "Mono", "audio metadata includes channel layout");
    tsIncludes(tsAudioMarkup, "999 bps", "audio metadata includes bitrate");

    const tsModelMarkup = tsProbe.tsBuild3DMetaMarkup({
        type: "3d",
        extension: ".glb",
        size_bytes: 1536,
        technical_info: {},
    });
    tsIncludes(tsModelMarkup, "GLB", "3D metadata falls back to extension format");
    tsIncludes(tsModelMarkup, "1.5 KB", "3D metadata includes formatted size");
}

const tsHelperExports = await tsLoadHelperExports();
const tsViewerExports = tsBuildViewerHarness(tsHelperExports);

tsRunFormatTests(tsViewerExports);
tsRunChannelLayoutTests(tsViewerExports.TSArtiusBrowserViewer);
tsRunCompareModeTests(tsViewerExports.TSArtiusBrowserViewer);
tsRunSyncItemsTests(tsViewerExports.TSArtiusBrowserViewer);
tsRunMetaMarkupTests(tsViewerExports.TSArtiusBrowserViewer);

console.log(`frontend viewer characterization: ${tsAssertions} assertions OK`);
