// One post-generation rescan per browser, not one per open tab.
//
// The rescan is triggered client-side, from ComfyUI's execution_success event.
// Every tab with the extension loaded hears that event, so two ComfyUI tabs on
// one machine asked the server to walk the output root twice per generation.
// The backend deduplicates identical requests that arrive while a scan is
// already running, but two that do NOT overlap are two full walks — and that is
// exactly the case on a library small enough for the first walk to finish
// quickly.
//
// The tabs agree through localStorage, which is shared per origin and survives
// nothing else being available. There is no cross-process compare-and-swap, so
// the claim is written and then read back: a loser sees somebody else's token
// and stands down. Two tabs can still both win if their writes interleave
// inside the same microsecond, which costs one redundant rescan — the same
// thing that happens today, every time.

// NOT prefixed "tsab:" - that prefix belongs to the ComfyUI event bus and
// the release gate verifies every name carrying it is a real event.
export const TS_RESCAN_CLAIM_STORAGE_KEY = "ts-artius-browser:execution-rescan-claim";

function tsReadClaim(tsStorage, tsKey) {
    try {
        return tsStorage.getItem(tsKey);
    } catch {
        return null;
    }
}

export function tsClaimExecutionRescan(tsOptions = {}) {
    const tsWindowMs = Math.max(0, Number(tsOptions.tsWindowMs) || 0);
    const tsNow = typeof tsOptions.tsNow === "function" ? tsOptions.tsNow : () => Date.now();
    const tsRandom = typeof tsOptions.tsRandom === "function" ? tsOptions.tsRandom : Math.random;
    const tsKey = tsOptions.tsKey || TS_RESCAN_CLAIM_STORAGE_KEY;
    let tsStorage = tsOptions.tsStorage;
    if (tsStorage === undefined) {
        try {
            tsStorage = window.localStorage;
        } catch {
            // Private mode, a sandboxed frame, storage disabled by policy.
            tsStorage = null;
        }
    }
    if (!tsStorage) {
        // No shared surface to agree on: behave exactly as before this existed
        // rather than silently dropping the rescan.
        return true;
    }

    const tsCurrentTime = tsNow();
    const tsExisting = tsReadClaim(tsStorage, tsKey);
    if (tsExisting) {
        const tsExistingTime = Number(String(tsExisting).split(":")[0]) || 0;
        // A live claim from another tab. A claim older than the window is
        // treated as abandoned, so a tab that was closed mid-generation cannot
        // suppress every future rescan.
        if (tsExistingTime > 0 && tsCurrentTime - tsExistingTime < tsWindowMs) {
            return false;
        }
    }

    const tsToken = `${tsCurrentTime}:${tsRandom()}`;
    try {
        tsStorage.setItem(tsKey, tsToken);
    } catch {
        // Quota or a storage failure mid-write: fall back to the old behaviour.
        return true;
    }
    // Read back: whoever wrote last owns the claim, and every other tab sees a
    // token that is not its own.
    return tsReadClaim(tsStorage, tsKey) === tsToken;
}
