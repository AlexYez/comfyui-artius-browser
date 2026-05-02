export function tsFormatTime(tsSeconds) {
    const tsSafeSeconds = Math.max(0, Number(tsSeconds) || 0);
    const tsMinutes = Math.floor(tsSafeSeconds / 60);
    const tsRemainderSeconds = Math.floor(tsSafeSeconds % 60);
    return `${tsMinutes}:${String(tsRemainderSeconds).padStart(2, "0")}`;
}

export function tsFormatBitrate(tsBitrate) {
    const tsSafeBitrate = Number(tsBitrate) || 0;
    if (tsSafeBitrate <= 0) {
        return "";
    }
    if (tsSafeBitrate >= 1_000_000) {
        return `${(tsSafeBitrate / 1_000_000).toFixed(2)} Mbps`;
    }
    if (tsSafeBitrate >= 1_000) {
        return `${(tsSafeBitrate / 1_000).toFixed(0)} kbps`;
    }
    return `${tsSafeBitrate} bps`;
}
