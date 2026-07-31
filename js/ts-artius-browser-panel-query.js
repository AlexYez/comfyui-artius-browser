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
    const tsCursorAfter = Object.prototype.hasOwnProperty.call(tsOverrides, "cursorAfter")
        ? tsOverrides.cursorAfter
        : tsOptions.cursorAfter;
    tsParams.set("limit", String(Math.max(1, tsLimit || tsOptions.defaultLimit)));
    tsParams.set("view", tsView || "flat");
    tsParams.set("sort", tsSortKey || "created_at");
    tsParams.set("order", tsSortDirection || "desc");
    if (tsSearch) {
        tsParams.set("q", String(tsSearch));
        const tsSearchScope = Object.prototype.hasOwnProperty.call(tsOverrides, "searchScope")
            ? tsOverrides.searchScope
            : tsOptions.searchScope;
        // Only send the non-default "all" scope (search prompts too); filename
        // is the default and stays implicit.
        if (String(tsSearchScope || "filename") === "all") {
            tsParams.set("search_scope", "all");
        }
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
    const tsFavoritesOnly = Object.prototype.hasOwnProperty.call(tsOverrides, "favoritesOnly")
        ? tsOverrides.favoritesOnly
        : tsOptions.favoritesOnly;
    // Only sent when active; "show everything" stays the implicit default.
    if (tsFavoritesOnly) {
        tsParams.set("favorites", "1");
    }
    // Optional metadata filters (assets only). Empty date / 0 dimension means
    // "no filter" and is omitted so the query stays minimal.
    const tsFilters = Object.prototype.hasOwnProperty.call(tsOverrides, "filters")
        ? tsOverrides.filters
        : tsOptions.filters;
    if (tsFilters) {
        const tsDateFrom = String(tsFilters.dateFrom || "").trim();
        const tsDateTo = String(tsFilters.dateTo || "").trim();
        if (tsDateFrom) {
            tsParams.set("date_from", tsDateFrom);
        }
        if (tsDateTo) {
            tsParams.set("date_to", tsDateTo);
        }
        const tsDimensions = [
            ["min_width", tsFilters.minWidth],
            ["max_width", tsFilters.maxWidth],
            ["min_height", tsFilters.minHeight],
            ["max_height", tsFilters.maxHeight],
        ];
        for (const [tsKey, tsValue] of tsDimensions) {
            const tsNumber = Number(tsValue || 0);
            if (Number.isFinite(tsNumber) && tsNumber > 0) {
                tsParams.set(tsKey, String(Math.floor(tsNumber)));
            }
        }
    }
    if (tsCursorAfter
        && tsCursorAfter.sort_value !== undefined
        && tsCursorAfter.sort_value !== null
        && tsCursorAfter.id !== undefined
        && tsCursorAfter.id !== null) {
        tsParams.set("after_sort", String(tsCursorAfter.sort_value));
        tsParams.set("after_id", String(tsCursorAfter.id));
    }
    return tsParams;
}
