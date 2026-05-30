import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

import {
    tsConsoleWarn,
    tsEnsureCanvasDropBridge,
    tsEnsureSidebarIconStyle,
    tsFetchBrowserSettings,
    tsPostJSON,
} from "./ts-artius-browser-api.js";
import {
    tsApiSettings,
    tsBrowserRuntimeSettings,
    tsProjectSettings,
} from "./ts-artius-browser-settings.js";
import { tsEnsurePanelElement, tsGetPanelSingleton } from "./ts-artius-browser-panel.js";
import { tsStartGlobal3DThumbnailWorker } from "./ts-artius-browser-3d-worker.js";

let tsExecutionRescanTimer = 0;
let tsExecutionRescanFirstEventAt = 0;
let tsAutoscanEnabled = true;
// Authoritative "is ComfyUI busy?" signal sourced from the WebSocket
// `status` event's exec_info.queue_remaining counter. Falls back to 0 if
// ComfyUI never emits a status update (older builds, broken socket),
// which makes the gate degrade to the plain debounce path instead of
// hanging forever.
let tsComfyQueueRemaining = 0;

function tsSetAutoscanEnabled(tsEnabled) {
    tsAutoscanEnabled = Boolean(tsEnabled);
    if (!tsAutoscanEnabled) {
        window.clearTimeout(tsExecutionRescanTimer);
        tsExecutionRescanFirstEventAt = 0;
    }
}

function tsAttemptRescanNow() {
    if (!tsAutoscanEnabled) {
        tsExecutionRescanFirstEventAt = 0;
        return;
    }
    if (tsComfyQueueRemaining > 0) {
        // Queue still has prompts. Re-arm a short retry instead of
        // POSTing /rescan — the backend scan would contend with whatever
        // ComfyUI is currently sampling. The next status event with
        // queue_remaining=0 unblocks this branch.
        const tsRetryMs = Number(tsBrowserRuntimeSettings.executionRescanIdleRetryMs) || 250;
        window.clearTimeout(tsExecutionRescanTimer);
        tsExecutionRescanTimer = window.setTimeout(tsAttemptRescanNow, tsRetryMs);
        return;
    }
    tsExecutionRescanFirstEventAt = 0;
    tsPostJSON(`${tsApiSettings.routeBase}/rescan`, { root_id: tsBrowserRuntimeSettings.executionRescanRootId }).catch((tsError) => {
        tsConsoleWarn("Timesaver Artius Browser execution rescan failed", tsError);
    });
}

function tsDebouncedExecutionRescan() {
    if (!tsAutoscanEnabled) {
        return;
    }
    const tsNow = Date.now();
    if (!tsExecutionRescanFirstEventAt) {
        tsExecutionRescanFirstEventAt = tsNow;
    }
    const tsElapsed = tsNow - tsExecutionRescanFirstEventAt;
    const tsBaseDelay = Number(tsBrowserRuntimeSettings.executionRescanDelayMs) || 0;
    const tsMaxDeferral = Number(tsBrowserRuntimeSettings.executionRescanMaxDeferralMs) || tsBaseDelay;
    const tsDelay = Math.max(0, Math.min(tsBaseDelay, tsMaxDeferral - tsElapsed));
    window.clearTimeout(tsExecutionRescanTimer);
    tsExecutionRescanTimer = window.setTimeout(tsAttemptRescanNow, tsDelay);
}

function tsHandleStatusEvent(tsEvent) {
    // ComfyUI emits: { detail: { status: { exec_info: { queue_remaining: N } } } }
    // — sometimes wrapped one level (older builds), sometimes flat.
    // Walk both shapes and keep the most recent non-NaN reading.
    const tsDetail = tsEvent?.detail || {};
    const tsStatus = tsDetail.status || tsDetail;
    const tsExecInfo = tsStatus?.exec_info || {};
    const tsRaw = Number(tsExecInfo.queue_remaining);
    if (Number.isFinite(tsRaw)) {
        tsComfyQueueRemaining = Math.max(0, tsRaw);
        // If the queue just drained and we were retrying, fire the next
        // tick immediately so users see new assets right after the queue
        // settles instead of waiting another debounce cycle.
        if (tsComfyQueueRemaining === 0 && tsExecutionRescanTimer) {
            window.clearTimeout(tsExecutionRescanTimer);
            tsExecutionRescanTimer = window.setTimeout(tsAttemptRescanNow, 0);
        }
    }
}

function tsHandleExecutionEnd() {
    tsDebouncedExecutionRescan();
}

app.registerExtension({
    name: tsProjectSettings.extensionId,
    async setup() {
        tsEnsureSidebarIconStyle();
        tsEnsurePanelElement();
        tsEnsureCanvasDropBridge();
        tsStartGlobal3DThumbnailWorker();
        try {
            const tsSettingsPayload = await tsFetchBrowserSettings();
            tsSetAutoscanEnabled(tsSettingsPayload?.ui?.autoscan !== false);
        } catch (tsError) {
            tsConsoleWarn("Timesaver Artius Browser autoscan settings fetch failed", tsError);
            tsSetAutoscanEnabled(true);
        }
        window.addEventListener("tsab:autoscan-changed", (tsEvent) => {
            tsSetAutoscanEnabled(tsEvent?.detail?.autoscan !== false);
        });

        const tsSidebarDefinition = {
            id: tsProjectSettings.sidebarId,
            title: tsProjectSettings.title,
            label: tsProjectSettings.label,
            tooltip: tsProjectSettings.tooltip,
            icon: tsProjectSettings.sidebarIcon,
            type: "custom",
            render: (tsMountPoint) => {
                tsMountPoint.style.display = "flex";
                tsMountPoint.style.flex = "1 1 auto";
                tsMountPoint.style.height = "100%";
                tsMountPoint.style.minHeight = "0";
                const tsPanel = tsGetPanelSingleton();
                tsPanel.style.display = "flex";
                tsPanel.style.flex = "1 1 auto";
                tsPanel.style.height = "100%";
                tsPanel.style.minHeight = "0";
                tsMountPoint.replaceChildren(tsPanel);
                tsPanel.tsAttachMountPoint?.(tsMountPoint);
                tsPanel.tsHandleSidebarShown?.();
            },
        };

        if (app?.extensionManager?.registerSidebarTab) {
            app.extensionManager.registerSidebarTab(tsSidebarDefinition);
        } else {
            tsConsoleWarn("Timesaver Artius Browser sidebar tab registration is unavailable in this ComfyUI build");
        }

        if (tsAutoscanEnabled) {
            window.setTimeout(() => {
                if (!tsAutoscanEnabled) {
                    return;
                }
                tsPostJSON(`${tsApiSettings.routeBase}/rescan`, { root_id: tsBrowserRuntimeSettings.executionRescanRootId }).catch((tsError) => {
                    tsConsoleWarn("Timesaver Artius Browser initial rescan failed", tsError);
                });
            }, tsBrowserRuntimeSettings.initialRescanDelayMs);
        }

        api.addEventListener("status", (tsEvent) => tsHandleStatusEvent(tsEvent));
        api.addEventListener("execution_success", () => tsHandleExecutionEnd());
        api.addEventListener("execution_error", () => tsHandleExecutionEnd());
        api.addEventListener("execution_interrupted", () => tsHandleExecutionEnd());
    },
});
