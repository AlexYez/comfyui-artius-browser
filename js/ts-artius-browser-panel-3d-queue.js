// Background 3D-thumbnail capture queue, extracted from the panel god-file.
//
// This is a memory-sensitive subsystem: each capture spins up a WebGL/Three.js
// context and loads a full model, and captured thumbnails are data URLs
// (hundreds of KB each). The queue therefore: skips models it already captured
// or that permanently failed, caps concurrency, evicts the oldest cached data
// URLs past a capacity, and stops when disposed (the panel is torn out of the
// DOM when its sidebar tab is hidden). All DOM/state touch points are injected
// so the queue owns only its own bookkeeping and stays unit-testable.
//
// Injected dependencies (tsDeps):
//   patchThumbnail(assetId, previewURL, alt) -> patch the visible card <img>
//   capture(viewerURL, {width,height,warmFrames}) -> Promise<string|""> data URL
//   persistToBackend(assetId, previewURL) -> Promise<{asset?}> save to backend
//   applyPersistedAsset(assetPatch) -> merge the saved card into panel state
//   warn(...args) -> log a non-fatal warning

export class TS3DThumbnailQueue {
    constructor(tsSettings, tsDeps) {
        this.tsSettings = tsSettings || {};
        this.tsDeps = tsDeps || {};
        this.tsDisposed = false;
        this.tsQueue = [];
        this.tsPending = new Set();
        this.tsInFlight = new Set();
        this.tsFailed = new Set();
        this.tsCache = new Map();
        this.tsWorkers = 0;
        this.tsPersisting = new Set();
    }

    tsGetCachedPreviewURL(tsViewerURL) {
        return this.tsCache.get(tsViewerURL);
    }

    // Torn-out-of-DOM teardown: stop scheduling new work and drop the queued
    // (not-yet-started) jobs. In-flight captures finish and no-op on their
    // disposed check. Mirrors the panel's disconnectedCallback contract.
    tsDispose() {
        this.tsDisposed = true;
        this.tsQueue = [];
        this.tsPending.clear();
    }

    tsResume() {
        this.tsDisposed = false;
    }

    // Rebuild Cache: forget every captured/failed/in-progress record so the
    // fresh library is re-captured from scratch.
    tsClear() {
        this.tsPending.clear();
        this.tsInFlight.clear();
        this.tsFailed.clear();
        this.tsCache.clear();
        this.tsPersisting.clear();
    }

    tsScheduleVisible(tsItems) {
        this.tsEnqueue(tsItems, Number(this.tsSettings.visibleLimit || 4));
    }

    tsEnqueue(tsItems, tsMaxCount = Number.POSITIVE_INFINITY) {
        if (this.tsDisposed || !Array.isArray(tsItems) || tsItems.length === 0) {
            return 0;
        }
        let tsQueuedCount = 0;
        for (const tsItem of tsItems) {
            if (!tsItem || tsItem.type !== "3d" || !tsItem.viewer_3d_url) {
                continue;
            }
            const tsCacheKey = tsItem.viewer_3d_url;
            const tsCachedPreviewURL = this.tsCache.get(tsCacheKey);
            if (tsCachedPreviewURL) {
                this.tsDeps.patchThumbnail(tsItem.id, tsCachedPreviewURL, tsItem.filename || "");
                continue;
            }
            if (tsItem.preview_is_3d_capture && !tsItem.preview_is_placeholder) {
                continue;
            }
            if (
                this.tsFailed.has(tsCacheKey)
                || this.tsPending.has(tsCacheKey)
                || this.tsInFlight.has(tsCacheKey)
            ) {
                continue;
            }
            if (tsQueuedCount >= tsMaxCount) {
                break;
            }
            this.tsPending.add(tsCacheKey);
            this.tsQueue.push({
                tsAssetId: tsItem.id,
                tsViewerURL: tsCacheKey,
                tsFilename: tsItem.filename || "",
            });
            tsQueuedCount += 1;
        }
        if (tsQueuedCount > 0) {
            this.tsPump();
        }
        return tsQueuedCount;
    }

    tsPump() {
        const tsConcurrency = Math.max(1, Number(this.tsSettings.concurrency || 1));
        while (!this.tsDisposed && this.tsWorkers < tsConcurrency && this.tsQueue.length > 0) {
            const tsJob = this.tsQueue.shift();
            if (!tsJob?.tsViewerURL) {
                continue;
            }
            if (this.tsCache.has(tsJob.tsViewerURL) || this.tsFailed.has(tsJob.tsViewerURL)) {
                this.tsPending.delete(tsJob.tsViewerURL);
                continue;
            }
            this.tsPending.delete(tsJob.tsViewerURL);
            this.tsInFlight.add(tsJob.tsViewerURL);
            this.tsWorkers += 1;
            void this.tsRunJob(tsJob);
        }
    }

    async tsPersist(tsJob, tsPreviewURL) {
        if (!tsJob?.tsAssetId || !tsPreviewURL || this.tsPersisting.has(tsJob.tsAssetId)) {
            return;
        }
        this.tsPersisting.add(tsJob.tsAssetId);
        try {
            const tsPayload = await this.tsDeps.persistToBackend(tsJob.tsAssetId, tsPreviewURL);
            const tsAssetPatch = tsPayload?.asset;
            if (!tsAssetPatch?.id) {
                return;
            }
            this.tsDeps.applyPersistedAsset(tsAssetPatch);
        } catch (tsError) {
            this.tsDeps.warn("Timesaver Artius Browser 3D thumbnail persist failed", tsError);
        } finally {
            this.tsPersisting.delete(tsJob.tsAssetId);
        }
    }

    async tsRunJob(tsJob) {
        try {
            const tsPreviewURL = await this.tsDeps.capture(tsJob.tsViewerURL, {
                width: this.tsSettings.captureSize,
                height: this.tsSettings.captureSize,
                warmFrames: this.tsSettings.warmFrames,
            });
            if (tsPreviewURL) {
                this.tsCache.set(tsJob.tsViewerURL, tsPreviewURL);
                // Captured thumbnails are data URLs (hundreds of KB each);
                // evict the oldest entries so a large 3D library cannot grow
                // the tab's memory without bound. Evicted entries reload from
                // the persisted backend preview, not via a fresh capture.
                const tsCacheCapacity = Math.max(8, Number(this.tsSettings.cacheCapacity || 64));
                while (this.tsCache.size > tsCacheCapacity) {
                    const tsOldestKey = this.tsCache.keys().next().value;
                    this.tsCache.delete(tsOldestKey);
                }
                if (!this.tsDisposed) {
                    this.tsDeps.patchThumbnail(tsJob.tsAssetId, tsPreviewURL, tsJob.tsFilename);
                }
                void this.tsPersist(tsJob, tsPreviewURL);
            } else {
                this.tsFailed.add(tsJob.tsViewerURL);
            }
        } catch {
            this.tsFailed.add(tsJob.tsViewerURL);
        } finally {
            this.tsInFlight.delete(tsJob.tsViewerURL);
            this.tsWorkers = Math.max(0, this.tsWorkers - 1);
            this.tsPump();
        }
    }
}
