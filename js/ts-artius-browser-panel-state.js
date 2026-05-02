export const tsBrowserSections = Object.freeze(["assets", "workflows"]);

export function tsIsBrowserSection(tsValue) {
    return tsBrowserSections.includes(tsValue);
}

export function tsNormalizeFolderPath(tsValue) {
    return String(tsValue || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
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

export function tsSyncSectionSettingsFromActiveState(tsState, tsIsWorkflowSection) {
    if (tsIsWorkflowSection) {
        tsState.tsWorkflowMode = tsState.tsMode;
        tsState.tsWorkflowSortKey = tsState.tsSortKey === "size_bytes" ? "created_at" : tsState.tsSortKey;
        tsState.tsWorkflowSortDirection = tsState.tsSortDirection;
        tsState.tsWorkflowPreviewSize = tsState.tsPreviewSize;
        tsState.tsWorkflowSearch = tsState.tsSearch;
        return;
    }
    tsState.tsAssetMode = tsState.tsMode;
    tsState.tsAssetSortKey = tsState.tsSortKey;
    tsState.tsAssetSortDirection = tsState.tsSortDirection;
    tsState.tsAssetPreviewSize = tsState.tsPreviewSize;
    tsState.tsAssetSearch = tsState.tsSearch;
}

export function tsApplySectionSettingsToState(tsState, tsOptions = {}) {
    if (tsOptions.isWorkflowSection) {
        tsState.tsMode = tsState.tsWorkflowMode;
        tsState.tsSortKey = tsState.tsWorkflowSortKey === "size_bytes" ? "created_at" : tsState.tsWorkflowSortKey;
        tsState.tsSortDirection = tsState.tsWorkflowSortDirection;
        tsState.tsPreviewSize = tsState.tsWorkflowPreviewSize;
        tsState.tsSearch = tsState.tsWorkflowSearch;
        tsState.tsFolder = tsState.tsMode === "tree" ? (tsOptions.workflowSelectedFolder || "") : "";
        return;
    }
    tsState.tsMode = tsState.tsAssetMode;
    tsState.tsSortKey = tsState.tsAssetSortKey;
    tsState.tsSortDirection = tsState.tsAssetSortDirection;
    tsState.tsPreviewSize = tsState.tsAssetPreviewSize;
    tsState.tsSearch = tsState.tsAssetSearch;
    tsState.tsFolder = tsState.tsMode === "tree" ? (tsOptions.lastAssetFolder || "") : "";
}
