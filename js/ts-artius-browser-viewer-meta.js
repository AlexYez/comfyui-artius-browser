import {
    tsFormatBitrate,
    tsFormatTime,
} from "./ts-artius-browser-viewer-format.js";

export function tsResolveChannelLayoutLabel(tsChannelCount, tsLabels = {}) {
    const tsChannels = Number(tsChannelCount) || 0;
    if (tsChannels === 1) {
        return tsLabels.mono || "Mono";
    }
    if (tsChannels === 2) {
        return tsLabels.stereo || "Stereo";
    }
    if (tsChannels > 2) {
        return `${tsChannels}ch`;
    }
    return "";
}

export function tsBuildPromptMetaBlock(tsOptions = {}) {
    const tsResolvedText = tsOptions.text || tsOptions.emptyText;
    return `
        <div class="ts-meta-block">
            <div class="ts-meta-row">
                <h4>${tsOptions.escapeHTML(tsOptions.title)}</h4>
                <button class="ts-meta-copy" type="button" data-copy-field="${tsOptions.escapeAttribute(tsOptions.field)}" ${tsOptions.text ? "" : "disabled"}>${tsOptions.copyLabel}</button>
            </div>
            <div class="ts-prompt">${tsOptions.escapeHTML(tsResolvedText)}</div>
        </div>
    `;
}

export function tsBuildImageMetaMarkup(tsAsset, tsDeps) {
    const tsPromptText = tsAsset.prompt_text || "";
    const tsNegativePromptText = tsAsset.negative_prompt_text || "";
    const tsPositivePromptMarkup = tsBuildPromptMetaBlock({
        title: tsDeps.t("meta.positivePrompt", "Positive Prompt"),
        field: "prompt",
        text: tsPromptText,
        emptyText: tsDeps.t("meta.noPrompt", "No prompt metadata found."),
        copyLabel: tsDeps.t("button.copy", "Copy"),
        escapeHTML: tsDeps.escapeHTML,
        escapeAttribute: tsDeps.escapeAttribute,
    });
    const tsNegativePromptMarkup = tsNegativePromptText
        ? tsBuildPromptMetaBlock({
            title: tsDeps.t("meta.negativePrompt", "Negative Prompt"),
            field: "negative_prompt",
            text: tsNegativePromptText,
            emptyText: "",
            copyLabel: tsDeps.t("button.copy", "Copy"),
            escapeHTML: tsDeps.escapeHTML,
            escapeAttribute: tsDeps.escapeAttribute,
        })
        : "";
    const tsSeedText = tsAsset.seed || "";
    const tsSeedMarkup = tsSeedText
        ? `
            <div class="ts-meta-block">
                <div class="ts-meta-row">
                    <h4>${tsDeps.t("meta.seed", "Seed")}</h4>
                    <button class="ts-meta-copy" type="button" data-copy-field="seed">${tsDeps.t("button.copy", "Copy")}</button>
                </div>
                <div class="ts-seed">${tsDeps.escapeHTML(tsSeedText)}</div>
            </div>
        `
        : "";
    const tsModels = Array.isArray(tsAsset.models) ? tsAsset.models.filter(Boolean) : [];
    const tsModelsMarkup = tsModels.length > 0
        ? `
            <div class="ts-meta-block">
                <div class="ts-meta-row">
                    <h4>${tsDeps.t("meta.models", "Models")}</h4>
                    <button class="ts-meta-copy" type="button" data-copy-field="models">${tsDeps.t("button.copy", "Copy")}</button>
                </div>
                <div class="ts-model-list">
                    ${tsModels.map((tsModel) => {
                        // Show the bare file name (checkpoints usually sit in
                        // subfolders) but keep the full path in the tooltip.
                        const tsModelName = String(tsModel).split(/[\\/]/).pop() || String(tsModel);
                        return `<span class="ts-model-chip" title="${tsDeps.escapeAttribute(tsModel)}">${tsDeps.escapeHTML(tsModelName)}</span>`;
                    }).join("")}
                </div>
            </div>
        `
        : "";
    const tsWorkflowButtonMarkup = tsAsset.workflow_text
        ? `
            <div class="ts-meta-block">
                <div class="ts-meta-row">
                    <h4>${tsDeps.t("meta.workflow", "Workflow")}</h4>
                    <button class="ts-meta-copy" type="button" data-copy-field="workflow">${tsDeps.t("button.copyWorkflow", "Copy Workflow")}</button>
                </div>
            </div>
        `
        : "";
    return `
        ${tsPositivePromptMarkup}
        ${tsNegativePromptMarkup}
        ${tsSeedMarkup}
        ${tsModelsMarkup}
        ${tsWorkflowButtonMarkup}
    `;
}

function tsBuildTechnicalRowsMarkup(tsRows, tsDeps) {
    return `
        <div class="ts-meta-block">
            <div class="ts-meta-row">
                <h4>${tsDeps.t("meta.technical", "Technical")}</h4>
            </div>
            <div class="ts-technical-grid">
                ${tsRows.map((tsRow) => `
                    <div class="ts-technical-item">
                        <div class="ts-technical-label">${tsDeps.escapeHTML(tsRow.tsLabel)}</div>
                        <div class="ts-technical-value">${tsDeps.escapeHTML(tsRow.tsValue)}</div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

function tsBuildEmptyTechnicalMarkup(tsEmptyText, tsDeps) {
    return `
        <div class="ts-meta-block">
            <div class="ts-meta-row">
                <h4>${tsDeps.t("meta.technical", "Technical")}</h4>
            </div>
            <div class="ts-technical-empty">${tsEmptyText}</div>
        </div>
    `;
}

export function tsBuild3DMetaMarkup(tsAsset, tsDeps) {
    const tsTechnical = tsAsset?.technical_info || {};
    const tsFormatName = tsTechnical.format_name || String(tsAsset?.extension || "").replace(/^\./, "").toUpperCase();
    const tsSizeText = tsDeps.formatBytes(tsAsset?.size_bytes);
    const tsRows = [];
    if (tsFormatName) {
        tsRows.push({ tsLabel: tsDeps.t("meta.fileFormat", "File Format"), tsValue: tsFormatName });
    }
    if (tsSizeText) {
        tsRows.push({ tsLabel: tsDeps.t("meta.size", "Size"), tsValue: tsSizeText });
    }
    if (tsRows.length === 0) {
        return tsBuildEmptyTechnicalMarkup(tsDeps.t("meta.noTechnical", "No model metadata found."), tsDeps);
    }
    return tsBuildTechnicalRowsMarkup(tsRows, tsDeps);
}

export function tsBuildPromptSeedMetaMarkup(tsAsset, tsDeps) {
    const tsPromptText = tsAsset.prompt_text || tsDeps.t("meta.noPrompt", "No prompt metadata found.");
    return `
        <div class="ts-meta-block">
            <div class="ts-meta-row">
                <h4>${tsDeps.t("meta.prompt", "Prompt")}</h4>
                <button class="ts-meta-copy" type="button" data-copy-field="prompt" ${tsAsset.prompt_text ? "" : "disabled"}>${tsDeps.t("button.copy", "Copy")}</button>
            </div>
            <div class="ts-prompt">${tsDeps.escapeHTML(tsPromptText)}</div>
        </div>
    `;
}

export function tsBuildTechnicalMetaMarkup(tsAsset, tsDeps) {
    const tsTechnical = tsAsset?.technical_info || {};
    const tsRows = [];
    if (tsTechnical.format_name) {
        tsRows.push({ tsLabel: tsDeps.t("meta.fileFormat", "File Format"), tsValue: tsTechnical.format_name });
    }
    if (tsAsset?.type === "video" && Number(tsTechnical.width) > 0 && Number(tsTechnical.height) > 0) {
        tsRows.push({ tsLabel: tsDeps.t("meta.resolution", "Resolution"), tsValue: `${tsTechnical.width}x${tsTechnical.height}` });
    }
    if (tsAsset?.type === "video" && tsTechnical.codec_name) {
        tsRows.push({ tsLabel: tsDeps.t("meta.codec", "Codec"), tsValue: String(tsTechnical.codec_name).toUpperCase() });
    }
    if (tsAsset?.type === "audio" && tsTechnical.codec_name) {
        tsRows.push({ tsLabel: tsDeps.t("meta.codec", "Codec"), tsValue: String(tsTechnical.codec_name).toUpperCase() });
    }
    if (tsAsset?.type === "video" && Number(tsTechnical.fps) > 0) {
        const tsRoundedFPS = Math.round(Number(tsTechnical.fps) * 100) / 100;
        tsRows.push({ tsLabel: tsDeps.t("meta.fps", "FPS"), tsValue: Number.isInteger(tsRoundedFPS) ? `${tsRoundedFPS}` : `${tsRoundedFPS}` });
    }
    if (tsAsset?.type === "video" && (tsTechnical.audio_codec_name || tsAsset.audio_codec_name || tsTechnical.audio_channels || tsAsset.audio_channel_layout)) {
        const tsAudioCodec = String(tsTechnical.audio_codec_name || tsAsset.audio_codec_name || "").toUpperCase();
        const tsAudioChannels = String(tsAsset.audio_channel_layout || tsDeps.resolveChannelLayoutLabel(tsTechnical.audio_channels) || "");
        const tsAudioParts = [tsAudioCodec, tsAudioChannels].filter(Boolean);
        if (tsAudioParts.length > 0) {
            tsRows.push({ tsLabel: tsDeps.t("meta.audioTrack", "Audio Track"), tsValue: tsAudioParts.join(" / ") });
        }
    }
    if (tsAsset?.type === "audio" && (tsTechnical.channels || tsAsset.channel_layout)) {
        const tsChannelLayout = String(tsAsset.channel_layout || tsDeps.resolveChannelLayoutLabel(tsTechnical.channels) || "");
        if (tsChannelLayout) {
            tsRows.push({ tsLabel: tsDeps.t("meta.channels", "Channels"), tsValue: tsChannelLayout });
        }
    }
    if (Number(tsTechnical.duration) > 0) {
        tsRows.push({ tsLabel: tsDeps.t("meta.duration", "Duration"), tsValue: tsFormatTime(tsTechnical.duration) });
    }
    const tsBitrateText = tsFormatBitrate(tsTechnical.bit_rate);
    if (tsBitrateText) {
        tsRows.push({ tsLabel: tsDeps.t("meta.bitrate", "Bitrate"), tsValue: tsBitrateText });
    }
    if (tsRows.length === 0) {
        return tsBuildEmptyTechnicalMarkup(tsDeps.t("meta.noTechnical", "No ffprobe metadata found."), tsDeps);
    }
    return tsBuildTechnicalRowsMarkup(tsRows, tsDeps);
}
