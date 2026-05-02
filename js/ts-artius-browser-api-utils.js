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
