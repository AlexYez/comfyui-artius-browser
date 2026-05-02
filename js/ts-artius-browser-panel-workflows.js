export function tsBuildWorkflowRootNodes(tsLabel = "Workflows") {
    return [{
        root_id: "workflows",
        label: tsLabel,
    }];
}

export function tsBuildWorkflowFolders(tsItems) {
    const tsFolderCounts = new Map();
    (tsItems || []).forEach((tsItem) => {
        const tsFolderPath = String(tsItem?.folder_path || "");
        tsFolderCounts.set(tsFolderPath, Number(tsFolderCounts.get(tsFolderPath) || 0) + 1);
    });
    return [...tsFolderCounts.entries()].map(([tsFolderPath, tsAssetCount]) => ({
        root_id: "workflows",
        folder_path: tsFolderPath,
        asset_count: tsAssetCount,
    }));
}

export function tsBuildWorkflowQueryResult(tsItems, tsOptions = {}) {
    const tsSearchNeedle = String(tsOptions.search || "").trim().toLowerCase();
    const tsSelectedFolder = tsOptions.mode === "tree" ? String(tsOptions.folder || "") : "";
    const tsFilteredForTree = (tsItems || []).filter((tsItem) => {
        if (tsSearchNeedle && !String(tsItem?.filename || "").toLowerCase().includes(tsSearchNeedle)) {
            return false;
        }
        return true;
    });
    const tsVisibleItems = tsFilteredForTree.filter((tsItem) => {
        if (!tsSelectedFolder) {
            return true;
        }
        const tsItemFolder = String(tsItem?.folder_path || "");
        return tsItemFolder === tsSelectedFolder || tsItemFolder.startsWith(`${tsSelectedFolder}/`);
    });
    const tsSortDirectionFactor = tsOptions.sortDirection === "asc" ? 1 : -1;
    const tsSortedItems = [...tsVisibleItems].sort((tsLeft, tsRight) => {
        if (tsOptions.sortKey === "filename") {
            return tsSortDirectionFactor * String(tsLeft?.filename || "").localeCompare(String(tsRight?.filename || ""), undefined, { sensitivity: "base" });
        }
        if (tsOptions.sortKey === "size_bytes") {
            return tsSortDirectionFactor * (Number(tsLeft?.size_bytes || 0) - Number(tsRight?.size_bytes || 0));
        }
        return tsSortDirectionFactor * (Number(tsLeft?.modified_at || tsLeft?.created_at || 0) - Number(tsRight?.modified_at || tsRight?.created_at || 0));
    });
    return {
        items: tsSortedItems,
        folders: tsBuildWorkflowFolders(tsFilteredForTree),
        roots: tsOptions.roots || tsBuildWorkflowRootNodes(),
    };
}
