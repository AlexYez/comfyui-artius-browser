export function tsBuildItemIndexById(tsItems) {
    const tsItemIndexById = new Map();
    tsItems.forEach((tsItem, tsIndex) => {
        tsItemIndexById.set(tsItem.id, tsIndex);
    });
    return tsItemIndexById;
}

export function tsFindItemById(tsItems, tsItemIndexById, tsAssetId) {
    const tsIndex = tsItemIndexById.get(tsAssetId);
    return tsIndex === undefined ? null : (tsItems[tsIndex] || null);
}

export function tsGetSelectedItems(tsItems, tsItemIndexById, tsSelection) {
    const tsSelectedItems = [];
    tsSelection.forEach((tsAssetId) => {
        const tsIndex = tsItemIndexById.get(tsAssetId);
        if (tsIndex === undefined) {
            return;
        }
        const tsItem = tsItems[tsIndex];
        if (tsItem) {
            tsSelectedItems.push(tsItem);
        }
    });
    return tsSelectedItems;
}
