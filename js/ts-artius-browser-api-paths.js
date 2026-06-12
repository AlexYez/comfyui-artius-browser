const tsWorkflowUserdataRoot = "workflows";
const tsWorkflowPreviewImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);
const tsWorkflowPreviewVideoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);

// Combined djb2+sdbm hash of the workflow's relative path, projected into
// the negative integer range so a workflow id stays stable across library
// re-fetches even when entries are added/removed. Negative range avoids
// collisions with positive DB-backed asset ids; the +1 offset prevents a
// path that hashes to 0 from producing id 0 (a "no item" sentinel). Two
// independent 32-bit hashes packed into a 52-bit safe integer make an
// accidental id collision between two workflow paths practically
// impossible (both hashes would have to collide at once).
function tsHashWorkflowRelativePathToId(tsRelativePath) {
    const tsText = String(tsRelativePath || "");
    let tsHashA = 5381;
    let tsHashB = 0;
    for (let tsIndex = 0; tsIndex < tsText.length; tsIndex += 1) {
        const tsCode = tsText.charCodeAt(tsIndex);
        tsHashA = (((tsHashA << 5) + tsHashA) + tsCode) | 0;
        tsHashB = (tsCode + (tsHashB << 6) + (tsHashB << 16) - tsHashB) | 0;
    }
    return -((Math.abs(tsHashA) * 0x200000) + (tsHashB & 0x1FFFFF) + 1);
}

export function tsNormalizeRelativePath(tsPath) {
    return String(tsPath || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

export function tsBuildUserdataFilePath(tsRelativePath) {
    const tsNormalizedPath = tsNormalizeRelativePath(tsRelativePath);
    if (!tsNormalizedPath) {
        return "";
    }
    return `/userdata/${encodeURIComponent(tsNormalizedPath)}`;
}

export function tsBuildUserdataFileURL(tsRelativePath, tsApiURL) {
    const tsPath = tsBuildUserdataFilePath(tsRelativePath);
    return tsPath ? tsApiURL(tsPath) : "";
}

export function tsGetPathExtension(tsPath) {
    const tsFilename = tsNormalizeRelativePath(tsPath).split("/").at(-1) || "";
    const tsDotIndex = tsFilename.lastIndexOf(".");
    return tsDotIndex >= 0 ? tsFilename.slice(tsDotIndex).toLowerCase() : "";
}

export function tsGetPathStem(tsPath) {
    const tsFilename = tsNormalizeRelativePath(tsPath).split("/").at(-1) || "";
    const tsDotIndex = tsFilename.lastIndexOf(".");
    return tsDotIndex >= 0 ? tsFilename.slice(0, tsDotIndex) : tsFilename;
}

export function tsGetParentFolderPath(tsPath) {
    const tsNormalizedPath = tsNormalizeRelativePath(tsPath);
    const tsSegments = tsNormalizedPath.split("/").filter(Boolean);
    return tsSegments.slice(0, -1).join("/");
}

export function tsParseModifiedEpoch(tsValue) {
    if (Number.isFinite(tsValue)) {
        return Math.floor(Number(tsValue));
    }
    if (typeof tsValue !== "string" || !tsValue) {
        return 0;
    }
    const tsEpochMs = Date.parse(tsValue);
    return Number.isFinite(tsEpochMs) ? Math.floor(tsEpochMs / 1000) : 0;
}

export function tsPickWorkflowPreview(tsCandidates) {
    if (!Array.isArray(tsCandidates) || tsCandidates.length === 0) {
        return null;
    }
    const tsImageCandidate = tsCandidates.find((tsCandidate) => tsCandidate.preview_kind === "image");
    return tsImageCandidate || tsCandidates[0] || null;
}

export function tsToWorkflowBrowserFolderPath(tsRelativePath) {
    const tsNormalizedPath = tsNormalizeRelativePath(tsRelativePath);
    if (!tsNormalizedPath.toLowerCase().startsWith(`${tsWorkflowUserdataRoot}/`)) {
        return "";
    }
    return tsNormalizedPath
        .slice(tsWorkflowUserdataRoot.length + 1)
        .split("/")
        .filter(Boolean)
        .slice(0, -1)
        .join("/");
}

export function tsToWorkflowStorePath(tsRelativePath) {
    const tsNormalizedPath = tsNormalizeRelativePath(tsRelativePath);
    if (!tsNormalizedPath) {
        return "";
    }
    if (!tsNormalizedPath.toLowerCase().startsWith(`${tsWorkflowUserdataRoot}/`)) {
        return tsNormalizedPath;
    }
    return tsNormalizedPath.slice(tsWorkflowUserdataRoot.length + 1);
}

export function tsBuildWorkflowBrowserLibraryItems(tsEntries, tsBuildUserdataURL) {
    const tsFileEntries = (Array.isArray(tsEntries) ? tsEntries : [])
        .filter((tsEntry) => String(tsEntry?.type || "").toLowerCase() === "file")
        .map((tsEntry) => {
            const tsPath = tsNormalizeRelativePath(tsEntry?.path || "");
            return {
                ...tsEntry,
                path: tsPath,
                name: String(tsEntry?.name || tsPath.split("/").at(-1) || ""),
            };
        })
        .filter((tsEntry) => tsEntry.path.toLowerCase().startsWith(`${tsWorkflowUserdataRoot}/`));

    const tsPreviewsByKey = new Map();
    const tsWorkflowEntries = [];
    for (const tsEntry of tsFileEntries) {
        const tsExtension = tsGetPathExtension(tsEntry.path);
        const tsFolderKey = tsGetParentFolderPath(tsEntry.path);
        const tsStem = tsGetPathStem(tsEntry.path);
        if (tsExtension === ".json") {
            tsWorkflowEntries.push(tsEntry);
            continue;
        }
        const tsPreviewKind = tsWorkflowPreviewImageExtensions.has(tsExtension)
            ? "image"
            : (tsWorkflowPreviewVideoExtensions.has(tsExtension) ? "video" : "");
        if (!tsPreviewKind) {
            continue;
        }
        const tsPreviewKey = `${tsFolderKey}::${tsStem}`;
        const tsExistingCandidates = tsPreviewsByKey.get(tsPreviewKey) || [];
        tsExistingCandidates.push({
            preview_kind: tsPreviewKind,
            path: tsEntry.path,
            extension: tsExtension,
        });
        tsPreviewsByKey.set(tsPreviewKey, tsExistingCandidates);
    }

    const tsSortedWorkflows = [...tsWorkflowEntries].sort((tsLeft, tsRight) => {
        return tsLeft.path.localeCompare(tsRight.path);
    });
    return tsSortedWorkflows.map((tsEntry, tsIndex) => {
        const tsPreviewKey = `${tsGetParentFolderPath(tsEntry.path)}::${tsGetPathStem(tsEntry.path)}`;
        const tsPreview = tsPickWorkflowPreview(tsPreviewsByKey.get(tsPreviewKey));
        const tsModifiedAt = tsParseModifiedEpoch(tsEntry.modified);
        return {
            id: tsHashWorkflowRelativePathToId(tsEntry.path),
            type: "workflow",
            filename: tsEntry.name,
            extension: ".json",
            folder_path: tsToWorkflowBrowserFolderPath(tsEntry.path),
            relative_path: tsEntry.path,
            file_url: tsBuildUserdataURL(tsEntry.path),
            preview_url: tsPreview ? tsBuildUserdataURL(tsPreview.path) : "",
            preview_kind: tsPreview?.preview_kind || "",
            size_bytes: Number(tsEntry.size || 0),
            created_at: tsModifiedAt,
            modified_at: tsModifiedAt,
            allow_delete: false,
            detail_loaded: true,
        };
    });
}
