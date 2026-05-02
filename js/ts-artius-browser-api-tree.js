export function tsBuildFolderTree(tsFolders, tsRoots) {
    const tsRootNodes = new Map();
    for (const tsRoot of tsRoots || []) {
        tsRootNodes.set(tsRoot.root_id, {
            tsKey: `root:${tsRoot.root_id}`,
            tsRootId: tsRoot.root_id,
            tsFolderPath: "",
            tsLabel: tsRoot.label || tsRoot.root_id,
            tsDirectCount: 0,
            tsCount: 0,
            tsChildren: [],
            tsIndex: new Map(),
        });
    }
    for (const tsFolder of tsFolders || []) {
        const tsRootNode = tsRootNodes.get(tsFolder.root_id);
        if (!tsRootNode) {
            continue;
        }
        const tsDirectCount = Number(tsFolder.asset_count || 0);
        const tsSegments = tsFolder.folder_path ? tsFolder.folder_path.split("/").filter(Boolean) : [];
        let tsParentNode = tsRootNode;
        let tsCurrentPath = "";
        for (const tsSegment of tsSegments) {
            tsCurrentPath = tsCurrentPath ? `${tsCurrentPath}/${tsSegment}` : tsSegment;
            if (!tsParentNode.tsIndex.has(tsCurrentPath)) {
                const tsNode = {
                    tsKey: `${tsRootNode.tsRootId}:${tsCurrentPath}`,
                    tsRootId: tsRootNode.tsRootId,
                    tsFolderPath: tsCurrentPath,
                    tsLabel: tsSegment,
                    tsDirectCount: 0,
                    tsCount: 0,
                    tsChildren: [],
                    tsIndex: new Map(),
                };
                tsParentNode.tsChildren.push(tsNode);
                tsParentNode.tsIndex.set(tsCurrentPath, tsNode);
            }
            tsParentNode = tsParentNode.tsIndex.get(tsCurrentPath);
        }
        tsParentNode.tsDirectCount = tsDirectCount;
    }
    const tsFinalizeCounts = (tsNode) => {
        const tsChildrenCount = tsNode.tsChildren.reduce((tsTotal, tsChild) => tsTotal + tsFinalizeCounts(tsChild), 0);
        tsNode.tsCount = Number(tsNode.tsDirectCount || 0) + tsChildrenCount;
        return tsNode.tsCount;
    };
    const tsSortNodes = (tsNodes) => {
        tsNodes.sort((tsLeft, tsRight) => tsLeft.tsLabel.localeCompare(tsRight.tsLabel));
        for (const tsNode of tsNodes) {
            tsSortNodes(tsNode.tsChildren);
        }
    };
    const tsRootsList = [...tsRootNodes.values()];
    for (const tsRootNode of tsRootsList) {
        tsFinalizeCounts(tsRootNode);
    }
    tsSortNodes(tsRootsList);
    return tsRootsList;
}
