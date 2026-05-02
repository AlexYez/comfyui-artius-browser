export function tsBuildAssetSearchParams(tsOptions = {}) {
    const tsOverrides = tsOptions.overrides || {};
    const tsParams = new URLSearchParams();
    const tsLimit = Number(tsOverrides.limit ?? tsOptions.defaultLimit);
    const tsView = tsOverrides.view ?? tsOptions.view;
    const tsSortKey = tsOverrides.sortKey ?? tsOptions.sortKey;
    const tsSortDirection = tsOverrides.sortDirection ?? tsOptions.sortDirection;
    const tsSearch = Object.prototype.hasOwnProperty.call(tsOverrides, "search")
        ? tsOverrides.search
        : tsOptions.search;
    const tsRootId = Object.prototype.hasOwnProperty.call(tsOverrides, "rootId")
        ? tsOverrides.rootId
        : tsOptions.rootId;
    const tsTypes = Object.prototype.hasOwnProperty.call(tsOverrides, "types")
        ? tsOverrides.types
        : tsOptions.types;
    const tsFolder = Object.prototype.hasOwnProperty.call(tsOverrides, "folder")
        ? tsOverrides.folder
        : (tsOptions.view === "tree" ? tsOptions.folder : "");
    tsParams.set("offset", String(Math.max(0, Number(tsOptions.offset) || 0)));
    tsParams.set("limit", String(Math.max(1, tsLimit || tsOptions.defaultLimit)));
    tsParams.set("view", tsView || "flat");
    tsParams.set("sort", tsSortKey || "created_at");
    tsParams.set("order", tsSortDirection || "desc");
    if (tsSearch) {
        tsParams.set("q", String(tsSearch));
    }
    if (tsRootId && tsRootId !== "all") {
        tsParams.set("root_id", String(tsRootId));
    }
    if (Array.isArray(tsTypes) && tsTypes.length > 0) {
        tsParams.set("types", tsTypes.join(","));
    }
    if (tsFolder) {
        tsParams.set("folder", String(tsFolder));
    }
    return tsParams;
}
