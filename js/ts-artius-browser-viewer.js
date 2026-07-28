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
    tsShowToast,
} from "./ts-artius-browser-api.js";
import {
    tsLoad3DViewerClass,
    tsResolve3DViewerFileExtension,
} from "./ts-artius-browser-3d.js";
import { tsFormatTime } from "./ts-artius-browser-viewer-format.js";
import {
    tsBuild3DMetaMarkup,
    tsBuildImageMetaMarkup,
    tsBuildPromptMetaBlock,
    tsBuildPromptSeedMetaMarkup,
    tsBuildTechnicalMetaMarkup,
    tsResolveChannelLayoutLabel,
} from "./ts-artius-browser-viewer-meta.js";
import {
    tsIsViewerTypedCompareMode,
    tsSyncViewerItemsFromSource,
} from "./ts-artius-browser-viewer-state.js";
import { tsBuildStageMarkup } from "./ts-artius-browser-viewer-stage.js";
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
        this.tsCompareItems = [];
        this.tsDetailRequestToken = 0;
        this.tsBoundKeydown = (tsEvent) => this.tsHandleKeydown(tsEvent);
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
                .ts-stage[data-image-zoomable="true"][data-zoomed="true"] img {
                    cursor: grab;
                }
                .ts-stage[data-image-zoomable="true"][data-panning="true"] img {
                    cursor: grabbing;
                    transition: none;
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
                .ts-image-compare-after {
                    clip-path: inset(0 calc(100% - var(--ts-wipe)) 0 0);
                    z-index: 1;
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
                .ts-video-compare-shell[data-count="4"] .ts-video-compare-video {
                    max-height: min(35vh, calc((100dvh - 160px) / 2));
                }
                .ts-video-compare-controls {
                    width: min(100%, 1040px);
                    margin: 0 auto;
                    display: grid;
                    gap: 6px;
                }
                .ts-video-transport {
                    display: grid;
                    grid-template-columns: auto minmax(0, 1fr) auto;
                    gap: 6px;
                    align-items: center;
                }
                .ts-video-play-toggle {
                    min-height: 30px;
                    min-width: 82px;
                    padding: 5px 10px;
                    font-size: 11px;
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
                @media (max-width: 1080px) {
                    .ts-video-compare-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .ts-video-compare-video,
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
                }
            </style>
            <div class="ts-viewer" data-open="false">
                <div class="ts-head">
                    <div>
                        <div class="ts-title"></div>
                        <div class="ts-subtitle"></div>
                    </div>
                    <div class="ts-actions">
                        <button class="ts-download"></button>
                        <button class="ts-open-new-tab"></button>
                        <button class="ts-delete"></button>
                        <button class="ts-close"></button>
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
            tsDeleteButton: this.shadowRoot.querySelector(".ts-delete"),
            tsCloseButton: this.shadowRoot.querySelector(".ts-close"),
            tsCompareCloseButton: this.shadowRoot.querySelector(".ts-compare-close"),
            tsPrevButton: this.shadowRoot.querySelector(".ts-stage-nav-prev"),
            tsNextButton: this.shadowRoot.querySelector(".ts-stage-nav-next"),
        };
        this.tsRefs.tsStage.style.setProperty("--ts-audio-shell-max-width", `${tsViewerSettings.audio.maxWidth}px`);
        this.tsRefs.tsStage.style.setProperty("--ts-audio-waveform-max-height", `${tsViewerSettings.audio.waveformMaxHeight}px`);
        this.tsRefs.tsMeta.addEventListener("click", (tsEvent) => this.tsHandleMetaClick(tsEvent));
        this.tsRefs.tsDownloadButton.addEventListener("click", () => this.tsDownloadCurrent());
        this.tsRefs.tsOpenInNewTabButton.addEventListener("click", () => this.tsOpenInNewTabCurrent());
        this.tsRefs.tsDeleteButton.addEventListener("click", () => void this.tsDeleteCurrent());
        this.tsRefs.tsCloseButton.addEventListener("click", () => this.tsClose());
        this.tsRefs.tsCompareCloseButton.addEventListener("click", () => this.tsClose());
        this.tsRefs.tsPrevButton.addEventListener("click", () => void this.tsNavigate(-1));
        this.tsRefs.tsNextButton.addEventListener("click", () => void this.tsNavigate(1));
        this.tsRefs.tsRoot.addEventListener("click", (tsEvent) => {
            if (tsEvent.target === this.tsRefs.tsRoot) {
                this.tsClose();
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
            if (tsItemIndex === this.tsIndex && tsRequestToken === this.tsDetailRequestToken) {
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
        return this.tsIndex >= 0 && this.tsItems.length > 0;
    }

    tsOpen(tsItems, tsIndex, tsOnChange = null, tsOptions = null) {
        this.tsItems = Array.isArray(tsItems) ? [...tsItems] : [];
        this.tsIndex = Math.max(0, Math.min(tsIndex, this.tsItems.length - 1));
        this.tsOnChange = tsOnChange;
        this.tsGetItems = typeof tsOptions?.tsGetItems === "function" ? tsOptions.tsGetItems : null;
        this.tsRequestMore = typeof tsOptions?.tsRequestMore === "function" ? tsOptions.tsRequestMore : null;
        this.tsCanLoadMore = typeof tsOptions?.tsCanLoadMore === "function" ? tsOptions.tsCanLoadMore : null;
        this.tsCompareItems = Array.isArray(tsOptions?.tsCompareItems) ? [...tsOptions.tsCompareItems] : [];
        this.tsMoreRequestPromise = null;
        window.addEventListener("keydown", this.tsBoundKeydown);
        this.tsRender();
        void this.tsEnsureAssetDetail(this.tsIndex);
        void this.tsMaybePrefetchMore(this.tsIndex);
    }

    tsClose() {
        this.tsTeardownStage();
        this.tsIndex = -1;
        this.tsItems = [];
        this.tsOnChange = null;
        this.tsGetItems = null;
        this.tsRequestMore = null;
        this.tsCanLoadMore = null;
        this.tsMoreRequestPromise = null;
        this.tsCompareItems = [];
        window.removeEventListener("keydown", this.tsBoundKeydown);
        this.tsRender();
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

    tsHandleKeydown(tsEvent) {
        if (this.tsIndex < 0) {
            return;
        }
        if (tsEvent.key === "Escape") {
            tsEvent.preventDefault();
            this.tsClose();
            return;
        }
        const tsCompareMode = this.tsIsCompareMode();
        const tsVideoCompareMode = this.tsIsVideoCompareMode();
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
        if (tsEvent.key === "ArrowUp") {
            if (!tsCompareMode && this.tsItems[this.tsIndex]?.type === "video" && typeof this.tsVideoFrameStepper === "function") {
                tsEvent.preventDefault();
                this.tsVideoFrameStepper(-1);
            }
            return;
        }
        if (tsEvent.key === "ArrowDown") {
            if (!tsCompareMode && this.tsItems[this.tsIndex]?.type === "video" && typeof this.tsVideoFrameStepper === "function") {
                tsEvent.preventDefault();
                this.tsVideoFrameStepper(1);
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
        this.tsRender();
        void this.tsEnsureAssetDetail(this.tsIndex);
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
            : tsAsset.prompt_text;
        if (!tsValue) {
            return;
        }
        const tsCopied = await tsCopyText(tsValue);
        tsShowToast(
            tsCopied ? "success" : "error",
            tsCopied ? this.tsT("toast.copied", "Copied") : this.tsT("toast.copyFailed", "Copy failed"),
        );
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
        if (!tsAsset?.id || !tsAsset.allow_delete) {
            return;
        }
        const tsDeletedAssetId = tsAsset.id;
        const tsNextIndexHint = Math.max(0, Math.min(this.tsIndex, this.tsItems.length - 2));
        try {
            await tsDeleteAssetIds([tsDeletedAssetId]);
        } catch (tsError) {
            // Previously uncaught: a failed delete rejected tsDeleteCurrent and
            // left the lightbox showing an asset the user thinks is gone.
            tsShowToast("error", this.tsT("toast.deleteFailed", "Delete failed"), String(tsError?.message || tsError || ""));
            return;
        }
        this.tsItems = this.tsItems.filter((tsItem) => tsItem.id !== tsDeletedAssetId);
        this.tsCompareItems = this.tsCompareItems.filter((tsItem) => tsItem.id !== tsDeletedAssetId);
        if (typeof this.tsGetItems === "function") {
            window.setTimeout(() => {
                const tsNextAssetId = this.tsItems[Math.max(0, Math.min(tsNextIndexHint, this.tsItems.length - 1))]?.id ?? null;
                if (this.tsSyncItemsFromSource(tsNextAssetId)) {
                    if (!this.tsItems.length) {
                        this.tsClose();
                        return;
                    }
                    this.tsIndex = Math.max(0, Math.min(this.tsIndex, this.tsItems.length - 1));
                    if (typeof this.tsOnChange === "function") {
                        this.tsOnChange(this.tsIndex, this.tsItems[this.tsIndex] || null);
                    }
                    this.tsRender();
                    void this.tsEnsureAssetDetail(this.tsIndex);
                }
            }, 0);
        }
        if (!this.tsItems.length) {
            this.tsClose();
            return;
        }
        this.tsIndex = Math.max(0, Math.min(tsNextIndexHint, this.tsItems.length - 1));
        if (typeof this.tsOnChange === "function") {
            this.tsOnChange(this.tsIndex, this.tsItems[this.tsIndex] || null);
        }
        this.tsRender();
        void this.tsEnsureAssetDetail(this.tsIndex);
    }

    tsBuildMetaMarkup(tsAsset) {
        if (tsAsset?.type === "video" || tsAsset?.type === "audio") {
            return this.tsBuildTechnicalMetaMarkup(tsAsset);
        }
        if (tsAsset?.type === "3d") {
            return this.tsBuild3DMetaMarkup(tsAsset);
        }
        if (tsAsset?.type === "image") {
            return this.tsBuildImageMetaMarkup(tsAsset);
        }
        return this.tsBuildPromptSeedMetaMarkup(tsAsset);
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
        return tsBuildImageMetaMarkup(tsAsset, this.tsGetMetaDeps());
    }

    tsBuild3DMetaMarkup(tsAsset) {
        return tsBuild3DMetaMarkup(tsAsset, this.tsGetMetaDeps());
    }

    tsBuildPromptSeedMetaMarkup(tsAsset) {
        return tsBuildPromptSeedMetaMarkup(tsAsset, this.tsGetMetaDeps());
    }

    tsBuildTechnicalMetaMarkup(tsAsset) {
        return tsBuildTechnicalMetaMarkup(tsAsset, this.tsGetMetaDeps());
    }

    tsGetMetaDeps() {
        return {
            t: (tsKey, tsFallback) => this.tsT(tsKey, tsFallback),
            escapeHTML: (tsText) => this.tsEscapeHTML(tsText),
            escapeAttribute: (tsText) => this.tsEscapeAttribute(tsText),
            formatBytes: (tsBytes) => tsFormatBytes(tsBytes),
            resolveChannelLayoutLabel: (tsChannelCount) => this.tsResolveChannelLayoutLabel(tsChannelCount),
        };
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
        this.tsRefs.tsDownloadButton.textContent = this.tsT("button.download", "Download");
        this.tsRefs.tsOpenInNewTabButton.textContent = this.tsT("button.openInNewTab", "Open In New Tab");
        this.tsRefs.tsDeleteButton.textContent = this.tsT("button.delete", "Delete");
        this.tsRefs.tsCloseButton.textContent = tsCloseLabel;
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
            this.tsRefs.tsMeta.innerHTML = "";
            return;
        }

        this.tsTeardownStage();
        this.tsRefs.tsTitle.textContent = tsAsset.filename || this.tsT("label.asset", "Asset");
        this.tsRefs.tsSubtitle.textContent = `${tsAsset.root_label || tsAsset.root_id || ""}${tsAsset.folder_path ? ` / ${tsAsset.folder_path}` : ""}`;
        this.tsRefs.tsStage.dataset.kind = tsAsset.type || "";
        const tsCompareMode = this.tsIsCompareMode();
        this.tsRefs.tsRoot.dataset.compare = String(tsCompareMode);
        this.tsRefs.tsOpenInNewTabButton.hidden = tsAsset.type === "3d";
        this.tsRefs.tsDeleteButton.disabled = !tsAsset.allow_delete;
        this.tsRefs.tsStage.innerHTML = this.tsBuildStageMarkup(tsAsset);
        this.tsRefs.tsMeta.innerHTML = this.tsBuildMetaMarkup(tsAsset);
        this.tsRefs.tsPrevButton.hidden = tsCompareMode;
        this.tsRefs.tsNextButton.hidden = tsCompareMode;
        this.tsRefs.tsPrevButton.disabled = tsCompareMode || this.tsIndex <= 0;
        this.tsRefs.tsNextButton.disabled = tsCompareMode || (this.tsIndex >= this.tsItems.length - 1
            && !(typeof this.tsCanLoadMore === "function" && this.tsCanLoadMore())
            && !this.tsMoreRequestPromise);
        this.tsBindStageInteractions(tsAsset);
    }

    tsBindStageInteractions(tsAsset) {
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
        this.tsCompareItems = [];
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

        const tsResolveFPS = () => {
            const tsFPS = Number(tsAsset?.technical_info?.fps || tsAsset?.fps || 0);
            return Number.isFinite(tsFPS) && tsFPS > 0 ? tsFPS : 30;
        };
        const tsFormatFrameText = () => {
            const tsFPS = tsResolveFPS();
            const tsFrameIndex = Math.max(0, Math.round(Number(tsVideo.currentTime || 0) * tsFPS));
            return `${this.tsT("label.currentFrame", "Frame")} ${tsFrameIndex}`;
        };
        const tsUpdateFrameLabel = () => {
            tsFrameLabel.textContent = tsFormatFrameText();
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
            const tsFPS = tsResolveFPS();
            const tsFrameDuration = 1 / tsFPS;
            const tsDuration = Number(tsVideo.duration || 0);
            const tsMaxTime = Number.isFinite(tsDuration) && tsDuration > 0 ? Math.max(0, tsDuration - (tsFrameDuration / 2)) : Number.MAX_SAFE_INTEGER;
            tsVideo.pause();
            const tsDelta = tsDirection >= 0 ? tsFrameDuration : -tsFrameDuration;
            const tsTargetTime = Math.max(0, Math.min(tsMaxTime, Number(tsVideo.currentTime || 0) + tsDelta));
            tsVideo.currentTime = tsTargetTime;
            tsUpdateFrameLabel();
        };

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
        tsPrevFrameButton.addEventListener("click", tsHandlePrevFrame);
        tsNextFrameButton.addEventListener("click", tsHandleNextFrame);
        tsVideo.addEventListener("loadedmetadata", tsHandleLoadedMetadata);
        tsVideo.addEventListener("timeupdate", tsHandleTimeUpdate);
        tsVideo.addEventListener("seeked", tsHandleSeeked);
        tsVideo.addEventListener("pause", tsHandlePause);
        tsVideo.addEventListener("play", tsHandlePlay);
        tsVideo.addEventListener("ended", tsHandlePause);
        tsUpdateFrameLabel();
        if (!tsVideo.paused) {
            tsStartTicker();
        }

        return () => {
            tsStopTicker();
            this.tsVideoFrameStepper = null;
            tsPrevFrameButton.removeEventListener("click", tsHandlePrevFrame);
            tsNextFrameButton.removeEventListener("click", tsHandleNextFrame);
            tsVideo.removeEventListener("loadedmetadata", tsHandleLoadedMetadata);
            tsVideo.removeEventListener("timeupdate", tsHandleTimeUpdate);
            tsVideo.removeEventListener("seeked", tsHandleSeeked);
            tsVideo.removeEventListener("pause", tsHandlePause);
            tsVideo.removeEventListener("play", tsHandlePlay);
            tsVideo.removeEventListener("ended", tsHandlePause);
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

        const tsPrimaryVideo = tsVideos.find((tsVideo) => tsVideo.dataset.primary === "true") || tsVideos[0];
        const tsSyncThreshold = 0.05;
        let tsAnimationFrameId = 0;
        let tsSyncing = false;
        let tsSeekDragging = false;
        let tsResumeAfterSeek = false;

        tsVideos.forEach((tsVideo) => {
            tsVideo.controls = false;
            tsVideo.muted = tsVideo !== tsPrimaryVideo;
        });

        const tsResolveFPS = () => {
            const tsFPS = Number(tsAsset?.technical_info?.fps || tsAsset?.fps || 0);
            return Number.isFinite(tsFPS) && tsFPS > 0 ? tsFPS : 30;
        };
        const tsFormatFrameText = (tsCurrentTime = Number(tsPrimaryVideo.currentTime || 0)) => {
            const tsFPS = tsResolveFPS();
            const tsFrameIndex = Math.max(0, Math.round(Math.max(0, Number(tsCurrentTime) || 0) * tsFPS));
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
        const tsSyncOtherVideos = (tsForce = false) => {
            if (tsSyncing) {
                return;
            }
            const tsCurrentTime = Math.max(0, Number(tsPrimaryVideo.currentTime || 0));
            const tsPlaybackRate = Number(tsPrimaryVideo.playbackRate || 1) || 1;
            tsSyncing = true;
            try {
                tsVideos.forEach((tsVideo) => {
                    if (tsVideo === tsPrimaryVideo) {
                        return;
                    }
                    if (Math.abs((Number(tsVideo.playbackRate || 1) || 1) - tsPlaybackRate) > 0.001) {
                        tsVideo.playbackRate = tsPlaybackRate;
                    }
                    if (tsForce || Math.abs(Number(tsVideo.currentTime || 0) - tsCurrentTime) > tsSyncThreshold) {
                        try {
                            tsVideo.currentTime = tsClampVideoTime(tsVideo, tsCurrentTime);
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
            tsPlayToggleButton.textContent = tsPrimaryVideo.paused ? this.tsT("button.play", "Play") : this.tsT("button.pause", "Pause");
            tsTimeLabel.textContent = `${tsFormatTime(tsCurrentTime)} / ${tsFormatTime(tsDuration)}`;
            tsFrameLabel.textContent = tsFormatFrameText(tsCurrentTime);
            tsSeekInput.max = String(Math.max(0, tsDuration));
            tsSeekInput.disabled = tsDuration <= 0;
            if (!tsSeekDragging) {
                tsSeekInput.value = String(tsDuration > 0 ? Math.min(tsDuration, tsCurrentTime) : 0);
            }
        };
        const tsStopTicker = () => {
            if (tsAnimationFrameId) {
                window.cancelAnimationFrame(tsAnimationFrameId);
                tsAnimationFrameId = 0;
            }
        };
        const tsTick = () => {
            tsSyncOtherVideos(false);
            tsUpdateTransport();
            if (!tsPrimaryVideo.paused && !tsPrimaryVideo.ended) {
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
        const tsPauseAll = (tsForceSync = true) => {
            tsVideos.forEach((tsVideo) => tsVideo.pause());
            if (tsForceSync) {
                tsSyncOtherVideos(true);
            }
            tsStopTicker();
            tsUpdateTransport();
        };
        const tsPlayAll = () => {
            tsSyncOtherVideos(true);
            const tsPlaybackRate = Number(tsPrimaryVideo.playbackRate || 1) || 1;
            const tsPlayPromises = tsVideos.map((tsVideo) => {
                tsVideo.playbackRate = tsPlaybackRate;
                const tsPlayPromise = tsVideo.play();
                if (tsPlayPromise && typeof tsPlayPromise.catch === "function") {
                    return tsPlayPromise.catch(() => {});
                }
                return Promise.resolve();
            });
            tsStartTicker();
            void Promise.all(tsPlayPromises).finally(() => {
                tsUpdateTransport();
            });
        };
        const tsHandleTogglePlay = () => {
            if (tsPrimaryVideo.paused) {
                tsPlayAll();
                return;
            }
            tsPauseAll(true);
        };
        const tsHandleSeekPointerDown = () => {
            tsSeekDragging = true;
            tsResumeAfterSeek = !tsPrimaryVideo.paused;
            if (tsResumeAfterSeek) {
                tsPauseAll(false);
            }
        };
        const tsHandleSeekInput = () => {
            const tsNextTime = Math.max(0, Number(tsSeekInput.value || 0));
            tsSetAllCurrentTimes(tsNextTime);
            tsUpdateTransport();
        };
        const tsHandleSeekCommit = () => {
            tsSeekDragging = false;
            tsSyncOtherVideos(true);
            tsUpdateTransport();
            if (tsResumeAfterSeek) {
                tsResumeAfterSeek = false;
                tsPlayAll();
            }
        };
        const tsStepFrame = (tsDirection) => {
            const tsFPS = tsResolveFPS();
            const tsFrameDuration = 1 / tsFPS;
            const tsTargetTime = Math.max(
                0,
                tsClampVideoTime(
                    tsPrimaryVideo,
                    Number(tsPrimaryVideo.currentTime || 0) + (tsDirection >= 0 ? tsFrameDuration : -tsFrameDuration),
                    tsFrameDuration,
                ),
            );
            tsPauseAll(false);
            tsSetAllCurrentTimes(tsTargetTime, tsFrameDuration);
            tsUpdateTransport();
        };
        const tsHandlePrimaryLoadedMetadata = () => tsUpdateTransport();
        const tsHandlePrimaryDurationChange = () => tsUpdateTransport();
        const tsHandlePrimaryTimeUpdate = () => {
            if (!tsSeekDragging) {
                tsSyncOtherVideos(false);
            }
            tsUpdateTransport();
        };
        const tsHandlePrimarySeeked = () => {
            if (!tsSeekDragging) {
                tsSyncOtherVideos(true);
            }
            tsUpdateTransport();
        };
        const tsHandlePrimaryPlay = () => {
            tsStartTicker();
            tsUpdateTransport();
        };
        const tsHandlePrimaryPause = () => {
            if (!tsSeekDragging) {
                tsSyncOtherVideos(true);
            }
            tsStopTicker();
            tsUpdateTransport();
        };
        const tsHandlePrimaryEnded = () => {
            tsPauseAll(true);
        };
        const tsHandlePrimaryRateChange = () => {
            tsSyncOtherVideos(true);
            tsUpdateTransport();
        };
        const tsHandlePrevFrame = () => tsStepFrame(-1);
        const tsHandleNextFrame = () => tsStepFrame(1);

        this.tsVideoFrameStepper = tsStepFrame;
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
        tsPrimaryVideo.addEventListener("play", tsHandlePrimaryPlay);
        tsPrimaryVideo.addEventListener("pause", tsHandlePrimaryPause);
        tsPrimaryVideo.addEventListener("ended", tsHandlePrimaryEnded);
        tsPrimaryVideo.addEventListener("ratechange", tsHandlePrimaryRateChange);
        tsUpdateTransport();
        if (!tsPrimaryVideo.paused && !tsPrimaryVideo.ended) {
            tsStartTicker();
        }

        return () => {
            tsStopTicker();
            this.tsVideoFrameStepper = null;
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
            tsPrimaryVideo.removeEventListener("play", tsHandlePrimaryPlay);
            tsPrimaryVideo.removeEventListener("pause", tsHandlePrimaryPause);
            tsPrimaryVideo.removeEventListener("ended", tsHandlePrimaryEnded);
            tsPrimaryVideo.removeEventListener("ratechange", tsHandlePrimaryRateChange);
            tsVideos.forEach((tsVideo) => {
                tsReleaseMediaSource(tsVideo);
            });
        };
    }

    tsSetupImageCompareStage() {
        const tsShell = this.tsRefs.tsStage?.querySelector(".ts-image-compare-shell");
        const tsRange = tsShell?.querySelector(".ts-image-compare-range");
        if (!tsShell || !tsRange) {
            return null;
        }
        const tsApplyWipe = () => {
            const tsValue = Math.max(0, Math.min(100, Number(tsRange.value || 50)));
            tsShell.style.setProperty("--ts-wipe", `${tsValue}%`);
        };
        tsRange.addEventListener("input", tsApplyWipe);
        tsRange.addEventListener("change", tsApplyWipe);
        tsApplyWipe();
        return () => {
            tsRange.removeEventListener("input", tsApplyWipe);
            tsRange.removeEventListener("change", tsApplyWipe);
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

        tsShowStatus(this.tsT("status.loading3dViewer", "Loading 3D viewer..."));
        tsSetReady(false);

        void (async () => {
            try {
                const tsLoad3dClass = await tsLoad3DViewerClass();
                if (tsDisposed || !tsLoad3dClass) {
                    if (!tsDisposed) {
                        tsShowStatus(this.tsT("status.no3dViewer", "3D viewer unavailable."));
                    }
                    return;
                }
                const tsViewerURL = tsAsset.viewer_3d_url ? tsApiURL(tsAsset.viewer_3d_url) : null;
                const tsExtension = tsResolve3DViewerFileExtension(tsViewerURL || "");
                if (!tsViewerURL || !tsExtension) {
                    tsShowStatus(this.tsT("status.no3dViewer", "3D viewer unavailable."));
                    return;
                }
                tsViewerController = new tsLoad3dClass(tsHost, { width: 800, height: 600, isViewerMode: true });
                tsViewerController.cameraManager?.reset?.();
                tsViewerController.controlsManager?.reset?.();
                tsViewerController.modelManager?.clearModel?.();
                tsViewerController.animationManager?.dispose?.();
                const tsModel = await tsViewerController.loaderManager?.loadModelInternal?.(tsViewerURL, tsExtension);
                if (!tsModel) {
                    throw new Error("3D model load returned no model");
                }
                await tsViewerController.modelManager?.setupModel?.(tsModel);
                if (tsViewerController.modelManager?.currentModel) {
                    tsViewerController.animationManager?.setupModelAnimations?.(
                        tsViewerController.modelManager.currentModel,
                        tsViewerController.modelManager.originalModel,
                    );
                }
                tsViewerController.handleResize?.();
                if (tsDisposed) {
                    tsViewerController?.remove?.();
                    return;
                }
                tsSetReady(true);
                tsShowStatus("");
                tsHandleResize();
                tsHost.addEventListener("mouseenter", tsHandleMouseEnter);
                tsHost.addEventListener("mouseleave", tsHandleMouseLeave);
                if (typeof ResizeObserver === "function") {
                    tsResizeObserver = new ResizeObserver(() => tsHandleResize());
                    tsResizeObserver.observe(tsStage);
                }
            } catch {
                if (!tsDisposed) {
                    tsShowStatus(this.tsT("status.failed3dViewer", "Failed to open 3D viewer."));
                }
            }
        })();

        return () => {
            tsDisposed = true;
            tsResizeObserver?.disconnect();
            tsHost.removeEventListener("mouseenter", tsHandleMouseEnter);
            tsHost.removeEventListener("mouseleave", tsHandleMouseLeave);
            try {
                tsViewerController?.remove?.();
            } catch {
                // no-op
            }
            tsHost.replaceChildren();
            tsSetReady(false);
            tsShowStatus("");
        };
    }
    tsSetupImageStage(tsAsset) {
        const tsStage = this.tsRefs.tsStage;
        const tsImage = tsStage.querySelector("img");
        if (!tsStage || !tsImage) {
            return null;
        }

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

        const tsClampTranslate = () => {
            const tsBaseWidth = tsImage.offsetWidth || tsImage.clientWidth || 0;
            const tsBaseHeight = tsImage.offsetHeight || tsImage.clientHeight || 0;
            const tsStageWidth = tsStage.clientWidth || 0;
            const tsStageHeight = tsStage.clientHeight || 0;
            const tsScaledWidth = tsBaseWidth * tsScale;
            const tsScaledHeight = tsBaseHeight * tsScale;
            const tsMaxX = Math.max(0, (tsScaledWidth - tsStageWidth) / 2);
            const tsMaxY = Math.max(0, (tsScaledHeight - tsStageHeight) / 2);
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
            tsStage.dataset.imageZoomable = "true";
            tsStage.dataset.zoomed = String(tsScale > 1);
            tsStage.dataset.panning = String(tsPanning);
            tsImage.style.transform = `translate(${tsTranslateX}px, ${tsTranslateY}px) scale(${tsScale})`;
        };

        const tsGetStagePoint = (tsClientX, tsClientY) => {
            const tsRect = tsStage.getBoundingClientRect();
            return {
                tsX: tsClientX - (tsRect.left + (tsRect.width / 2)),
                tsY: tsClientY - (tsRect.top + (tsRect.height / 2)),
            };
        };

        const tsHandleWheel = (tsEvent) => {
            tsEvent.preventDefault();
            const tsNextScale = Math.max(
                tsZoomLimits.tsMin,
                Math.min(
                    tsZoomLimits.tsMax,
                    tsScale * (tsEvent.deltaY < 0 ? tsZoomLimits.tsStepIn : tsZoomLimits.tsStepOut),
                ),
            );
            if (Math.abs(tsNextScale - tsScale) < 0.0001) {
                return;
            }
            const tsPoint = tsGetStagePoint(tsEvent.clientX, tsEvent.clientY);
            const tsLocalX = (tsPoint.tsX - tsTranslateX) / tsScale;
            const tsLocalY = (tsPoint.tsY - tsTranslateY) / tsScale;
            tsScale = tsNextScale;
            tsTranslateX = tsPoint.tsX - (tsLocalX * tsScale);
            tsTranslateY = tsPoint.tsY - (tsLocalY * tsScale);
            tsApplyTransform();
        };

        const tsHandlePointerDown = (tsEvent) => {
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

        tsImage.draggable = false;
        tsStage.addEventListener("wheel", tsHandleWheel, { passive: false });
        tsStage.addEventListener("pointerdown", tsHandlePointerDown);
        tsStage.addEventListener("pointermove", tsHandlePointerMove);
        tsStage.addEventListener("pointerup", tsStopPanning);
        tsStage.addEventListener("pointercancel", tsStopPanning);
        tsStage.addEventListener("lostpointercapture", tsStopPanning);
        tsStage.addEventListener("mousedown", tsPreventMiddleDefault);
        tsStage.addEventListener("auxclick", tsPreventMiddleDefault);
        window.addEventListener("resize", tsHandleReset);
        tsApplyTransform();

        return () => {
            tsStopPanning();
            window.removeEventListener("resize", tsHandleReset);
            tsStage.removeEventListener("wheel", tsHandleWheel);
            tsStage.removeEventListener("pointerdown", tsHandlePointerDown);
            tsStage.removeEventListener("pointermove", tsHandlePointerMove);
            tsStage.removeEventListener("pointerup", tsStopPanning);
            tsStage.removeEventListener("pointercancel", tsStopPanning);
            tsStage.removeEventListener("lostpointercapture", tsStopPanning);
            tsStage.removeEventListener("mousedown", tsPreventMiddleDefault);
            tsStage.removeEventListener("auxclick", tsPreventMiddleDefault);
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
        tsUpdateUI();

        return () => {
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






