import { tsResolveLastFrameTime, tsResolveVideoFrameIndex } from "./ts-artius-browser-viewer-state.js";

// Wait for a decoded picture, including after a seek. A stalled range
// request must not leave a decoder (or the download button) busy forever.
function tsWaitForPicture(tsVideo, tsEvent, tsStart) {
    return new Promise((tsResolve, tsReject) => {
        const tsFinish = (tsError) => {
            clearTimeout(tsTimer);
            tsVideo.removeEventListener(tsEvent, tsReady);
            tsVideo.removeEventListener("error", tsFailed);
            if (tsError) tsReject(tsError);
            else tsResolve();
        };
        const tsReady = () => tsFinish();
        const tsFailed = () => tsFinish(new Error("Video decode failed"));
        const tsTimer = setTimeout(tsFailed, 30000);
        tsVideo.addEventListener(tsEvent, tsReady);
        tsVideo.addEventListener("error", tsFailed);
        try {
            tsStart();
        } catch (tsError) {
            tsFinish(tsError);
        }
    });
}

async function tsPicturePNG(tsVideo, tsPosition, tsFPS) {
    const tsTime = tsPosition === "last" ? tsResolveLastFrameTime(tsVideo.duration, tsFPS) : tsVideo.currentTime;
    const tsHint = tsResolveVideoFrameIndex(tsTime, tsFPS);
    const tsCanvas = document.createElement("canvas");
    tsCanvas.width = tsVideo.videoWidth;
    tsCanvas.height = tsVideo.videoHeight;
    tsCanvas.getContext("2d").drawImage(tsVideo, 0, 0);
    const tsBlob = await new Promise((tsResolve, tsReject) => {
        tsCanvas.toBlob(tsBlob => tsBlob ? tsResolve(tsBlob) : tsReject(new Error("PNG encoding failed")), "image/png");
    });
    return { tsBlob, tsHint };
}

export async function tsCaptureBrowserFrame(tsURL, tsPosition, tsPlayer, tsFPS) {
    if (!tsURL) throw new Error("Missing original video URL");
    // The user may have moved to another frame or closed the viewer while
    // the server was responding. Only reuse the exact paused original.
    if (tsPlayer?.paused && !tsPlayer.seeking && tsPlayer.videoWidth && tsPlayer.readyState >= 2
        && tsPlayer.currentSrc === new URL(tsURL, document.baseURI).href
        && (tsPosition === "last" ? tsPlayer.ended : Math.round(tsPlayer.currentTime * 1e6) === tsPosition)) {
        return tsPicturePNG(tsPlayer, tsPosition, tsFPS);
    }

    const tsVideo = document.createElement("video");
    tsVideo.muted = true;
    tsVideo.playsInline = true;
    tsVideo.preload = "auto";
    try {
        await tsWaitForPicture(tsVideo, "loadeddata", () => { tsVideo.src = tsURL; });
        if (!tsVideo.videoWidth || !tsVideo.videoHeight) throw new Error("Missing video track");
        if (tsPosition !== "first" && tsPosition !== 0) {
            // A timestamp just inside the end works for variable frame rates
            // too. No FPS estimate or ffprobe metadata is needed.
            const tsTime = tsPosition === "last" ? Math.max(0, tsVideo.duration - 0.000001) : tsPosition / 1e6;
            if (!Number.isFinite(tsTime)) throw new Error("Unknown frame position");
            if (tsTime !== tsVideo.currentTime) {
                await tsWaitForPicture(tsVideo, "seeked", () => { tsVideo.currentTime = tsTime; });
                if (tsVideo.readyState < 2 || Math.abs(tsVideo.currentTime - tsTime) > 0.0001) {
                    throw new Error("Requested frame is unavailable");
                }
            }
        }
        return tsPicturePNG(tsVideo, tsPosition, tsFPS);
    } finally {
        tsVideo.removeAttribute("src");
        tsVideo.load();
    }
}
