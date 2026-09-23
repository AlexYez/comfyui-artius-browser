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

// What a POST /delete answer means for the grid. `deleted` went to the trash
// and `missing` had no row any more (another tab, a scan): both cards go.
// Anything else the backend skipped is a file that is still on disk - locked
// by another program, or in a root that does not allow deleting - and its card
// must stay. An older backend without the lists is taken at its word for the
// whole request, which is what the panel always assumed.
export function tsResolveDeleteOutcome(tsRequestedIds, tsResult) {
    const tsRequested = (Array.isArray(tsRequestedIds) ? tsRequestedIds : []).map(Number);
    if (!tsResult || !Array.isArray(tsResult.deleted)) {
        return { tsDeletedIds: tsRequested, tsRemovedIds: tsRequested, tsFailedIds: [] };
    }
    const tsDeletedIds = tsResult.deleted.map(Number);
    const tsMissingIds = Array.isArray(tsResult.missing) ? tsResult.missing.map(Number) : [];
    const tsRemoved = new Set([...tsDeletedIds, ...tsMissingIds]);
    return {
        tsDeletedIds,
        tsRemovedIds: [...tsRemoved],
        tsFailedIds: tsRequested.filter((tsId) => !tsRemoved.has(tsId)),
    };
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
