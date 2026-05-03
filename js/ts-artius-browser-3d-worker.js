import { api } from "/scripts/api.js";

import {
    tsConsoleWarn,
    tsFetchJSON,
    tsRouteBase,
    tsSave3DThumbnail,
} from "./ts-artius-browser-api.js";
import { tsCapture3DThumbnail } from "./ts-artius-browser-3d.js";
import {
    tsBrowserRuntimeSettings,
    tsPanelSettings,
} from "./ts-artius-browser-settings.js";

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
                void this.tsScheduleRun("scan-complete");
            }
        }
    }

    async tsScheduleRun(tsReason = "manual") {
        if (this.tsDisposed || this.tsScanRunning) {
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
        if (!tsAsset || tsAsset.type !== "3d" || !tsAsset.viewer_3d_url) {
            return false;
        }
        if (tsAsset.preview_is_3d_capture && !tsAsset.preview_is_placeholder) {
            return false;
        }
        const tsPreviewURL = await tsCapture3DThumbnail(tsAsset.viewer_3d_url, {
            width: tsPanelSettings.threeDThumbnails?.captureSize,
            height: tsPanelSettings.threeDThumbnails?.captureSize,
            warmFrames: tsPanelSettings.threeDThumbnails?.warmFrames,
        });
        if (!tsPreviewURL) {
            return false;
        }
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
            if (this.tsPendingRun && !this.tsDisposed && !this.tsScanRunning) {
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
