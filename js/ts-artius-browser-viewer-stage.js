export function tsBuildStageMarkup(tsAsset, tsDeps) {
    const tsFileURL = tsDeps.apiURL(tsAsset.file_url);
    const tsPreviewURL = tsDeps.apiURL(tsAsset.preview_url);
    const tsAssetLabel = tsDeps.t("label.asset", "Asset");
    if (tsAsset.type === "image") {
        if (tsDeps.isImageCompareMode()) {
            const tsCompareItems = tsDeps.compareItems.slice(0, 4);
            const tsImageLabel = tsDeps.t("type.image", "Image");
            if (tsCompareItems.length === 2) {
                const [tsBeforeItem, tsAfterItem] = tsCompareItems;
                return `
                    <div class="ts-image-compare-shell" data-count="2">
                        <div class="ts-image-compare-wipe">
                            <img class="ts-image-compare-before" src="${tsDeps.apiURL(tsBeforeItem.file_url)}" alt="${tsDeps.escapeAttribute(tsBeforeItem.filename || tsImageLabel)}">
                            <img class="ts-image-compare-after" src="${tsDeps.apiURL(tsAfterItem.file_url)}" alt="${tsDeps.escapeAttribute(tsAfterItem.filename || tsImageLabel)}">
                            <div class="ts-image-compare-divider"></div>
                            <input class="ts-image-compare-range" type="range" min="0" max="100" value="50" aria-label="${tsDeps.escapeAttribute(tsDeps.t("label.imageCompareWipe", "Image comparison slider"))}">
                        </div>
                    </div>
                `;
            }
            return `
                <div class="ts-image-compare-shell ts-image-compare-grid" data-count="${tsCompareItems.length}">
                    ${tsCompareItems.map((tsCompareItem) => `
                        <div class="ts-image-compare-card">
                            <img src="${tsDeps.apiURL(tsCompareItem.file_url)}" alt="${tsDeps.escapeAttribute(tsCompareItem.filename || tsImageLabel)}">
                        </div>
                    `).join("")}
                </div>
            `;
        }
        return `<img src="${tsFileURL}" alt="${tsDeps.escapeAttribute(tsAsset.filename || tsAssetLabel)}">`;
    }
    if (tsAsset.type === "video") {
        if (tsDeps.isVideoCompareMode()) {
            const tsCompareItems = tsDeps.compareItems.slice(0, 4);
            const tsVideoLabel = tsDeps.t("type.video", "Video");
            return `
                <div class="ts-video-compare-shell" data-count="${tsCompareItems.length}">
                    <div class="ts-video-compare-grid">
                        ${tsCompareItems.map((tsCompareItem) => {
                            const tsCompareURL = tsDeps.apiURL(tsCompareItem.file_url);
                            const tsPrimary = tsCompareItem.id === tsAsset.id;
                            return `
                                <div class="ts-video-compare-card" data-primary="${String(tsPrimary)}">
                                    <div class="ts-video-compare-label" title="${tsDeps.escapeAttribute(tsCompareItem.filename || tsVideoLabel)}">${tsDeps.escapeHTML(tsCompareItem.filename || tsVideoLabel)}</div>
                                    <video class="ts-video-compare-video ts-compare-video" data-primary="${String(tsPrimary)}" src="${tsCompareURL}" ${tsPrimary ? "" : "muted"} playsinline preload="metadata"></video>
                                </div>
                            `;
                        }).join("")}
                    </div>
                    <div class="ts-video-compare-controls">
                        <div class="ts-video-transport">
                            <button class="ts-video-play-toggle" type="button">${tsDeps.t("button.play", "Play")}</button>
                            <input class="ts-video-seek" type="range" min="0" max="0" step="0.001" value="0">
                            <div class="ts-video-time">0:00 / 0:00</div>
                        </div>
                        <div class="ts-video-stepper">
                            <button class="ts-video-step ts-video-prev-frame" type="button">${tsDeps.t("button.prevFrame", "Previous Frame")}</button>
                            <div class="ts-video-frame">${tsDeps.t("label.currentFrame", "Frame")} 0</div>
                            <button class="ts-video-step ts-video-next-frame" type="button">${tsDeps.t("button.nextFrame", "Next Frame")}</button>
                        </div>
                    </div>
                </div>
            `;
        }
        return `
            <div class="ts-video-shell">
                <video src="${tsFileURL}" controls autoplay playsinline></video>
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
                <div class="ts-audio-waveform-shell" data-audio-seek="true">
                    <div class="ts-audio-waveform-image" style="background-image:url('${tsDeps.escapeAttribute(tsPreviewURL)}')" aria-label="${tsDeps.escapeAttribute(tsAsset.filename || tsDeps.t("label.audioWaveform", "Audio waveform"))}"></div>
                    <div class="ts-audio-progress"></div>
                    <div class="ts-audio-playhead"></div>
                </div>
                <div class="ts-audio-controls">
                    <button class="ts-audio-play" type="button">${tsDeps.t("button.play", "Play")}</button>
                    <button class="ts-audio-stop" type="button">${tsDeps.t("button.stop", "Stop")}</button>
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
                <img class="ts-3d-fallback" src="${tsPreviewURL}" alt="${tsDeps.escapeAttribute(tsAsset.filename || tsDeps.t("label.asset3d", "3D asset"))}">
                <div class="ts-3d-status">${tsDeps.t("status.loading3dViewer", "Loading 3D viewer...")}</div>
            </div>
        `;
    }
    return `<img src="${tsPreviewURL}" alt="${tsDeps.escapeAttribute(tsAsset.filename || tsAssetLabel)}">`;
}
