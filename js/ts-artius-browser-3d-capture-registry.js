// @ts-check
// Shared arbitration between the two 3D-thumbnail capture pipelines.
//
// There are deliberately two: TS3DThumbnailQueue (panel-3d-queue.js) captures
// the models currently VISIBLE in the grid so a user scrolling a 3D folder sees
// thumbnails appear, and TSGlobal3DThumbnailWorker (3d-worker.js) sweeps the
// whole library in the background even while the sidebar tab is closed. Their
// scheduling is genuinely different and stays separate.
//
// What must NOT be separate is the decision of whether a given model needs
// capturing and whether someone is already capturing it. Each capture spins up a
// WebGL/Three.js context and parses a full model file, so two pipelines racing
// on the same viewer_3d_url means two contexts, two model loads, and two
// competing writes to the same asset row. Both pipelines therefore share the
// predicate and the in-flight set below.

// viewer_3d_url values currently being captured by ANY pipeline.
const tsActiveCaptureURLs = new Set();

/**
 * The single skip predicate. An asset needs a capture only when it is a 3D
 * asset with a viewer URL whose stored preview is not already a real (non
 * placeholder) 3D capture.
 * @param {{type?: string, viewer_3d_url?: string, preview_is_3d_capture?: boolean, preview_is_placeholder?: boolean} | null | undefined} tsAsset
 * @returns {boolean}
 */
export function tsNeeds3DCapture(tsAsset) {
    if (!tsAsset || tsAsset.type !== "3d" || !tsAsset.viewer_3d_url) {
        return false;
    }
    return !(tsAsset.preview_is_3d_capture && !tsAsset.preview_is_placeholder);
}

/**
 * Claim a model for capture. Returns false when another pipeline already holds
 * it, in which case the caller must skip - not wait.
 * @param {string} tsViewerURL
 * @returns {boolean}
 */
export function tsAcquire3DCapture(tsViewerURL) {
    if (!tsViewerURL || tsActiveCaptureURLs.has(tsViewerURL)) {
        return false;
    }
    tsActiveCaptureURLs.add(tsViewerURL);
    return true;
}

/**
 * Release a claim taken by tsAcquire3DCapture. Always call from a finally block.
 * @param {string} tsViewerURL
 * @returns {void}
 */
export function tsRelease3DCapture(tsViewerURL) {
    tsActiveCaptureURLs.delete(tsViewerURL);
}
