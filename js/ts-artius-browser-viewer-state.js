export const TS_COMPARE_MIN_ITEMS = 2;
export const TS_COMPARE_MAX_ITEMS = 4;

export function tsIsViewerTypedCompareMode(tsAsset, tsCompareItems, tsType) {
    return Boolean(
        tsAsset?.type === tsType
        && Array.isArray(tsCompareItems)
        && tsCompareItems.length >= TS_COMPARE_MIN_ITEMS
        && tsCompareItems.length <= TS_COMPARE_MAX_ITEMS,
    );
}

// --- Synchronised video compare -------------------------------------------
//
// One clip is the master clock; the others follow it. The drift band below is
// the whole trick. Seeking a PLAYING video flushes its decoder, which shows up
// as a visible hitch — so a seek is the last resort, not the routine
// correction. Inside the band the follower is nudged with playbackRate, which
// is imperceptible, and only drift a viewer could actually notice is worth a
// seek.
export const TS_COMPARE_SYNC_TOLERANCE_SECONDS = 0.02;
export const TS_COMPARE_SYNC_HARD_SECONDS = 0.35;
export const TS_COMPARE_SYNC_MAX_RATE_TRIM = 0.25;

export function tsResolveCompareSyncCorrection(tsDriftSeconds, tsMasterRate = 1) {
    const tsRate = Number.isFinite(tsMasterRate) && tsMasterRate > 0 ? tsMasterRate : 1;
    const tsDrift = Number.isFinite(tsDriftSeconds) ? tsDriftSeconds : 0;
    const tsDistance = Math.abs(tsDrift);
    if (tsDistance >= TS_COMPARE_SYNC_HARD_SECONDS) {
        return { tsAction: "seek", tsPlaybackRate: tsRate };
    }
    if (tsDistance <= TS_COMPARE_SYNC_TOLERANCE_SECONDS) {
        return { tsAction: "hold", tsPlaybackRate: tsRate };
    }
    // Positive drift means the follower runs AHEAD of the master, so it has to
    // slow down; negative means it lags and speeds up.
    const tsTrim = (tsDrift / TS_COMPARE_SYNC_HARD_SECONDS) * TS_COMPARE_SYNC_MAX_RATE_TRIM;
    return {
        tsAction: "rate",
        tsPlaybackRate: Math.max(0.0625, tsRate * (1 - tsTrim)),
    };
}

export function tsResolveVideoFrameIndex(tsCurrentTime, tsFPS) {
    const tsSafeFPS = Number.isFinite(tsFPS) && tsFPS > 0 ? tsFPS : 30;
    const tsSafeTime = Math.max(0, Number(tsCurrentTime) || 0);
    // Frame N covers [N/fps, (N+1)/fps), so the index floors. The epsilon
    // absorbs the float error of a currentTime that came back from the decoder
    // a hair under the boundary it was seeked to.
    return Math.max(0, Math.floor(tsSafeTime * tsSafeFPS + 1e-6));
}

export function tsResolveVideoFrameTime(tsCurrentTime, tsFPS, tsDirection, tsDuration = 0) {
    const tsSafeFPS = Number.isFinite(tsFPS) && tsFPS > 0 ? tsFPS : 30;
    const tsStep = tsDirection >= 0 ? 1 : -1;
    const tsTargetIndex = Math.max(0, tsResolveVideoFrameIndex(tsCurrentTime, tsSafeFPS) + tsStep);
    // Land in the MIDDLE of the target frame. Adding ±1/fps to the raw
    // currentTime accumulates float error and can resolve back to the frame it
    // started on, which is why a step sometimes appeared to do nothing.
    const tsTargetTime = (tsTargetIndex + 0.5) / tsSafeFPS;
    const tsSafeDuration = Number.isFinite(tsDuration) && tsDuration > 0 ? tsDuration : 0;
    if (tsSafeDuration > 0) {
        return Math.max(0, Math.min(tsTargetTime, tsSafeDuration - (0.5 / tsSafeFPS)));
    }
    return tsTargetTime;
}

// The last frame of a clip as a seek target: the middle of its final frame.
// Seeking to `duration` itself lands past the last frame, where some decoders
// show nothing and every one reports "ended".
export function tsResolveLastFrameTime(tsDuration, tsFPS) {
    const tsSafeFPS = Number.isFinite(tsFPS) && tsFPS > 0 ? tsFPS : 30;
    const tsSafeDuration = Number.isFinite(tsDuration) && tsDuration > 0 ? tsDuration : 0;
    return tsSafeDuration > 0 ? Math.max(0, tsSafeDuration - 0.5 / tsSafeFPS) : 0;
}

// Within one frame of the end counts as "on the last frame": a step to the
// last frame lands half a frame before the end, never exactly on it.
export function tsIsOnLastFrame(tsCurrentTime, tsDuration, tsFPS) {
    const tsSafeFPS = Number.isFinite(tsFPS) && tsFPS > 0 ? tsFPS : 30;
    const tsSafeDuration = Number.isFinite(tsDuration) && tsDuration > 0 ? tsDuration : 0;
    return tsSafeDuration > 0 && (Number(tsCurrentTime) || 0) >= tsSafeDuration - 1 / tsSafeFPS;
}

// Where a clip opens when the one before it was left paused: the same moment,
// clamped to its own length, or its own last frame when the previous clip was
// parked on its end - so flipping through finished clips compares their last
// frames, whatever their lengths.
export function tsResolveCarriedVideoTime(tsCarry, tsDuration, tsFPS) {
    const tsLastFrameTime = tsResolveLastFrameTime(tsDuration, tsFPS);
    if (!tsCarry) {
        return 0;
    }
    if (tsCarry.tsAtEnd) {
        return tsLastFrameTime;
    }
    return Math.max(0, Math.min(tsLastFrameTime, Number(tsCarry.tsTime) || 0));
}

// One zoom factor for a wheel event, whatever produced it. A mouse wheel
// sends one ~100px notch per click and should keep the familiar fixed step; a
// trackpad sends dozens of tiny deltas per gesture, and a fixed step per event
// made it race through the whole range. Scaling by the distance makes both
// feel right. deltaMode 1 = lines, 2 = pages.
export function tsResolveWheelZoomFactor(tsDeltaY, tsDeltaMode, tsStepIn) {
    const tsPixels = Number(tsDeltaY || 0) * (tsDeltaMode === 1 ? 33 : (tsDeltaMode === 2 ? 400 : 1));
    if (!Number.isFinite(tsPixels) || tsPixels === 0) {
        return 1;
    }
    const tsNotch = 100;
    const tsStepLog = Math.log(Math.max(1.0001, Number(tsStepIn) || 1.14));
    // Clamped to one notch per event, so a flung wheel cannot jump the range.
    const tsNotches = Math.max(-1, Math.min(1, -tsPixels / tsNotch));
    return Math.exp(tsNotches * tsStepLog);
}

export function tsSyncViewerItemsFromSource(tsOptions = {}) {
    if (typeof tsOptions.getItems !== "function") {
        return {
            tsDidSync: false,
            tsItems: tsOptions.items,
            tsIndex: tsOptions.index,
        };
    }
    const tsSourceItems = tsOptions.getItems();
    if (!Array.isArray(tsSourceItems) || tsSourceItems.length === 0) {
        return {
            tsDidSync: false,
            tsItems: tsOptions.items,
            tsIndex: tsOptions.index,
        };
    }
    // The panel's list never carries an asset's detail (prompt, technical
    // info): the lightbox fetches that itself. Syncing used to replace those
    // merged objects with the bare cards on every forward step, so each visit
    // fetched the detail again and re-rendered the stage when it came back.
    // A viewer copy is kept while it still describes the same file.
    const tsLoadedById = new Map(
        (Array.isArray(tsOptions.items) ? tsOptions.items : [])
            .filter((tsItem) => tsItem?.detail_loaded)
            .map((tsItem) => [tsItem.id, tsItem]),
    );
    const tsItems = tsSourceItems.map((tsItem) => {
        const tsLoaded = tsLoadedById.get(tsItem?.id);
        if (!tsLoaded || tsItem?.detail_loaded || tsLoaded.file_url !== tsItem.file_url) {
            return tsItem;
        }
        return { ...tsLoaded, ...tsItem, detail_loaded: true };
    });
    const tsCurrentAssetId = tsOptions.preferredAssetId ?? tsOptions.items?.[tsOptions.index]?.id ?? null;
    if (tsCurrentAssetId !== null) {
        const tsMatchedIndex = tsItems.findIndex((tsItem) => tsItem.id === tsCurrentAssetId);
        if (tsMatchedIndex >= 0) {
            return {
                tsDidSync: true,
                tsItems,
                tsIndex: tsMatchedIndex,
            };
        }
    }
    return {
        tsDidSync: true,
        tsItems,
        tsIndex: Math.max(0, Math.min(tsOptions.index, tsItems.length - 1)),
    };
}
