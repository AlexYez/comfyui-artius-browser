import { api } from "/scripts/api.js";

import {
    tsConsoleWarn,
    tsFetchJSON,
    tsRouteBase,
    tsSave3DThumbnail,
} from "./ts-artius-browser-api.js";
import { tsCapture3DThumbnail } from "./ts-artius-browser-3d.js";
import {
    tsAcquire3DCapture,
    tsNeeds3DCapture,
    tsRelease3DCapture,
} from "./ts-artius-browser-3d-capture-registry.js";
import {
    tsBrowserRuntimeSettings,
    tsPanelSettings,
} from "./ts-artius-browser-settings.js";

// Total capture attempts per model per page load. Attempt 1 is the normal
// capture; one retry covers transient failures (slow disk, first-load races).
// Anything still failing after that is skipped until the page reloads.
const TS_MAX_3D_CAPTURE_ATTEMPTS = 2;

class TSGlobal3DThumbnailWorker {
    constructor() {
        this.tsStarted = false;
        this.tsDisposed = false;
        this.tsRunning = false;
        this.tsPendingRun = false;
        this.tsRunToken = 0;
        this.tsScanRunning = false;
        this.tsLastWarmupKey = "";
        this.tsStartupTimer = 0;
        // 3D viewer captures (3d.js) each spin up a WebGL/Three.js context
        // and load the full model file. A model that can't be captured
        // (corrupt, unsupported, viewer returns nothing) must not be
        // re-attempted on every sweep — that recreates WebGL contexts and
        // re-parses multi-MB models without bound and can crash the
        // renderer. Failures get a small fixed number of attempts per page
        // load; clearing them on every scan-complete is NOT safe, because
        // the post-generation autoscan completes after every prompt and
        // would retry permanently-uncapturable models all session long.
        this.tsFailedViewerAttempts = new Map();
        this.tsBoundScanEvent = (tsEvent) => this.tsHandleScanEvent(tsEvent);
        this.tsBoundVisibilityChange = () => {
            if (!document.hidden) {
                void this.tsScheduleRun("visibility");
            }
        };
        this.tsBoundWindowFocus = () => {
            void this.tsScheduleRun("focus");
        };
    }

    tsStart() {
        if (this.tsStarted || this.tsDisposed) {
            return;
        }
        this.tsStarted = true;
        api.addEventListener("tsab:index-start", this.tsBoundScanEvent);
        api.addEventListener("tsab:index-progress", this.tsBoundScanEvent);
        api.addEventListener("tsab:index-complete", this.tsBoundScanEvent);
        document.addEventListener("visibilitychange", this.tsBoundVisibilityChange);
        window.addEventListener("focus", this.tsBoundWindowFocus);
        const tsInitialDelay = Math.max(
            1200,
            Number(tsBrowserRuntimeSettings.initialRescanDelayMs || 0) + 1500,
        );
        this.tsStartupTimer = window.setTimeout(() => {
            void this.tsScheduleRun("startup");
        }, tsInitialDelay);
    }

    tsDispose() {
        if (this.tsDisposed && !this.tsStarted) {
            return;
        }
        this.tsDisposed = true;
        this.tsRunToken += 1;
        window.clearTimeout(this.tsStartupTimer);
        if (this.tsStarted) {
            api.removeEventListener?.("tsab:index-start", this.tsBoundScanEvent);
            api.removeEventListener?.("tsab:index-progress", this.tsBoundScanEvent);
            api.removeEventListener?.("tsab:index-complete", this.tsBoundScanEvent);
            document.removeEventListener("visibilitychange", this.tsBoundVisibilityChange);
            window.removeEventListener("focus", this.tsBoundWindowFocus);
            this.tsStarted = false;
        }
    }

    tsHandleScanEvent(tsEvent) {
        const tsDetail = tsEvent?.detail || {};
        const tsStatus = tsDetail.status || {};
        this.tsScanRunning = Boolean(tsStatus.running);
        if (this.tsScanRunning) {
            return;
        }
        const tsCompletedAt = Number(tsStatus.completed_at || 0);
        if (tsCompletedAt > 0) {
            const tsWarmupKey = `scan:${tsCompletedAt}`;
            if (tsWarmupKey !== this.tsLastWarmupKey) {
                this.tsLastWarmupKey = tsWarmupKey;
                // Deliberately keep tsFailedViewerAttempts: scans complete
                // after every generation, so wholesale retries here would
                // re-load uncapturable models on every prompt (see the
                // constructor comment). The attempt cap already grants a
                // bounded number of retries per page load.
                void this.tsScheduleRun("scan-complete");
            }
        }
    }

    async tsScheduleRun(tsReason = "manual") {
        if (this.tsDisposed || this.tsScanRunning) {
            return false;
        }
        // Never start a sweep in a hidden tab: requestAnimationFrame is
        // suspended there, so a capture would park a fully loaded model in
        // memory until the tab is shown again. The visibilitychange handler
        // schedules a fresh run when the tab becomes visible.
        if (document.hidden) {
            return false;
        }
        if (this.tsRunning) {
            this.tsPendingRun = true;
            return false;
        }
        return this.tsRun(tsReason);
    }

    tsBuildSearchPath(tsCursor = null) {
        const tsParams = new URLSearchParams();
        tsParams.set("limit", String(Math.max(1, Number(tsPanelSettings.threeDThumbnails?.backgroundPageSize || 8))));
        tsParams.set("view", "flat");
        tsParams.set("sort", "created_at");
        tsParams.set("order", "desc");
        tsParams.set("types", "3d");
        if (tsCursor && tsCursor.sort_value !== undefined && tsCursor.sort_value !== null && tsCursor.id) {
            tsParams.set("after_sort", String(tsCursor.sort_value));
            tsParams.set("after_id", String(tsCursor.id));
        }
        return `${tsRouteBase}/search?${tsParams.toString()}`;
    }

    async tsProcessAsset(tsAsset) {
        if (!tsNeeds3DCapture(tsAsset)) {
            return false;
        }
        // Skip before creating any WebGL viewer: a model that already used
        // up its capture attempts is not retried until the next page load.
        const tsFailedAttempts = this.tsFailedViewerAttempts.get(tsAsset.viewer_3d_url) || 0;
        if (tsFailedAttempts >= TS_MAX_3D_CAPTURE_ATTEMPTS) {
            return false;
        }
        // The panel's visible-card queue may already be capturing this exact
        // model. Two captures of one model means two WebGL contexts, two full
        // model loads and two competing writes to the same asset row.
        if (!tsAcquire3DCapture(tsAsset.viewer_3d_url)) {
            return false;
        }
        let tsPreviewURL = "";
        try {
            tsPreviewURL = await tsCapture3DThumbnail(tsAsset.viewer_3d_url, {
                width: tsPanelSettings.threeDThumbnails?.captureSize,
                height: tsPanelSettings.threeDThumbnails?.captureSize,
                warmFrames: tsPanelSettings.threeDThumbnails?.warmFrames,
            });
        } catch (tsError) {
            this.tsFailedViewerAttempts.set(tsAsset.viewer_3d_url, tsFailedAttempts + 1);
            throw tsError;
        } finally {
            tsRelease3DCapture(tsAsset.viewer_3d_url);
        }
        if (!tsPreviewURL) {
            this.tsFailedViewerAttempts.set(tsAsset.viewer_3d_url, tsFailedAttempts + 1);
            return false;
        }
        this.tsFailedViewerAttempts.delete(tsAsset.viewer_3d_url);
        await tsSave3DThumbnail(tsAsset.id, tsPreviewURL);
        return true;
    }

    async tsRun(tsReason = "manual") {
        if (this.tsDisposed) {
            return false;
        }
        this.tsRunning = true;
        const tsRunToken = ++this.tsRunToken;
        try {
            let tsCursor = null;
            while (!this.tsDisposed && tsRunToken === this.tsRunToken) {
                const tsPayload = await tsFetchJSON(this.tsBuildSearchPath(tsCursor));
                const tsStatus = tsPayload?.scan_status || {};
                this.tsScanRunning = Boolean(tsStatus.running);
                if (this.tsScanRunning) {
                    return false;
                }
                const tsItems = Array.isArray(tsPayload?.items) ? tsPayload.items : [];
                if (tsItems.length === 0) {
                    break;
                }
                for (const tsAsset of tsItems) {
                    if (this.tsDisposed || tsRunToken !== this.tsRunToken) {
                        return false;
                    }
                    // Stop the sweep when the tab goes hidden mid-run: rAF is
                    // suspended, so the next capture would just park a loaded
                    // model in memory. The visibilitychange handler restarts
                    // the sweep (skipping captured/failed models) on return.
                    if (document.hidden) {
                        return false;
                    }
                    try {
                        await this.tsProcessAsset(tsAsset);
                    } catch (tsError) {
                        tsConsoleWarn("Timesaver Artius Browser global 3D thumbnail capture failed", tsError);
                    }
                }
                if (!tsPayload?.has_more || !tsPayload?.next_cursor) {
                    break;
                }
                tsCursor = tsPayload.next_cursor;
            }
            return true;
        } catch (tsError) {
            tsConsoleWarn(`Timesaver Artius Browser global 3D worker run failed (${tsReason})`, tsError);
            return false;
        } finally {
            this.tsRunning = false;
            if (this.tsPendingRun && !this.tsDisposed && !this.tsScanRunning && !document.hidden) {
                this.tsPendingRun = false;
                void this.tsRun("pending");
            }
        }
    }
}

let tsGlobal3DThumbnailWorkerSingleton = null;

export function tsStartGlobal3DThumbnailWorker() {
    if (!tsGlobal3DThumbnailWorkerSingleton) {
        tsGlobal3DThumbnailWorkerSingleton = new TSGlobal3DThumbnailWorker();
    }
    tsGlobal3DThumbnailWorkerSingleton.tsStart();
    return tsGlobal3DThumbnailWorkerSingleton;
}
