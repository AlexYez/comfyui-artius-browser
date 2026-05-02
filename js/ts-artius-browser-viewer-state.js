export function tsIsViewerTypedCompareMode(tsAsset, tsCompareItems, tsType) {
    return Boolean(
        tsAsset?.type === tsType
        && Array.isArray(tsCompareItems)
        && (tsCompareItems.length === 2 || tsCompareItems.length === 4),
    );
}

export function tsSyncViewerItemsFromSource(tsOptions = {}) {
    if (typeof tsOptions.getItems !== "function") {
        return {
            tsDidSync: false,
            tsItems: tsOptions.items,
            tsIndex: tsOptions.index,
        };
    }
    const tsSourceItems = tsOptions.getItems();
    if (!Array.isArray(tsSourceItems) || tsSourceItems.length === 0) {
        return {
            tsDidSync: false,
            tsItems: tsOptions.items,
            tsIndex: tsOptions.index,
        };
    }
    const tsItems = [...tsSourceItems];
    const tsCurrentAssetId = tsOptions.preferredAssetId ?? tsOptions.items?.[tsOptions.index]?.id ?? null;
    if (tsCurrentAssetId !== null) {
        const tsMatchedIndex = tsItems.findIndex((tsItem) => tsItem.id === tsCurrentAssetId);
        if (tsMatchedIndex >= 0) {
            return {
                tsDidSync: true,
                tsItems,
                tsIndex: tsMatchedIndex,
            };
        }
    }
    return {
        tsDidSync: true,
        tsItems,
        tsIndex: Math.max(0, Math.min(tsOptions.index, tsItems.length - 1)),
    };
}
