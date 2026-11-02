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
import {
    TS_MAX_TRACKED_EXECUTION_FILES,
    tsExtractExecutedOutputPaths,
} from "./ts-artius-browser-execution-outputs.js";

let tsExecutionRescanTimer = 0;
let tsExecutionRescanFirstEventAt = 0;
let tsExecutionRescanPromptId = "";
let tsExecutionIndexInFlight = false;
let tsExecutionFullScanPending = false;
let tsAutoscanEnabled = true;
// Only a full directory scan waits for an idle queue. Named files from a
// completed prompt can be indexed while the next prompt is generating.
let tsComfyQueueRemaining = 0;
// What the running prompt has written so far, so the post-generation index can
// name those files instead of asking the server to walk the whole output root.
// Both the running prompt and completed backlog are bounded. Known files are
// indexed immediately; an overflow requests one full scan after the queue ends.
const tsPendingExecutionFiles = new Set();
let tsExecutionOutputsOverflowed = false;
const tsReadyExecutionFiles = new Set();

function tsQueueReadyExecutionFiles(tsFiles) {
    for (const tsPath of tsFiles) {
        if (tsReadyExecutionFiles.size >= TS_MAX_TRACKED_EXECUTION_FILES) {
            tsExecutionFullScanPending = true;
            return;
        }
        tsReadyExecutionFiles.add(tsPath);
    }
}

function tsTrackExecutedOutputs(tsOutput) {
    for (const tsPath of tsExtractExecutedOutputPaths(tsOutput)) {
        if (tsPendingExecutionFiles.size >= TS_MAX_TRACKED_EXECUTION_FILES) {
            tsExecutionOutputsOverflowed = true;
            return;
        }
        tsPendingExecutionFiles.add(tsPath);
    }
}

function tsTakePendingExecutionFiles() {
    const tsFiles = [...tsPendingExecutionFiles];
    tsPendingExecutionFiles.clear();
    tsExecutionOutputsOverflowed = false;
    return tsFiles;
}

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
        tsExecutionRescanPromptId = "";
        tsExecutionFullScanPending = false;
        tsReadyExecutionFiles.clear();
        tsTakePendingExecutionFiles();
    }
}

async function tsAttemptRescanNow() {
    if (!tsAutoscanEnabled) {
        tsExecutionRescanFirstEventAt = 0;
        return;
    }
    if (tsExecutionIndexInFlight) {
        // The in-flight request's finally block picks up completed prompts
        // accumulated meanwhile. Never run several indexing jobs in parallel.
        return;
    }
    const tsFiles = [...tsReadyExecutionFiles];
    if (tsFiles.length === 0 && (!tsExecutionFullScanPending || tsComfyQueueRemaining > 0)) {
        // A status event restarts the deferred full scan when the queue drains;
        // there is no polling or directory walk while generation is active.
        return;
    }
    tsExecutionRescanFirstEventAt = 0;
    // Tabs reacting to the same prompt share a claim for its targeted request.
    // Without an execution id, preferring a redundant scan is safer than
    // treating two different generations as the same one and dropping files.
    const tsRootId = tsBrowserRuntimeSettings.executionRescanRootId;
    let tsBusy = false;
    tsExecutionIndexInFlight = true;
    try {
        if (tsFiles.length > 0) {
            const tsWonClaim = !tsExecutionRescanPromptId || tsClaimExecutionRescan({
                tsWindowMs: tsBrowserRuntimeSettings.executionRescanClaimWindowMs,
                tsPromptId: tsExecutionRescanPromptId,
            });
            tsExecutionRescanPromptId = "";
            tsReadyExecutionFiles.clear();
            if (!tsWonClaim) {
                return;
            }
            const tsResult = await tsPostJSON(`${tsApiSettings.routeBase}/index_files`, { root_id: tsRootId, files: tsFiles });
            if (tsResult?.busy) {
                // Retry just these names after the current indexer job. A full
                // rescan would compete with the still-running generation queue.
                tsBusy = true;
                tsQueueReadyExecutionFiles(tsFiles);
            }
        } else {
            tsExecutionFullScanPending = false;
            tsExecutionRescanPromptId = "";
            await tsPostJSON(`${tsApiSettings.routeBase}/rescan`, { root_id: tsRootId });
        }
    } catch (tsError) {
        if (tsFiles.length > 0) {
            tsExecutionFullScanPending = true;
            tsConsoleWarn("Timesaver Artius Browser targeted index failed", tsError);
        } else {
            tsConsoleWarn("Timesaver Artius Browser execution rescan failed", tsError);
        }
    } finally {
        tsExecutionIndexInFlight = false;
        if (tsAutoscanEnabled && (tsReadyExecutionFiles.size > 0 || (tsExecutionFullScanPending && tsComfyQueueRemaining === 0))) {
            const tsRetryMs = Number(tsBrowserRuntimeSettings.executionRescanIdleRetryMs) || 250;
            tsArmExecutionRescanTimer(tsBusy ? Math.max(1000, tsRetryMs) : tsRetryMs);
        }
    }
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
        if (tsComfyQueueRemaining === 0 && (tsExecutionRescanTimer || tsExecutionFullScanPending)) {
            tsArmExecutionRescanTimer(0);
        }
    }
}

function tsHandleExecutionEnd(tsEvent) {
    const tsNeedsFullScan = tsExecutionOutputsOverflowed || tsPendingExecutionFiles.size === 0;
    const tsFiles = tsTakePendingExecutionFiles();
    if (!tsAutoscanEnabled) {
        return;
    }
    // Snapshot at completion: files emitted by the next running prompt must
    // not be mixed into this prompt's delayed request.
    tsExecutionFullScanPending ||= tsNeedsFullScan;
    tsQueueReadyExecutionFiles(tsFiles);
    tsExecutionRescanPromptId = String(tsEvent?.detail?.prompt_id || "");
    tsDebouncedExecutionRescan();
}

// Sidebar tab strings are handed to ComfyUI once at registration, so a language
// change has to push new ones into the registered tab object.
let tsActiveLocaleCode = "";
let tsLocaleWatchTimer = 0;
let tsSidebarLocale = {};
let tsLocaleSyncId = 0;
let tsLocaleWatchTarget = null;
let tsFallbackUILanguage = "";

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
    const tsCode = tsResolveLocaleCode(tsFallbackUILanguage, tsResolveComfyLocale());
    if (!tsForceApply && tsCode === tsActiveLocaleCode) {
        return null;
    }
    tsActiveLocaleCode = tsCode;
    const tsSyncId = ++tsLocaleSyncId;
    const tsLocale = await tsLoadLocale(tsCode).catch((tsError) => {
        tsConsoleWarn("Timesaver Artius Browser locale load failed", tsError);
        return null;
    });
    if (!tsLocale || tsSyncId !== tsLocaleSyncId || tsCode !== tsResolveLocaleCode(tsFallbackUILanguage, tsResolveComfyLocale())) {
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
    // ComfyUI's settings bridge emits this event after changing its store.
    // Keep a cheap store-only poll for builds without that bridge/event.
    tsLocaleWatchTarget?.removeEventListener?.("Comfy.Locale.change", tsHandleComfyLocaleChange);
    tsLocaleWatchTarget = app?.ui?.settings;
    tsLocaleWatchTarget?.addEventListener?.("Comfy.Locale.change", tsHandleComfyLocaleChange);
    window.clearInterval(tsLocaleWatchTimer);
    tsLocaleWatchTimer = window.setInterval(() => {
        void tsSyncLocale();
    }, 2000);
}

function tsHandleComfyLocaleChange() {
    void tsSyncLocale();
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
            // Move the shared singleton into an external host and restore its
            // previous parent on unmount. Only one mount is live at a time.
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
            tsFallbackUILanguage = typeof tsSettingsPayload?.ui?.language === "string" ? tsSettingsPayload.ui.language : "";
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
        api.addEventListener("executed", (tsEvent) => tsTrackExecutedOutputs(tsEvent?.detail?.output));
        api.addEventListener("execution_success", (tsEvent) => tsHandleExecutionEnd(tsEvent));
        api.addEventListener("execution_error", (tsEvent) => tsHandleExecutionEnd(tsEvent));
        api.addEventListener("execution_interrupted", (tsEvent) => tsHandleExecutionEnd(tsEvent));
    },
});
