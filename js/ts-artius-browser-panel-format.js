export function tsLerp(tsStart, tsEnd, tsRatio) {
    return tsStart + ((tsEnd - tsStart) * tsRatio);
}

export function tsFormatCardFPS(tsFPS) {
    const tsValue = Number(tsFPS || 0);
    if (!Number.isFinite(tsValue) || tsValue <= 0) {
        return "";
    }
    const tsRounded = Math.round(tsValue * 100) / 100;
    return `${Number.isInteger(tsRounded) ? tsRounded.toFixed(0) : tsRounded.toFixed(tsRounded < 10 ? 2 : 1).replace(/\.0$/, "")}` + " FPS";
}

export function tsFormatCardDuration(tsSeconds) {
    const tsValue = Number(tsSeconds || 0);
    if (!Number.isFinite(tsValue) || tsValue <= 0) {
        return "";
    }
    const tsRounded = Math.max(1, Math.round(tsValue));
    if (tsRounded < 60) {
        return `${tsRounded}s`;
    }
    const tsHours = Math.floor(tsRounded / 3600);
    const tsMinutes = Math.floor((tsRounded % 3600) / 60);
    const tsSecondsRemainder = tsRounded % 60;
    if (tsHours > 0) {
        return `${tsHours}:${String(tsMinutes).padStart(2, "0")}:${String(tsSecondsRemainder).padStart(2, "0")}`;
    }
    return `${tsMinutes}:${String(tsSecondsRemainder).padStart(2, "0")}`;
}
