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

export function tsResolveDragAssets(tsItems, tsItemIndexById, tsSelection, tsDraggedId) {
    // Which assets a drag carries: if the grabbed card is part of a
    // multi-selection, drag the whole selection (preserving item order);
    // otherwise just the grabbed card.
    const tsDragged = tsFindItemById(tsItems, tsItemIndexById, tsDraggedId);
    if (!tsDragged) {
        return [];
    }
    if (tsSelection.has(tsDraggedId) && tsSelection.size > 1) {
        const tsSelected = tsItems.filter((tsItem) => tsSelection.has(tsItem.id));
        if (tsSelected.length > 1) {
            return tsSelected;
        }
    }
    return [tsDragged];
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
