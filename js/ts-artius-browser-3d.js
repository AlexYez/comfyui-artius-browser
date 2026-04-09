import { tsFetch3DViewerSupport } from "./ts-artius-browser-api.js";

let ts3DViewerClassPromise = null;

function tsResolve3DViewerClass(tsModule) {
    return tsModule?.Load3d || tsModule?.n || tsModule?.default?.Load3d || null;
}

export function tsResolve3DViewerFileExtension(tsViewerURL) {
    try {
        const tsURL = new URL(tsViewerURL, window.location.origin);
        const tsFilename = tsURL.searchParams.get("filename") || "";
        const tsExtension = tsFilename.split(".").pop()?.trim().toLowerCase() || "";
        return tsExtension || null;
    } catch {
        return null;
    }
}

async function tsWaitAnimationFrames(tsCount = 2) {
    for (let tsIndex = 0; tsIndex < tsCount; tsIndex += 1) {
        await new Promise((tsResolve) => window.requestAnimationFrame(() => tsResolve()));
    }
}

export async function tsLoad3DViewerClass() {
    if (ts3DViewerClassPromise) {
        return ts3DViewerClassPromise;
    }
    ts3DViewerClassPromise = (async () => {
        const tsSupport = await tsFetch3DViewerSupport().catch(() => null);
        const tsModuleURL = tsSupport?.load3d_module_url || tsSupport?.module_url || tsSupport?.viewer_module_url;
        if (!tsSupport?.available || !tsModuleURL) {
            return null;
        }
        const tsModule = await import(new URL(tsModuleURL, window.location.origin).href);
        return tsResolve3DViewerClass(tsModule);
    })().catch((tsError) => {
        ts3DViewerClassPromise = null;
        throw tsError;
    });
    return ts3DViewerClassPromise;
}

export async function tsCapture3DThumbnail(tsViewerURL, tsOptions = {}) {
    const tsLoad3dClass = await tsLoad3DViewerClass();
    const tsExtension = tsResolve3DViewerFileExtension(tsViewerURL || "");
    if (!tsLoad3dClass || !tsViewerURL || !tsExtension) {
        return null;
    }
    const tsWidth = Math.max(128, Math.min(1024, Number(tsOptions.width) || 320));
    const tsHeight = Math.max(128, Math.min(1024, Number(tsOptions.height) || 320));
    const tsWarmFrames = Math.max(1, Math.min(8, Number(tsOptions.warmFrames) || 2));
    const tsHost = document.createElement("div");
    Object.assign(tsHost.style, {
        position: "fixed",
        left: "-10000px",
        top: "-10000px",
        width: `${tsWidth}px`,
        height: `${tsHeight}px`,
        opacity: "0",
        pointerEvents: "none",
        overflow: "hidden",
    });
    document.body.append(tsHost);
    let tsViewerController = null;
    try {
        tsViewerController = new tsLoad3dClass(tsHost, { width: tsWidth, height: tsHeight, isViewerMode: true });
        tsViewerController.cameraManager?.reset?.();
        tsViewerController.controlsManager?.reset?.();
        tsViewerController.modelManager?.clearModel?.();
        tsViewerController.animationManager?.dispose?.();
        const tsModel = await tsViewerController.loaderManager?.loadModelInternal?.(tsViewerURL, tsExtension);
        if (!tsModel) {
            return null;
        }
        await tsViewerController.modelManager?.setupModel?.(tsModel);
        if (tsViewerController.modelManager?.currentModel) {
            tsViewerController.animationManager?.setupModelAnimations?.(
                tsViewerController.modelManager.currentModel,
                tsViewerController.modelManager.originalModel,
            );
        }
        tsViewerController.handleResize?.();
        await tsWaitAnimationFrames(tsWarmFrames);
        const tsThumbnail = await tsViewerController.captureThumbnail?.(tsWidth, tsHeight);
        if (typeof tsThumbnail === "string" && tsThumbnail) {
            return tsThumbnail;
        }
        if (tsThumbnail && typeof tsThumbnail.scene === "string" && tsThumbnail.scene) {
            return tsThumbnail.scene;
        }
        return null;
    } finally {
        try {
            tsViewerController?.remove?.();
        } catch {
            // no-op
        }
        tsHost.remove();
    }
}
