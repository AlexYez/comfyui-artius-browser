import {
    tsApiURL,
    tsCopyText,
    tsDeleteAssetIds,
    tsFetchAssetDetail,
    tsFormatBytes,
    tsOpenAssetInNewTab,
    tsOpenDownload,
} from "./ts-artius-browser-api.js";
import {
    tsLoad3DViewerClass,
    tsResolve3DViewerFileExtension,
} from "./ts-artius-browser-3d.js";
import { tsViewerSettings } from "./ts-artius-browser-settings.js";

function tsFormatTime(tsSeconds) {
    const tsSafeSeconds = Math.max(0, Number(tsSeconds) || 0);
    const tsMinutes = Math.floor(tsSafeSeconds / 60);
    const tsRemainderSeconds = Math.floor(tsSafeSeconds % 60);
    return `${tsMinutes}:${String(tsRemainderSeconds).padStart(2, "0")}`;
}

function tsFormatBitrate(tsBitrate) {
    const tsSafeBitrate = Number(tsBitrate) || 0;
    if (tsSafeBitrate <= 0) {
        return "";
    }
    if (tsSafeBitrate >= 1_000_000) {
        return `${(tsSafeBitrate / 1_000_000).toFixed(2)} Mbps`;
    }
    if (tsSafeBitrate >= 1_000) {
        return `${(tsSafeBitrate / 1_000).toFixed(0)} kbps`;
    }
    return `${tsSafeBitrate} bps`;
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
                    --ts-accent: var(--p-button-primary-background, var(--theme-color, #5c9cff));
                    --ts-accent-contrast: var(--p-button-primary-color, #ffffff);
                    --ts-bg-0: var(--comfy-menu-bg, var(--bg-color, #141414));
                    --ts-bg-1: var(--comfy-input-bg, var(--comfy-menu-bg, #1c1c1c));
                    --ts-bg-2: var(--content-bg, var(--comfy-menu-secondary-bg, #202020));
                    --ts-border: var(--border-color, rgba(255,255,255,0.14));
                    --ts-text: var(--input-text, var(--fg-color, #e8e8e8));
                    --ts-text-muted: var(--descrip-text, rgba(255,255,255,0.7));
                }
                .ts-viewer {
                    position: absolute;
                    inset: 0;
                    display: none;
                    background: rgba(0, 0, 0, 0.82);
                    backdrop-filter: blur(8px);
                    color: var(--ts-text);
                    pointer-events: auto;
                }
                .ts-viewer[data-open="true"] {
                    display: grid;
                    grid-template-rows: auto 1fr auto;
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
                    background: rgba(10, 10, 10, 0.68);
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
                    background: rgba(10, 10, 10, 0.72);
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
                    background: rgba(255, 255, 255, 0.02);
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
                    background: rgba(255, 255, 255, 0.02);
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
                    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
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
                        <button class="ts-stage-nav ts-stage-nav-prev" type="button" aria-label="Previous">&#8249;</button>
                        <div class="ts-stage"></div>
                        <button class="ts-stage-nav ts-stage-nav-next" type="button" aria-label="Next">&#8250;</button>
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

    tsOpen(tsItems, tsIndex, tsOnChange = null, tsOptions = null) {
        this.tsItems = Array.isArray(tsItems) ? [...tsItems] : [];
        this.tsIndex = Math.max(0, Math.min(tsIndex, this.tsItems.length - 1));
        this.tsOnChange = tsOnChange;
        this.tsGetItems = typeof tsOptions?.tsGetItems === "function" ? tsOptions.tsGetItems : null;
        this.tsRequestMore = typeof tsOptions?.tsRequestMore === "function" ? tsOptions.tsRequestMore : null;
        this.tsCanLoadMore = typeof tsOptions?.tsCanLoadMore === "function" ? tsOptions.tsCanLoadMore : null;
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
        this.tsDetailRequestToken = 0;
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
        if (tsEvent.key === "ArrowLeft") {
            tsEvent.preventDefault();
            void this.tsNavigate(-1);
            return;
        }
        if (tsEvent.key === "ArrowRight") {
            tsEvent.preventDefault();
            void this.tsNavigate(1);
            return;
        }
        if (tsEvent.key === "Delete") {
            tsEvent.preventDefault();
            void this.tsDeleteCurrent();
        }
    }

    tsSyncItemsFromSource(tsPreferredAssetId = null) {
        if (typeof this.tsGetItems !== "function") {
            return false;
        }
        const tsSourceItems = this.tsGetItems();
        if (!Array.isArray(tsSourceItems) || tsSourceItems.length === 0) {
            return false;
        }
        const tsCurrentAssetId = tsPreferredAssetId ?? this.tsItems[this.tsIndex]?.id ?? null;
        this.tsItems = [...tsSourceItems];
        if (tsCurrentAssetId !== null) {
            const tsMatchedIndex = this.tsItems.findIndex((tsItem) => tsItem.id === tsCurrentAssetId);
            if (tsMatchedIndex >= 0) {
                this.tsIndex = tsMatchedIndex;
                return true;
            }
        }
        this.tsIndex = Math.max(0, Math.min(this.tsIndex, this.tsItems.length - 1));
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
            this.tsOnChange(this.tsIndex);
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
            : tsAsset.prompt_text;
        if (tsValue) {
            await tsCopyText(tsValue);
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
        if (!tsAsset?.id || !tsAsset.allow_delete) {
            return;
        }
        const tsDeletedAssetId = tsAsset.id;
        const tsNextIndexHint = Math.max(0, Math.min(this.tsIndex, this.tsItems.length - 2));
        await tsDeleteAssetIds([tsDeletedAssetId]);
        this.tsItems = this.tsItems.filter((tsItem) => tsItem.id !== tsDeletedAssetId);
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
                        this.tsOnChange(this.tsIndex);
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
            this.tsOnChange(this.tsIndex);
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

    tsBuildImageMetaMarkup(tsAsset) {
        const tsPromptText = tsAsset.prompt_text || this.tsT("meta.noPrompt", "No prompt metadata found.");
        const tsWorkflowButtonMarkup = tsAsset.workflow_text
            ? `
                <div class="ts-meta-block">
                    <div class="ts-meta-row">
                        <h4>${this.tsT("meta.workflow", "Workflow")}</h4>
                        <button class="ts-meta-copy" type="button" data-copy-field="workflow">${this.tsT("button.copyWorkflow", "Copy Workflow")}</button>
                    </div>
                </div>
            `
            : "";
        return `
            <div class="ts-meta-block">
                <div class="ts-meta-row">
                    <h4>${this.tsT("meta.prompt", "Prompt")}</h4>
                    <button class="ts-meta-copy" type="button" data-copy-field="prompt" ${tsAsset.prompt_text ? "" : "disabled"}>${this.tsT("button.copy", "Copy")}</button>
                </div>
                <div class="ts-prompt">${this.tsEscapeHTML(tsPromptText)}</div>
            </div>
            ${tsWorkflowButtonMarkup}
        `;
    }

    tsBuild3DMetaMarkup(tsAsset) {
        const tsTechnical = tsAsset?.technical_info || {};
        const tsFormatName = tsTechnical.format_name || String(tsAsset?.extension || "").replace(/^\./, "").toUpperCase();
        const tsSizeText = tsFormatBytes(tsAsset?.size_bytes);
        const tsRows = [];
        if (tsFormatName) {
            tsRows.push({ tsLabel: this.tsT("meta.fileFormat", "File Format"), tsValue: tsFormatName });
        }
        if (tsSizeText) {
            tsRows.push({ tsLabel: this.tsT("meta.size", "Size"), tsValue: tsSizeText });
        }
        if (tsRows.length === 0) {
            return `
                <div class="ts-meta-block">
                    <div class="ts-meta-row">
                        <h4>${this.tsT("meta.technical", "Technical")}</h4>
                    </div>
                    <div class="ts-technical-empty">${this.tsT("meta.noTechnical", "No model metadata found.")}</div>
                </div>
            `;
        }
        return `
            <div class="ts-meta-block">
                <div class="ts-meta-row">
                    <h4>${this.tsT("meta.technical", "Technical")}</h4>
                </div>
                <div class="ts-technical-grid">
                    ${tsRows.map((tsRow) => `
                        <div class="ts-technical-item">
                            <div class="ts-technical-label">${this.tsEscapeHTML(tsRow.tsLabel)}</div>
                            <div class="ts-technical-value">${this.tsEscapeHTML(tsRow.tsValue)}</div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    tsBuildPromptSeedMetaMarkup(tsAsset) {
        const tsPromptText = tsAsset.prompt_text || this.tsT("meta.noPrompt", "No prompt metadata found.");
        return `
            <div class="ts-meta-block">
                <div class="ts-meta-row">
                    <h4>${this.tsT("meta.prompt", "Prompt")}</h4>
                    <button class="ts-meta-copy" type="button" data-copy-field="prompt" ${tsAsset.prompt_text ? "" : "disabled"}>${this.tsT("button.copy", "Copy")}</button>
                </div>
                <div class="ts-prompt">${this.tsEscapeHTML(tsPromptText)}</div>
            </div>
        `;
    }

    tsBuildTechnicalMetaMarkup(tsAsset) {
        const tsTechnical = tsAsset?.technical_info || {};
        const tsRows = [];
        if (tsTechnical.format_name) {
            tsRows.push({ tsLabel: this.tsT("meta.fileFormat", "File Format"), tsValue: tsTechnical.format_name });
        }
        if (tsAsset?.type === "video" && Number(tsTechnical.width) > 0 && Number(tsTechnical.height) > 0) {
            tsRows.push({ tsLabel: this.tsT("meta.resolution", "Resolution"), tsValue: `${tsTechnical.width}x${tsTechnical.height}` });
        }
        if (Number(tsTechnical.duration) > 0) {
            tsRows.push({ tsLabel: this.tsT("meta.duration", "Duration"), tsValue: tsFormatTime(tsTechnical.duration) });
        }
        const tsBitrateText = tsFormatBitrate(tsTechnical.bit_rate);
        if (tsBitrateText) {
            tsRows.push({ tsLabel: this.tsT("meta.bitrate", "Bitrate"), tsValue: tsBitrateText });
        }
        if (tsRows.length === 0) {
            return `
                <div class="ts-meta-block">
                    <div class="ts-meta-row">
                        <h4>${this.tsT("meta.technical", "Technical")}</h4>
                    </div>
                    <div class="ts-technical-empty">${this.tsT("meta.noTechnical", "No ffprobe metadata found.")}</div>
                </div>
            `;
        }
        return `
            <div class="ts-meta-block">
                <div class="ts-meta-row">
                    <h4>${this.tsT("meta.technical", "Technical")}</h4>
                </div>
                <div class="ts-technical-grid">
                    ${tsRows.map((tsRow) => `
                        <div class="ts-technical-item">
                            <div class="ts-technical-label">${this.tsEscapeHTML(tsRow.tsLabel)}</div>
                            <div class="ts-technical-value">${this.tsEscapeHTML(tsRow.tsValue)}</div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    tsRender() {
        if (!this.tsRefs) {
            return;
        }
        const tsAsset = this.tsIndex >= 0 ? this.tsItems[this.tsIndex] : null;
        const tsIsOpen = Boolean(tsAsset);
        this.tsRefs.tsRoot.dataset.open = String(tsIsOpen);
        this.style.pointerEvents = tsIsOpen ? "auto" : "none";
        this.tsRefs.tsDownloadButton.textContent = this.tsT("button.download", "Download");
        this.tsRefs.tsOpenInNewTabButton.textContent = this.tsT("button.openInNewTab", "Open In New Tab");
        this.tsRefs.tsDeleteButton.textContent = this.tsT("button.delete", "Delete");
        this.tsRefs.tsCloseButton.textContent = this.tsT("button.close", "Close");
        this.tsRefs.tsPrevButton.title = this.tsT("button.prev", "Previous");
        this.tsRefs.tsNextButton.title = this.tsT("button.next", "Next");
        if (!tsIsOpen) {
            this.tsTeardownStage();
            this.tsRefs.tsTitle.textContent = "";
            this.tsRefs.tsSubtitle.textContent = "";
            delete this.tsRefs.tsStage.dataset.kind;
            this.tsRefs.tsStage.innerHTML = "";
            this.tsRefs.tsMeta.innerHTML = "";
            return;
        }

        this.tsTeardownStage();
        this.tsRefs.tsTitle.textContent = tsAsset.filename || "Asset";
        this.tsRefs.tsSubtitle.textContent = `${tsAsset.root_label || tsAsset.root_id || ""}${tsAsset.folder_path ? ` / ${tsAsset.folder_path}` : ""}`;
        this.tsRefs.tsStage.dataset.kind = tsAsset.type || "";
        this.tsRefs.tsOpenInNewTabButton.hidden = tsAsset.type === "3d";
        this.tsRefs.tsDeleteButton.disabled = !tsAsset.allow_delete;
        this.tsRefs.tsStage.innerHTML = this.tsBuildStageMarkup(tsAsset);
        this.tsRefs.tsMeta.innerHTML = this.tsBuildMetaMarkup(tsAsset);
        this.tsRefs.tsPrevButton.disabled = this.tsIndex <= 0;
        this.tsRefs.tsNextButton.disabled = this.tsIndex >= this.tsItems.length - 1
            && !(typeof this.tsCanLoadMore === "function" && this.tsCanLoadMore())
            && !this.tsMoreRequestPromise;
        this.tsBindStageInteractions(tsAsset);
    }

    tsBindStageInteractions(tsAsset) {
        if (tsAsset.type === "image") {
            this.tsStageCleanup = this.tsSetupImageStage(tsAsset);
            return;
        }
        if (tsAsset.type === "audio") {
            this.tsStageCleanup = this.tsSetupAudioStage(tsAsset);
            return;
        }
        if (tsAsset.type === "video") {
            const tsVideo = this.tsRefs.tsStage.querySelector("video");
            this.tsStageCleanup = () => tsVideo?.pause();
            return;
        }
        if (tsAsset.type === "3d") {
            this.tsStageCleanup = this.tsSetup3DStage(tsAsset);
            return;
        }
        this.tsStageCleanup = null;
        this.tsDetailRequestToken = 0;
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
            tsAudio.pause();
        };
    }

    tsBuildStageMarkup(tsAsset) {
        const tsFileURL = tsApiURL(tsAsset.file_url);
        const tsPreviewURL = tsApiURL(tsAsset.preview_url);
        if (tsAsset.type === "image") {
            return `<img src="${tsFileURL}" alt="${this.tsEscapeAttribute(tsAsset.filename || "asset")}">`;
        }
        if (tsAsset.type === "video") {
            return `<video src="${tsFileURL}" controls autoplay playsinline></video>`;
        }
        if (tsAsset.type === "audio") {
            return `
                <div class="ts-audio-shell">
                    <div class="ts-audio-waveform-shell" data-audio-seek="true">
                        <div class="ts-audio-waveform-image" style="background-image:url('${this.tsEscapeAttribute(tsPreviewURL)}')" aria-label="${this.tsEscapeAttribute(tsAsset.filename || "audio waveform")}"></div>
                        <div class="ts-audio-progress"></div>
                        <div class="ts-audio-playhead"></div>
                    </div>
                    <div class="ts-audio-controls">
                        <button class="ts-audio-play" type="button">${this.tsT("button.play", "Play")}</button>
                        <button class="ts-audio-stop" type="button">${this.tsT("button.stop", "Stop")}</button>
                        <span class="ts-audio-time">0:00 / 0:00</span>
                    </div>
                    <audio class="ts-audio-element" src="${tsFileURL}" preload="metadata"></audio>
                </div>
            `;
        }
        if (tsAsset.type === "3d") {
            return `
                <div class="ts-3d-shell" data-ready="false">
                    <div class="ts-3d-viewer-host"></div>
                    <img class="ts-3d-fallback" src="${tsPreviewURL}" alt="${this.tsEscapeAttribute(tsAsset.filename || "3d asset")}">
                    <div class="ts-3d-status">${this.tsT("status.loading3dViewer", "Loading 3D viewer...")}</div>
                </div>
            `;
        }
        return `<img src="${tsPreviewURL}" alt="${this.tsEscapeAttribute(tsAsset.filename || "asset")}">`;
    }

    tsEscapeHTML(tsText) {
        return String(tsText || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    tsEscapeAttribute(tsText) {
        return this.tsEscapeHTML(tsText).replaceAll('"', "&quot;");
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






