// @ts-check
export function tsDebounce(tsFunction, tsWaitMs = 250, tsWindow = window) {
    let tsTimeoutId = 0;
    return (...tsArgs) => {
        tsWindow.clearTimeout(tsTimeoutId);
        tsTimeoutId = tsWindow.setTimeout(() => tsFunction(...tsArgs), tsWaitMs);
    };
}

export function tsClamp(tsValue, tsMin, tsMax) {
    return Math.max(tsMin, Math.min(tsMax, tsValue));
}

// Single source of truth for HTML/attribute escaping. The panel and viewer both
// build markup via template strings; keeping one implementation here prevents
// the two copies from drifting apart (e.g. one escaping `"` and the other not).
export function tsEscapeHTML(tsText) {
    return String(tsText || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

export function tsEscapeAttribute(tsText) {
    // "&#39;" (not "&apos;") for maximum parser compatibility: single quotes
    // matter for the one single-quoted CSS url('...') sink in the viewer stage.
    return tsEscapeHTML(tsText).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function tsFormatBytes(tsBytes) {
    if (!Number.isFinite(tsBytes) || tsBytes <= 0) {
        return "0 B";
    }
    const tsUnits = ["B", "KB", "MB", "GB", "TB"];
    let tsValue = tsBytes;
    let tsUnitIndex = 0;
    while (tsValue >= 1024 && tsUnitIndex < tsUnits.length - 1) {
        tsValue /= 1024;
        tsUnitIndex += 1;
    }
    return `${tsValue.toFixed(tsUnitIndex === 0 ? 0 : 1)} ${tsUnits[tsUnitIndex]}`;
}
