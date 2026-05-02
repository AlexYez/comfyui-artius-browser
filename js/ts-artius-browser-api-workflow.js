export function tsSplitRelativePath(tsRelativePath) {
    const tsNormalized = String(tsRelativePath || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    if (!tsNormalized) {
        return { tsSubfolder: "", tsFilename: "" };
    }
    const tsParts = tsNormalized.split("/").filter(Boolean);
    if (!tsParts.length) {
        return { tsSubfolder: "", tsFilename: "" };
    }
    return {
        tsSubfolder: tsParts.slice(0, -1).join("/"),
        tsFilename: tsParts.at(-1) || "",
    };
}

export function tsBuildAssetFetchPath(tsAsset, tsRouteBase) {
    if (!tsAsset) {
        return "";
    }
    if (tsAsset.file_url) {
        return String(tsAsset.file_url);
    }
    if (tsAsset.id != null) {
        return `${tsRouteBase}/file?id=${encodeURIComponent(String(tsAsset.id))}`;
    }
    return "";
}

export function tsGetRelativeAssetPath(tsAsset) {
    if (!tsAsset?.filename) {
        return "";
    }
    const tsFolder = String(tsAsset.folder_path || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    return tsFolder ? `${tsFolder}/${tsAsset.filename}` : tsAsset.filename;
}

export function tsResolveNodeComfyClass(tsNode) {
    return String(
        tsNode?.comfyClass
        || tsNode?.constructor?.comfyClass
        || tsNode?.properties?.["Node name for S&R"]
        || tsNode?.type
        || "",
    );
}

export function tsIsGraphPointInsideNode(tsNode, tsGraphX, tsGraphY) {
    if (!tsNode) {
        return false;
    }
    if (typeof tsNode.isPointInside === "function") {
        try {
            return Boolean(tsNode.isPointInside(tsGraphX, tsGraphY, 2, false));
        } catch {
            try {
                return Boolean(tsNode.isPointInside(tsGraphX, tsGraphY));
            } catch {
                // Fall back to the node bounds check below.
            }
        }
    }
    const tsPosX = Number(tsNode?.pos?.[0]) || 0;
    const tsPosY = Number(tsNode?.pos?.[1]) || 0;
    const tsWidth = Number(tsNode?.size?.[0]) || 0;
    const tsHeight = Number(tsNode?.size?.[1]) || 0;
    return tsGraphX >= tsPosX
        && tsGraphX <= tsPosX + tsWidth
        && tsGraphY >= tsPosY
        && tsGraphY <= tsPosY + tsHeight;
}
