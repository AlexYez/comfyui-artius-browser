import {
    tsApiURL,
    tsCopyText,
    tsDeleteAssetIds,
    tsEscapeAttribute,
    tsEscapeHTML,
    tsFetchAssetDetail,
    tsFormatBytes,
    tsOpenAssetInNewTab,
    tsOpenDownload,
    tsRevealAssetInFolder,
    tsShowToast,
} from "./ts-artius-browser-api.js";
import {
    tsLoad3DViewerClass,
    tsResolve3DViewerFileExtension,
    tsResolveLoadedObject3D,
} from "./ts-artius-browser-3d.js";
import { tsFormatTime } from "./ts-artius-browser-viewer-format.js";
import {
    tsBuild3DMetaMarkup,
    tsBuildImageMetaMarkup,
    tsBuildImageTechnicalMarkup,
    tsBuildPromptMetaBlock,
    tsBuildPromptSeedMetaMarkup,
    tsBuildTechnicalMetaMarkup,
    tsResolveChannelLayoutLabel,
} from "./ts-artius-browser-viewer-meta.js";
import {
    tsIsOnLastFrame,
    tsIsViewerTypedCompareMode,
    tsResolveCarriedVideoTime,
    tsResolveCompareSyncCorrection,
    tsResolveLastFrameTime,
    tsResolveWheelZoomFactor,
    tsResolveVideoFrameIndex,
    tsResolveVideoFrameTime,
    tsSyncViewerItemsFromSource,
} from "./ts-artius-browser-viewer-state.js";
import { tsBuildStageMarkup, tsResolveDisplayURL } from "./ts-artius-browser-viewer-stage.js";
import { tsResolveDeleteOutcome } from "./ts-artius-browser-panel-selection.js";
import { tsViewerSettings } from "./ts-artius-browser-settings.js";

// Detaching a <video>/<audio> element from the DOM does not, by itself,
// release the decoded frames, buffered network data, and media-pipeline
// memory the browser holds for it: that survives until the element is GC'd,
// and an element that still has a live `src` can keep buffering in the
// meantime. Across a long session of opening clips in the lightbox this
// accumulates and is a prime suspect for the renderer "Out of Memory" crash.
// Pausing, clearing the source, and calling load() forces the browser to free
// those resources immediately on stage teardown (CLAUDE.md section 8
// teardown contract).
function tsReleaseMediaSource(tsMedia) {
    if (!tsMedia) {
        return;
    }
    try {
        tsMedia.pause();
    } catch {
        // no-op
    }
    try {
        tsMedia.removeAttribute("src");
        tsMedia.load();
    } catch {
        // no-op
    }
}

// Volume and mute carry over from clip to clip. Every clip used to start at
// full volume and unmuted, whatever the user had just set.
const TS_LIGHTBOX_VOLUME_STORAGE_KEY = "tsArtiusBrowser.lightboxVolume";

function tsReadStoredVolume() {
    try {
        const tsStored = JSON.parse(window.localStorage.getItem(TS_LIGHTBOX_VOLUME_STORAGE_KEY) || "null");
        const tsVolume = Number(tsStored?.volume);
        if (Number.isFinite(tsVolume) && tsVolume >= 0 && tsVolume <= 1) {
            return { tsVolume, tsMuted: Boolean(tsStored.muted) };
        }
    } catch {
        // Storage unavailable (private mode, blocked): defaults apply.
    }
    return null;
}

function tsStoreVolume(tsMedia) {
    try {
        window.localStorage.setItem(
            TS_LIGHTBOX_VOLUME_STORAGE_KEY,
            JSON.stringify({ volume: Number(tsMedia.volume), muted: Boolean(tsMedia.muted) }),
        );
    } catch {
        // no-op
    }
}

// Whether players start again at the end. Off by default: a clip that always
// restarted never let anyone look at its last frame, which is the frame that
// matters most when generations are compared. One preference for the single
// player, the compare stage and audio.
const TS_LIGHTBOX_LOOP_STORAGE_KEY = "tsArtiusBrowser.lightboxLoop";

function tsReadLoopPreference() {
    try {
        return window.localStorage.getItem(TS_LIGHTBOX_LOOP_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function tsStoreLoopPreference(tsLoop) {
    try {
        window.localStorage.setItem(TS_LIGHTBOX_LOOP_STORAGE_KEY, tsLoop ? "1" : "0");
    } catch {
        // no-op
    }
}

function tsRenderLoopButton(tsButton, tsLoop) {
    if (tsButton) {
        tsButton.setAttribute("aria-pressed", String(Boolean(tsLoop)));
    }
}

// The converted copy of an asset, requested even when the codec list said the
// browser could manage: it is what the lightbox falls back to when the file
// then fails to play (10-bit H.264, HEVC without hardware decoding...).
function tsBuildForcedDisplayURL(tsAsset) {
    let tsToken = "";
    try {
        tsToken = new URL(String(tsAsset?.file_url || ""), "http://local").searchParams.get("v") || "";
    } catch {
        tsToken = "";
    }
    return `/asset_browser/display/${encodeURIComponent(String(tsAsset?.id ?? ""))}?proxy=1&v=${encodeURIComponent(tsToken)}`;
}

export class TSArtiusBrowserViewer extends HTMLElement {
    constructor() {
        super();
        this.tsLocale = {};
        this.tsItems = [];
        this.tsIndex = -1;
        this.tsOnChange = null;
        this.tsGetItems = null;
        this.tsRequestMore = null;
        this.tsCanLoadMore = null;
        this.tsMoreRequestPromise = null;
        this.tsStageCleanup = null;
        this.tsVideoFrameStepper = null;
        this.tsImageZoomHandler = null;
        this.tsCompareItems = [];
        this.tsDetailRequestToken = 0;
        // Decoded-image warm set + the guard that keeps a slow decode from
        // painting over a newer navigation (see tsWarmImage / tsNavigate).
        this.tsImageWarmCache = new Map();
        this.tsStageRenderToken = 0;
        // Markup the stage was last built from, and the fading copy of the
        // previous picture (see tsRender / tsLiftStageGhost).
        this.tsStageMarkup = "";
        this.tsStageGhost = null;
        this.tsBoundKeydown = (tsEvent) => this.tsHandleWindowKeydown(tsEvent);
        this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
        if (this.tsConnectedOnce) {
            return;
        }
        this.tsConnectedOnce = true;
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    inset: 0;
                    z-index: 2140;
                    pointer-events: none;
                    --ts-accent: var(--p-button-primary-background, var(--theme-color, var(--input-text, var(--fg-color, currentColor))));
                    --ts-accent-contrast: var(--p-button-primary-color, var(--comfy-menu-bg, var(--bg-color, inherit)));
                    --ts-bg-0: var(--comfy-menu-bg, var(--bg-color, transparent));
                    --ts-bg-1: var(--comfy-input-bg, var(--comfy-menu-bg, var(--ts-bg-0)));
                    --ts-bg-2: var(--content-bg, var(--comfy-menu-secondary-bg, var(--ts-bg-1)));
                    --ts-border: var(--border-color, color-mix(in srgb, var(--input-text, var(--fg-color, currentColor)) 16%, transparent));
                    --ts-text: var(--input-text, var(--fg-color, inherit));
                    --ts-text-muted: var(--descrip-text, color-mix(in srgb, var(--ts-text) 72%, transparent));
                    --ts-backdrop: color-mix(in srgb, var(--ts-bg-0) 84%, transparent);
                    --ts-backdrop-strong: color-mix(in srgb, var(--ts-bg-0) 76%, transparent);
                    --ts-surface-ghost: color-mix(in srgb, var(--ts-text) 4%, transparent);
                    --ts-status-surface: color-mix(in srgb, var(--ts-bg-0) 78%, transparent);
                    --ts-nav-surface: color-mix(in srgb, var(--ts-bg-0) 82%, transparent);
                    --ts-playhead-shadow: color-mix(in srgb, var(--ts-bg-0) 24%, transparent);
                }
                .ts-viewer {
                    position: absolute;
                    inset: 0;
                    display: none;
                    background: var(--ts-backdrop);
                    backdrop-filter: blur(8px);
                    color: var(--ts-text);
                    pointer-events: auto;
                }
                .ts-viewer[data-open="true"] {
                    display: grid;
                    grid-template-rows: auto 1fr auto;
                }
                .ts-viewer[data-compare="true"] {
                    grid-template-rows: 1fr;
                }
                .ts-viewer[data-compare="true"] .ts-head,
                .ts-viewer[data-compare="true"] .ts-meta {
                    display: none;
                }
                .ts-viewer[data-compare="true"] .ts-body {
                    grid-template-columns: minmax(0, 1fr);
                    min-height: 100dvh;
                }
                .ts-viewer[data-compare="true"] .ts-stage-wrap {
                    min-height: 100dvh;
                }
                .ts-viewer[data-compare="true"] .ts-stage {
                    align-items: stretch;
                    padding: 8px 14px 10px;
                }
                .ts-compare-close {
                    position: absolute;
                    top: 14px;
                    right: 16px;
                    z-index: 20;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    width: 46px;
                    min-width: 46px;
                    height: 46px;
                    min-height: 46px;
                    padding: 0;
                    border-radius: 14px;
                    font-size: 26px;
                    line-height: 1;
                    background: color-mix(in srgb, var(--ts-bg-0) 84%, transparent);
                    backdrop-filter: blur(6px);
                }
                .ts-viewer[data-compare="true"] .ts-compare-close {
                    display: flex;
                }
                .ts-head {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 18px;
                    border-bottom: 1px solid var(--ts-border);
                    background: color-mix(in srgb, var(--ts-bg-1) 92%, transparent);
                }
                .ts-title {
                    font: 600 14px/1.35 inherit;
                }
                .ts-subtitle {
                    font: 500 11px/1.35 inherit;
                    color: var(--ts-text-muted);
                }
                .ts-actions,
                .ts-meta-row {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                button {
                    border: 1px solid var(--ts-border);
                    background: var(--ts-bg-2);
                    color: inherit;
                    border-radius: 8px;
                    padding: 8px 12px;
                    min-height: 34px;
                    cursor: pointer;
                    transition: background 140ms ease, border-color 140ms ease, opacity 140ms ease;
                }
                button:hover {
                    border-color: var(--ts-accent);
                    background: color-mix(in srgb, var(--ts-accent) 18%, var(--ts-bg-2));
                }
                button[disabled] {
                    opacity: 0.45;
                    cursor: default;
                }
                .ts-body {
                    display: grid;
                    grid-template-columns: 1fr minmax(280px, 360px);
                    min-height: 0;
                }
                .ts-stage-wrap {
                    position: relative;
                    min-height: 0;
                    display: flex;
                    align-items: stretch;
                    justify-content: stretch;
                    background: var(--ts-bg-0);
                }
                .ts-stage {
                    position: relative;
                    min-height: 0;
                    flex: 1 1 auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 18px 64px;
                    background: var(--ts-bg-0);
                }
                .ts-stage[data-kind="audio"] {
                    justify-content: center;
                }
                .ts-stage[data-image-zoomable="true"] {
                    overflow: hidden;
                    /* The pinch and pan are ours: without this a touch screen
                       zooms or scrolls the whole page instead. */
                    touch-action: none;
                }
                .ts-stage img,
                .ts-stage video,
                .ts-stage model-viewer {
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: auto;
                    border-radius: 12px;
                    background: var(--ts-bg-2);
                }
                .ts-3d-shell {
                    position: relative;
                    width: min(100%, 1180px);
                    height: min(100%, 72vh);
                    min-height: 360px;
                    border-radius: 14px;
                    overflow: hidden;
                    background: var(--ts-bg-2);
                    border: 1px solid var(--ts-border);
                }
                .ts-3d-viewer-host,
                .ts-3d-fallback {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                }
                .ts-3d-viewer-host > * {
                    width: 100%;
                    height: 100%;
                }
                .ts-3d-fallback {
                    object-fit: contain;
                    background: var(--ts-bg-2);
                }
                .ts-3d-shell[data-ready="true"] .ts-3d-fallback {
                    display: none;
                }
                .ts-3d-status {
                    position: absolute;
                    left: 14px;
                    bottom: 14px;
                    z-index: 2;
                    padding: 8px 10px;
                    border-radius: 999px;
                    font: 600 11px/1.2 inherit;
                    color: var(--ts-text);
                    background: var(--ts-status-surface);
                    border: 1px solid var(--ts-border);
                    backdrop-filter: blur(6px);
                }
                .ts-3d-shell[data-ready="true"] .ts-3d-status {
                    display: none;
                }
                .ts-stage[data-image-zoomable="true"] img {
                    transform-origin: center center;
                    transition: transform 110ms ease;
                    will-change: transform;
                    user-select: none;
                    -webkit-user-drag: none;
                    cursor: zoom-in;
                }
                /* Outgoing picture during a crossfade (tsLiftStageGhost). Under
                   the nav buttons, over the stage, never a pointer target. */
                .ts-stage-ghost {
                    position: absolute;
                    z-index: 2;
                    overflow: hidden;
                    pointer-events: none;
                    opacity: 1;
                    transition-property: opacity;
                    transition-timing-function: ease-in-out;
                }
                .ts-stage-ghost[data-fading="true"] {
                    opacity: 0;
                }
                .ts-stage-ghost-frame {
                    position: absolute;
                    transform-origin: center center;
                }
                .ts-stage-ghost-frame img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    border-radius: 12px;
                    background: var(--ts-bg-2);
                }
                .ts-stage[data-image-zoomable="true"][data-can-zoom="false"] img {
                    cursor: default;
                }
                .ts-stage[data-image-zoomable="true"][data-zoomed="true"] img {
                    cursor: grab;
                }
                .ts-stage .ts-image-zoom-indicator {
                    left: 14px;
                    right: auto;
                    bottom: 14px;
                }
                .ts-stage[data-image-zoomable="true"][data-panning="true"] img {
                    cursor: grabbing;
                    transition: none;
                }
                /* Navigator/minimap: shown only while zoomed in, so panning a
                   100% view keeps a sense of where you are in the frame. */
                .ts-image-navigator {
                    position: absolute;
                    right: 14px;
                    bottom: 14px;
                    z-index: 3;
                    width: 148px;
                    max-height: 148px;
                    padding: 0;
                    overflow: hidden;
                    border: 1px solid var(--ts-border);
                    border-radius: 8px;
                    background: var(--ts-bg-2);
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
                    cursor: crosshair;
                    line-height: 0;
                }
                .ts-image-navigator[hidden] {
                    display: none;
                }
                /* Two classes so this wins over ".ts-stage img", which would
                   otherwise cap the thumbnail at the stage box and round it. */
                .ts-stage .ts-image-navigator-image {
                    display: block;
                    width: 100%;
                    height: auto;
                    max-width: 100%;
                    max-height: 148px;
                    object-fit: contain;
                    border-radius: 0;
                    background: transparent;
                    transform: none;
                    transition: none;
                    cursor: crosshair;
                    pointer-events: none;
                    user-select: none;
                    -webkit-user-drag: none;
                }
                .ts-image-navigator-view {
                    position: absolute;
                    top: 0;
                    left: 0;
                    border: 1px solid var(--ts-accent);
                    background: color-mix(in srgb, var(--ts-accent) 18%, transparent);
                    pointer-events: none;
                    will-change: transform;
                }
                .ts-model-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }
                .ts-model-chip {
                    padding: 3px 8px;
                    border: 1px solid var(--ts-border);
                    border-radius: 999px;
                    background: var(--ts-bg-2);
                    font-size: 11px;
                    line-height: 1.3;
                    word-break: break-all;
                }
                .ts-stage-nav {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 3;
                    width: 42px;
                    min-height: 42px;
                    padding: 0;
                    border-radius: 999px;
                    background: var(--ts-nav-surface);
                    backdrop-filter: blur(8px);
                    font-size: 20px;
                    font-weight: 700;
                    line-height: 1;
                }
                .ts-stage-nav-prev {
                    left: 14px;
                }
                .ts-stage-nav-next {
                    right: 14px;
                }
                .ts-meta {
                    border-left: 1px solid var(--ts-border);
                    padding: 16px;
                    overflow: auto;
                    background: var(--ts-bg-1);
                    display: grid;
                    gap: 18px;
                    align-content: start;
                }
                .ts-meta-block {
                    display: grid;
                    gap: 8px;
                }
                .ts-meta-row {
                    justify-content: space-between;
                }
                .ts-meta-row h4 {
                    margin: 0;
                    font: 600 12px/1.3 inherit;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--ts-text-muted);
                }
                .ts-meta-copy {
                    min-height: 28px;
                    padding: 4px 10px;
                    font-size: 11px;
                }
                .ts-prompt,
                .ts-seed,
                .ts-technical-empty {
                    white-space: pre-wrap;
                    word-break: break-word;
                    font: 500 12px/1.6 "Cascadia Code", "Consolas", monospace;
                    color: var(--ts-text);
                    padding: 12px;
                    border: 1px solid var(--ts-border);
                    border-radius: 10px;
                    background: var(--ts-surface-ghost);
                }
                .ts-technical-grid {
                    display: grid;
                    gap: 10px;
                }
                .ts-technical-item {
                    display: grid;
                    gap: 4px;
                    padding: 10px 12px;
                    border: 1px solid var(--ts-border);
                    border-radius: 10px;
                    background: var(--ts-surface-ghost);
                }
                .ts-technical-label {
                    font: 600 11px/1.3 inherit;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--ts-text-muted);
                }
                .ts-technical-value {
                    font: 600 13px/1.45 inherit;
                    color: var(--ts-text);
                    word-break: break-word;
                }
                .ts-image-compare-shell {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    display: grid;
                    min-width: 0;
                    min-height: 0;
                    --ts-wipe: 50%;
                }
                .ts-image-compare-shell img {
                    width: 100%;
                    height: 100%;
                    max-width: none;
                    max-height: none;
                    border-radius: 0;
                    background: transparent;
                    object-fit: contain;
                    user-select: none;
                    -webkit-user-drag: none;
                }
                .ts-image-compare-wipe {
                    position: relative;
                    min-width: 0;
                    min-height: 0;
                    border: 1px solid var(--ts-border);
                    border-radius: 12px;
                    overflow: hidden;
                    background: var(--ts-bg-2);
                    cursor: ew-resize;
                }
                .ts-image-compare-wipe img {
                    position: absolute;
                    inset: 0;
                }
                .ts-image-compare-layer {
                    position: absolute;
                    inset: 0;
                }
                /* The clip lives on the LAYER, never on the image: clip-path is
                   resolved in the element's own coordinate space, so clipping a
                   zoomed image would slide the split away from the divider. */
                .ts-image-compare-after {
                    clip-path: inset(0 calc(100% - var(--ts-wipe)) 0 0);
                    z-index: 1;
                }
                .ts-compare-image {
                    transform-origin: 50% 50%;
                    will-change: transform;
                }
                .ts-image-compare-shell[data-zoomed="true"] .ts-image-compare-wipe {
                    cursor: ew-resize;
                }
                .ts-image-compare-grid[data-zoomed="true"] .ts-image-compare-card {
                    cursor: grab;
                }
                .ts-image-compare-grid[data-panning="true"] .ts-image-compare-card {
                    cursor: grabbing;
                }
                .ts-image-compare-zoom {
                    position: absolute;
                    right: 10px;
                    bottom: 10px;
                    z-index: 4;
                    padding: 3px 8px;
                    border: 1px solid var(--ts-border);
                    border-radius: 999px;
                    background: var(--ts-nav-surface);
                    backdrop-filter: blur(8px);
                    color: var(--ts-text-muted);
                    font: 600 11px/1.3 inherit;
                    pointer-events: none;
                    white-space: nowrap;
                }
                .ts-image-compare-zoom[data-active="false"] {
                    opacity: 0;
                }
                .ts-image-compare-divider {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: var(--ts-wipe);
                    z-index: 2;
                    width: 2px;
                    transform: translateX(-50%);
                    background: var(--ts-accent);
                    box-shadow: 0 0 0 1px var(--ts-playhead-shadow);
                    pointer-events: none;
                }
                .ts-image-compare-divider::after {
                    content: "";
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 28px;
                    height: 28px;
                    border: 1px solid var(--ts-border);
                    border-radius: 999px;
                    transform: translate(-50%, -50%);
                    background: var(--ts-nav-surface);
                    backdrop-filter: blur(8px);
                    box-shadow: 0 8px 24px var(--ts-playhead-shadow);
                }
                .ts-image-compare-range {
                    position: absolute;
                    inset: 0;
                    z-index: 3;
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    opacity: 0;
                    cursor: ew-resize;
                    touch-action: none;
                }
                .ts-image-compare-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                    min-width: 0;
                    min-height: 0;
                }
                /* Same reason as the video grid: 2+1 would render the odd
                   image at twice the width of the other two. */
                .ts-image-compare-grid[data-count="3"] {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .ts-image-compare-card {
                    min-width: 0;
                    min-height: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--ts-border);
                    border-radius: 12px;
                    overflow: hidden;
                    background: var(--ts-bg-2);
                }
                .ts-video-compare-shell {
                    width: min(100%, 1560px);
                    margin: 0 auto;
                    display: grid;
                    gap: 8px;
                    align-items: center;
                    justify-self: stretch;
                }
                .ts-video-compare-grid {
                    display: grid;
                    gap: 8px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .ts-video-compare-shell[data-count="2"] .ts-video-compare-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                /* Three clips sit in one row: a 2+1 grid would give the odd
                   clip twice the width of the other two and make the sizes
                   incomparable, which is the whole point of the mode. */
                .ts-video-compare-shell[data-count="3"] .ts-video-compare-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .ts-video-compare-shell[data-count="4"] .ts-video-compare-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .ts-video-compare-card {
                    display: grid;
                    gap: 4px;
                    min-width: 0;
                }
                .ts-video-compare-card[data-primary="true"] .ts-video-compare-label {
                    border-color: var(--ts-accent);
                }
                .ts-video-compare-label {
                    padding: 4px 8px;
                    border: 1px solid var(--ts-border);
                    border-radius: 10px;
                    background: var(--ts-surface-ghost);
                    color: var(--ts-text);
                    width: fit-content;
                    max-width: 100%;
                    justify-self: center;
                    font: 600 9px/1.2 inherit;
                    text-align: center;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .ts-video-compare-video {
                    width: 100%;
                    max-height: min(78vh, calc(100dvh - 120px));
                    justify-self: center;
                }
                .ts-video-compare-shell[data-count="2"] .ts-video-compare-video {
                    max-height: min(78vh, calc(100dvh - 120px));
                }
                .ts-video-compare-shell[data-count="3"] .ts-video-compare-video {
                    max-height: min(70vh, calc(100dvh - 140px));
                }
                .ts-video-compare-shell[data-count="4"] .ts-video-compare-video {
                    max-height: min(35vh, calc((100dvh - 160px) / 2));
                }
                .ts-video-compare-status {
                    min-height: 14px;
                    text-align: center;
                    color: var(--ts-text-muted);
                    font: 500 11px/1.3 inherit;
                }
                .ts-video-compare-status[data-active="false"] {
                    visibility: hidden;
                }
                .ts-video-compare-controls {
                    width: min(100%, 1040px);
                    margin: 0 auto;
                    display: grid;
                    gap: 6px;
                }
                .ts-video-transport {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto auto auto;
                    gap: 6px;
                    align-items: center;
                }
                .ts-video-play-toggle,
                .ts-video-mute,
                .ts-video-transport .ts-video-loop {
                    min-height: 30px;
                    min-width: 82px;
                    padding: 5px 10px;
                    font-size: 11px;
                }
                .ts-video-mute[aria-pressed="true"],
                .ts-media-loop[aria-pressed="true"] {
                    border-color: var(--ts-accent);
                    color: var(--ts-text);
                    background: color-mix(in srgb, var(--ts-accent) 22%, transparent);
                }
                .ts-video-step.ts-video-edge {
                    min-width: 36px;
                    font-size: 15px;
                    line-height: 1;
                }
                /* The wipe slider is an invisible range over the picture;
                   with keyboard focus the divider itself lights up, or Tab
                   landed nowhere visible. */
                .ts-image-compare-wipe:has(.ts-image-compare-range:focus-visible) .ts-image-compare-divider {
                    width: 4px;
                    box-shadow: 0 0 0 2px var(--ts-accent);
                }
                .ts-3d-retry {
                    position: absolute;
                    right: 14px;
                    bottom: 14px;
                    z-index: 3;
                }
                .ts-3d-retry[hidden] {
                    display: none;
                }
                .ts-video-seek {
                    width: 100%;
                    margin: 0;
                    accent-color: var(--ts-accent);
                }
                .ts-video-time {
                    min-width: 96px;
                    text-align: right;
                    color: var(--ts-text-muted);
                    font: 500 11px/1.3 inherit;
                    white-space: nowrap;
                }
                .ts-video-stepper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .ts-video-shell {
                    width: min(100%, 1180px);
                    margin: 0 auto;
                    display: grid;
                    gap: 12px;
                    align-items: center;
                    justify-self: stretch;
                }
                .ts-video-shell video {
                    width: 100%;
                    max-height: min(72vh, calc(100vh - 260px));
                    justify-self: center;
                }
                .ts-video-controls {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .ts-video-step {
                    min-height: 30px;
                    padding: 6px 10px;
                    font-size: 12px;
                }
                .ts-video-frame {
                    min-width: 120px;
                    text-align: center;
                    padding: 6px 10px;
                    border: 1px solid var(--ts-border);
                    border-radius: 10px;
                    background: var(--ts-surface-ghost);
                    color: var(--ts-text);
                    font: 600 12px/1.4 "Cascadia Code", "Consolas", monospace;
                }
                .ts-audio-shell {
                    width: min(var(--ts-audio-shell-max-width, 1600px), 100%);
                    margin: 0 auto;
                    display: grid;
                    gap: 14px;
                    align-items: center;
                    justify-self: stretch;
                }
                .ts-audio-waveform-shell {
                    position: relative;
                    width: 100%;
                    height: min(var(--ts-audio-waveform-max-height, 360px), 38vh);
                    border: 1px solid var(--ts-border);
                    border-radius: 12px;
                    overflow: hidden;
                    background: var(--ts-bg-2);
                    cursor: pointer;
                    user-select: none;
                    touch-action: none;
                }
                .ts-audio-waveform-image {
                    position: absolute;
                    inset: 0;
                    background-position: center;
                    background-repeat: no-repeat;
                    background-size: 100% 100%;
                    pointer-events: none;
                }
                .ts-audio-progress {
                    position: absolute;
                    inset: 0 auto 0 0;
                    width: 0%;
                    background: color-mix(in srgb, var(--ts-accent) 26%, transparent);
                    pointer-events: none;
                }
                .ts-audio-playhead {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 0%;
                    width: 2px;
                    background: var(--ts-accent);
                    box-shadow: 0 0 0 1px var(--ts-playhead-shadow);
                    pointer-events: none;
                }
                .ts-audio-controls {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .ts-audio-time {
                    color: var(--ts-text-muted);
                    font: 500 12px/1.4 inherit;
                    min-width: 110px;
                    text-align: right;
                }
                .ts-audio-element {
                    display: none;
                }
                /* Opens and closes with a short fade instead of popping. */
                @keyframes ts-viewer-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes ts-viewer-out {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                .ts-viewer[data-open="true"] {
                    animation: ts-viewer-in 140ms ease-out;
                }
                .ts-viewer[data-open="true"][data-closing="true"] {
                    animation: ts-viewer-out 130ms ease-in forwards;
                    pointer-events: none;
                }
                /* The lightbox's own shortcut card. */
                .ts-help {
                    position: absolute;
                    inset: 0;
                    z-index: 30;
                    display: grid;
                    place-items: center;
                    background: color-mix(in srgb, var(--ts-bg-0) 60%, transparent);
                }
                .ts-help[hidden] {
                    display: none;
                }
                .ts-help-card {
                    width: min(460px, calc(100vw - 32px));
                    max-height: calc(100dvh - 48px);
                    overflow: auto;
                    padding: 16px 18px;
                    border: 1px solid var(--ts-border);
                    border-radius: 14px;
                    background: var(--ts-bg-1);
                    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
                }
                .ts-help-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .ts-help-title {
                    margin: 0;
                    font: 600 14px/1.3 inherit;
                }
                .ts-help-close {
                    min-height: 30px;
                    width: 30px;
                    padding: 0;
                    font-size: 18px;
                }
                .ts-help-body {
                    display: grid;
                    grid-template-columns: minmax(120px, max-content) 1fr;
                }
                .ts-help-row {
                    display: grid;
                    grid-column: 1 / -1;
                    grid-template-columns: subgrid;
                    gap: 12px;
                    padding: 5px 0;
                    font-size: 12px;
                    border-bottom: 1px solid color-mix(in srgb, var(--ts-border) 50%, transparent);
                }
                .ts-help-row kbd {
                    font: 600 11px/1.4 "Cascadia Code", "Consolas", monospace;
                    color: var(--ts-text);
                }
                .ts-help-button {
                    min-width: 34px;
                    padding: 8px 0;
                    font-weight: 700;
                }
                .ts-head > div:first-child {
                    min-width: 0;
                }
                .ts-title,
                .ts-subtitle {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .ts-actions {
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }
                .ts-actions .ts-delete:not([disabled]):hover {
                    border-color: color-mix(in srgb, #d24b4b 72%, var(--ts-text));
                    background: color-mix(in srgb, #d24b4b 18%, var(--ts-bg-2));
                }
                button:focus-visible,
                [tabindex]:focus-visible {
                    outline: 2px solid var(--ts-accent);
                    outline-offset: 2px;
                }
                /* The dialog itself takes focus on open only to own the
                   keyboard; a ring around the whole screen says nothing. */
                .ts-viewer:focus,
                .ts-viewer:focus-visible {
                    outline: none;
                }
                /* A 4000-character prompt pushed seed, models and workflow
                   off the panel; it scrolls in its own box instead. */
                .ts-prompt {
                    max-height: 40vh;
                    overflow: auto;
                }
                .ts-model-chip {
                    word-break: normal;
                    overflow-wrap: anywhere;
                }
                .ts-meta-copy[data-copied="true"] {
                    border-color: var(--ts-accent);
                    background: color-mix(in srgb, var(--ts-accent) 22%, var(--ts-bg-2));
                }
                .ts-meta[data-pending="true"] .ts-prompt,
                .ts-meta[data-pending="true"] .ts-technical-empty {
                    color: var(--ts-text-muted);
                }
                .ts-media-status {
                    position: absolute;
                    left: 50%;
                    bottom: 18px;
                    transform: translateX(-50%);
                    z-index: 3;
                    padding: 8px 14px;
                    border-radius: 999px;
                    font: 600 12px/1.2 inherit;
                    color: var(--ts-text);
                    background: var(--ts-status-surface);
                    border: 1px solid var(--ts-border);
                    backdrop-filter: blur(6px);
                    pointer-events: none;
                }
                .ts-media-status[hidden] {
                    display: none;
                }
                .ts-media-status[data-kind="error"] {
                    border-color: color-mix(in srgb, #d24b4b 60%, var(--ts-border));
                }
                @media (prefers-reduced-motion: reduce) {
                    .ts-viewer[data-open="true"] {
                        animation: none;
                    }
                    .ts-stage[data-image-zoomable="true"] img {
                        transition: none;
                    }
                }
                @media (max-width: 1080px) {
                    /* The per-count rules above win on specificity, so the
                       narrow layout has to restate them or a 3-up row would
                       survive on a phone. */
                    .ts-video-compare-grid,
                    .ts-video-compare-shell[data-count="2"] .ts-video-compare-grid,
                    .ts-video-compare-shell[data-count="3"] .ts-video-compare-grid,
                    .ts-video-compare-shell[data-count="4"] .ts-video-compare-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .ts-video-compare-video,
                    .ts-video-compare-shell[data-count="3"] .ts-video-compare-video,
                    .ts-video-compare-shell[data-count="4"] .ts-video-compare-video {
                        max-height: min(32vh, calc(100dvh - 320px));
                    }
                    .ts-video-transport {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .ts-video-play-toggle {
                        justify-self: stretch;
                    }
                    .ts-video-time {
                        min-width: 0;
                        text-align: center;
                    }
                    .ts-body {
                        grid-template-columns: 1fr;
                    }
                    .ts-stage {
                        padding-inline: 54px;
                    }
                    .ts-meta {
                        border-left: 0;
                        border-top: 1px solid var(--ts-border);
                        max-height: 38vh;
                    }
                    /* Stacked, the metadata panel takes up to 38vh under the
                       stage; the player's cap ignored it, so the video grew
                       past the stage and covered the header. */
                    .ts-stage-wrap {
                        overflow: hidden;
                    }
                    .ts-video-shell video {
                        max-height: max(160px, calc(62dvh - 200px));
                    }
                }
            </style>
            <div class="ts-viewer" data-open="false" role="dialog" aria-modal="true" aria-labelledby="ts-viewer-title" tabindex="-1">
                <div class="ts-head">
                    <div>
                        <div class="ts-title" id="ts-viewer-title" aria-live="polite"></div>
                        <div class="ts-subtitle"></div>
                    </div>
                    <div class="ts-actions">
                        <button class="ts-download" type="button"></button>
                        <button class="ts-open-new-tab" type="button"></button>
                        <button class="ts-show-in-folder" type="button"></button>
                        <button class="ts-delete" type="button"></button>
                        <button class="ts-help-button" type="button">?</button>
                        <button class="ts-close" type="button"></button>
                    </div>
                </div>
                <div class="ts-body">
                    <div class="ts-stage-wrap">
                        <button class="ts-compare-close" type="button" aria-label="${this.tsEscapeAttribute(this.tsT("button.close", "Close"))}">&times;</button>
                        <button class="ts-stage-nav ts-stage-nav-prev" type="button" aria-label="${this.tsEscapeAttribute(this.tsT("button.prev", "Previous"))}">&#8249;</button>
                        <div class="ts-stage"></div>
                        <button class="ts-stage-nav ts-stage-nav-next" type="button" aria-label="${this.tsEscapeAttribute(this.tsT("button.next", "Next"))}">&#8250;</button>
                    </div>
                    <div class="ts-meta"></div>
                </div>
                <div class="ts-help" role="dialog" aria-modal="true" aria-labelledby="ts-help-title" hidden>
                    <div class="ts-help-card">
                        <div class="ts-help-head">
                            <h3 class="ts-help-title" id="ts-help-title"></h3>
                            <button class="ts-help-close" type="button">&times;</button>
                        </div>
                        <div class="ts-help-body"></div>
                    </div>
                </div>
            </div>
        `;
        this.tsRefs = {
            tsRoot: this.shadowRoot.querySelector(".ts-viewer"),
            tsTitle: this.shadowRoot.querySelector(".ts-title"),
            tsSubtitle: this.shadowRoot.querySelector(".ts-subtitle"),
            tsStage: this.shadowRoot.querySelector(".ts-stage"),
            tsMeta: this.shadowRoot.querySelector(".ts-meta"),
            tsDownloadButton: this.shadowRoot.querySelector(".ts-download"),
            tsOpenInNewTabButton: this.shadowRoot.querySelector(".ts-open-new-tab"),
            tsShowInFolderButton: this.shadowRoot.querySelector(".ts-show-in-folder"),
            tsDeleteButton: this.shadowRoot.querySelector(".ts-delete"),
            tsCloseButton: this.shadowRoot.querySelector(".ts-close"),
            tsCompareCloseButton: this.shadowRoot.querySelector(".ts-compare-close"),
            tsPrevButton: this.shadowRoot.querySelector(".ts-stage-nav-prev"),
            tsNextButton: this.shadowRoot.querySelector(".ts-stage-nav-next"),
            tsHelp: this.shadowRoot.querySelector(".ts-help"),
            tsHelpTitle: this.shadowRoot.querySelector(".ts-help-title"),
            tsHelpBody: this.shadowRoot.querySelector(".ts-help-body"),
            tsHelpClose: this.shadowRoot.querySelector(".ts-help-close"),
            tsHelpButton: this.shadowRoot.querySelector(".ts-help-button"),
        };
        this.tsRefs.tsStage.style.setProperty("--ts-audio-shell-max-width", `${tsViewerSettings.audio.maxWidth}px`);
        this.tsRefs.tsStage.style.setProperty("--ts-audio-waveform-max-height", `${tsViewerSettings.audio.waveformMaxHeight}px`);
        this.tsRefs.tsMeta.addEventListener("click", (tsEvent) => this.tsHandleMetaClick(tsEvent));
        this.tsRefs.tsDownloadButton.addEventListener("click", () => this.tsDownloadCurrent());
        this.tsRefs.tsOpenInNewTabButton.addEventListener("click", () => this.tsOpenInNewTabCurrent());
        this.tsRefs.tsShowInFolderButton.addEventListener("click", () => {
            const tsAsset = this.tsItems[this.tsIndex];
            if (tsAsset) {
                void tsRevealAssetInFolder(tsAsset);
            }
        });
        this.tsRefs.tsDeleteButton.addEventListener("click", () => void this.tsDeleteCurrent());
        this.tsRefs.tsHelpButton.addEventListener("click", () => this.tsToggleHelp(true));
        this.tsRefs.tsHelpClose.addEventListener("click", () => this.tsToggleHelp(false));
        this.tsRefs.tsHelp.addEventListener("click", (tsEvent) => {
            if (tsEvent.target === this.tsRefs.tsHelp) {
                this.tsToggleHelp(false);
            }
        });
        this.tsRefs.tsCloseButton.addEventListener("click", () => this.tsClose());
        this.tsRefs.tsCompareCloseButton.addEventListener("click", () => this.tsClose());
        this.tsRefs.tsPrevButton.addEventListener("click", () => void this.tsNavigate(-1));
        this.tsRefs.tsNextButton.addEventListener("click", () => void this.tsNavigate(1));
        this.tsRefs.tsRoot.addEventListener("click", (tsEvent) => {
            if (tsEvent.target === this.tsRefs.tsRoot) {
                this.tsClose();
                return;
            }
            // The root is fully covered by the header and the body, so the
            // click-outside above practically never fired. The empty stage
            // around the media is the "outside" a user actually clicks. An
            // image stage keeps its clicks: they zoom.
            const tsStage = this.tsRefs.tsStage;
            const tsWrap = tsStage.parentElement;
            const tsOnBackground = tsEvent.target === tsWrap
                || (tsEvent.target === tsStage && tsStage.dataset.kind !== "image" && this.tsRefs.tsRoot.dataset.compare !== "true");
            if (tsOnBackground && tsEvent.button === 0) {
                this.tsClose();
            }
        });
        // The mouse's Back/Forward buttons step through the assets instead of
        // navigating the whole ComfyUI tab away.
        this.tsRefs.tsRoot.addEventListener("mouseup", (tsEvent) => {
            if (tsEvent.button !== 3 && tsEvent.button !== 4) {
                return;
            }
            tsEvent.preventDefault();
            if (!this.tsIsCompareMode()) {
                void this.tsNavigate(tsEvent.button === 3 ? -1 : 1);
            }
        });
        this.tsRender();
    }

    tsSetLocale(tsLocale) {
        this.tsLocale = tsLocale || {};
        this.tsRender();
    }

    tsT(tsKey, tsFallback) {
        return this.tsLocale?.[tsKey] || tsFallback;
    }

    tsResolveChannelLayoutLabel(tsChannelCount) {
        return tsResolveChannelLayoutLabel(tsChannelCount, {
            mono: this.tsT("label.mono", "Mono"),
            stereo: this.tsT("label.stereo", "Stereo"),
        });
    }

    async tsEnsureAssetDetail(tsItemIndex = this.tsIndex) {
        const tsAsset = this.tsItems?.[tsItemIndex];
        if (!tsAsset?.id) {
            return null;
        }
        if (tsAsset.detail_loaded) {
            return tsAsset;
        }
        const tsRequestToken = ++this.tsDetailRequestToken;
        try {
            const tsDetail = await tsFetchAssetDetail(tsAsset.id);
            const tsCurrentAsset = this.tsItems?.[tsItemIndex];
            if (!tsCurrentAsset || tsCurrentAsset.id !== tsAsset.id) {
                return tsDetail || tsAsset;
            }
            this.tsItems[tsItemIndex] = { ...tsCurrentAsset, ...(tsDetail || {}) };
            // During a swap the detail only merges: the swap's own render
            // (which is coming) builds the stage and the panel from it, once.
            if (tsItemIndex === this.tsIndex && tsRequestToken === this.tsDetailRequestToken && !this.tsSwapPending) {
                this.tsRender();
            }
            return this.tsItems[tsItemIndex];
        } catch {
            return tsAsset;
        }
    }

    tsIsViewerOpen() {
        // The panel asks this before handling a key: both handlers sit in the
        // same bubble path, so the panel must stand down while the lightbox is up.
        // A lightbox fading out is already closed as far as keys go.
        return this.tsIndex >= 0 && this.tsItems.length > 0 && !this.tsClosingTimer;
    }

    tsOpen(tsItems, tsIndex, tsOnChange = null, tsOptions = null) {
        this.tsItems = Array.isArray(tsItems) ? [...tsItems] : [];
        this.tsIndex = Math.max(0, Math.min(tsIndex, this.tsItems.length - 1));
        this.tsOnChange = tsOnChange;
        this.tsGetItems = typeof tsOptions?.tsGetItems === "function" ? tsOptions.tsGetItems : null;
        this.tsRequestMore = typeof tsOptions?.tsRequestMore === "function" ? tsOptions.tsRequestMore : null;
        this.tsCanLoadMore = typeof tsOptions?.tsCanLoadMore === "function" ? tsOptions.tsCanLoadMore : null;
        this.tsCompareItems = Array.isArray(tsOptions?.tsCompareItems) ? [...tsOptions.tsCompareItems] : [];
        this.tsOnDeleted = typeof tsOptions?.tsOnDeleted === "function" ? tsOptions.tsOnDeleted : null;
        this.tsMoreRequestPromise = null;
        // Reopened while the previous close was still fading: that close is
        // abandoned, and the focus to return to is still the one it saved.
        const tsWasClosing = this.tsCancelClosing();
        const tsWasOpen = this.tsRefs?.tsRoot?.dataset.open === "true" && !tsWasClosing;
        if (tsWasClosing) {
            this.style.pointerEvents = "auto";
        }
        if (!tsWasOpen && !tsWasClosing) {
            // Where the keyboard was, so closing can put it back on the card
            // the user came from.
            this.tsReturnFocus = this.tsDeepActiveElement();
        }
        if (!tsWasOpen) {
            // A fresh lightbox starts its first clip playing, whatever the
            // last session left paused.
            this.tsVideoCarry = null;
        }
        window.removeEventListener("keydown", this.tsBoundKeydown, true);
        window.addEventListener("keydown", this.tsBoundKeydown, true);
        this.tsRender();
        // Focus moves INTO the dialog (its root, not a button: Space must
        // reach the player, not press "Close").
        this.tsRefs?.tsRoot?.focus?.({ preventScroll: true });
        // Warm the neighbours right away, so the FIRST arrow press is as smooth
        // as the ones after it.
        this.tsPrefetchNeighbourImages();
        this.tsRequestDetailForCurrent();
        void this.tsMaybePrefetchMore(this.tsIndex);
    }

    // Compare mode hides the metadata panel entirely, so a detail request
    // there only costs a round trip (and, before, a rebuilt stage).
    tsRequestDetailForCurrent() {
        if (this.tsIsCompareMode()) {
            return;
        }
        void this.tsEnsureAssetDetail(this.tsIndex);
    }

    // Closing fades out over ~130 ms instead of vanishing in one frame. The
    // keyboard is released at once and the lightbox reports itself closed, so
    // nothing waits on the animation; opening again cancels it.
    tsClose() {
        const tsRoot = this.tsRefs?.tsRoot;
        const tsReduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        if (this.tsClosingTimer) {
            return;
        }
        if (!tsRoot || tsRoot.dataset.open !== "true" || tsReduceMotion) {
            this.tsFinishClose();
            return;
        }
        window.removeEventListener("keydown", this.tsBoundKeydown, true);
        this.tsToggleHelp(false);
        this.style.pointerEvents = "none";
        tsRoot.dataset.closing = "true";
        this.tsClosingTimer = window.setTimeout(() => {
            this.tsClosingTimer = 0;
            delete tsRoot.dataset.closing;
            this.tsFinishClose();
        }, 130);
    }

    tsCancelClosing() {
        if (!this.tsClosingTimer) {
            return false;
        }
        window.clearTimeout(this.tsClosingTimer);
        this.tsClosingTimer = 0;
        if (this.tsRefs?.tsRoot) {
            delete this.tsRefs.tsRoot.dataset.closing;
        }
        return true;
    }

    tsFinishClose() {
        this.tsDropStageGhost();
        this.tsTeardownStage();
        this.tsVideoCarry = null;
        if (this.tsRefs?.tsHelp) {
            this.tsRefs.tsHelp.hidden = true;
        }
        this.tsIndex = -1;
        this.tsItems = [];
        this.tsOnChange = null;
        this.tsGetItems = null;
        this.tsRequestMore = null;
        this.tsCanLoadMore = null;
        this.tsMoreRequestPromise = null;
        this.tsCompareItems = [];
        // Closing the lightbox is the moment those decoded copies stop being
        // worth their memory (CLAUDE.md section 8 teardown contract).
        this.tsImageWarmCache.clear();
        // Any decode still in flight belongs to a stage that no longer exists.
        this.tsStageRenderToken += 1;
        this.tsSwapPending = false;
        this.tsOnDeleted = null;
        window.removeEventListener("keydown", this.tsBoundKeydown, true);
        this.tsRender();
        const tsReturnFocus = this.tsReturnFocus;
        this.tsReturnFocus = null;
        if (tsReturnFocus?.isConnected && typeof tsReturnFocus.focus === "function") {
            tsReturnFocus.focus({ preventScroll: true });
        }
    }

    tsTeardownStage() {
        if (typeof this.tsStageCleanup === "function") {
            try {
                this.tsStageCleanup();
            } catch {
                // no-op
            }
        }
        this.tsStageCleanup = null;
        this.tsVideoFrameStepper = null;
        this.tsMediaEdgeJumper = null;
        this.tsImageZoomHandler = null;
        // tsDetailRequestToken stays monotonic on purpose: a stale detail
        // fetch is rejected by the ++token guard, not by a reset here.
        // Resetting it let a concurrent tsRender() (e.g. prefetch) drop the
        // freshly loaded metadata for the asset still on screen.
    }

    tsIsVideoCompareMode() {
        const tsAsset = this.tsIndex >= 0 ? this.tsItems[this.tsIndex] : null;
        return tsIsViewerTypedCompareMode(tsAsset, this.tsCompareItems, "video");
    }

    tsIsImageCompareMode() {
        const tsAsset = this.tsIndex >= 0 ? this.tsItems[this.tsIndex] : null;
        return tsIsViewerTypedCompareMode(tsAsset, this.tsCompareItems, "image");
    }

    tsIsCompareMode() {
        return this.tsIsVideoCompareMode() || this.tsIsImageCompareMode();
    }

    // Registered on window in the CAPTURE phase while the lightbox is open, so
    // it runs before anything else on the page. A key it acts on stops there:
    // ComfyUI's own shortcuts (Delete removes the selected graph nodes!) must
    // not fire underneath an overlay the user is looking at.
    tsHandleWindowKeydown(tsEvent) {
        if (this.tsIndex < 0) {
            return;
        }
        this.tsHandleKeydown(tsEvent);
        if (tsEvent.defaultPrevented) {
            tsEvent.stopPropagation();
        }
    }

    tsDeepActiveElement() {
        let tsActive = document.activeElement;
        while (tsActive?.shadowRoot?.activeElement) {
            tsActive = tsActive.shadowRoot.activeElement;
        }
        return tsActive || null;
    }

    // Tab stays inside the dialog: behind it lies the whole ComfyUI page, and
    // tabbing into hidden controls is how Space ends up pressing one of them.
    tsTrapFocus(tsEvent) {
        const tsFocusable = [...this.shadowRoot.querySelectorAll("button, video[controls], input, [tabindex]:not([tabindex='-1'])")]
            .filter((tsElement) => !tsElement.disabled && !tsElement.hidden && tsElement.offsetParent !== null);
        if (!tsFocusable.length) {
            tsEvent.preventDefault();
            return;
        }
        const tsCurrent = tsFocusable.indexOf(this.shadowRoot.activeElement);
        const tsNext = tsEvent.shiftKey
            ? (tsCurrent <= 0 ? tsFocusable.length - 1 : tsCurrent - 1)
            : (tsCurrent < 0 || tsCurrent >= tsFocusable.length - 1 ? 0 : tsCurrent + 1);
        tsEvent.preventDefault();
        tsFocusable[tsNext].focus();
    }

    // Space plays and pauses whatever is on the stage, the way every media
    // viewer does. A focused button or native player keeps its own Space.
    tsTogglePlayback(tsEvent) {
        const tsPath = typeof tsEvent.composedPath === "function" ? tsEvent.composedPath() : [];
        const tsTarget = tsPath[0];
        const tsTag = String(tsTarget?.tagName || "").toUpperCase();
        if (tsTag === "BUTTON" || tsTag === "INPUT" || tsTag === "VIDEO" || tsTag === "AUDIO") {
            return false;
        }
        const tsStage = this.tsRefs?.tsStage;
        const tsToggle = tsStage?.querySelector(".ts-video-play-toggle, .ts-audio-play");
        if (tsToggle) {
            tsToggle.click();
            return true;
        }
        const tsVideo = tsStage?.querySelector("video");
        if (!tsVideo) {
            return false;
        }
        if (tsVideo.paused || tsVideo.ended) {
            const tsPlayed = tsVideo.play();
            tsPlayed?.catch?.(() => {});
        } else {
            tsVideo.pause();
        }
        return true;
    }

    // The lightbox's own shortcut card. The panel's "?" help lives in the
    // panel's shadow root, under this overlay, so "?" pressed here did
    // nothing at all.
    tsToggleHelp(tsShow) {
        const tsHelp = this.tsRefs?.tsHelp;
        if (!tsHelp) {
            return;
        }
        if (tsShow) {
            const tsRows = [
                ["Esc", this.tsT("shortcuts.closeOrReset", "Back to the whole picture, then close")],
                ["← →", this.tsT("shortcuts.nav", "Previous / next asset")],
                ["↑ ↓", this.tsT("shortcuts.frame", "Step one video frame")],
                ["Home / End", this.tsT("shortcuts.firstLastFrame", "First / last frame")],
                ["Space", this.tsT("shortcuts.playPause", "Play / pause")],
                ["+ − / 1 / 0", this.tsT("shortcuts.zoomSingle", "Zoom / actual pixels / fit")],
                [this.tsT("shortcuts.clickKey", "Click"), this.tsT("shortcuts.clickZoom", "Actual pixels at that point, click again to fit")],
                [this.tsT("shortcuts.pinchKey", "Wheel / pinch"), this.tsT("shortcuts.zoomGesture", "Zoom around the pointer")],
                [this.tsT("shortcuts.mouseButtonsKey", "Mouse Back / Forward"), this.tsT("shortcuts.nav", "Previous / next asset")],
                ["Delete", this.tsT("shortcuts.trash", "Send to system trash")],
                ["?", this.tsT("shortcuts.help", "This help")],
            ];
            this.tsRefs.tsHelpTitle.textContent = this.tsT("shortcuts.title", "Keyboard shortcuts");
            this.tsRefs.tsHelpClose.setAttribute("aria-label", this.tsT("button.close", "Close"));
            this.tsRefs.tsHelpBody.innerHTML = tsRows
                .map(([tsKeys, tsText]) => `<div class="ts-help-row"><kbd>${this.tsEscapeHTML(tsKeys)}</kbd><span>${this.tsEscapeHTML(tsText)}</span></div>`)
                .join("");
            tsHelp.hidden = false;
            this.tsRefs.tsHelpClose.focus({ preventScroll: true });
            return;
        }
        tsHelp.hidden = true;
        this.tsRefs.tsRoot.focus({ preventScroll: true });
    }

    // A focused slider (the compare wipe or seek bar, the audio waveform) owns
    // its arrow keys, Home and End; everywhere else they step through assets.
    tsIsSliderKeyTarget(tsEvent) {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(tsEvent.key)) {
            return false;
        }
        const tsPath = typeof tsEvent.composedPath === "function" ? tsEvent.composedPath() : [];
        const tsTarget = tsPath[0];
        return Boolean(
            tsTarget
            && ((String(tsTarget.tagName || "").toUpperCase() === "INPUT" && tsTarget.type === "range")
                || tsTarget.getAttribute?.("role") === "slider"),
        );
    }

    tsHandleKeydown(tsEvent) {
        if (this.tsIndex < 0) {
            return;
        }
        if (this.tsRefs?.tsHelp && !this.tsRefs.tsHelp.hidden) {
            // The help card is on top: Esc or ? close it, Tab stays on its
            // only control, and nothing reaches the stage underneath.
            if (tsEvent.key === "Escape" || tsEvent.key === "?" || tsEvent.key === "Tab") {
                tsEvent.preventDefault();
                if (tsEvent.key !== "Tab") {
                    this.tsToggleHelp(false);
                }
            }
            return;
        }
        if (tsEvent.key === "Escape") {
            tsEvent.preventDefault();
            // Zoomed in, the first Esc goes back to the whole picture; the
            // second one closes. Closing straight from 400% lost the place the
            // user was inspecting for a key they reach for to "back out".
            if (this.tsImageZoomHandler?.tsIsZoomed?.()) {
                this.tsImageZoomHandler.tsReset();
                return;
            }
            this.tsClose();
            return;
        }
        if (tsEvent.key === "?") {
            tsEvent.preventDefault();
            this.tsToggleHelp(true);
            return;
        }
        if (this.tsIsSliderKeyTarget(tsEvent)) {
            return;
        }
        if (tsEvent.key === "Tab") {
            this.tsTrapFocus(tsEvent);
            return;
        }
        // Alt+Arrow is Back/Forward, Ctrl/Cmd+Arrow belongs to the OS: a
        // modified key is never the lightbox's.
        if (tsEvent.ctrlKey || tsEvent.metaKey || tsEvent.altKey) {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", " "].includes(tsEvent.key)) {
                return;
            }
        }
        if (tsEvent.key === " " || tsEvent.key === "Spacebar") {
            if (this.tsTogglePlayback(tsEvent)) {
                tsEvent.preventDefault();
            }
            return;
        }
        const tsCompareMode = this.tsIsCompareMode();
        const tsVideoCompareMode = this.tsIsVideoCompareMode();
        const tsImageCompareMode = this.tsIsImageCompareMode();
        const tsZoom = this.tsImageZoomHandler;
        // Ctrl/Cmd +/-/0 is the browser's own page zoom and Alt belongs to the
        // window manager: only the bare keys are ours.
        if (tsZoom && !tsEvent.ctrlKey && !tsEvent.metaKey && !tsEvent.altKey) {
            if (tsEvent.key === "+" || tsEvent.key === "=") {
                tsEvent.preventDefault();
                tsZoom.tsZoomBy(tsViewerSettings.imageZoom.stepIn);
                return;
            }
            if (tsEvent.key === "-" || tsEvent.key === "_") {
                tsEvent.preventDefault();
                tsZoom.tsZoomBy(tsViewerSettings.imageZoom.stepOut);
                return;
            }
            if (tsEvent.key === "0") {
                tsEvent.preventDefault();
                tsZoom.tsReset();
                return;
            }
            if (tsEvent.key === "1") {
                tsEvent.preventDefault();
                tsZoom.tsZoomToNative();
                return;
            }
        }
        // Arrows pan only where they are otherwise idle: in image compare mode
        // there is nothing to navigate to and no frame to step, so a zoomed-in
        // comparison gets them. Single-image arrows stay asset navigation.
        if (tsZoom && tsImageCompareMode && tsZoom.tsIsZoomed() && !tsEvent.ctrlKey && !tsEvent.metaKey) {
            const tsPanStep = tsEvent.shiftKey
                ? tsViewerSettings.imageZoom.panStepFast
                : tsViewerSettings.imageZoom.panStep;
            const tsPanOffsets = {
                ArrowLeft: [tsPanStep, 0],
                ArrowRight: [-tsPanStep, 0],
                ArrowUp: [0, tsPanStep],
                ArrowDown: [0, -tsPanStep],
            };
            const tsOffset = tsPanOffsets[tsEvent.key];
            if (tsOffset && tsZoom.tsPanBy(tsOffset[0], tsOffset[1])) {
                tsEvent.preventDefault();
                return;
            }
        }
        if (tsEvent.key === "ArrowLeft") {
            if (this.tsItems[this.tsIndex]?.type === "video" && tsVideoCompareMode && typeof this.tsVideoFrameStepper === "function") {
                tsEvent.preventDefault();
                this.tsVideoFrameStepper(-1);
            } else if (!tsCompareMode) {
                tsEvent.preventDefault();
                void this.tsNavigate(-1);
            }
            return;
        }
        if (tsEvent.key === "ArrowRight") {
            if (this.tsItems[this.tsIndex]?.type === "video" && tsVideoCompareMode && typeof this.tsVideoFrameStepper === "function") {
                tsEvent.preventDefault();
                this.tsVideoFrameStepper(1);
            } else if (!tsCompareMode) {
                tsEvent.preventDefault();
                void this.tsNavigate(1);
            }
            return;
        }
        // Up/Down step a frame in EVERY video stage, compare included, as the
        // shortcut help says; in compare mode they used to do nothing.
        if (tsEvent.key === "ArrowUp") {
            if (this.tsItems[this.tsIndex]?.type === "video" && typeof this.tsVideoFrameStepper === "function") {
                tsEvent.preventDefault();
                this.tsVideoFrameStepper(-1);
            }
            return;
        }
        if (tsEvent.key === "ArrowDown") {
            if (this.tsItems[this.tsIndex]?.type === "video" && typeof this.tsVideoFrameStepper === "function") {
                tsEvent.preventDefault();
                this.tsVideoFrameStepper(1);
            }
            return;
        }
        // First / last frame of a clip (every clip, in compare mode), start /
        // end of an audio file.
        if (tsEvent.key === "Home" || tsEvent.key === "End") {
            if (!tsEvent.ctrlKey && !tsEvent.metaKey && !tsEvent.altKey && typeof this.tsMediaEdgeJumper === "function") {
                tsEvent.preventDefault();
                this.tsMediaEdgeJumper(tsEvent.key === "End" ? 1 : -1);
            }
            return;
        }
        if (tsEvent.key === "Delete") {
            tsEvent.preventDefault();
            void this.tsDeleteCurrent();
        }
    }

    tsSyncItemsFromSource(tsPreferredAssetId = null) {
        const tsSyncResult = tsSyncViewerItemsFromSource({
            items: this.tsItems,
            index: this.tsIndex,
            getItems: this.tsGetItems,
            preferredAssetId: tsPreferredAssetId,
        });
        if (!tsSyncResult.tsDidSync) {
            return false;
        }
        this.tsItems = tsSyncResult.tsItems;
        this.tsIndex = tsSyncResult.tsIndex;
        return true;
    }

    async tsMaybePrefetchMore(tsTargetIndex = this.tsIndex, tsForce = false) {
        if (typeof this.tsRequestMore !== "function") {
            return false;
        }
        const tsRemainingItems = this.tsItems.length - Math.max(0, tsTargetIndex) - 1;
        const tsThreshold = Math.max(0, Number(tsViewerSettings.pagination?.prefetchThreshold || 0));
        if (!tsForce && tsRemainingItems > tsThreshold) {
            return false;
        }
        if (typeof this.tsCanLoadMore === "function" && !this.tsCanLoadMore()) {
            return false;
        }
        if (this.tsMoreRequestPromise) {
            return this.tsMoreRequestPromise;
        }
        const tsCurrentAssetId = this.tsItems[this.tsIndex]?.id ?? null;
        this.tsMoreRequestPromise = (async () => {
            try {
                const tsLoaded = await this.tsRequestMore(tsTargetIndex);
                if (tsLoaded) {
                    this.tsSyncItemsFromSource(tsCurrentAssetId);
                    this.tsRender();
                }
                return Boolean(tsLoaded);
            } finally {
                this.tsMoreRequestPromise = null;
            }
        })();
        return this.tsMoreRequestPromise;
    }

    // The lightbox rebuilds its stage on every navigation, so the new <img>
    // starts empty while the old picture is already gone. Decoding the file
    // before the swap closes that gap; warming the neighbours makes the usual
    // arrow press cost nothing.
    tsWarmImage(tsImageURL) {
        if (!tsImageURL) {
            return Promise.resolve(false);
        }
        const tsCachedWarm = this.tsImageWarmCache.get(tsImageURL);
        if (tsCachedWarm) {
            return tsCachedWarm;
        }
        const tsWarmPromise = new Promise((tsResolve) => {
            const tsImage = new Image();
            tsImage.decoding = "async";
            const tsFinish = () => tsResolve(true);
            tsImage.onload = () => {
                // decode() resolves when the bitmap is ready to PAINT; load
                // alone only means the bytes arrived, and painting them is the
                // part that was showing up as the flash.
                if (typeof tsImage.decode === "function") {
                    tsImage.decode().then(tsFinish, tsFinish);
                    return;
                }
                tsFinish();
            };
            // A broken image resolves too: it must not hold navigation, and the
            // stage shows the same failure it always did.
            tsImage.onerror = tsFinish;
            tsImage.src = tsImageURL;
        });
        this.tsImageWarmCache.set(tsImageURL, tsWarmPromise);
        while (this.tsImageWarmCache.size > tsViewerSettings.imageSwap.cacheSize) {
            this.tsImageWarmCache.delete(this.tsImageWarmCache.keys().next().value);
        }
        return tsWarmPromise;
    }

    tsResolveStageImageURL(tsAsset) {
        // Single-image stages only. Compare stages build their own layers, and
        // every other type keeps the behaviour it had.
        if (!tsAsset || tsAsset.type !== "image" || this.tsIsImageCompareMode() || !tsAsset.file_url) {
            return "";
        }
        // The same URL the stage will load: the converted copy for an EXR or
        // TIFF, so warming it also gets that copy made ahead of the step.
        return tsApiURL(tsResolveDisplayURL(tsAsset));
    }

    async tsWaitForStageImage(tsAsset) {
        const tsImageURL = this.tsResolveStageImageURL(tsAsset);
        if (!tsImageURL) {
            return;
        }
        await Promise.race([
            this.tsWarmImage(tsImageURL),
            new Promise((tsResolve) => {
                window.setTimeout(tsResolve, tsViewerSettings.imageSwap.maxWaitMs);
            }),
        ]);
    }

    tsPrefetchNeighbourImages() {
        const tsRadius = Math.max(0, Number(tsViewerSettings.imageSwap.prefetchRadius) || 0);
        for (let tsOffset = -tsRadius; tsOffset <= tsRadius; tsOffset += 1) {
            if (tsOffset === 0) {
                continue;
            }
            const tsNeighbourURL = this.tsResolveStageImageURL(this.tsItems[this.tsIndex + tsOffset]);
            if (tsNeighbourURL) {
                void this.tsWarmImage(tsNeighbourURL);
            }
        }
    }

    // Crossfade. The outgoing picture is lifted out of the stage into a layer
    // above it, at exactly the box it occupied, and faded out over the new
    // stage - which sits fully opaque underneath, so the blend never dips to
    // the background half-way. The element itself moves rather than a copy:
    // its bitmap is decoded and on screen already, so the layer cannot blank
    // for a frame the way a fresh <img> can, and it covers the new picture
    // for as long as that one takes to paint.
    tsLiftStageGhost() {
        this.tsDropStageGhost();
        const tsFadeMs = Math.max(0, Number(tsViewerSettings.imageSwap.fadeMs) || 0);
        const tsStage = this.tsRefs?.tsStage;
        const tsWrap = tsStage?.parentElement;
        const tsImage = tsStage?.querySelector(":scope > img");
        if (!tsFadeMs || !tsWrap || !tsImage || !tsImage.complete || !tsImage.naturalWidth) {
            return null;
        }
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
            return null;
        }
        const tsStageRect = tsStage.getBoundingClientRect();
        const tsWrapRect = tsWrap.getBoundingClientRect();
        const tsGhost = document.createElement("div");
        tsGhost.className = "ts-stage-ghost";
        tsGhost.style.left = `${tsStageRect.left - tsWrapRect.left}px`;
        tsGhost.style.top = `${tsStageRect.top - tsWrapRect.top}px`;
        tsGhost.style.width = `${tsStageRect.width}px`;
        tsGhost.style.height = `${tsStageRect.height}px`;
        tsGhost.style.transitionDuration = `${tsFadeMs}ms`;
        // The frame takes the picture's layout box AND its zoom transform: the
        // stage cleanup that runs next clears the transform on the <img>, and
        // a zoomed-in view must fade out exactly as it was on screen.
        const tsFrame = document.createElement("div");
        tsFrame.className = "ts-stage-ghost-frame";
        tsFrame.style.left = `${tsImage.offsetLeft}px`;
        tsFrame.style.top = `${tsImage.offsetTop}px`;
        tsFrame.style.width = `${tsImage.offsetWidth}px`;
        tsFrame.style.height = `${tsImage.offsetHeight}px`;
        tsFrame.style.transform = tsImage.style.transform || "";
        tsImage.style.transform = "";
        tsFrame.append(tsImage);
        tsGhost.append(tsFrame);
        tsWrap.append(tsGhost);
        this.tsStageGhost = tsGhost;
        return tsGhost;
    }

    tsFadeStageGhost(tsGhost) {
        if (!tsGhost) {
            return;
        }
        const tsFadeMs = Math.max(0, Number(tsViewerSettings.imageSwap.fadeMs) || 0);
        // Two frames: the first paints the new stage under the ghost, the
        // second starts the fade from that painted state.
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                if (this.tsStageGhost === tsGhost) {
                    tsGhost.dataset.fading = "true";
                }
            });
        });
        // Timer, not transitionend: a hidden tab runs no frames, and the ghost
        // must never outlive its fade by more than a moment.
        window.setTimeout(() => {
            if (this.tsStageGhost === tsGhost) {
                this.tsDropStageGhost();
            }
        }, tsFadeMs + 250);
    }

    tsDropStageGhost() {
        this.tsStageGhost?.remove();
        this.tsStageGhost = null;
    }

    async tsNavigate(tsDirection) {
        if (!this.tsItems.length) {
            return;
        }
        if (tsDirection > 0) {
            await this.tsMaybePrefetchMore(this.tsIndex);
            this.tsSyncItemsFromSource(this.tsItems[this.tsIndex]?.id ?? null);
        }
        let tsNextIndex = Math.max(0, Math.min(this.tsIndex + tsDirection, this.tsItems.length - 1));
        if (tsDirection > 0 && tsNextIndex === this.tsIndex) {
            const tsLoaded = await this.tsMaybePrefetchMore(this.tsIndex, true);
            if (tsLoaded) {
                this.tsSyncItemsFromSource(this.tsItems[this.tsIndex]?.id ?? null);
                tsNextIndex = Math.max(0, Math.min(this.tsIndex + tsDirection, this.tsItems.length - 1));
            }
        }
        if (tsNextIndex === this.tsIndex) {
            return;
        }
        this.tsIndex = tsNextIndex;
        if (typeof this.tsOnChange === "function") {
            this.tsOnChange(this.tsIndex, this.tsItems[this.tsIndex] || null);
        }
        await this.tsSwapToCurrent();
    }

    // Brings the stage to this.tsIndex: waits for the picture (or for a
    // held key to settle on heavy media), then crossfades. Shared by arrow
    // navigation and by the step that follows a delete.
    async tsSwapToCurrent() {
        // The index moves at once so a held arrow key keeps advancing; only the
        // SWAP waits for the picture. The token makes the newest navigation the
        // one that owns the stage: a decode that finishes late must not paint
        // over an image the user has already moved past.
        const tsRenderToken = ++this.tsStageRenderToken;
        const tsAsset = this.tsItems[this.tsIndex];
        // The detail is requested NOW, in parallel with the decode, instead of
        // after the swap. It merges without rendering while the swap is
        // pending (tsEnsureAssetDetail), so the stage is still built once.
        this.tsSwapPending = true;
        this.tsRequestDetailForCurrent();
        if (tsAsset && tsAsset.type !== "image") {
            // A held arrow over videos or 3D models used to build a <video>
            // (and start downloading it) or a WebGL viewer on EVERY key
            // repeat. A short settle lets the repeats pass; a single press
            // barely notices it.
            await new Promise((tsResolve) => {
                window.setTimeout(tsResolve, tsViewerSettings.mediaSwapSettleMs);
            });
        } else {
            await this.tsWaitForStageImage(tsAsset);
        }
        if (tsRenderToken !== this.tsStageRenderToken) {
            return;
        }
        this.tsSwapPending = false;
        const tsGhost = this.tsLiftStageGhost();
        this.tsRender();
        this.tsFadeStageGhost(tsGhost);
        this.tsPrefetchNeighbourImages();
        void this.tsMaybePrefetchMore(this.tsIndex);
    }

    async tsHandleMetaClick(tsEvent) {
        const tsButton = tsEvent.target.closest("[data-copy-field]");
        if (!tsButton) {
            return;
        }
        const tsAsset = this.tsItems[this.tsIndex];
        if (!tsAsset) {
            return;
        }
        const tsField = tsButton.dataset.copyField;
        const tsValue = tsField === "workflow"
            ? tsAsset.workflow_text
            : tsField === "negative_prompt"
                ? tsAsset.negative_prompt_text
            : tsField === "seed"
                ? tsAsset.seed
            : tsField === "models"
                ? (Array.isArray(tsAsset.models) ? tsAsset.models.join("\n") : "")
            : tsAsset.prompt_text;
        if (!tsValue) {
            return;
        }
        const tsCopied = await tsCopyText(tsValue);
        tsShowToast(
            tsCopied ? "success" : "error",
            tsCopied ? this.tsT("toast.copied", "Copied") : this.tsT("toast.copyFailed", "Copy failed"),
        );
        if (tsCopied && tsButton.isConnected) {
            // The button itself confirms, where the eye already is; the toast
            // appears in a corner.
            const tsLabel = tsButton.textContent;
            tsButton.dataset.copied = "true";
            tsButton.textContent = this.tsT("toast.copied", "Copied");
            window.setTimeout(() => {
                if (tsButton.isConnected) {
                    delete tsButton.dataset.copied;
                    tsButton.textContent = tsLabel;
                }
            }, 1200);
        }
    }

    tsDownloadCurrent() {
        const tsAsset = this.tsItems[this.tsIndex];
        if (tsAsset) {
            tsOpenDownload(tsAsset);
        }
    }


    tsOpenInNewTabCurrent() {
        const tsAsset = this.tsItems[this.tsIndex];
        if (!tsAsset) {
            return;
        }
        tsOpenAssetInNewTab(tsAsset);
    }
    async tsDeleteCurrent() {
        const tsAsset = this.tsItems[this.tsIndex];
        if (!tsAsset?.id || !tsAsset.allow_delete || this.tsDeleteInFlight) {
            return;
        }
        const tsDeletedAssetId = tsAsset.id;
        let tsResult;
        this.tsDeleteInFlight = true;
        try {
            tsResult = await tsDeleteAssetIds([tsDeletedAssetId]);
        } catch (tsError) {
            // Previously uncaught: a failed delete rejected tsDeleteCurrent and
            // left the lightbox showing an asset the user thinks is gone.
            tsShowToast("error", this.tsT("toast.deleteFailed", "Delete failed"), String(tsError?.message || tsError || ""));
            return;
        } finally {
            this.tsDeleteInFlight = false;
        }
        const tsOutcome = tsResolveDeleteOutcome([tsDeletedAssetId], tsResult);
        if (!tsOutcome.tsRemovedIds.includes(tsDeletedAssetId)) {
            // Locked by another program, or its folder refuses deletes: the
            // file is still there, so the picture stays on screen.
            tsShowToast(
                "warn",
                this.tsT("toast.deleteSkipped", "{count} could not be moved to the trash").replace("{count}", "1"),
                this.tsT("toast.deleteSkippedHint", "The file may be open in another program, or deleting is turned off for its folder."),
            );
            return;
        }
        if (tsOutcome.tsDeletedIds.includes(tsDeletedAssetId)) {
            tsShowToast("success", this.tsT("toast.movedToTrash", "Moved to trash"), String(tsAsset.filename || ""));
        }
        // The panel drops the card NOW. Its list is what the lightbox re-syncs
        // from, and waiting for the backend's remove event (which the panel
        // ignores while a scan runs) let the deleted picture come back.
        this.tsOnDeleted?.([tsDeletedAssetId]);
        const tsNextIndexHint = Math.max(0, Math.min(this.tsIndex, this.tsItems.length - 2));
        this.tsItems = this.tsItems.filter((tsItem) => tsItem.id !== tsDeletedAssetId);
        this.tsCompareItems = this.tsCompareItems.filter((tsItem) => tsItem.id !== tsDeletedAssetId);
        if (typeof this.tsGetItems === "function") {
            const tsNextAssetId = this.tsItems[tsNextIndexHint]?.id ?? null;
            this.tsSyncItemsFromSource(tsNextAssetId);
        }
        if (!this.tsItems.length) {
            this.tsClose();
            return;
        }
        const tsNextId = this.tsItems[Math.max(0, Math.min(tsNextIndexHint, this.tsItems.length - 1))]?.id;
        const tsSyncedIndex = this.tsItems.findIndex((tsItem) => tsItem.id === tsNextId);
        this.tsIndex = tsSyncedIndex >= 0 ? tsSyncedIndex : Math.max(0, Math.min(tsNextIndexHint, this.tsItems.length - 1));
        if (typeof this.tsOnChange === "function") {
            this.tsOnChange(this.tsIndex, this.tsItems[this.tsIndex] || null);
        }
        // The next picture arrives the way an arrow press brings it -
        // decoded first, crossfaded - instead of blinking in, and once.
        await this.tsSwapToCurrent();
    }

    tsBuildMetaMarkup(tsAsset) {
        const tsDeps = this.tsGetMetaDeps(tsAsset);
        if (tsAsset?.type === "video" || tsAsset?.type === "audio") {
            // A video generated by ComfyUI carries the same embedded prompt and
            // workflow a PNG does, so it gets the same blocks above its
            // technical panel - but only when there is something in them. A
            // clip that came from anywhere else keeps the panel it always had.
            // Before the detail arrives the card's flags already say whether
            // there will be, so the blocks do not pop in a moment later.
            const tsWillHaveEmbedded = this.tsHasEmbeddedGenerationMetadata(tsAsset)
                || (tsDeps.pending && Boolean(tsAsset?.has_prompt || tsAsset?.has_workflow));
            return `${tsWillHaveEmbedded ? tsBuildImageMetaMarkup(tsAsset, tsDeps) : ""}${tsBuildTechnicalMetaMarkup(tsAsset, tsDeps)}`;
        }
        if (tsAsset?.type === "3d") {
            return tsBuild3DMetaMarkup(tsAsset, tsDeps);
        }
        if (tsAsset?.type === "image") {
            return `${tsBuildImageMetaMarkup(tsAsset, tsDeps)}${tsBuildImageTechnicalMarkup(tsAsset, tsDeps)}`;
        }
        return tsBuildPromptSeedMetaMarkup(tsAsset, tsDeps);
    }

    tsHasEmbeddedGenerationMetadata(tsAsset) {
        return Boolean(
            tsAsset?.prompt_text
            || tsAsset?.negative_prompt_text
            || tsAsset?.workflow_text
            || tsAsset?.seed
            || (Array.isArray(tsAsset?.models) && tsAsset.models.length > 0),
        );
    }

    tsBuildPromptMetaBlock(tsTitle, tsField, tsText, tsEmptyText) {
        return tsBuildPromptMetaBlock({
            title: tsTitle,
            field: tsField,
            text: tsText,
            emptyText: tsEmptyText,
            copyLabel: this.tsT("button.copy", "Copy"),
            escapeHTML: (tsTextValue) => this.tsEscapeHTML(tsTextValue),
            escapeAttribute: (tsTextValue) => this.tsEscapeAttribute(tsTextValue),
        });
    }

    tsBuildImageMetaMarkup(tsAsset) {
        return tsBuildImageMetaMarkup(tsAsset, this.tsGetMetaDeps(tsAsset));
    }

    tsBuild3DMetaMarkup(tsAsset) {
        return tsBuild3DMetaMarkup(tsAsset, this.tsGetMetaDeps(tsAsset));
    }

    tsBuildPromptSeedMetaMarkup(tsAsset) {
        return tsBuildPromptSeedMetaMarkup(tsAsset, this.tsGetMetaDeps(tsAsset));
    }

    tsBuildTechnicalMetaMarkup(tsAsset) {
        return tsBuildTechnicalMetaMarkup(tsAsset, this.tsGetMetaDeps(tsAsset));
    }

    tsGetMetaDeps(tsAsset = null) {
        return {
            t: (tsKey, tsFallback) => this.tsT(tsKey, tsFallback),
            escapeHTML: (tsText) => this.tsEscapeHTML(tsText),
            escapeAttribute: (tsText) => this.tsEscapeAttribute(tsText),
            formatBytes: (tsBytes) => tsFormatBytes(tsBytes),
            resolveChannelLayoutLabel: (tsChannelCount) => this.tsResolveChannelLayoutLabel(tsChannelCount),
            // The list card has no prompt or technical data; "not found"
            // would be a lie until the detail request has answered.
            pending: Boolean(tsAsset && !tsAsset.detail_loaded && tsAsset.id !== undefined),
        };
    }

    tsBuildSubtitle(tsAsset) {
        const tsLocation = `${tsAsset.root_label || tsAsset.root_id || ""}${tsAsset.folder_path ? ` / ${tsAsset.folder_path}` : ""}`;
        if (this.tsIsCompareMode() || this.tsItems.length < 2) {
            return tsLocation;
        }
        // Where the user is in the list. "+" while more pages can still load:
        // the total is not known yet.
        const tsMore = typeof this.tsCanLoadMore === "function" && this.tsCanLoadMore() ? "+" : "";
        const tsPosition = `${this.tsIndex + 1} / ${this.tsItems.length}${tsMore}`;
        return tsLocation ? `${tsPosition} · ${tsLocation}` : tsPosition;
    }

    tsRender() {
        if (!this.tsRefs) {
            return;
        }
        const tsAsset = this.tsIndex >= 0 ? this.tsItems[this.tsIndex] : null;
        const tsIsOpen = Boolean(tsAsset);
        this.tsRefs.tsRoot.dataset.open = String(tsIsOpen);
        this.style.pointerEvents = tsIsOpen ? "auto" : "none";
        const tsCloseLabel = this.tsT("button.close", "Close");
        const tsPrevLabel = this.tsT("button.prev", "Previous");
        const tsNextLabel = this.tsT("button.next", "Next");
        const tsLabelButton = (tsButton, tsText, tsTitle) => {
            if (tsButton.textContent !== tsText) {
                tsButton.textContent = tsText;
            }
            tsButton.title = tsTitle;
        };
        tsLabelButton(this.tsRefs.tsDownloadButton, this.tsT("button.download", "Download"), this.tsT("tooltip.viewerDownload", "Download the original file"));
        tsLabelButton(this.tsRefs.tsOpenInNewTabButton, this.tsT("button.openInNewTab", "Open In New Tab"), this.tsT("tooltip.viewerOpenTab", "Open the original file in a new browser tab"));
        tsLabelButton(this.tsRefs.tsShowInFolderButton, this.tsT("button.showInFolder", "Show In Folder"), this.tsT("tooltip.viewerShowInFolder", "Open the folder that holds this file, with the file selected"));
        tsLabelButton(
            this.tsRefs.tsDeleteButton,
            this.tsT("button.delete", "Delete"),
            tsAsset && !tsAsset.allow_delete
                ? this.tsT("tooltip.deleteNotAllowed", "Deleting is turned off for this folder")
                : this.tsT("tooltip.viewerDelete", "Move to the system trash (Delete)"),
        );
        tsLabelButton(this.tsRefs.tsCloseButton, tsCloseLabel, this.tsT("tooltip.viewerClose", "Close (Esc)"));
        this.tsRefs.tsHelpButton.title = this.tsT("tooltip.help", "Keyboard shortcuts (?)");
        this.tsRefs.tsHelpButton.setAttribute("aria-label", this.tsT("tooltip.help", "Keyboard shortcuts (?)"));
        this.tsRefs.tsCompareCloseButton.title = tsCloseLabel;
        this.tsRefs.tsCompareCloseButton.setAttribute("aria-label", tsCloseLabel);
        this.tsRefs.tsPrevButton.title = tsPrevLabel;
        this.tsRefs.tsPrevButton.setAttribute("aria-label", tsPrevLabel);
        this.tsRefs.tsNextButton.title = tsNextLabel;
        this.tsRefs.tsNextButton.setAttribute("aria-label", tsNextLabel);
        if (!tsIsOpen) {
            this.tsTeardownStage();
            this.tsRefs.tsRoot.dataset.compare = "false";
            this.tsRefs.tsTitle.textContent = "";
            this.tsRefs.tsSubtitle.textContent = "";
            delete this.tsRefs.tsStage.dataset.kind;
            this.tsRefs.tsStage.innerHTML = "";
            this.tsStageMarkup = "";
            this.tsRefs.tsMeta.innerHTML = "";
            this.tsLastMetaAssetId = null;
            this.tsLastMetaMarkup = "";
            return;
        }

        const tsCompareMode = this.tsIsCompareMode();
        const tsStageMarkup = this.tsBuildStageMarkup(tsAsset);
        // Rendering the SAME asset again - its detail arrived a moment after
        // the swap, the grid loaded another page, the locale changed - must
        // leave the stage alone, whatever it shows. Rebuilding it replaced the
        // <img> (a second blink, the zoom gone), restarted a playing video from
        // 0:00 and downloaded it again, stopped the audio, loaded a 3D model
        // into a second WebGL context, and snapped a comparison back.
        const tsStageIntact = tsAsset.type === "image" && !tsCompareMode
            ? Boolean(this.tsRefs.tsStage.querySelector(":scope > img"))
            : this.tsRefs.tsStage.childElementCount > 0;
        const tsKeepStage = tsStageMarkup === this.tsStageMarkup && tsStageIntact;
        if (!tsKeepStage) {
            this.tsTeardownStage();
        }
        const tsTitle = tsAsset.filename || this.tsT("label.asset", "Asset");
        if (this.tsRefs.tsTitle.textContent !== tsTitle) {
            this.tsRefs.tsTitle.textContent = tsTitle;
        }
        this.tsRefs.tsTitle.title = tsTitle;
        this.tsRefs.tsSubtitle.textContent = this.tsBuildSubtitle(tsAsset);
        this.tsRefs.tsStage.dataset.kind = tsAsset.type || "";
        this.tsRefs.tsRoot.dataset.compare = String(tsCompareMode);
        this.tsRefs.tsOpenInNewTabButton.hidden = tsAsset.type === "3d";
        this.tsRefs.tsDeleteButton.disabled = !tsAsset.allow_delete;
        if (!tsKeepStage) {
            this.tsRefs.tsStage.innerHTML = tsStageMarkup;
            this.tsStageMarkup = tsStageMarkup;
        }
        const tsMetaMarkup = this.tsBuildMetaMarkup(tsAsset);
        // A new asset starts at the top of its panel; the same asset keeps
        // its scroll, so its detail arriving does not throw the reader back.
        const tsSameMetaAsset = this.tsLastMetaAssetId === tsAsset.id;
        const tsMetaScrollTop = tsSameMetaAsset ? this.tsRefs.tsMeta.scrollTop : 0;
        if (this.tsLastMetaMarkup !== tsMetaMarkup || !tsSameMetaAsset) {
            this.tsRefs.tsMeta.innerHTML = tsMetaMarkup;
            this.tsLastMetaMarkup = tsMetaMarkup;
        }
        this.tsRefs.tsMeta.scrollTop = tsMetaScrollTop;
        this.tsRefs.tsMeta.dataset.pending = String(!tsAsset.detail_loaded);
        this.tsLastMetaAssetId = tsAsset.id;
        this.tsRefs.tsPrevButton.hidden = tsCompareMode;
        this.tsRefs.tsNextButton.hidden = tsCompareMode;
        this.tsRefs.tsPrevButton.disabled = tsCompareMode || this.tsIndex <= 0;
        this.tsRefs.tsNextButton.disabled = tsCompareMode || (this.tsIndex >= this.tsItems.length - 1
            && !(typeof this.tsCanLoadMore === "function" && this.tsCanLoadMore())
            && !this.tsMoreRequestPromise);
        if (!tsKeepStage) {
            this.tsBindStageInteractions(tsAsset);
        }
    }

    tsBindStageInteractions(tsAsset) {
        // A paused position is handed only from one single clip to the next;
        // anything else in between (a picture, a comparison) breaks the chain.
        if (tsAsset.type !== "video" || this.tsIsVideoCompareMode()) {
            this.tsVideoCarry = null;
        }
        if (tsAsset.type === "image") {
            this.tsStageCleanup = this.tsIsImageCompareMode()
                ? this.tsSetupImageCompareStage()
                : this.tsSetupImageStage(tsAsset);
            return;
        }
        if (tsAsset.type === "audio") {
            this.tsStageCleanup = this.tsSetupAudioStage(tsAsset);
            return;
        }
        if (tsAsset.type === "video") {
            this.tsStageCleanup = this.tsIsVideoCompareMode()
                ? this.tsSetupVideoCompareStage(tsAsset)
                : this.tsSetupVideoStage(tsAsset);
            return;
        }
        if (tsAsset.type === "3d") {
            this.tsStageCleanup = this.tsSetup3DStage(tsAsset);
            return;
        }
        this.tsStageCleanup = null;
        this.tsVideoFrameStepper = null;
        this.tsImageZoomHandler = null;
        this.tsCompareItems = [];
    }

    // Loading state, failure message and the fallback to a converted copy for
    // the one media element of a single-asset stage. Returns its cleanup.
    tsBindDisplayFallback(tsMedia, tsAsset) {
        const tsStage = this.tsRefs.tsStage;
        const tsStatus = tsStage?.querySelector(".ts-media-status");
        const tsIsVideo = tsMedia?.tagName === "VIDEO";
        const tsIsImage = tsMedia?.tagName === "IMG";
        // Already the converted copy: nothing better to fall back to.
        let tsOnProxy = tsAsset?.display_mode === "proxy";
        const tsSetStatus = (tsText, tsKind = "info") => {
            if (!tsStatus) {
                return;
            }
            tsStatus.hidden = !tsText;
            tsStatus.textContent = tsText || "";
            tsStatus.dataset.kind = tsKind;
        };
        const tsHandleReady = () => tsSetStatus("");
        const tsSwitchToProxy = () => {
            tsOnProxy = true;
            tsSetStatus(this.tsT("status.preparingPreview", "Preparing a viewable copy..."));
            tsMedia.src = tsApiURL(tsBuildForcedDisplayURL(tsAsset));
            if (tsIsVideo) {
                tsMedia.load();
            }
        };
        const tsHandleError = () => {
            if (!tsMedia.getAttribute("src")) {
                // The teardown clears src on purpose; that is not a failure.
                return;
            }
            if (!tsOnProxy && (tsAsset?.type === "video" || tsAsset?.type === "image")) {
                tsSwitchToProxy();
                return;
            }
            tsSetStatus(
                this.tsT("status.cannotDisplay", "This file cannot be shown in the browser. Download it to open it elsewhere."),
                "error",
            );
        };
        // A video whose sound the browser decodes but whose picture it does
        // not (ProRes in a MOV the codec list missed) loads "fine" at 0x0.
        const tsHandleMetadata = () => {
            if (tsIsVideo && !tsOnProxy && tsMedia.videoWidth === 0 && tsMedia.videoHeight === 0) {
                tsSwitchToProxy();
            }
        };
        const tsReadyEvent = tsIsImage ? "load" : "loadeddata";
        tsMedia.addEventListener(tsReadyEvent, tsHandleReady);
        tsMedia.addEventListener("error", tsHandleError);
        tsMedia.addEventListener("loadedmetadata", tsHandleMetadata);
        if (tsIsImage && tsMedia.complete) {
            if (tsMedia.naturalWidth > 0) {
                tsHandleReady();
            } else if (tsMedia.getAttribute("src")) {
                tsHandleError();
            }
        }
        return () => {
            tsMedia.removeEventListener(tsReadyEvent, tsHandleReady);
            tsMedia.removeEventListener("error", tsHandleError);
            tsMedia.removeEventListener("loadedmetadata", tsHandleMetadata);
        };
    }

    tsSetupVideoStage(tsAsset) {
        const tsStage = this.tsRefs.tsStage;
        const tsVideo = tsStage?.querySelector("video");
        const tsPrevFrameButton = tsStage?.querySelector(".ts-video-prev-frame");
        const tsNextFrameButton = tsStage?.querySelector(".ts-video-next-frame");
        const tsFrameLabel = tsStage?.querySelector(".ts-video-frame");
        if (!tsStage || !tsVideo || !tsPrevFrameButton || !tsNextFrameButton || !tsFrameLabel) {
            this.tsVideoFrameStepper = null;
            return null;
        }
        const tsStoredVolume = tsReadStoredVolume();
        if (tsStoredVolume) {
            tsVideo.volume = tsStoredVolume.tsVolume;
            tsVideo.muted = tsStoredVolume.tsMuted;
        }
        const tsHandleVolumeChange = () => tsStoreVolume(tsVideo);
        tsVideo.addEventListener("volumechange", tsHandleVolumeChange);
        const tsReleaseFallback = this.tsBindDisplayFallback(tsVideo, tsAsset);

        const tsResolveFPS = () => {
            const tsFPS = Number(tsAsset?.technical_info?.fps || tsAsset?.fps || 0);
            return Number.isFinite(tsFPS) && tsFPS > 0 ? tsFPS : 30;
        };

        const tsLoopButton = tsStage.querySelector(".ts-video-loop");
        const tsFirstFrameButton = tsStage.querySelector(".ts-video-first-frame");
        const tsLastFrameButton = tsStage.querySelector(".ts-video-last-frame");
        tsVideo.loop = tsReadLoopPreference();
        tsRenderLoopButton(tsLoopButton, tsVideo.loop);
        const tsHandleLoopClick = () => {
            tsVideo.loop = !tsVideo.loop;
            tsStoreLoopPreference(tsVideo.loop);
            tsRenderLoopButton(tsLoopButton, tsVideo.loop);
        };

        // Flipping from a clip the user left PAUSED opens the next one paused
        // at the same moment - on its own last frame if the previous clip sat
        // on its end. Stepping through generations that way compares the
        // frames you are looking at instead of restarting every clip. A clip
        // left playing hands nothing over, and the next one autoplays as before.
        const tsCarry = this.tsVideoCarry || null;
        this.tsVideoCarry = null;
        // Set once the user has done something that makes a pause deliberate:
        // the clip played, or they stepped or jumped. A clip still loading
        // reports paused too, and quick flipping must not freeze autoplay.
        let tsInspected = Boolean(tsCarry);
        let tsCarryMetadataHandler = null;
        if (tsCarry) {
            tsVideo.autoplay = false;
            tsVideo.removeAttribute?.("autoplay");
            tsVideo.pause();
            const tsApplyCarry = () => {
                try {
                    tsVideo.currentTime = tsResolveCarriedVideoTime(tsCarry, Number(tsVideo.duration || 0), tsResolveFPS());
                } catch {
                    // no-op
                }
                // A 0x0 picture is about to be swapped for the converted copy
                // (tsBindDisplayFallback); the position belongs to THAT one.
                if (tsCarryMetadataHandler && (tsVideo.videoWidth > 0 || tsVideo.videoHeight > 0)) {
                    tsVideo.removeEventListener("loadedmetadata", tsCarryMetadataHandler);
                    tsCarryMetadataHandler = null;
                }
            };
            if (tsVideo.readyState >= 1) {
                tsApplyCarry();
            } else {
                tsCarryMetadataHandler = tsApplyCarry;
                tsVideo.addEventListener("loadedmetadata", tsCarryMetadataHandler);
            }
        }
        const tsHandlePlaying = () => {
            tsInspected = true;
        };
        const tsFormatFrameText = () => {
            // A finished clip sits exactly on `duration`, one frame past the
            // last one there is; it reads as the last frame, like End.
            const tsDuration = Number(tsVideo.duration || 0);
            const tsTime = tsDuration > 0
                ? Math.min(Number(tsVideo.currentTime || 0), tsResolveLastFrameTime(tsDuration, tsResolveFPS()))
                : tsVideo.currentTime;
            const tsFrameIndex = tsResolveVideoFrameIndex(tsTime, tsResolveFPS());
            return `${this.tsT("label.currentFrame", "Frame")} ${tsFrameIndex}`;
        };
        const tsUpdateFrameLabel = () => {
            // Runs every animation frame while playing; a DOM write only when
            // the frame number actually changed (the compare stage already
            // did this).
            const tsText = tsFormatFrameText();
            if (tsFrameLabel.textContent !== tsText) {
                tsFrameLabel.textContent = tsText;
            }
        };
        let tsAnimationFrameId = 0;
        const tsStopTicker = () => {
            if (tsAnimationFrameId) {
                window.cancelAnimationFrame(tsAnimationFrameId);
                tsAnimationFrameId = 0;
            }
        };
        const tsTick = () => {
            tsUpdateFrameLabel();
            if (!tsVideo.paused && !tsVideo.ended) {
                tsAnimationFrameId = window.requestAnimationFrame(tsTick);
            } else {
                tsAnimationFrameId = 0;
            }
        };
        const tsStartTicker = () => {
            if (!tsAnimationFrameId) {
                tsAnimationFrameId = window.requestAnimationFrame(tsTick);
            }
        };
        const tsStepFrame = (tsDirection) => {
            tsInspected = true;
            tsVideo.pause();
            tsVideo.currentTime = tsResolveVideoFrameTime(
                tsVideo.currentTime,
                tsResolveFPS(),
                tsDirection,
                Number(tsVideo.duration || 0),
            );
            tsUpdateFrameLabel();
        };
        // Home / End and the ⇤ ⇥ buttons: first frame, or the middle of the
        // last one (exactly `duration` is past it).
        const tsJumpToEdge = (tsEdge) => {
            const tsDuration = Number(tsVideo.duration || 0);
            if (!(tsDuration > 0)) {
                return;
            }
            tsInspected = true;
            tsVideo.pause();
            tsVideo.currentTime = tsEdge > 0 ? tsResolveLastFrameTime(tsDuration, tsResolveFPS()) : 0;
            tsUpdateFrameLabel();
        };
        const tsHandleFirstFrame = () => tsJumpToEdge(-1);
        const tsHandleLastFrame = () => tsJumpToEdge(1);

        const tsHandleLoadedMetadata = () => tsUpdateFrameLabel();
        const tsHandleTimeUpdate = () => tsUpdateFrameLabel();
        const tsHandleSeeked = () => tsUpdateFrameLabel();
        const tsHandlePause = () => {
            tsStopTicker();
            tsUpdateFrameLabel();
        };
        const tsHandlePlay = () => tsStartTicker();
        const tsHandlePrevFrame = () => tsStepFrame(-1);
        const tsHandleNextFrame = () => tsStepFrame(1);

        this.tsVideoFrameStepper = tsStepFrame;
        this.tsMediaEdgeJumper = tsJumpToEdge;
        tsPrevFrameButton.addEventListener("click", tsHandlePrevFrame);
        tsNextFrameButton.addEventListener("click", tsHandleNextFrame);
        tsFirstFrameButton?.addEventListener("click", tsHandleFirstFrame);
        tsLastFrameButton?.addEventListener("click", tsHandleLastFrame);
        tsLoopButton?.addEventListener("click", tsHandleLoopClick);
        tsVideo.addEventListener("loadedmetadata", tsHandleLoadedMetadata);
        tsVideo.addEventListener("timeupdate", tsHandleTimeUpdate);
        tsVideo.addEventListener("seeked", tsHandleSeeked);
        tsVideo.addEventListener("pause", tsHandlePause);
        tsVideo.addEventListener("play", tsHandlePlay);
        tsVideo.addEventListener("playing", tsHandlePlaying);
        tsVideo.addEventListener("ended", tsHandlePause);
        tsUpdateFrameLabel();
        if (!tsVideo.paused) {
            tsStartTicker();
        }

        return () => {
            // What the next clip inherits (see tsCarry above). Read before the
            // source is released, which resets the element.
            const tsDuration = Number(tsVideo.duration || 0);
            if (tsVideo.readyState >= 1 && tsDuration > 0) {
                this.tsVideoCarry = tsInspected && (tsVideo.paused || tsVideo.ended)
                    ? {
                        tsTime: Number(tsVideo.currentTime || 0),
                        tsAtEnd: tsVideo.ended || tsIsOnLastFrame(tsVideo.currentTime, tsDuration, tsResolveFPS()),
                    }
                    : null;
            } else {
                // Flipped past before it even loaded: pass the inherited
                // position on unchanged.
                this.tsVideoCarry = tsCarry;
            }
            tsStopTicker();
            this.tsVideoFrameStepper = null;
            this.tsMediaEdgeJumper = null;
            if (tsCarryMetadataHandler) {
                tsVideo.removeEventListener("loadedmetadata", tsCarryMetadataHandler);
            }
            tsPrevFrameButton.removeEventListener("click", tsHandlePrevFrame);
            tsNextFrameButton.removeEventListener("click", tsHandleNextFrame);
            tsFirstFrameButton?.removeEventListener("click", tsHandleFirstFrame);
            tsLastFrameButton?.removeEventListener("click", tsHandleLastFrame);
            tsLoopButton?.removeEventListener("click", tsHandleLoopClick);
            tsVideo.removeEventListener("loadedmetadata", tsHandleLoadedMetadata);
            tsVideo.removeEventListener("timeupdate", tsHandleTimeUpdate);
            tsVideo.removeEventListener("seeked", tsHandleSeeked);
            tsVideo.removeEventListener("pause", tsHandlePause);
            tsVideo.removeEventListener("play", tsHandlePlay);
            tsVideo.removeEventListener("playing", tsHandlePlaying);
            tsVideo.removeEventListener("ended", tsHandlePause);
            tsVideo.removeEventListener("volumechange", tsHandleVolumeChange);
            tsReleaseFallback();
            tsReleaseMediaSource(tsVideo);
        };
    }

    tsSetupVideoCompareStage(tsAsset) {
        const tsStage = this.tsRefs.tsStage;
        const tsVideos = Array.from(tsStage?.querySelectorAll(".ts-compare-video") || []);
        const tsPlayToggleButton = tsStage?.querySelector(".ts-video-play-toggle");
        const tsSeekInput = tsStage?.querySelector(".ts-video-seek");
        const tsTimeLabel = tsStage?.querySelector(".ts-video-time");
        const tsPrevFrameButton = tsStage?.querySelector(".ts-video-prev-frame");
        const tsNextFrameButton = tsStage?.querySelector(".ts-video-next-frame");
        const tsFrameLabel = tsStage?.querySelector(".ts-video-frame");
        if (
            !tsStage
            || tsVideos.length < 2
            || !tsPlayToggleButton
            || !tsSeekInput
            || !tsTimeLabel
            || !tsPrevFrameButton
            || !tsNextFrameButton
            || !tsFrameLabel
        ) {
            this.tsVideoFrameStepper = null;
            return null;
        }

        const tsStatusLabel = tsStage?.querySelector(".ts-video-compare-status");
        const tsPrimaryVideo = tsVideos.find((tsVideo) => tsVideo.dataset.primary === "true") || tsVideos[0];
        // How far ahead a clip must be buffered before playback resumes. The
        // stall threshold (readyState < HAVE_FUTURE_DATA) and this one are
        // deliberately different: with a single threshold the group would
        // oscillate between running and re-stalling at the boundary.
        const tsResumeBufferSeconds = 0.25;
        // The correction loop runs on a timer, NOT on requestAnimationFrame.
        // rAF stops dead the moment the tab is not the foreground one, while
        // the clips keep decoding and playing — so the group drifted apart
        // unwatched and only "froze" (a large catch-up seek) once you came
        // back. A timer is merely throttled in the background, so the group
        // stays corrected. 100 ms is far below the 350 ms seek threshold and
        // still cheap.
        const tsTickIntervalMs = 100;
        let tsTickerId = 0;
        let tsSyncing = false;
        let tsSeekDragging = false;
        let tsResumeAfterSeek = false;
        // What the USER asked for, which is not the same as "the master
        // element is playing": while the group waits for a slow clip every
        // element is paused, yet the transport must still read Pause and the
        // ticker must keep running so playback can resume by itself.
        let tsDesiredPlaying = false;
        let tsBuffering = false;
        let tsTransportKey = "";

        tsVideos.forEach((tsVideo) => {
            tsVideo.controls = false;
            tsVideo.muted = tsVideo !== tsPrimaryVideo;
        });
        // The compare stage hides the native controls, and with them the only
        // way to silence the clip whose sound plays. Its own toggle shares the
        // volume memory of the single-video player.
        const tsMuteButton = tsStage.querySelector(".ts-video-mute");
        const tsStoredVolume = tsReadStoredVolume();
        if (tsStoredVolume) {
            tsPrimaryVideo.volume = tsStoredVolume.tsVolume;
            tsPrimaryVideo.muted = tsStoredVolume.tsMuted;
        }
        const tsRenderMute = () => {
            if (!tsMuteButton) {
                return;
            }
            tsMuteButton.textContent = tsPrimaryVideo.muted
                ? this.tsT("button.unmute", "Unmute")
                : this.tsT("button.mute", "Mute");
            tsMuteButton.setAttribute("aria-pressed", String(Boolean(tsPrimaryVideo.muted)));
        };
        const tsHandleMuteClick = () => {
            tsPrimaryVideo.muted = !tsPrimaryVideo.muted;
            tsStoreVolume(tsPrimaryVideo);
            tsRenderMute();
        };
        tsMuteButton?.addEventListener("click", tsHandleMuteClick);
        tsRenderMute();
        // The group is driven by hand (the elements never loop themselves),
        // so Loop decides what the end of the master clip does: start the
        // group over, or park every clip on its own last frame.
        const tsLoopButton = tsStage.querySelector(".ts-video-loop");
        const tsFirstFrameButton = tsStage.querySelector(".ts-video-first-frame");
        const tsLastFrameButton = tsStage.querySelector(".ts-video-last-frame");
        let tsLoop = tsReadLoopPreference();
        tsRenderLoopButton(tsLoopButton, tsLoop);
        const tsHandleLoopClick = () => {
            tsLoop = !tsLoop;
            tsStoreLoopPreference(tsLoop);
            tsRenderLoopButton(tsLoopButton, tsLoop);
        };
        tsLoopButton?.addEventListener("click", tsHandleLoopClick);
        // True while every clip sits on its OWN last frame (End, or the end of
        // playback). Clips of different lengths then show different
        // timestamps on purpose, and the usual "snap the followers to the
        // master" on seek must leave them there.
        let tsEachAtOwnEnd = false;

        const tsResolveFPS = () => {
            const tsFPS = Number(tsAsset?.technical_info?.fps || tsAsset?.fps || 0);
            return Number.isFinite(tsFPS) && tsFPS > 0 ? tsFPS : 30;
        };
        const tsFormatFrameText = (tsCurrentTime = Number(tsPrimaryVideo.currentTime || 0)) => {
            const tsDuration = Number(tsPrimaryVideo.duration || 0);
            const tsTime = tsDuration > 0
                ? Math.min(tsCurrentTime, tsResolveLastFrameTime(tsDuration, tsResolveFPS()))
                : tsCurrentTime;
            const tsFrameIndex = tsResolveVideoFrameIndex(tsTime, tsResolveFPS());
            return `${this.tsT("label.currentFrame", "Frame")} ${tsFrameIndex}`;
        };
        const tsGetDuration = () => {
            const tsDuration = Number(tsPrimaryVideo.duration || 0);
            return Number.isFinite(tsDuration) && tsDuration > 0 ? tsDuration : 0;
        };
        const tsClampVideoTime = (tsVideo, tsTargetTime, tsFrameDuration = 0) => {
            const tsDuration = Number(tsVideo.duration || 0);
            if (!Number.isFinite(tsDuration) || tsDuration <= 0) {
                return Math.max(0, Number(tsTargetTime) || 0);
            }
            const tsMaxTime = Math.max(0, tsDuration - Math.max(0, tsFrameDuration / 2));
            return Math.max(0, Math.min(tsMaxTime, Number(tsTargetTime) || 0));
        };
        const tsSetAllCurrentTimes = (tsTargetTime, tsFrameDuration = 0) => {
            tsSyncing = true;
            try {
                tsVideos.forEach((tsVideo) => {
                    try {
                        tsVideo.currentTime = tsClampVideoTime(tsVideo, tsTargetTime, tsFrameDuration);
                    } catch {
                        // no-op
                    }
                });
            } finally {
                tsSyncing = false;
            }
        };
        const tsIsAtEnd = (tsVideo) => {
            const tsDuration = Number(tsVideo.duration || 0);
            return Number.isFinite(tsDuration)
                && tsDuration > 0
                && Number(tsVideo.currentTime || 0) >= tsDuration - 0.001;
        };
        const tsBufferedAhead = (tsVideo) => {
            const tsCurrentTime = Number(tsVideo.currentTime || 0);
            const tsRanges = tsVideo.buffered;
            if (!tsRanges) {
                return 0;
            }
            for (let tsIndex = 0; tsIndex < tsRanges.length; tsIndex += 1) {
                if (tsCurrentTime >= tsRanges.start(tsIndex) - 0.05 && tsCurrentTime <= tsRanges.end(tsIndex)) {
                    return Math.max(0, tsRanges.end(tsIndex) - tsCurrentTime);
                }
            }
            return 0;
        };
        // A clip that failed to load, or that is simply shorter than the rest,
        // must never hold the group hostage: it counts as ready and is left
        // parked on its last frame.
        const tsIsSettled = (tsVideo) => Boolean(tsVideo.error) || tsVideo.ended || tsIsAtEnd(tsVideo);
        const tsIsVideoReady = (tsVideo) => tsIsSettled(tsVideo)
            || (tsVideo.readyState >= 3 && tsBufferedAhead(tsVideo) >= tsResumeBufferSeconds);
        // A clip in the middle of a seek reports readyState 2 for a frame or
        // two. Counting that as a stall makes the group hold, re-align, seek
        // again and hold again — an infinite loop that looks exactly like the
        // freeze this engine exists to prevent.
        const tsIsVideoStalled = (tsVideo) => !tsIsSettled(tsVideo) && !tsVideo.seeking && tsVideo.readyState < 3;
        const tsAllVideosReady = () => tsVideos.every(tsIsVideoReady);
        const tsAnyVideoStalled = () => tsVideos.some(tsIsVideoStalled);
        // Three ways to converge, because a seek costs nothing while paused and
        // a lot while playing:
        //   "auto"   - during playback: nudge with playbackRate, seek only past
        //              the hard limit.
        //   "resume" - about to start playing: seek anything outside the
        //              tolerance, but leave already-aligned clips alone. A
        //              redundant seek here stalls the decoder and drops the
        //              group straight back into buffering.
        //   "align"  - paused (pause, scrub, frame step): snap every clip to
        //              the exact same timestamp. Nothing is decoding, so this
        //              is free, and a paused comparison has to be exact.
        const tsExactAlignSeconds = 0.001;
        const tsApplySync = (tsMode = "auto") => {
            if (tsSyncing) {
                return;
            }
            const tsAligning = tsMode === "align";
            const tsForce = tsAligning || tsMode === "resume";
            const tsMasterTime = Math.max(0, Number(tsPrimaryVideo.currentTime || 0));
            const tsMasterRate = Number(tsPrimaryVideo.playbackRate || 1) || 1;
            tsSyncing = true;
            try {
                tsVideos.forEach((tsVideo) => {
                    if (tsVideo === tsPrimaryVideo || tsVideo.error) {
                        return;
                    }
                    if (tsIsAtEnd(tsVideo) && !tsForce) {
                        return;
                    }
                    const tsDrift = Number(tsVideo.currentTime || 0) - tsMasterTime;
                    const tsCorrection = tsResolveCompareSyncCorrection(tsDrift, tsMasterRate);
                    const tsNeedsSeek = tsAligning
                        ? Math.abs(tsDrift) > tsExactAlignSeconds
                        : (tsForce ? tsCorrection.tsAction !== "hold" : tsCorrection.tsAction === "seek");
                    if (tsNeedsSeek) {
                        // Never stack a seek on a seek — the second one cancels
                        // the first and the clip visibly stutters in place.
                        if (!tsVideo.seeking) {
                            try {
                                tsVideo.currentTime = tsClampVideoTime(tsVideo, tsMasterTime);
                            } catch {
                                // no-op
                            }
                        }
                    }
                    const tsNextRate = tsForce ? tsMasterRate : tsCorrection.tsPlaybackRate;
                    if (Math.abs((Number(tsVideo.playbackRate || 1) || 1) - tsNextRate) > 0.001) {
                        try {
                            tsVideo.playbackRate = tsNextRate;
                        } catch {
                            // no-op
                        }
                    }
                });
            } finally {
                tsSyncing = false;
            }
        };
        const tsUpdateTransport = () => {
            const tsDuration = tsGetDuration();
            const tsCurrentTime = Math.max(0, Number(tsPrimaryVideo.currentTime || 0));
            const tsTimeText = `${tsFormatTime(tsCurrentTime)} / ${tsFormatTime(tsDuration)}`;
            const tsFrameText = tsFormatFrameText(tsCurrentTime);
            const tsToggleText = tsDesiredPlaying ? this.tsT("button.pause", "Pause") : this.tsT("button.play", "Play");
            const tsStatusText = tsBuffering ? this.tsT("status.compareBuffering", "Syncing clips...") : "";
            // This runs on every animation frame, so nothing is written back
            // unless it actually changed — four unconditional textContent
            // writes per frame are enough to keep the compositor busy.
            const tsNextKey = `${tsToggleText}|${tsTimeText}|${tsFrameText}|${tsStatusText}|${tsDuration}`;
            if (tsNextKey !== tsTransportKey) {
                tsTransportKey = tsNextKey;
                tsPlayToggleButton.textContent = tsToggleText;
                tsTimeLabel.textContent = tsTimeText;
                tsFrameLabel.textContent = tsFrameText;
                tsSeekInput.max = String(Math.max(0, tsDuration));
                tsSeekInput.disabled = tsDuration <= 0;
                if (tsStatusLabel) {
                    tsStatusLabel.textContent = tsStatusText;
                    tsStatusLabel.dataset.active = tsStatusText ? "true" : "false";
                }
            }
            if (!tsSeekDragging) {
                tsSeekInput.value = String(tsDuration > 0 ? Math.min(tsDuration, tsCurrentTime) : 0);
            }
        };
        const tsStopTicker = () => {
            if (tsTickerId) {
                window.clearInterval(tsTickerId);
                tsTickerId = 0;
            }
        };
        const tsHoldForBuffering = () => {
            if (!tsDesiredPlaying || tsBuffering) {
                return;
            }
            tsBuffering = true;
            // Everything stops together. Letting the healthy clips run on while
            // one buffers is what produced the drift the old code then tried to
            // seek away, one hitch at a time.
            tsSyncing = true;
            try {
                tsVideos.forEach((tsVideo) => tsVideo.pause());
            } finally {
                tsSyncing = false;
            }
            tsUpdateTransport();
        };
        const tsStartPlayback = () => {
            tsApplySync("resume");
            const tsPlaybackRate = Number(tsPrimaryVideo.playbackRate || 1) || 1;
            tsVideos.forEach((tsVideo) => {
                if (tsVideo.error || (tsVideo !== tsPrimaryVideo && tsIsAtEnd(tsVideo))) {
                    return;
                }
                try {
                    tsVideo.playbackRate = tsPlaybackRate;
                } catch {
                    // no-op
                }
                const tsPlayPromise = tsVideo.play();
                if (tsPlayPromise && typeof tsPlayPromise.catch === "function") {
                    tsPlayPromise.catch(() => {});
                }
            });
            tsUpdateTransport();
        };
        const tsTick = () => {
            if (tsDesiredPlaying) {
                if (tsBuffering) {
                    if (tsAllVideosReady()) {
                        tsBuffering = false;
                        tsStartPlayback();
                    }
                } else if (tsAnyVideoStalled()) {
                    tsHoldForBuffering();
                } else {
                    tsApplySync("auto");
                }
            }
            tsUpdateTransport();
        };
        const tsStartTicker = () => {
            if (!tsTickerId) {
                tsTickerId = window.setInterval(tsTick, tsTickIntervalMs);
            }
        };
        const tsPauseAll = (tsForceSync = true) => {
            tsDesiredPlaying = false;
            tsBuffering = false;
            tsSyncing = true;
            try {
                tsVideos.forEach((tsVideo) => tsVideo.pause());
            } finally {
                tsSyncing = false;
            }
            if (tsForceSync) {
                tsApplySync("align");
            }
            tsStopTicker();
            tsUpdateTransport();
        };
        const tsPlayAll = () => {
            if (
                tsEachAtOwnEnd
                || tsPrimaryVideo.ended
                || tsIsAtEnd(tsPrimaryVideo)
                || tsIsOnLastFrame(tsPrimaryVideo.currentTime, tsGetDuration(), tsResolveFPS())
            ) {
                // Play on a finished group means replay, not a no-op (nor a
                // single frame and stop again).
                tsSetAllCurrentTimes(0);
            }
            tsEachAtOwnEnd = false;
            tsDesiredPlaying = true;
            tsBuffering = !tsAllVideosReady();
            tsStartTicker();
            if (tsBuffering) {
                tsUpdateTransport();
                return;
            }
            tsStartPlayback();
        };
        const tsHandleTogglePlay = () => {
            if (tsDesiredPlaying) {
                tsPauseAll(true);
                return;
            }
            tsPlayAll();
        };
        const tsHandleSeekPointerDown = () => {
            tsEachAtOwnEnd = false;
            tsSeekDragging = true;
            tsResumeAfterSeek = tsDesiredPlaying;
            if (tsResumeAfterSeek) {
                tsPauseAll(false);
            }
        };
        const tsHandleSeekInput = () => {
            tsEachAtOwnEnd = false;
            const tsNextTime = Math.max(0, Number(tsSeekInput.value || 0));
            tsSetAllCurrentTimes(tsNextTime);
            tsUpdateTransport();
        };
        const tsHandleSeekCommit = () => {
            tsSeekDragging = false;
            tsApplySync("align");
            tsUpdateTransport();
            if (tsResumeAfterSeek) {
                tsResumeAfterSeek = false;
                tsPlayAll();
            }
        };
        const tsStepFrame = (tsDirection) => {
            const tsFPS = tsResolveFPS();
            const tsTargetTime = tsResolveVideoFrameTime(
                Number(tsPrimaryVideo.currentTime || 0),
                tsFPS,
                tsDirection,
                tsGetDuration(),
            );
            tsPauseAll(false);
            tsEachAtOwnEnd = false;
            tsSetAllCurrentTimes(tsTargetTime, 1 / tsFPS);
            tsUpdateTransport();
        };
        // Home / End and the ⇤ ⇥ buttons. End puts EVERY clip on its own last
        // frame, not on the master's timestamp: comparing how each generation
        // ends is the point, and a shorter clip has no frame at a longer
        // clip's last timestamp.
        const tsJumpToEdge = (tsEdge) => {
            tsPauseAll(false);
            const tsFPS = tsResolveFPS();
            tsSyncing = true;
            try {
                tsVideos.forEach((tsVideo) => {
                    try {
                        tsVideo.currentTime = tsEdge > 0
                            ? tsResolveLastFrameTime(Number(tsVideo.duration || 0), tsFPS)
                            : 0;
                    } catch {
                        // no-op
                    }
                });
            } finally {
                tsSyncing = false;
            }
            tsEachAtOwnEnd = tsEdge > 0;
            tsUpdateTransport();
        };
        const tsHandleFirstFrame = () => tsJumpToEdge(-1);
        const tsHandleLastFrame = () => tsJumpToEdge(1);
        const tsHandlePrimaryLoadedMetadata = () => tsUpdateTransport();
        const tsHandlePrimaryDurationChange = () => tsUpdateTransport();
        const tsHandlePrimaryTimeUpdate = () => tsUpdateTransport();
        const tsHandlePrimarySeeked = () => {
            if (!tsSeekDragging && !tsDesiredPlaying && !tsEachAtOwnEnd) {
                tsApplySync("align");
            }
            tsUpdateTransport();
        };
        const tsHandlePrimaryPause = () => {
            // A pause the engine issued itself (buffering hold) must not be
            // read as the user stopping playback.
            if (!tsDesiredPlaying) {
                tsStopTicker();
            }
            tsUpdateTransport();
        };
        const tsHandlePrimaryEnded = () => {
            if (tsLoop) {
                tsPauseAll(false);
                tsSetAllCurrentTimes(0);
                tsPlayAll();
                return;
            }
            tsJumpToEdge(1);
        };
        const tsHandlePrimaryRateChange = () => {
            tsApplySync("resume");
            tsUpdateTransport();
        };
        // Readiness is a property of the GROUP, so every clip reports in — the
        // one that stalls is rarely the master.
        const tsHandleVideoStall = () => {
            if (tsDesiredPlaying && !tsBuffering) {
                tsHoldForBuffering();
            }
        };
        const tsHandleVideoReady = () => {
            if (tsDesiredPlaying && tsBuffering && tsAllVideosReady()) {
                tsBuffering = false;
                tsStartPlayback();
            }
        };
        const tsHandleVisibilityChange = () => {
            // Background timers are throttled to about once a second, so the
            // group can come back noticeably apart. Re-align once on return
            // instead of waiting for the drift to cross the seek threshold.
            if (!document.hidden && tsDesiredPlaying && !tsBuffering) {
                tsApplySync("resume");
            }
        };
        const tsHandlePrevFrame = () => tsStepFrame(-1);
        const tsHandleNextFrame = () => tsStepFrame(1);

        this.tsVideoFrameStepper = tsStepFrame;
        this.tsMediaEdgeJumper = tsJumpToEdge;
        tsFirstFrameButton?.addEventListener("click", tsHandleFirstFrame);
        tsLastFrameButton?.addEventListener("click", tsHandleLastFrame);
        tsPlayToggleButton.addEventListener("click", tsHandleTogglePlay);
        tsSeekInput.addEventListener("pointerdown", tsHandleSeekPointerDown);
        tsSeekInput.addEventListener("pointerup", tsHandleSeekCommit);
        tsSeekInput.addEventListener("pointercancel", tsHandleSeekCommit);
        tsSeekInput.addEventListener("input", tsHandleSeekInput);
        tsSeekInput.addEventListener("change", tsHandleSeekCommit);
        tsPrevFrameButton.addEventListener("click", tsHandlePrevFrame);
        tsNextFrameButton.addEventListener("click", tsHandleNextFrame);
        tsPrimaryVideo.addEventListener("loadedmetadata", tsHandlePrimaryLoadedMetadata);
        tsPrimaryVideo.addEventListener("durationchange", tsHandlePrimaryDurationChange);
        tsPrimaryVideo.addEventListener("timeupdate", tsHandlePrimaryTimeUpdate);
        tsPrimaryVideo.addEventListener("seeked", tsHandlePrimarySeeked);
        tsPrimaryVideo.addEventListener("pause", tsHandlePrimaryPause);
        tsPrimaryVideo.addEventListener("ended", tsHandlePrimaryEnded);
        tsPrimaryVideo.addEventListener("ratechange", tsHandlePrimaryRateChange);
        tsVideos.forEach((tsVideo) => {
            tsVideo.addEventListener("waiting", tsHandleVideoStall);
            tsVideo.addEventListener("stalled", tsHandleVideoStall);
            tsVideo.addEventListener("canplay", tsHandleVideoReady);
            tsVideo.addEventListener("canplaythrough", tsHandleVideoReady);
            tsVideo.addEventListener("loadeddata", tsHandleVideoReady);
            tsVideo.addEventListener("error", tsHandleVideoReady);
        });
        document.addEventListener("visibilitychange", tsHandleVisibilityChange);
        tsUpdateTransport();

        return () => {
            tsStopTicker();
            this.tsVideoFrameStepper = null;
            this.tsMediaEdgeJumper = null;
            document.removeEventListener("visibilitychange", tsHandleVisibilityChange);
            tsMuteButton?.removeEventListener("click", tsHandleMuteClick);
            tsLoopButton?.removeEventListener("click", tsHandleLoopClick);
            tsFirstFrameButton?.removeEventListener("click", tsHandleFirstFrame);
            tsLastFrameButton?.removeEventListener("click", tsHandleLastFrame);
            tsPlayToggleButton.removeEventListener("click", tsHandleTogglePlay);
            tsSeekInput.removeEventListener("pointerdown", tsHandleSeekPointerDown);
            tsSeekInput.removeEventListener("pointerup", tsHandleSeekCommit);
            tsSeekInput.removeEventListener("pointercancel", tsHandleSeekCommit);
            tsSeekInput.removeEventListener("input", tsHandleSeekInput);
            tsSeekInput.removeEventListener("change", tsHandleSeekCommit);
            tsPrevFrameButton.removeEventListener("click", tsHandlePrevFrame);
            tsNextFrameButton.removeEventListener("click", tsHandleNextFrame);
            tsPrimaryVideo.removeEventListener("loadedmetadata", tsHandlePrimaryLoadedMetadata);
            tsPrimaryVideo.removeEventListener("durationchange", tsHandlePrimaryDurationChange);
            tsPrimaryVideo.removeEventListener("timeupdate", tsHandlePrimaryTimeUpdate);
            tsPrimaryVideo.removeEventListener("seeked", tsHandlePrimarySeeked);
            tsPrimaryVideo.removeEventListener("pause", tsHandlePrimaryPause);
            tsPrimaryVideo.removeEventListener("ended", tsHandlePrimaryEnded);
            tsPrimaryVideo.removeEventListener("ratechange", tsHandlePrimaryRateChange);
            tsVideos.forEach((tsVideo) => {
                tsVideo.removeEventListener("waiting", tsHandleVideoStall);
                tsVideo.removeEventListener("stalled", tsHandleVideoStall);
                tsVideo.removeEventListener("canplay", tsHandleVideoReady);
                tsVideo.removeEventListener("canplaythrough", tsHandleVideoReady);
                tsVideo.removeEventListener("loadeddata", tsHandleVideoReady);
                tsVideo.removeEventListener("error", tsHandleVideoReady);
                tsReleaseMediaSource(tsVideo);
            });
        };
    }

    tsSetupImageCompareStage() {
        const tsStage = this.tsRefs.tsStage;
        const tsShell = tsStage?.querySelector(".ts-image-compare-shell");
        const tsImages = Array.from(tsShell?.querySelectorAll(".ts-compare-image") || []);
        if (!tsShell || !tsImages.length) {
            this.tsImageZoomHandler = null;
            return null;
        }
        // Present only in the two-image wipe layout. Its absence is what marks
        // the grid layout, where a left drag is free to pan because there is no
        // divider to drag.
        const tsRange = tsShell.querySelector(".ts-image-compare-range");
        const tsWipe = tsShell.querySelector(".ts-image-compare-wipe");
        const tsZoomLabel = tsShell.querySelector(".ts-image-compare-zoom");

        const tsApplyWipe = () => {
            if (!tsRange) {
                return;
            }
            const tsValue = Math.max(0, Math.min(100, Number(tsRange.value || 50)));
            tsShell.style.setProperty("--ts-wipe", `${tsValue}%`);
        };

        // One scale and one offset drive EVERY image: two renders compared at
        // different zooms, or at different corners, are not a comparison.
        const tsZoomLimits = tsViewerSettings.imageZoom;
        let tsScale = 1;
        let tsTranslateX = 0;
        let tsTranslateY = 0;
        let tsPanning = false;
        let tsPointerId = null;
        let tsPanStartX = 0;
        let tsPanStartY = 0;
        let tsPanOriginX = 0;
        let tsPanOriginY = 0;

        // The box one image is laid out in: the whole wipe area, or the card
        // under the cursor in the grid layout.
        const tsResolveFrame = (tsClientX = null, tsClientY = null) => {
            if (tsWipe) {
                return tsWipe;
            }
            if (tsClientX !== null && tsClientY !== null) {
                for (const tsImage of tsImages) {
                    const tsCard = tsImage.parentElement;
                    const tsRect = tsCard?.getBoundingClientRect();
                    if (tsRect
                        && tsClientX >= tsRect.left && tsClientX <= tsRect.right
                        && tsClientY >= tsRect.top && tsClientY <= tsRect.bottom) {
                        return tsCard;
                    }
                }
            }
            return tsImages[0].parentElement || tsShell;
        };

        // object-fit: contain means the PICTURE is smaller than the box it sits
        // in. Clamping against the box instead would let a pan wander off into
        // the letterbox, and the zoom readout would lie.
        // Measured from the FIRST image: one scale drives them all, so when the
        // sources differ in size "100%" can only be exact for one of them, and
        // the first is the one the user picked to compare against.
        const tsGetRenderedSize = (tsFrame) => {
            const tsBoxWidth = tsFrame?.clientWidth || 0;
            const tsBoxHeight = tsFrame?.clientHeight || 0;
            const tsNaturalWidth = Number(tsImages[0].naturalWidth) || 0;
            const tsNaturalHeight = Number(tsImages[0].naturalHeight) || 0;
            if (!tsBoxWidth || !tsBoxHeight || !tsNaturalWidth || !tsNaturalHeight) {
                return { tsWidth: tsBoxWidth, tsHeight: tsBoxHeight, tsFit: 0 };
            }
            const tsFit = Math.min(tsBoxWidth / tsNaturalWidth, tsBoxHeight / tsNaturalHeight);
            return { tsWidth: tsNaturalWidth * tsFit, tsHeight: tsNaturalHeight * tsFit, tsFit };
        };

        // "100%" means one image pixel per screen pixel, so it depends on how
        // far the image was scaled down to fit in the first place.
        const tsGetNativeScale = () => {
            const tsFit = tsGetRenderedSize(tsResolveFrame()).tsFit;
            return tsFit > 0 ? 1 / tsFit : 1;
        };
        const tsGetMaxScale = () => Math.max(tsZoomLimits.max, tsGetNativeScale());
        const tsClampScale = (tsValue) => Math.max(tsZoomLimits.min, Math.min(tsGetMaxScale(), tsValue));

        const tsClampTranslate = () => {
            const tsFrame = tsResolveFrame();
            const tsRendered = tsGetRenderedSize(tsFrame);
            const tsMaxX = Math.max(0, ((tsRendered.tsWidth * tsScale) - (tsFrame?.clientWidth || 0)) / 2);
            const tsMaxY = Math.max(0, ((tsRendered.tsHeight * tsScale) - (tsFrame?.clientHeight || 0)) / 2);
            tsTranslateX = Math.max(-tsMaxX, Math.min(tsMaxX, tsTranslateX));
            tsTranslateY = Math.max(-tsMaxY, Math.min(tsMaxY, tsTranslateY));
        };

        const tsApplyTransform = () => {
            if (tsScale <= 1.001) {
                tsScale = 1;
                tsTranslateX = 0;
                tsTranslateY = 0;
            } else {
                tsClampTranslate();
            }
            const tsTransform = tsScale === 1
                ? ""
                : `translate(${tsTranslateX}px, ${tsTranslateY}px) scale(${tsScale})`;
            tsImages.forEach((tsImage) => {
                tsImage.style.transform = tsTransform;
            });
            tsShell.dataset.zoomed = String(tsScale > 1);
            tsShell.dataset.panning = String(tsPanning);
            if (tsZoomLabel) {
                const tsFit = tsGetRenderedSize(tsResolveFrame()).tsFit;
                const tsPercent = Math.round(tsScale * (tsFit > 0 ? tsFit : 1) * 100);
                tsZoomLabel.textContent = `${tsPercent}%`;
                tsZoomLabel.dataset.active = String(tsScale > 1.001);
            }
        };

        const tsZoomAround = (tsNextScale, tsClientX, tsClientY) => {
            const tsFrame = tsResolveFrame(tsClientX, tsClientY);
            const tsRect = tsFrame.getBoundingClientRect();
            const tsPointX = tsClientX - (tsRect.left + (tsRect.width / 2));
            const tsPointY = tsClientY - (tsRect.top + (tsRect.height / 2));
            const tsLocalX = (tsPointX - tsTranslateX) / tsScale;
            const tsLocalY = (tsPointY - tsTranslateY) / tsScale;
            tsScale = tsNextScale;
            tsTranslateX = tsPointX - (tsLocalX * tsScale);
            tsTranslateY = tsPointY - (tsLocalY * tsScale);
            tsApplyTransform();
        };

        const tsZoomTo = (tsNextScale, tsClientX = null, tsClientY = null) => {
            const tsTarget = tsClampScale(tsNextScale);
            if (Math.abs(tsTarget - tsScale) < 0.0001) {
                return;
            }
            if (tsClientX === null || tsClientY === null) {
                // Keyboard zoom has no cursor, so it holds the frame centre.
                const tsRect = tsResolveFrame().getBoundingClientRect();
                tsZoomAround(tsTarget, tsRect.left + (tsRect.width / 2), tsRect.top + (tsRect.height / 2));
                return;
            }
            tsZoomAround(tsTarget, tsClientX, tsClientY);
        };

        const tsResetZoom = () => {
            tsScale = 1;
            tsTranslateX = 0;
            tsTranslateY = 0;
            tsPanning = false;
            tsPointerId = null;
            tsApplyTransform();
        };

        const tsHandleWheel = (tsEvent) => {
            // A trackpad pinch arrives as Ctrl+wheel. It zooms the comparison,
            // exactly as it zooms a single image; letting it through zoomed the
            // whole ComfyUI page instead, and only in this one mode.
            tsEvent.preventDefault();
            tsZoomTo(
                tsScale * tsResolveWheelZoomFactor(tsEvent.deltaY, tsEvent.deltaMode, tsZoomLimits.stepIn),
                tsEvent.clientX,
                tsEvent.clientY,
            );
        };

        // In the wipe layout a left drag belongs to the divider, so panning is
        // the middle button (and the arrow keys). In the grid layout there is
        // nothing to drag, so the left button pans too.
        const tsCanPanWithButton = (tsButton) => (tsRange ? tsButton === 1 : (tsButton === 0 || tsButton === 1));

        const tsHandlePointerDown = (tsEvent) => {
            if (tsScale <= 1 || !tsCanPanWithButton(tsEvent.button)) {
                return;
            }
            tsEvent.preventDefault();
            tsPanning = true;
            tsPointerId = tsEvent.pointerId;
            tsPanStartX = tsEvent.clientX;
            tsPanStartY = tsEvent.clientY;
            tsPanOriginX = tsTranslateX;
            tsPanOriginY = tsTranslateY;
            tsShell.setPointerCapture?.(tsPointerId);
            tsApplyTransform();
        };

        const tsHandlePointerMove = (tsEvent) => {
            if (!tsPanning || tsEvent.pointerId !== tsPointerId) {
                return;
            }
            tsEvent.preventDefault();
            tsTranslateX = tsPanOriginX + (tsEvent.clientX - tsPanStartX);
            tsTranslateY = tsPanOriginY + (tsEvent.clientY - tsPanStartY);
            tsApplyTransform();
        };

        const tsStopPanning = (tsEvent) => {
            if (!tsPanning) {
                return;
            }
            if (tsEvent && tsPointerId !== null && tsEvent.pointerId !== tsPointerId) {
                return;
            }
            tsPanning = false;
            if (tsEvent && tsPointerId !== null) {
                try {
                    tsShell.releasePointerCapture?.(tsPointerId);
                } catch {
                    // no-op
                }
            }
            tsPointerId = null;
            tsApplyTransform();
        };

        const tsPreventMiddleDefault = (tsEvent) => {
            if (tsEvent.button === 1) {
                tsEvent.preventDefault();
            }
        };

        // A resize changes the fit scale under our feet, and every offset was
        // computed against the old box.
        const tsHandleResize = () => tsResetZoom();
        const tsHandleImageLoad = () => tsApplyTransform();

        this.tsImageZoomHandler = {
            tsZoomBy: (tsFactor) => tsZoomTo(tsScale * tsFactor),
            tsZoomToNative: () => {
                const tsNativeScale = tsGetNativeScale();
                // Already at native pixels: the useful second press is "back to
                // fit", the same toggle the single-image stage does on click.
                if (Math.abs(tsScale - tsNativeScale) < 0.01 || tsNativeScale <= 1.02) {
                    tsResetZoom();
                    return;
                }
                tsZoomTo(tsNativeScale);
            },
            tsReset: tsResetZoom,
            tsIsZoomed: () => tsScale > 1.001,
            tsPanBy: (tsDeltaX, tsDeltaY) => {
                if (tsScale <= 1.001) {
                    return false;
                }
                tsTranslateX += tsDeltaX;
                tsTranslateY += tsDeltaY;
                tsApplyTransform();
                return true;
            },
        };

        tsImages.forEach((tsImage) => {
            tsImage.draggable = false;
            tsImage.addEventListener("load", tsHandleImageLoad);
        });
        tsRange?.addEventListener("input", tsApplyWipe);
        tsRange?.addEventListener("change", tsApplyWipe);
        tsShell.addEventListener("wheel", tsHandleWheel, { passive: false });
        tsShell.addEventListener("pointerdown", tsHandlePointerDown);
        tsShell.addEventListener("pointermove", tsHandlePointerMove);
        tsShell.addEventListener("pointerup", tsStopPanning);
        tsShell.addEventListener("pointercancel", tsStopPanning);
        tsShell.addEventListener("lostpointercapture", tsStopPanning);
        tsShell.addEventListener("mousedown", tsPreventMiddleDefault);
        tsShell.addEventListener("auxclick", tsPreventMiddleDefault);
        window.addEventListener("resize", tsHandleResize);
        tsApplyWipe();
        tsApplyTransform();

        return () => {
            tsStopPanning();
            this.tsImageZoomHandler = null;
            tsImages.forEach((tsImage) => {
                tsImage.removeEventListener("load", tsHandleImageLoad);
                tsImage.style.transform = "";
            });
            tsRange?.removeEventListener("input", tsApplyWipe);
            tsRange?.removeEventListener("change", tsApplyWipe);
            tsShell.removeEventListener("wheel", tsHandleWheel);
            tsShell.removeEventListener("pointerdown", tsHandlePointerDown);
            tsShell.removeEventListener("pointermove", tsHandlePointerMove);
            tsShell.removeEventListener("pointerup", tsStopPanning);
            tsShell.removeEventListener("pointercancel", tsStopPanning);
            tsShell.removeEventListener("lostpointercapture", tsStopPanning);
            tsShell.removeEventListener("mousedown", tsPreventMiddleDefault);
            tsShell.removeEventListener("auxclick", tsPreventMiddleDefault);
            window.removeEventListener("resize", tsHandleResize);
            delete tsShell.dataset.zoomed;
            delete tsShell.dataset.panning;
        };
    }

    tsSetup3DStage(tsAsset) {
        const tsStage = this.tsRefs.tsStage;
        const tsShell = tsStage?.querySelector(".ts-3d-shell");
        const tsHost = tsStage?.querySelector(".ts-3d-viewer-host");
        const tsStatus = tsStage?.querySelector(".ts-3d-status");
        if (!tsStage || !tsShell || !tsHost) {
            return null;
        }

        let tsDisposed = false;
        let tsViewerController = null;
        let tsResizeObserver = null;
        let tsCanvas = null;
        // Every (re)load gets a token; a load that finishes after a newer one
        // started, or after the stage closed, cleans up after itself.
        let tsLoadToken = 0;

        // A failed load or a lost WebGL context used to leave a dead status
        // line with no way forward but closing the lightbox.
        const tsRetryButton = document.createElement("button");
        tsRetryButton.type = "button";
        tsRetryButton.className = "ts-3d-retry";
        tsRetryButton.textContent = this.tsT("empty.retryAction", "Try again");
        tsRetryButton.hidden = true;
        tsShell.append(tsRetryButton);

        const tsShowStatus = (tsText) => {
            if (!tsStatus) {
                return;
            }
            tsStatus.textContent = tsText || "";
            tsStatus.hidden = !tsText;
        };

        const tsSetReady = (tsReady) => {
            tsShell.dataset.ready = String(Boolean(tsReady));
        };

        const tsHandleResize = () => {
            try {
                tsViewerController?.handleResize?.();
            } catch {
                // no-op
            }
        };

        const tsHandleMouseEnter = () => {
            try {
                tsViewerController?.updateStatusMouseOnViewer?.(true);
            } catch {
                // no-op
            }
        };

        const tsHandleMouseLeave = () => {
            try {
                tsViewerController?.updateStatusMouseOnViewer?.(false);
            } catch {
                // no-op
            }
        };

        const tsDisposeController = () => {
            tsCanvas?.removeEventListener("webglcontextlost", tsHandleContextLost);
            tsCanvas = null;
            try {
                tsViewerController?.remove?.();
            } catch {
                // no-op
            }
            tsViewerController = null;
            tsHost.replaceChildren();
            tsSetReady(false);
        };

        const tsFail = (tsText) => {
            tsShowStatus(tsText);
            tsRetryButton.hidden = false;
        };

        // The GPU reset, the driver restarted, or too many WebGL contexts were
        // open: the canvas goes blank and nothing ever redraws it. Drop the
        // dead viewer, fall back to the thumbnail, and offer to load again.
        function tsHandleContextLost(tsEvent) {
            tsEvent?.preventDefault?.();
            if (tsDisposed) {
                return;
            }
            tsDisposeController();
            tsFail(tsContextLostText);
        }
        const tsContextLostText = this.tsT("status.3dContextLost", "The 3D view was lost (the graphics card reset or ran out of memory).");

        const tsLoad = async () => {
            const tsToken = ++tsLoadToken;
            const tsIsCurrent = () => !tsDisposed && tsToken === tsLoadToken;
            tsRetryButton.hidden = true;
            tsShowStatus(this.tsT("status.loading3dViewer", "Loading 3D viewer..."));
            tsSetReady(false);
            let tsController = null;
            try {
                const tsLoad3dClass = await tsLoad3DViewerClass();
                if (!tsIsCurrent()) {
                    return;
                }
                if (!tsLoad3dClass) {
                    tsShowStatus(this.tsT("status.no3dViewer", "3D viewer unavailable."));
                    return;
                }
                const tsViewerURL = tsAsset.viewer_3d_url ? tsApiURL(tsAsset.viewer_3d_url) : null;
                const tsExtension = tsResolve3DViewerFileExtension(tsViewerURL || "");
                if (!tsViewerURL || !tsExtension) {
                    tsShowStatus(this.tsT("status.no3dViewer", "3D viewer unavailable."));
                    return;
                }
                tsController = new tsLoad3dClass(tsHost, { width: 800, height: 600, isViewerMode: true });
                tsViewerController = tsController;
                tsController.cameraManager?.reset?.();
                tsController.controlsManager?.reset?.();
                tsController.modelManager?.clearModel?.();
                tsController.animationManager?.dispose?.();
                const tsLoaded = await tsController.loaderManager?.loadModelInternal?.(tsViewerURL, tsExtension);
                // Same unwrap contract as tsCapture3DThumbnail: current ComfyUI
                // resolves loadModelInternal to a wrapper (or nothing, with the
                // model landing on the model manager); passing the wrapper to
                // setupModel throws "e.traverse is not a function".
                let tsModel = tsResolveLoadedObject3D(tsLoaded);
                if (!tsModel) {
                    await tsController.loaderManager?.whenLoadIdle?.();
                    tsModel = tsController.modelManager?.currentModel || null;
                }
                if (!tsModel) {
                    throw new Error("3D model load returned no model");
                }
                if (tsController.modelManager?.currentModel !== tsModel) {
                    await tsController.modelManager?.setupModel?.(tsModel);
                }
                if (tsController.modelManager?.currentModel) {
                    tsController.animationManager?.setupModelAnimations?.(
                        tsController.modelManager.currentModel,
                        tsController.modelManager.originalModel,
                    );
                }
                tsController.handleResize?.();
                if (!tsIsCurrent()) {
                    if (tsViewerController === tsController) {
                        tsDisposeController();
                    } else {
                        tsController.remove?.();
                    }
                    return;
                }
                tsCanvas = tsHost.querySelector("canvas");
                tsCanvas?.addEventListener("webglcontextlost", tsHandleContextLost);
                tsSetReady(true);
                tsShowStatus("");
                tsHandleResize();
            } catch {
                if (tsIsCurrent()) {
                    tsDisposeController();
                    tsFail(this.tsT("status.failed3dViewer", "Failed to open 3D viewer."));
                }
            }
        };

        const tsHandleRetry = () => {
            tsDisposeController();
            void tsLoad();
        };

        tsRetryButton.addEventListener("click", tsHandleRetry);
        tsHost.addEventListener("mouseenter", tsHandleMouseEnter);
        tsHost.addEventListener("mouseleave", tsHandleMouseLeave);
        if (typeof ResizeObserver === "function") {
            tsResizeObserver = new ResizeObserver(() => tsHandleResize());
            tsResizeObserver.observe(tsStage);
        }
        void tsLoad();

        return () => {
            tsDisposed = true;
            tsResizeObserver?.disconnect();
            tsRetryButton.removeEventListener("click", tsHandleRetry);
            tsHost.removeEventListener("mouseenter", tsHandleMouseEnter);
            tsHost.removeEventListener("mouseleave", tsHandleMouseLeave);
            tsDisposeController();
            tsRetryButton.remove();
            tsShowStatus("");
        };
    }
    tsSetupImageStage(tsAsset) {
        const tsStage = this.tsRefs.tsStage;
        const tsImage = tsStage.querySelector(":scope > img");
        if (!tsStage || !tsImage) {
            return null;
        }
        const tsReleaseFallback = this.tsBindDisplayFallback(tsImage, tsAsset);

        const tsZoomLimits = {
            tsMin: tsViewerSettings.imageZoom.min,
            tsMax: tsViewerSettings.imageZoom.max,
            tsStepIn: tsViewerSettings.imageZoom.stepIn,
            tsStepOut: tsViewerSettings.imageZoom.stepOut,
        };
        let tsScale = 1;
        let tsTranslateX = 0;
        let tsTranslateY = 0;
        let tsPanning = false;
        let tsPointerId = null;
        let tsPanStartX = 0;
        let tsPanStartY = 0;
        let tsPanOriginX = 0;
        let tsPanOriginY = 0;
        let tsPointerMoved = false;
        let tsPointerDownX = 0;
        let tsPointerDownY = 0;
        let tsNavigatorDragging = false;
        // Active two-finger pinch (touch screens), see tsHandleTouchDown.
        let tsPinch = null;

        // Navigator (minimap): only meaningful once the image is larger than
        // the stage, which is exactly when panning starts to feel blind.
        const tsNavigator = document.createElement("div");
        tsNavigator.className = "ts-image-navigator";
        tsNavigator.hidden = true;
        const tsNavigatorImage = document.createElement("img");
        tsNavigatorImage.className = "ts-image-navigator-image";
        tsNavigatorImage.draggable = false;
        tsNavigatorImage.alt = "";
        // The cached thumbnail, not the original: the minimap is ~148px wide,
        // so pointing it at the full-resolution file would keep a second
        // full-size decoded bitmap alive for the whole lightbox session.
        tsNavigatorImage.src = tsAsset?.preview_url
            ? tsApiURL(tsAsset.preview_url)
            : (tsImage.getAttribute("src") || "");
        const tsNavigatorView = document.createElement("div");
        tsNavigatorView.className = "ts-image-navigator-view";
        tsNavigator.append(tsNavigatorImage, tsNavigatorView);
        tsStage.append(tsNavigator);
        // How far in the user is, in real pixels: 100% means one file pixel
        // per screen pixel. The compare stage always had this readout.
        const tsZoomIndicator = document.createElement("div");
        tsZoomIndicator.className = "ts-image-compare-zoom ts-image-zoom-indicator";
        tsZoomIndicator.dataset.active = "false";
        tsZoomIndicator.setAttribute("aria-live", "polite");
        tsStage.append(tsZoomIndicator);

        const tsGetBaseSize = () => ({
            tsWidth: tsImage.offsetWidth || tsImage.clientWidth || 0,
            tsHeight: tsImage.offsetHeight || tsImage.clientHeight || 0,
        });

        const tsGetNativeScale = () => {
            // "100%" = one image pixel per screen pixel. The <img> is laid out
            // to fit the stage, so the factor is natural / displayed size.
            const tsBase = tsGetBaseSize();
            const tsNaturalWidth = Number(tsImage.naturalWidth) || Number(tsAsset?.width) || 0;
            if (!tsBase.tsWidth || !tsNaturalWidth) {
                return 1;
            }
            return tsNaturalWidth / tsBase.tsWidth;
        };

        const tsGetMaxScale = () => Math.max(tsZoomLimits.tsMax, tsGetNativeScale());

        const tsUpdateZoomIndicator = () => {
            const tsZoomed = tsScale > 1.001;
            tsZoomIndicator.dataset.active = String(tsZoomed);
            if (tsZoomed) {
                const tsNativeScale = Math.max(0.0001, tsGetNativeScale());
                const tsText = `${Math.round((tsScale / tsNativeScale) * 100)}%`;
                if (tsZoomIndicator.textContent !== tsText) {
                    tsZoomIndicator.textContent = tsText;
                }
            }
        };

        const tsClampTranslate = () => {
            const tsBase = tsGetBaseSize();
            const tsStageWidth = tsStage.clientWidth || 0;
            const tsStageHeight = tsStage.clientHeight || 0;
            const tsScaledWidth = tsBase.tsWidth * tsScale;
            const tsScaledHeight = tsBase.tsHeight * tsScale;
            const tsMaxX = Math.max(0, (tsScaledWidth - tsStageWidth) / 2);
            const tsMaxY = Math.max(0, (tsScaledHeight - tsStageHeight) / 2);
            tsTranslateX = Math.max(-tsMaxX, Math.min(tsMaxX, tsTranslateX));
            tsTranslateY = Math.max(-tsMaxY, Math.min(tsMaxY, tsTranslateY));
        };

        const tsUpdateNavigator = () => {
            if (tsScale <= 1.001) {
                tsNavigator.hidden = true;
                return;
            }
            const tsBase = tsGetBaseSize();
            const tsScaledWidth = tsBase.tsWidth * tsScale;
            const tsScaledHeight = tsBase.tsHeight * tsScale;
            if (!tsScaledWidth || !tsScaledHeight) {
                tsNavigator.hidden = true;
                return;
            }
            tsNavigator.hidden = false;
            const tsNavigatorWidth = tsNavigator.clientWidth || 0;
            const tsNavigatorHeight = tsNavigator.clientHeight || 0;
            const tsViewFractionX = Math.min(1, (tsStage.clientWidth || 0) / tsScaledWidth);
            const tsViewFractionY = Math.min(1, (tsStage.clientHeight || 0) / tsScaledHeight);
            // Where the stage centre sits inside the image, 0..1.
            const tsCentreX = 0.5 - (tsTranslateX / tsScaledWidth);
            const tsCentreY = 0.5 - (tsTranslateY / tsScaledHeight);
            const tsViewWidth = tsNavigatorWidth * tsViewFractionX;
            const tsViewHeight = tsNavigatorHeight * tsViewFractionY;
            const tsViewLeft = Math.max(0, Math.min(tsNavigatorWidth - tsViewWidth, (tsNavigatorWidth * tsCentreX) - (tsViewWidth / 2)));
            const tsViewTop = Math.max(0, Math.min(tsNavigatorHeight - tsViewHeight, (tsNavigatorHeight * tsCentreY) - (tsViewHeight / 2)));
            tsNavigatorView.style.width = `${tsViewWidth}px`;
            tsNavigatorView.style.height = `${tsViewHeight}px`;
            tsNavigatorView.style.transform = `translate(${tsViewLeft}px, ${tsViewTop}px)`;
        };

        const tsApplyTransform = () => {
            if (tsScale <= 1.001) {
                tsScale = 1;
                tsTranslateX = 0;
                tsTranslateY = 0;
            } else {
                tsClampTranslate();
            }
            tsStage.dataset.imageZoomable = "true";
            tsStage.dataset.zoomed = String(tsScale > 1);
            tsStage.dataset.panning = String(tsPanning || tsNavigatorDragging || Boolean(tsPinch));
            // The cursor promises only what a click will do: zoom in where
            // the file has more pixels than the screen shows, nothing where it
            // does not (a click on a small image used to show zoom-in and do
            // nothing), zoom out once zoomed.
            tsStage.dataset.canZoom = String(tsScale > 1.001 || tsGetNativeScale() > 1.02);
            tsImage.style.transform = `translate(${tsTranslateX}px, ${tsTranslateY}px) scale(${tsScale})`;
            tsUpdateNavigator();
            tsUpdateZoomIndicator();
        };

        const tsGetStagePoint = (tsClientX, tsClientY) => {
            const tsRect = tsStage.getBoundingClientRect();
            return {
                tsX: tsClientX - (tsRect.left + (tsRect.width / 2)),
                tsY: tsClientY - (tsRect.top + (tsRect.height / 2)),
            };
        };

        const tsZoomAroundPoint = (tsNextScale, tsClientX, tsClientY) => {
            const tsPoint = tsGetStagePoint(tsClientX, tsClientY);
            const tsLocalX = (tsPoint.tsX - tsTranslateX) / tsScale;
            const tsLocalY = (tsPoint.tsY - tsTranslateY) / tsScale;
            tsScale = tsNextScale;
            tsTranslateX = tsPoint.tsX - (tsLocalX * tsScale);
            tsTranslateY = tsPoint.tsY - (tsLocalY * tsScale);
            tsApplyTransform();
        };

        const tsHandleWheel = (tsEvent) => {
            tsEvent.preventDefault();
            const tsNextScale = Math.max(
                tsZoomLimits.tsMin,
                Math.min(
                    tsGetMaxScale(),
                    tsScale * tsResolveWheelZoomFactor(tsEvent.deltaY, tsEvent.deltaMode, tsZoomLimits.tsStepIn),
                ),
            );
            if (Math.abs(tsNextScale - tsScale) < 0.0001) {
                return;
            }
            tsZoomAroundPoint(tsNextScale, tsEvent.clientX, tsEvent.clientY);
        };

        const tsHandleStageClick = (tsEvent) => {
            // Click-to-100%: the single most common thing to want on a
            // generated image is "show me the real pixels here". Ignored when
            // the pointer actually dragged (that was a pan), when the image is
            // already smaller than the stage (100% would shrink it), or when
            // the click landed on the navigator.
            if (tsEvent.button !== 0 || tsPointerMoved || tsNavigator.contains(tsEvent.target)) {
                return;
            }
            // The second click of a double-click: the first one already
            // zoomed, and toggling straight back out read as a flicker.
            if (tsEvent.detail > 1) {
                return;
            }
            const tsNativeScale = tsGetNativeScale();
            if (tsScale > 1.001) {
                tsScale = 1;
                tsTranslateX = 0;
                tsTranslateY = 0;
                tsApplyTransform();
                return;
            }
            if (tsNativeScale <= 1.02) {
                return;
            }
            tsZoomAroundPoint(Math.min(tsGetMaxScale(), tsNativeScale), tsEvent.clientX, tsEvent.clientY);
        };

        const tsApplyNavigatorPoint = (tsClientX, tsClientY) => {
            const tsRect = tsNavigator.getBoundingClientRect();
            if (!tsRect.width || !tsRect.height) {
                return;
            }
            const tsBase = tsGetBaseSize();
            const tsNormalizedX = Math.max(0, Math.min(1, (tsClientX - tsRect.left) / tsRect.width));
            const tsNormalizedY = Math.max(0, Math.min(1, (tsClientY - tsRect.top) / tsRect.height));
            tsTranslateX = -((tsNormalizedX - 0.5) * tsBase.tsWidth * tsScale);
            tsTranslateY = -((tsNormalizedY - 0.5) * tsBase.tsHeight * tsScale);
            tsApplyTransform();
        };

        const tsHandleNavigatorPointerDown = (tsEvent) => {
            if (tsEvent.button !== 0) {
                return;
            }
            tsEvent.preventDefault();
            tsEvent.stopPropagation();
            tsNavigatorDragging = true;
            // "panning" switches the 110 ms transform transition off, as a
            // direct drag on the image does; without it the view trailed the
            // pointer on the minimap.
            tsStage.dataset.panning = "true";
            tsNavigator.setPointerCapture?.(tsEvent.pointerId);
            tsApplyNavigatorPoint(tsEvent.clientX, tsEvent.clientY);
        };

        const tsHandleNavigatorPointerMove = (tsEvent) => {
            if (!tsNavigatorDragging) {
                return;
            }
            tsEvent.preventDefault();
            tsApplyNavigatorPoint(tsEvent.clientX, tsEvent.clientY);
        };

        const tsHandleNavigatorPointerUp = (tsEvent) => {
            if (!tsNavigatorDragging) {
                return;
            }
            tsNavigatorDragging = false;
            tsStage.dataset.panning = String(tsPanning);
            try {
                tsNavigator.releasePointerCapture?.(tsEvent.pointerId);
            } catch {
                // no-op
            }
        };

        const tsHandlePointerDown = (tsEvent) => {
            tsPointerMoved = false;
            tsPointerDownX = tsEvent.clientX;
            tsPointerDownY = tsEvent.clientY;
            if ((tsEvent.button !== 0 && tsEvent.button !== 1) || tsScale <= 1) {
                return;
            }
            tsEvent.preventDefault();
            tsPanning = true;
            tsPointerId = tsEvent.pointerId;
            tsPanStartX = tsEvent.clientX;
            tsPanStartY = tsEvent.clientY;
            tsPanOriginX = tsTranslateX;
            tsPanOriginY = tsTranslateY;
            tsStage.setPointerCapture?.(tsPointerId);
            tsApplyTransform();
        };

        const tsHandlePointerMove = (tsEvent) => {
            if (!tsPointerMoved
                && (Math.abs(tsEvent.clientX - tsPointerDownX) > 4 || Math.abs(tsEvent.clientY - tsPointerDownY) > 4)) {
                tsPointerMoved = true;
            }
            if (!tsPanning || tsEvent.pointerId !== tsPointerId) {
                return;
            }
            tsEvent.preventDefault();
            tsTranslateX = tsPanOriginX + (tsEvent.clientX - tsPanStartX);
            tsTranslateY = tsPanOriginY + (tsEvent.clientY - tsPanStartY);
            tsApplyTransform();
        };

        const tsStopPanning = (tsEvent) => {
            if (!tsPanning) {
                return;
            }
            if (tsEvent && tsPointerId !== null && tsEvent.pointerId !== tsPointerId) {
                return;
            }
            tsPanning = false;
            if (tsEvent && tsPointerId !== null) {
                try {
                    tsStage.releasePointerCapture?.(tsPointerId);
                } catch {
                    // no-op
                }
            }
            tsPointerId = null;
            tsApplyTransform();
        };

        const tsPreventMiddleDefault = (tsEvent) => {
            if (tsEvent.button === 1) {
                tsEvent.preventDefault();
            }
        };

        const tsHandleReset = () => {
            tsScale = 1;
            tsTranslateX = 0;
            tsTranslateY = 0;
            tsPanning = false;
            tsPointerId = null;
            tsApplyTransform();
        };

        // Two-finger pinch on a touch screen: zoom around the midpoint of the
        // fingers, and moving both fingers pans. The wheel handler covers a
        // trackpad pinch; a touch screen sends pointers, not wheel events.
        const tsTouchPoints = new Map();
        const tsPinchGeometry = () => {
            const [tsFirst, tsSecond] = [...tsTouchPoints.values()];
            return {
                tsDistance: Math.hypot(tsSecond.x - tsFirst.x, tsSecond.y - tsFirst.y),
                tsMidX: (tsFirst.x + tsSecond.x) / 2,
                tsMidY: (tsFirst.y + tsSecond.y) / 2,
            };
        };
        const tsHandleTouchDown = (tsEvent) => {
            if (tsEvent.pointerType !== "touch") {
                return;
            }
            tsTouchPoints.set(tsEvent.pointerId, { x: tsEvent.clientX, y: tsEvent.clientY });
            if (tsTouchPoints.size === 2) {
                // A second finger turns a one-finger pan into a pinch.
                tsStopPanning();
                tsPointerMoved = true;
                const tsGeometry = tsPinchGeometry();
                tsPinch = { ...tsGeometry, tsStartScale: tsScale };
                tsStage.dataset.panning = "true";
            }
        };
        const tsHandleTouchMove = (tsEvent) => {
            if (!tsTouchPoints.has(tsEvent.pointerId)) {
                return;
            }
            tsTouchPoints.set(tsEvent.pointerId, { x: tsEvent.clientX, y: tsEvent.clientY });
            if (!tsPinch || tsTouchPoints.size !== 2) {
                return;
            }
            tsEvent.preventDefault();
            const tsGeometry = tsPinchGeometry();
            const tsNextScale = Math.max(
                tsZoomLimits.tsMin,
                Math.min(tsGetMaxScale(), tsPinch.tsStartScale * (tsGeometry.tsDistance / Math.max(1, tsPinch.tsDistance))),
            );
            // Pan by the midpoint's travel, then zoom around where it is now.
            tsTranslateX += tsGeometry.tsMidX - tsPinch.tsMidX;
            tsTranslateY += tsGeometry.tsMidY - tsPinch.tsMidY;
            tsPinch.tsMidX = tsGeometry.tsMidX;
            tsPinch.tsMidY = tsGeometry.tsMidY;
            tsZoomAroundPoint(tsNextScale, tsGeometry.tsMidX, tsGeometry.tsMidY);
        };
        const tsHandleTouchUp = (tsEvent) => {
            if (!tsTouchPoints.delete(tsEvent.pointerId)) {
                return;
            }
            if (tsTouchPoints.size < 2 && tsPinch) {
                tsPinch = null;
                tsStage.dataset.panning = "false";
                tsApplyTransform();
            }
        };

        // The same contract the compare stage publishes, so the viewer's zoom
        // keys work on a single image without knowing which stage is up.
        this.tsImageZoomHandler = {
            tsZoomBy: (tsFactor) => {
                const tsRect = tsStage.getBoundingClientRect();
                const tsNextScale = Math.max(
                    tsZoomLimits.tsMin,
                    Math.min(tsGetMaxScale(), tsScale * tsFactor),
                );
                if (Math.abs(tsNextScale - tsScale) < 0.0001) {
                    return;
                }
                tsZoomAroundPoint(tsNextScale, tsRect.left + (tsRect.width / 2), tsRect.top + (tsRect.height / 2));
            },
            tsZoomToNative: () => {
                const tsNativeScale = tsGetNativeScale();
                if (tsScale > 1.001 || tsNativeScale <= 1.02) {
                    tsHandleReset();
                    return;
                }
                const tsRect = tsStage.getBoundingClientRect();
                tsZoomAroundPoint(
                    Math.min(tsGetMaxScale(), tsNativeScale),
                    tsRect.left + (tsRect.width / 2),
                    tsRect.top + (tsRect.height / 2),
                );
            },
            tsReset: tsHandleReset,
            tsIsZoomed: () => tsScale > 1.001,
            tsPanBy: (tsDeltaX, tsDeltaY) => {
                if (tsScale <= 1.001) {
                    return false;
                }
                tsTranslateX += tsDeltaX;
                tsTranslateY += tsDeltaY;
                tsApplyTransform();
                return true;
            },
        };

        tsImage.draggable = false;
        tsStage.addEventListener("wheel", tsHandleWheel, { passive: false });
        tsStage.addEventListener("pointerdown", tsHandleTouchDown);
        tsStage.addEventListener("pointermove", tsHandleTouchMove, { passive: false });
        tsStage.addEventListener("pointerup", tsHandleTouchUp);
        tsStage.addEventListener("pointercancel", tsHandleTouchUp);
        tsStage.addEventListener("pointerdown", tsHandlePointerDown);
        tsStage.addEventListener("pointermove", tsHandlePointerMove);
        tsStage.addEventListener("pointerup", tsStopPanning);
        tsStage.addEventListener("pointercancel", tsStopPanning);
        tsStage.addEventListener("lostpointercapture", tsStopPanning);
        tsStage.addEventListener("mousedown", tsPreventMiddleDefault);
        tsStage.addEventListener("auxclick", tsPreventMiddleDefault);
        tsStage.addEventListener("click", tsHandleStageClick);
        tsNavigator.addEventListener("pointerdown", tsHandleNavigatorPointerDown);
        tsNavigator.addEventListener("pointermove", tsHandleNavigatorPointerMove);
        tsNavigator.addEventListener("pointerup", tsHandleNavigatorPointerUp);
        tsNavigator.addEventListener("pointercancel", tsHandleNavigatorPointerUp);
        // A window resize keeps the zoom and re-clamps the pan to the new box.
        // Throwing the zoom away on every resize lost the user's place for
        // something as small as the devtools panel opening.
        const tsHandleResize = () => {
            tsScale = Math.max(tsZoomLimits.tsMin, Math.min(tsScale, tsGetMaxScale()));
            tsApplyTransform();
        };
        const tsHandleImageLoad = () => {
            tsUpdateNavigator();
            // naturalWidth is known only now; the cursor and readout depend
            // on it.
            tsApplyTransform();
        };
        tsImage.addEventListener("load", tsHandleImageLoad);
        window.addEventListener("resize", tsHandleResize);
        tsApplyTransform();

        return () => {
            tsStopPanning();
            this.tsImageZoomHandler = null;
            window.removeEventListener("resize", tsHandleResize);
            tsStage.removeEventListener("wheel", tsHandleWheel);
            tsStage.removeEventListener("pointerdown", tsHandleTouchDown);
            tsStage.removeEventListener("pointermove", tsHandleTouchMove);
            tsStage.removeEventListener("pointerup", tsHandleTouchUp);
            tsStage.removeEventListener("pointercancel", tsHandleTouchUp);
            tsStage.removeEventListener("pointerdown", tsHandlePointerDown);
            tsStage.removeEventListener("pointermove", tsHandlePointerMove);
            tsStage.removeEventListener("pointerup", tsStopPanning);
            tsStage.removeEventListener("pointercancel", tsStopPanning);
            tsStage.removeEventListener("lostpointercapture", tsStopPanning);
            tsStage.removeEventListener("mousedown", tsPreventMiddleDefault);
            tsStage.removeEventListener("auxclick", tsPreventMiddleDefault);
            tsStage.removeEventListener("click", tsHandleStageClick);
            tsNavigator.removeEventListener("pointerdown", tsHandleNavigatorPointerDown);
            tsNavigator.removeEventListener("pointermove", tsHandleNavigatorPointerMove);
            tsNavigator.removeEventListener("pointerup", tsHandleNavigatorPointerUp);
            tsNavigator.removeEventListener("pointercancel", tsHandleNavigatorPointerUp);
            tsImage.removeEventListener("load", tsHandleImageLoad);
            tsReleaseFallback();
            tsNavigator.remove();
            tsZoomIndicator.remove();
            delete tsStage.dataset.canZoom;
            delete tsStage.dataset.imageZoomable;
            delete tsStage.dataset.zoomed;
            delete tsStage.dataset.panning;
            tsImage.style.transform = "";
        };
    }

    tsSetupAudioStage(tsAsset) {
        const tsAudio = this.tsRefs.tsStage.querySelector(".ts-audio-element");
        const tsWaveform = this.tsRefs.tsStage.querySelector(".ts-audio-waveform-shell");
        const tsProgress = this.tsRefs.tsStage.querySelector(".ts-audio-progress");
        const tsPlayhead = this.tsRefs.tsStage.querySelector(".ts-audio-playhead");
        const tsPlayButton = this.tsRefs.tsStage.querySelector(".ts-audio-play");
        const tsStopButton = this.tsRefs.tsStage.querySelector(".ts-audio-stop");
        const tsTime = this.tsRefs.tsStage.querySelector(".ts-audio-time");
        if (!tsAudio || !tsWaveform || !tsProgress || !tsPlayhead || !tsPlayButton || !tsStopButton || !tsTime) {
            return null;
        }

        const tsUpdateUI = () => {
            const tsDuration = Number.isFinite(tsAudio.duration) && tsAudio.duration > 0
                ? tsAudio.duration
                : Number(tsAsset.duration || 0);
            const tsCurrent = Math.max(0, Number(tsAudio.currentTime || 0));
            const tsRatio = tsDuration > 0 ? Math.min(1, tsCurrent / tsDuration) : 0;
            tsProgress.style.width = `${tsRatio * 100}%`;
            tsPlayhead.style.left = `${tsRatio * 100}%`;
            tsTime.textContent = `${tsFormatTime(tsCurrent)} / ${tsFormatTime(tsDuration)}`;
            tsWaveform.setAttribute("aria-valuemax", String(Math.round(tsDuration)));
            tsWaveform.setAttribute("aria-valuenow", String(Math.round(tsCurrent)));
            tsWaveform.setAttribute("aria-valuetext", tsTime.textContent);
            tsPlayButton.textContent = tsAudio.paused ? this.tsT("button.play", "Play") : this.tsT("button.pause", "Pause");
        };

        const tsSeekFromClientX = (tsClientX) => {
            const tsDuration = Number.isFinite(tsAudio.duration) && tsAudio.duration > 0
                ? tsAudio.duration
                : Number(tsAsset.duration || 0);
            if (!(tsDuration > 0)) {
                return;
            }
            const tsRect = tsWaveform.getBoundingClientRect();
            if (tsRect.width <= 0) {
                return;
            }
            const tsRatio = Math.max(0, Math.min(1, (tsClientX - tsRect.left) / tsRect.width));
            tsAudio.currentTime = tsRatio * tsDuration;
            tsUpdateUI();
        };

        let tsDragging = false;
        const tsHandlePointerDown = (tsEvent) => {
            // Only the primary button seeks; a right-click (for the context
            // menu) used to jump the playhead.
            if (tsEvent.button !== 0) {
                return;
            }
            tsDragging = true;
            tsWaveform.setPointerCapture?.(tsEvent.pointerId);
            tsSeekFromClientX(tsEvent.clientX);
        };
        const tsHandlePointerMove = (tsEvent) => {
            if (!tsDragging) {
                return;
            }
            tsSeekFromClientX(tsEvent.clientX);
        };
        const tsHandlePointerUp = (tsEvent) => {
            if (!tsDragging) {
                return;
            }
            tsDragging = false;
            tsSeekFromClientX(tsEvent.clientX);
            try {
                tsWaveform.releasePointerCapture?.(tsEvent.pointerId);
            } catch {
                // no-op
            }
        };
        // The waveform is a slider for the keyboard too: arrows move 5 s
        // (Shift: 15 s), Home/End jump to the ends. The lightbox leaves these
        // keys to a focused slider (see tsIsSliderKeyTarget).
        const tsHandleWaveformKeydown = (tsEvent) => {
            const tsDuration = Number.isFinite(tsAudio.duration) && tsAudio.duration > 0
                ? tsAudio.duration
                : Number(tsAsset.duration || 0);
            if (!(tsDuration > 0)) {
                return;
            }
            const tsStep = tsEvent.shiftKey ? 15 : 5;
            const tsTargets = {
                ArrowLeft: tsAudio.currentTime - tsStep,
                ArrowDown: tsAudio.currentTime - tsStep,
                ArrowRight: tsAudio.currentTime + tsStep,
                ArrowUp: tsAudio.currentTime + tsStep,
                Home: 0,
                End: tsDuration,
            };
            if (!(tsEvent.key in tsTargets)) {
                return;
            }
            tsEvent.preventDefault();
            tsAudio.currentTime = Math.max(0, Math.min(tsDuration, tsTargets[tsEvent.key]));
            tsUpdateUI();
        };
        const tsHandlePlayClick = async () => {
            if (tsAudio.paused) {
                await tsAudio.play().catch(() => {});
            } else {
                tsAudio.pause();
            }
            tsUpdateUI();
        };
        const tsHandleStopClick = () => {
            tsAudio.pause();
            tsAudio.currentTime = 0;
            tsUpdateUI();
        };
        const tsLoopButton = this.tsRefs.tsStage.querySelector(".ts-audio-loop");
        tsAudio.loop = tsReadLoopPreference();
        tsRenderLoopButton(tsLoopButton, tsAudio.loop);
        const tsHandleLoopClick = () => {
            tsAudio.loop = !tsAudio.loop;
            tsStoreLoopPreference(tsAudio.loop);
            tsRenderLoopButton(tsLoopButton, tsAudio.loop);
        };
        // Home / End from anywhere in the lightbox, not only with the
        // waveform focused (that one handles its own keys).
        const tsJumpToEdge = (tsEdge) => {
            const tsDuration = Number.isFinite(tsAudio.duration) && tsAudio.duration > 0
                ? tsAudio.duration
                : Number(tsAsset.duration || 0);
            if (!(tsDuration > 0)) {
                return;
            }
            tsAudio.pause();
            tsAudio.currentTime = tsEdge > 0 ? tsDuration : 0;
            tsUpdateUI();
        };
        this.tsMediaEdgeJumper = tsJumpToEdge;
        tsLoopButton?.addEventListener("click", tsHandleLoopClick);

        tsWaveform.addEventListener("keydown", tsHandleWaveformKeydown);
        tsWaveform.addEventListener("pointerdown", tsHandlePointerDown);
        tsWaveform.addEventListener("pointermove", tsHandlePointerMove);
        tsWaveform.addEventListener("pointerup", tsHandlePointerUp);
        tsWaveform.addEventListener("pointercancel", tsHandlePointerUp);
        tsPlayButton.addEventListener("click", tsHandlePlayClick);
        tsStopButton.addEventListener("click", tsHandleStopClick);
        tsAudio.addEventListener("loadedmetadata", tsUpdateUI);
        tsAudio.addEventListener("timeupdate", tsUpdateUI);
        tsAudio.addEventListener("play", tsUpdateUI);
        tsAudio.addEventListener("pause", tsUpdateUI);
        tsAudio.addEventListener("ended", tsUpdateUI);
        const tsStoredVolume = tsReadStoredVolume();
        if (tsStoredVolume) {
            tsAudio.volume = tsStoredVolume.tsVolume;
            tsAudio.muted = tsStoredVolume.tsMuted;
        }
        const tsHandleVolumeChange = () => tsStoreVolume(tsAudio);
        tsAudio.addEventListener("volumechange", tsHandleVolumeChange);
        // A file the browser cannot decode used to sit at "0:00 / 0:00" with
        // a Play button that silently did nothing.
        const tsReleaseFallback = this.tsBindDisplayFallback(tsAudio, tsAsset);
        tsUpdateUI();

        return () => {
            this.tsMediaEdgeJumper = null;
            tsLoopButton?.removeEventListener("click", tsHandleLoopClick);
            tsAudio.removeEventListener("volumechange", tsHandleVolumeChange);
            tsReleaseFallback();
            tsWaveform.removeEventListener("keydown", tsHandleWaveformKeydown);
            tsWaveform.removeEventListener("pointerdown", tsHandlePointerDown);
            tsWaveform.removeEventListener("pointermove", tsHandlePointerMove);
            tsWaveform.removeEventListener("pointerup", tsHandlePointerUp);
            tsWaveform.removeEventListener("pointercancel", tsHandlePointerUp);
            tsPlayButton.removeEventListener("click", tsHandlePlayClick);
            tsStopButton.removeEventListener("click", tsHandleStopClick);
            tsAudio.removeEventListener("loadedmetadata", tsUpdateUI);
            tsAudio.removeEventListener("timeupdate", tsUpdateUI);
            tsAudio.removeEventListener("play", tsUpdateUI);
            tsAudio.removeEventListener("pause", tsUpdateUI);
            tsAudio.removeEventListener("ended", tsUpdateUI);
            tsReleaseMediaSource(tsAudio);
        };
    }

    tsBuildStageMarkup(tsAsset) {
        return tsBuildStageMarkup(tsAsset, {
            apiURL: (tsPath) => tsApiURL(tsPath),
            t: (tsKey, tsFallback) => this.tsT(tsKey, tsFallback),
            escapeHTML: (tsText) => this.tsEscapeHTML(tsText),
            escapeAttribute: (tsText) => this.tsEscapeAttribute(tsText),
            compareItems: this.tsCompareItems,
            isImageCompareMode: () => this.tsIsImageCompareMode(),
            isVideoCompareMode: () => this.tsIsVideoCompareMode(),
        });
    }

    tsEscapeHTML(tsText) {
        return tsEscapeHTML(tsText);
    }

    tsEscapeAttribute(tsText) {
        return tsEscapeAttribute(tsText);
    }
}

let tsViewerSingleton = null;

export function tsEnsureViewerElement() {
    if (!customElements.get("ts-artius-browser-viewer")) {
        customElements.define("ts-artius-browser-viewer", TSArtiusBrowserViewer);
    }
    if (!tsViewerSingleton) {
        tsViewerSingleton = document.createElement("ts-artius-browser-viewer");
    }
    if (!tsViewerSingleton.isConnected) {
        (document.body || document.documentElement).append(tsViewerSingleton);
    }
    return tsViewerSingleton;
}

export function tsGetViewerSingleton() {
    return tsEnsureViewerElement();
}






