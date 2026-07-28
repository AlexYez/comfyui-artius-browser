import { tsNormalizeRelativePath } from "./ts-artius-browser-api-paths.js";

export const tsBrowserSections = Object.freeze(["assets", "workflows"]);

export function tsIsBrowserSection(tsValue) {
    return tsBrowserSections.includes(tsValue);
}

// Folder paths and asset-relative paths are normalized by the same rule, and
// both are applied to the same folder_path values. Delegating keeps a single
// implementation: these used to be byte-identical copies, so hardening one
// (collapsing "//", rejecting "..") would silently leave the other behind.
export function tsNormalizeFolderPath(tsValue) {
    return tsNormalizeRelativePath(tsValue);
}

export function tsResolveLocaleCode(tsUILanguage, tsComfyLocale) {
    // Which locale JSON to load. ComfyUI's own locale wins (it reflects the
    // user's app-wide language choice, so a Russian ComfyUI shows a Russian
    // panel automatically); an explicit ui.language is the fallback override;
    // English is the final default. Region suffixes are dropped ("ru-RU" ->
    // "ru"). An unsupported code still round-trips — tsLoadLocale falls back to
    // English if the file is missing.
    const tsNormalize = (tsValue) => String(tsValue || "").trim().toLowerCase().split(/[-_]/)[0];
    return tsNormalize(tsComfyLocale) || tsNormalize(tsUILanguage) || "en";
}

export function tsResolvePreviewSize(tsValue, tsFallback, tsPreviewSizeRange) {
    const tsSize = Number(tsValue || 0);
    return Number.isFinite(tsSize) && tsSize > 0
        ? Math.max(tsPreviewSizeRange.min, Math.min(tsPreviewSizeRange.max, tsSize))
        : tsFallback;
}

export function tsNormalizeViewMode(tsValue, tsFallback) {
    return tsValue === "flat" || tsValue === "tree" ? tsValue : tsFallback;
}

export function tsNormalizeSortDirection(tsValue, tsFallback) {
    return tsValue === "asc" || tsValue === "desc" ? tsValue : tsFallback;
}

export function tsNormalizeAssetSortKey(tsValue, tsFallback) {
    return tsValue === "created_at" || tsValue === "filename" || tsValue === "size_bytes" ? tsValue : tsFallback;
}

export function tsNormalizeWorkflowSortKey(tsValue, tsFallback) {
    const tsSafeFallback = tsFallback === "size_bytes" ? "created_at" : tsFallback;
    return tsValue === "created_at" || tsValue === "filename" ? tsValue : tsSafeFallback;
}

export function tsNormalizeAssetTypeSet(tsValues, tsTypeOrder) {
    if (!Array.isArray(tsValues)) {
        return null;
    }
    return new Set(
        tsValues
            .map((tsType) => String(tsType || ""))
            .filter((tsType) => tsTypeOrder.includes(tsType))
    );
}

// Single source of truth for every setting that is persisted independently per
// browser section (Assets vs Workflows). Each entry maps the "active" state
// field the UI reads/writes to its per-section mirrors. Sync (active → mirror)
// and apply (mirror → active) both iterate this table, so adding a new
// per-section setting is a one-line change here instead of four hand-edited
// assignment blocks that could silently drift out of sync.
// `tsCoerceWorkflow` guards the Workflows section, which has no size sort — a
// size_bytes selection there falls back to created_at.
const tsSectionSettingFields = [
    { tsActive: "tsMode", tsAsset: "tsAssetMode", tsWorkflow: "tsWorkflowMode" },
    {
        tsActive: "tsSortKey",
        tsAsset: "tsAssetSortKey",
        tsWorkflow: "tsWorkflowSortKey",
        tsCoerceWorkflow: (tsValue) => (tsValue === "size_bytes" ? "created_at" : tsValue),
    },
    { tsActive: "tsSortDirection", tsAsset: "tsAssetSortDirection", tsWorkflow: "tsWorkflowSortDirection" },
    { tsActive: "tsPreviewSize", tsAsset: "tsAssetPreviewSize", tsWorkflow: "tsWorkflowPreviewSize" },
    { tsActive: "tsSearch", tsAsset: "tsAssetSearch", tsWorkflow: "tsWorkflowSearch" },
    { tsActive: "tsTreeWidth", tsAsset: "tsAssetTreeWidth", tsWorkflow: "tsWorkflowTreeWidth" },
];

export function tsSyncSectionSettingsFromActiveState(tsState, tsIsWorkflowSection) {
    const tsMirrorKey = tsIsWorkflowSection ? "tsWorkflow" : "tsAsset";
    for (const tsField of tsSectionSettingFields) {
        const tsValue = tsState[tsField.tsActive];
        tsState[tsField[tsMirrorKey]] = tsIsWorkflowSection && tsField.tsCoerceWorkflow
            ? tsField.tsCoerceWorkflow(tsValue)
            : tsValue;
    }
}

export function tsApplySectionSettingsToState(tsState, tsOptions = {}) {
    const tsIsWorkflowSection = Boolean(tsOptions.isWorkflowSection);
    const tsMirrorKey = tsIsWorkflowSection ? "tsWorkflow" : "tsAsset";
    for (const tsField of tsSectionSettingFields) {
        const tsValue = tsState[tsField[tsMirrorKey]];
        tsState[tsField.tsActive] = tsIsWorkflowSection && tsField.tsCoerceWorkflow
            ? tsField.tsCoerceWorkflow(tsValue)
            : tsValue;
    }
    const tsSelectedFolder = tsIsWorkflowSection
        ? (tsOptions.workflowSelectedFolder || "")
        : (tsOptions.lastAssetFolder || "");
    tsState.tsFolder = tsState.tsMode === "tree" ? tsSelectedFolder : "";
}
