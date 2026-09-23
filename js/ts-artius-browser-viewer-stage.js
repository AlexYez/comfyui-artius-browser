// What the stage loads to SHOW an asset. display_url is the file itself when
// the browser can play or display it, and a converted copy made on demand
// when it cannot (ProRes, HEVC, AVI, EXR, TIFF...). Older payloads without the
// field fall back to the file.
export function tsResolveDisplayURL(tsAsset) {
    return tsAsset?.display_url || tsAsset?.file_url || "";
}

// "Preparing a playable copy" while the converted copy is being made. It can
// take a few seconds for a long ProRes clip, and an empty player with no
// explanation looked broken.
function tsBuildMediaStatusMarkup(tsAsset, tsDeps) {
    if (tsAsset?.display_mode !== "proxy") {
        return `<div class="ts-media-status" role="status" hidden></div>`;
    }
    return `<div class="ts-media-status" role="status">${tsDeps.escapeHTML(tsDeps.t("status.preparingPreview", "Preparing a viewable copy..."))}</div>`;
}

export function tsBuildStageMarkup(tsAsset, tsDeps) {
    // Asset/preview URLs are backend-generated and safe today, but they are
    // interpolated into HTML attributes just like alt/aria-label — escape them
    // the same way so a future URL-format change cannot silently break out of
    // the attribute. Escaping is a no-op for the current "&"-free/id-based URLs.
    const tsFileURL = tsDeps.escapeAttribute(tsDeps.apiURL(tsResolveDisplayURL(tsAsset)));
    const tsPreviewURL = tsDeps.escapeAttribute(tsDeps.apiURL(tsAsset.preview_url));
    const tsSizeAttributes = `${Number(tsAsset.width) > 0 ? ` width="${Math.round(Number(tsAsset.width))}"` : ""}${Number(tsAsset.height) > 0 ? ` height="${Math.round(Number(tsAsset.height))}"` : ""}`;
    const tsAssetLabel = tsDeps.t("label.asset", "Asset");
    if (tsAsset.type === "image") {
        if (tsDeps.isImageCompareMode()) {
            const tsCompareItems = tsDeps.compareItems.slice(0, 4);
            const tsImageLabel = tsDeps.t("type.image", "Image");
            if (tsCompareItems.length === 2) {
                const [tsBeforeItem, tsAfterItem] = tsCompareItems;
                // Each image sits in its own layer, and the wipe clips the
                // LAYER rather than the image. clip-path is resolved in the
                // element's own coordinate space, so clipping a zoomed image
                // would drag the split away from the divider the moment the
                // user zooms.
                return `
                    <div class="ts-image-compare-shell" data-count="2">
                        <div class="ts-image-compare-wipe">
                            <div class="ts-image-compare-layer ts-image-compare-before">
                                <img class="ts-compare-image" src="${tsDeps.escapeAttribute(tsDeps.apiURL(tsResolveDisplayURL(tsBeforeItem)))}" alt="${tsDeps.escapeAttribute(tsBeforeItem.filename || tsImageLabel)}">
                            </div>
                            <div class="ts-image-compare-layer ts-image-compare-after">
                                <img class="ts-compare-image" src="${tsDeps.escapeAttribute(tsDeps.apiURL(tsResolveDisplayURL(tsAfterItem)))}" alt="${tsDeps.escapeAttribute(tsAfterItem.filename || tsImageLabel)}">
                            </div>
                            <div class="ts-image-compare-divider"></div>
                            <input class="ts-image-compare-range" type="range" min="0" max="100" value="50" aria-label="${tsDeps.escapeAttribute(tsDeps.t("label.imageCompareWipe", "Image comparison slider"))}">
                        </div>
                        <div class="ts-image-compare-zoom" data-active="false"></div>
                    </div>
                `;
            }
            return `
                <div class="ts-image-compare-shell ts-image-compare-grid" data-count="${tsCompareItems.length}">
                    ${tsCompareItems.map((tsCompareItem) => `
                        <div class="ts-image-compare-card">
                            <img class="ts-compare-image" src="${tsDeps.escapeAttribute(tsDeps.apiURL(tsResolveDisplayURL(tsCompareItem)))}" alt="${tsDeps.escapeAttribute(tsCompareItem.filename || tsImageLabel)}">
                        </div>
                    `).join("")}
                    <div class="ts-image-compare-zoom" data-active="false"></div>
                </div>
            `;
        }
        // The index already knows the picture's size, so hand it to the element:
        // the browser reserves the right box before a single byte is decoded.
        // Without it a loading <img> is zero-sized, and every navigation
        // collapsed the stage for a frame before the picture snapped back.
        const tsImageMarkup = `<img${tsSizeAttributes} src="${tsFileURL}" alt="${tsDeps.escapeAttribute(tsAsset.filename || tsAssetLabel)}">`;
        // The status sits AFTER the <img>, so the image stays the stage's
        // first element (the zoom and crossfade code look it up that way).
        return tsAsset.display_mode === "proxy"
            ? `${tsImageMarkup}${tsBuildMediaStatusMarkup(tsAsset, tsDeps)}`
            : tsImageMarkup;
    }
    if (tsAsset.type === "video") {
        if (tsDeps.isVideoCompareMode()) {
            const tsCompareItems = tsDeps.compareItems.slice(0, 4);
            const tsVideoLabel = tsDeps.t("type.video", "Video");
            return `
                <div class="ts-video-compare-shell" data-count="${tsCompareItems.length}">
                    <div class="ts-video-compare-grid">
                        ${tsCompareItems.map((tsCompareItem) => {
                            const tsCompareURL = tsDeps.escapeAttribute(tsDeps.apiURL(tsResolveDisplayURL(tsCompareItem)));
                            const tsPrimary = tsCompareItem.id === tsAsset.id;
                            return `
                                <div class="ts-video-compare-card" data-primary="${String(tsPrimary)}">
                                    <div class="ts-video-compare-label" title="${tsDeps.escapeAttribute(tsCompareItem.filename || tsVideoLabel)}">${tsDeps.escapeHTML(tsCompareItem.filename || tsVideoLabel)}</div>
                                    <video class="ts-video-compare-video ts-compare-video" data-primary="${String(tsPrimary)}" src="${tsCompareURL}" ${tsPrimary ? "" : "muted"} playsinline preload="auto"></video>
                                </div>
                            `;
                        }).join("")}
                    </div>
                    <div class="ts-video-compare-controls">
                        <div class="ts-video-transport">
                            <button class="ts-video-play-toggle" type="button">${tsDeps.t("button.play", "Play")}</button>
                            <input class="ts-video-seek" type="range" min="0" max="0" step="0.001" value="0" aria-label="${tsDeps.escapeAttribute(tsDeps.t("label.playbackPosition", "Playback position"))}">
                            <div class="ts-video-time">0:00 / 0:00</div>
                            <button class="ts-video-mute" type="button" aria-pressed="false">${tsDeps.t("button.mute", "Mute")}</button>
                        </div>
                        <div class="ts-video-compare-status" data-active="false" role="status"></div>
                        <div class="ts-video-stepper">
                            <button class="ts-video-step ts-video-prev-frame" type="button">${tsDeps.t("button.prevFrame", "Previous Frame")}</button>
                            <div class="ts-video-frame">${tsDeps.t("label.currentFrame", "Frame")} 0</div>
                            <button class="ts-video-step ts-video-next-frame" type="button">${tsDeps.t("button.nextFrame", "Next Frame")}</button>
                        </div>
                    </div>
                </div>
            `;
        }
        // The poster fills the frame while the file loads (it used to be a
        // black box that jumped to the video's size); the size attributes
        // reserve the right shape up front. loop: most generated clips are a
        // few seconds long and are watched on repeat.
        const tsPosterAttribute = tsAsset.preview_url && !tsAsset.preview_is_placeholder ? ` poster="${tsPreviewURL}"` : "";
        return `
            <div class="ts-video-shell">
                <video${tsSizeAttributes}${tsPosterAttribute} src="${tsFileURL}" controls autoplay loop playsinline preload="auto"></video>
                ${tsBuildMediaStatusMarkup(tsAsset, tsDeps)}
                <div class="ts-video-controls">
                    <button class="ts-video-step ts-video-prev-frame" type="button">${tsDeps.t("button.prevFrame", "Previous Frame")}</button>
                    <div class="ts-video-frame">${tsDeps.t("label.currentFrame", "Frame")} 0</div>
                    <button class="ts-video-step ts-video-next-frame" type="button">${tsDeps.t("button.nextFrame", "Next Frame")}</button>
                </div>
            </div>
        `;
    }
    if (tsAsset.type === "audio") {
        return `
            <div class="ts-audio-shell">
                <div class="ts-audio-waveform-shell" data-audio-seek="true" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-label="${tsDeps.escapeAttribute(tsDeps.t("label.playbackPosition", "Playback position"))}">
                    <div class="ts-audio-waveform-image" style="background-image:url('${tsPreviewURL}')" aria-label="${tsDeps.escapeAttribute(tsAsset.filename || tsDeps.t("label.audioWaveform", "Audio waveform"))}"></div>
                    <div class="ts-audio-progress"></div>
                    <div class="ts-audio-playhead"></div>
                </div>
                <div class="ts-audio-controls">
                    <button class="ts-audio-play" type="button">${tsDeps.t("button.play", "Play")}</button>
                    <button class="ts-audio-stop" type="button">${tsDeps.t("button.stop", "Stop")}</button>
                    <span class="ts-audio-time">0:00 / 0:00</span>
                </div>
                <audio class="ts-audio-element" src="${tsFileURL}" preload="metadata"></audio>
                ${tsBuildMediaStatusMarkup(tsAsset, tsDeps)}
            </div>
        `;
    }
    if (tsAsset.type === "3d") {
        return `
            <div class="ts-3d-shell" data-ready="false">
                <div class="ts-3d-viewer-host"></div>
                <img class="ts-3d-fallback" src="${tsPreviewURL}" alt="${tsDeps.escapeAttribute(tsAsset.filename || tsDeps.t("label.asset3d", "3D asset"))}">
                <div class="ts-3d-status" role="status">${tsDeps.t("status.loading3dViewer", "Loading 3D viewer...")}</div>
            </div>
        `;
    }
    return `<img src="${tsPreviewURL}" alt="${tsDeps.escapeAttribute(tsAsset.filename || tsAssetLabel)}">`;
}
