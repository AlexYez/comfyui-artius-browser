import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

import {
    tsConsoleWarn,
    tsEnsureCanvasDropBridge,
    tsEnsureSidebarIconStyle,
    tsFetchBrowserSettings,
    tsFetchJSON,
    tsGetRecentErrors,
    tsLoadLocale,
    tsPostJSON,
    tsResolveComfyLocale,
} from "./ts-artius-browser-api.js";
import {
    tsApiSettings,
    tsBrowserRuntimeSettings,
    tsProjectSettings,
} from "./ts-artius-browser-settings.js";
import { tsResolveLocaleCode } from "./ts-artius-browser-panel-state.js";
import { tsEnsurePanelElement, tsGetPanelSingleton } from "./ts-artius-browser-panel.js";
import { tsStartGlobal3DThumbnailWorker } from "./ts-artius-browser-3d-worker.js";
import { tsClaimExecutionRescan } from "./ts-artius-browser-rescan-claim.js";

let tsExecutionRescanTimer = 0;
let tsExecutionRescanFirstEventAt = 0;
let tsAutoscanEnabled = true;
// Authoritative "is ComfyUI busy?" signal sourced from the WebSocket
// `status` event's exec_info.queue_remaining counter. Falls back to 0 if
// ComfyUI never emits a status update (older builds, broken socket),
// which makes the gate degrade to the plain debounce path instead of
// hanging forever.
let tsComfyQueueRemaining = 0;

// tsExecutionRescanTimer doubles as the "a rescan is pending" flag in
// tsHandleStatusEvent, and clearTimeout() does not reset the caller's variable.
// These two helpers keep the handle and the flag in sync; without them the id
// stayed truthy for the rest of the page session after the first prompt, so
// every later queue-only status event (clear/cancel/socket reconnect) fired an
// immediate unconditional /rescan, bypassing the debounce entirely.
function tsClearExecutionRescanTimer() {
    window.clearTimeout(tsExecutionRescanTimer);
    tsExecutionRescanTimer = 0;
}

function tsArmExecutionRescanTimer(tsDelayMs) {
    tsClearExecutionRescanTimer();
    tsExecutionRescanTimer = window.setTimeout(() => {
        tsExecutionRescanTimer = 0;
        tsAttemptRescanNow();
    }, tsDelayMs);
}

function tsSetAutoscanEnabled(tsEnabled) {
    tsAutoscanEnabled = Boolean(tsEnabled);
    if (!tsAutoscanEnabled) {
        tsClearExecutionRescanTimer();
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
        tsArmExecutionRescanTimer(tsRetryMs);
        return;
    }
    tsExecutionRescanFirstEventAt = 0;
    // One rescan per browser, not one per tab. Two ComfyUI tabs on the same
    // machine used to ask the server for two full walks of the output root
    // after every generation.
    if (!tsClaimExecutionRescan({ tsWindowMs: tsBrowserRuntimeSettings.executionRescanClaimWindowMs })) {
        return;
    }
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
    tsArmExecutionRescanTimer(tsDelay);
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
            tsArmExecutionRescanTimer(0);
        }
    }
}

function tsHandleExecutionEnd() {
    tsDebouncedExecutionRescan();
}

// Sidebar tab strings are handed to ComfyUI once at registration, so a language
// change has to push new ones into the registered tab object.
let tsActiveLocaleCode = "";
let tsLocaleWatchTimer = 0;
let tsSidebarLocale = {};

function tsT(tsKey, tsFallback) {
    return tsSidebarLocale?.[tsKey] || tsFallback;
}

function tsBuildSidebarStrings(tsLocale) {
    tsSidebarLocale = tsLocale && typeof tsLocale === "object" ? tsLocale : {};
    return {
        title: tsT("panel.title", tsProjectSettings.title),
        label: tsT("sidebar.label", tsProjectSettings.label),
        tooltip: tsT("sidebar.tooltip", tsProjectSettings.tooltip),
    };
}

function tsUpdateRegisteredSidebarTab(tsStrings) {
    // Mutating the object returned by getSidebarTabs goes through ComfyUI's
    // reactive store, so the toolbar re-renders. Re-registering instead would
    // close the sidebar when our tab is the active one.
    try {
        const tsTabs = app?.extensionManager?.getSidebarTabs?.();
        const tsTab = Array.isArray(tsTabs)
            ? tsTabs.find((tsCandidate) => tsCandidate?.id === tsProjectSettings.sidebarId)
            : null;
        if (!tsTab) {
            return false;
        }
        Object.assign(tsTab, tsStrings);
        return true;
    } catch (tsError) {
        tsConsoleWarn("Timesaver Artius Browser sidebar tab locale update failed", tsError);
        return false;
    }
}

async function tsSyncLocale(tsForceApply = false) {
    const tsCode = tsResolveLocaleCode("", tsResolveComfyLocale());
    if (!tsForceApply && tsCode === tsActiveLocaleCode) {
        return null;
    }
    tsActiveLocaleCode = tsCode;
    const tsLocale = await tsLoadLocale(tsCode).catch((tsError) => {
        tsConsoleWarn("Timesaver Artius Browser locale load failed", tsError);
        return null;
    });
    if (!tsLocale) {
        return null;
    }
    const tsStrings = tsBuildSidebarStrings(tsLocale);
    if (!tsForceApply) {
        tsUpdateRegisteredSidebarTab(tsStrings);
        // The panel keeps its own copy of the locale table.
        window.dispatchEvent(new CustomEvent("tsab:locale-changed", { detail: { code: tsCode, locale: tsLocale } }));
    }
    return tsStrings;
}

function tsStartComfyLocaleWatch() {
    // ComfyUI switches language live (it refreshes node definitions and reloads
    // the workflow) but publishes no event for it, so the setting is polled at
    // a low frequency. Each tick is one in-memory settings-store read and the
    // locale JSON is cached, so a no-change tick costs nothing.
    window.clearInterval(tsLocaleWatchTimer);
    tsLocaleWatchTimer = window.setInterval(() => {
        void tsSyncLocale();
    }, 2000);
}

app.registerExtension({
    name: tsProjectSettings.extensionId,
    async setup() {
        tsEnsureSidebarIconStyle();
        tsEnsurePanelElement();
        tsEnsureCanvasDropBridge();
        tsStartGlobal3DThumbnailWorker();
        // Console-accessible bug-report helper: dumps the bounded ring of the
        // most recent non-fatal warnings even when the debug console is off.
        window.tsArtiusBrowser = Object.assign(window.tsArtiusBrowser || {}, {
            getRecentErrors: tsGetRecentErrors,
            // Embed API (added 2026-08-02 by the AI agent working on
            // comfyui-timesaver's TS Image Studio — see CHANGELOG). Mounts the
            // SINGLETON panel into a host element (e.g. the studio's Library
            // tab) and returns it to its previous parent on unmount. The
            // singleton is shared with the sidebar tab, so one mount is live
            // at a time; a fullscreen studio and the sidebar are never
            // usefully visible together, which makes the move safe.
            mountPanel(tsHost, _tsOptions = {}) {
                const tsPanel = tsGetPanelSingleton();
                const tsPrevParent = tsPanel.parentElement;
                const tsPrevSibling = tsPanel.nextSibling;
                tsHost.appendChild(tsPanel);
                return {
                    unmount() {
                        try {
                            if (tsPrevParent) {
                                tsPrevParent.insertBefore(tsPanel, tsPrevSibling);
                            } else {
                                tsPanel.remove();
                            }
                        } catch (tsError) {
                            tsConsoleWarn("Timesaver Artius Browser mountPanel unmount failed", tsError);
                        }
                    },
                };
            },
        });
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

        // Resolve the label/tooltip from ComfyUI's current locale BEFORE the tab
        // is registered, so a Russian ComfyUI shows a Russian sidebar entry on
        // first paint rather than flashing English.
        const tsSidebarStrings = (await tsSyncLocale(true)) || tsBuildSidebarStrings({});

        const tsSidebarDefinition = {
            id: tsProjectSettings.sidebarId,
            title: tsSidebarStrings.title,
            label: tsSidebarStrings.label,
            tooltip: tsSidebarStrings.tooltip,
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
            tsStartComfyLocaleWatch();
        } else {
            tsConsoleWarn("Timesaver Artius Browser sidebar tab registration is unavailable in this ComfyUI build");
        }

        if (tsAutoscanEnabled) {
            window.setTimeout(async () => {
                if (!tsAutoscanEnabled) {
                    return;
                }
                try {
                    // The backend schedules its own startup autoscan; an
                    // unconditional POST /rescan here used to queue a second
                    // full walk right behind it. Ask for the scan status
                    // first (this request also lets the backend auto-start
                    // the initial scan if it has not run yet) and only
                    // rescan when nothing is running, nothing is about to
                    // start, and no scan finished moments ago. A page reload
                    // of a long-lived server (last scan far in the past)
                    // still refreshes the output root as before. The
                    // freshness window compares a server epoch against the
                    // client clock — same machine in practice, and the worst
                    // case of skew is one redundant (or one skipped) rescan.
                    const tsPayload = await tsFetchJSON(`${tsApiSettings.routeBase}/assets?limit=1`);
                    const tsStatus = tsPayload?.scan_status || {};
                    const tsCompletedAt = Number(tsStatus.completed_at || 0);
                    const tsFreshWindowMs = Number(tsBrowserRuntimeSettings.initialRescanFreshWindowMs) || 0;
                    const tsRecentlyCompleted = tsCompletedAt > 0 && (Date.now() - (tsCompletedAt * 1000)) < tsFreshWindowMs;
                    const tsStartingUp = Boolean(tsStatus.started_at) && !tsCompletedAt;
                    if (tsStatus.running || tsStartingUp || tsRecentlyCompleted) {
                        return;
                    }
                } catch (tsError) {
                    tsConsoleWarn("Timesaver Artius Browser initial scan status check failed", tsError);
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
