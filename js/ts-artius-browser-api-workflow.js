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

const tsComfyAdapterLegacyNotices = new Set();

function tsLogComfyLegacySurface(tsDeps, tsKey, tsMessage) {
    if (tsComfyAdapterLegacyNotices.has(tsKey)) {
        return;
    }
    tsComfyAdapterLegacyNotices.add(tsKey);
    tsDeps?.consoleDebug?.(tsMessage);
}

function tsNormalizeGraphPosition(tsPosition) {
    if (!Array.isArray(tsPosition) || tsPosition.length < 2) {
        return null;
    }
    return [Number(tsPosition[0]) || 0, Number(tsPosition[1]) || 0];
}

export function tsGetComfyCanvasElement(tsDeps) {
    return tsDeps?.app?.canvas?.canvas || null;
}

export function tsGetComfyGraph(tsDeps) {
    const tsCanvasGraph = tsDeps?.app?.canvas?.graph;
    if (tsCanvasGraph) {
        return tsCanvasGraph;
    }
    const tsGraph = tsDeps?.app?.graph;
    if (tsGraph) {
        tsLogComfyLegacySurface(
            tsDeps,
            "app.graph",
            "Timesaver Artius Browser using legacy app.graph fallback",
        );
    }
    return tsGraph || null;
}

export function tsGetComfyCanvasDropGraphPosition(tsEvent, tsDeps) {
    const tsCanvas = tsDeps?.app?.canvas;
    if (tsEvent && typeof tsCanvas?.convertEventToCanvasOffset === "function") {
        const tsOffset = tsNormalizeGraphPosition(tsCanvas.convertEventToCanvasOffset(tsEvent));
        if (tsOffset) {
            return tsOffset;
        }
    }
    const tsGraphMouse = tsNormalizeGraphPosition(tsCanvas?.graph_mouse);
    if (tsGraphMouse) {
        tsLogComfyLegacySurface(
            tsDeps,
            "app.canvas.graph_mouse",
            "Timesaver Artius Browser using legacy canvas graph_mouse fallback",
        );
        return tsGraphMouse;
    }
    return null;
}

export function tsGetComfyVisibleNodes(tsDeps) {
    const tsVisibleNodes = tsDeps?.app?.canvas?.visible_nodes;
    if (Array.isArray(tsVisibleNodes) && tsVisibleNodes.length > 0) {
        return tsVisibleNodes;
    }
    const tsLegacyNodes = tsDeps?.app?.graph?._nodes;
    if (Array.isArray(tsLegacyNodes)) {
        tsLogComfyLegacySurface(
            tsDeps,
            "app.graph._nodes",
            "Timesaver Artius Browser using legacy graph _nodes fallback",
        );
        return tsLegacyNodes;
    }
    return [];
}

export function tsGetComfySelectedNodes(tsDeps) {
    const tsSelected = tsDeps?.app?.canvas?.selected_nodes;
    if (!tsSelected) {
        return [];
    }
    if (Array.isArray(tsSelected)) {
        return tsSelected;
    }
    return Object.values(tsSelected);
}

export function tsCreateComfyGraphNode(tsNodeType, tsDeps) {
    const tsLiteGraph = tsDeps?.window?.LiteGraph;
    if (typeof tsLiteGraph?.createNode !== "function") {
        return null;
    }
    tsLogComfyLegacySurface(
        tsDeps,
        "window.LiteGraph.createNode",
        "Timesaver Artius Browser using legacy LiteGraph createNode fallback",
    );
    return tsLiteGraph.createNode(tsNodeType);
}

export function tsAddComfyGraphNode(tsNode, tsDeps) {
    const tsGraph = tsGetComfyGraph(tsDeps);
    if (!tsGraph || typeof tsGraph.add !== "function" || !tsNode) {
        return false;
    }
    tsGraph.add(tsNode);
    return true;
}

export function tsMarkComfyGraphDirty(tsDeps) {
    tsGetComfyGraph(tsDeps)?.setDirtyCanvas?.(true, true);
    tsDeps?.app?.canvas?.setDirty?.(true, true);
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
