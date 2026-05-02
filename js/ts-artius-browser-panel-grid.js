import { tsLerp } from "./ts-artius-browser-panel-format.js";

function tsClamp(tsValue, tsMin, tsMax) {
    return Math.max(tsMin, Math.min(tsMax, tsValue));
}

export function tsCalculateGridMetrics(tsOptions = {}) {
    const tsGap = tsOptions.gridLayout.spacing;
    const tsPaddingTop = tsOptions.gridLayout.spacing;
    const tsPaddingRight = tsOptions.gridLayout.spacing;
    const tsPaddingBottom = tsOptions.gridLayout.spacing;
    const tsPaddingLeft = tsOptions.gridLayout.spacing;
    const tsViewportWidth = Math.max(0, Math.round(Number(tsOptions.viewportWidth || 0)));
    const tsCardWidth = tsClamp(tsOptions.cardWidth, tsOptions.previewSizeRange.min, tsOptions.previewSizeRange.max);
    const tsContentWidth = Math.max(220, tsViewportWidth - (tsPaddingLeft + tsPaddingRight + 4));
    const tsCardPreviewHeight = Math.round(tsCardWidth * 0.92);
    const tsCardHeight = tsCardPreviewHeight;
    const tsPreviewRatio = tsClamp((tsCardWidth - tsOptions.previewSizeRange.min) / Math.max(1, tsOptions.previewSizeRange.max - tsOptions.previewSizeRange.min), 0, 1);
    const tsMetrics = {
        tsGap,
        tsPaddingTop,
        tsPaddingRight,
        tsPaddingBottom,
        tsPaddingLeft,
        tsContentWidth,
        tsCardWidth,
        tsCardPreviewHeight,
        tsCardHeight,
        tsCardInset: Math.round(tsLerp(tsOptions.cardChromeScale.insetMin, tsOptions.cardChromeScale.insetMax, tsPreviewRatio)),
        tsActionSize: Math.round(tsLerp(tsOptions.cardChromeScale.actionSizeMin, tsOptions.cardChromeScale.actionSizeMax, tsPreviewRatio)),
        tsActionRadius: Math.round(tsLerp(tsOptions.cardChromeScale.actionRadiusMin, tsOptions.cardChromeScale.actionRadiusMax, tsPreviewRatio)),
        tsActionFontSize: Math.round(tsLerp(tsOptions.cardChromeScale.actionFontMin, tsOptions.cardChromeScale.actionFontMax, tsPreviewRatio)),
        tsActionGap: Math.round(tsLerp(tsOptions.cardChromeScale.actionGapMin, tsOptions.cardChromeScale.actionGapMax, tsPreviewRatio)),
        tsBadgeFontSize: Math.round(tsLerp(tsOptions.cardChromeScale.badgeFontMin, tsOptions.cardChromeScale.badgeFontMax, tsPreviewRatio)),
        tsBadgePadY: Math.round(tsLerp(tsOptions.cardChromeScale.badgePadYMin, tsOptions.cardChromeScale.badgePadYMax, tsPreviewRatio)),
        tsBadgePadX: Math.round(tsLerp(tsOptions.cardChromeScale.badgePadXMin, tsOptions.cardChromeScale.badgePadXMax, tsPreviewRatio)),
        tsBadgeRadius: Math.round(tsLerp(tsOptions.cardChromeScale.badgeRadiusMin, tsOptions.cardChromeScale.badgeRadiusMax, tsPreviewRatio)),
        tsOverlayPadX: Math.round(tsLerp(tsOptions.cardChromeScale.overlayPadXMin, tsOptions.cardChromeScale.overlayPadXMax, tsPreviewRatio)),
        tsOverlayPadBottom: Math.round(tsLerp(tsOptions.cardChromeScale.overlayPadBottomMin, tsOptions.cardChromeScale.overlayPadBottomMax, tsPreviewRatio)),
        tsOverlayTop: Math.round(tsLerp(tsOptions.cardChromeScale.overlayTopMin, tsOptions.cardChromeScale.overlayTopMax, tsPreviewRatio)),
        tsOverlayTitleSize: Math.round(tsLerp(tsOptions.cardChromeScale.overlayTitleMin, tsOptions.cardChromeScale.overlayTitleMax, tsPreviewRatio)),
        tsOverlayMetaSize: Math.round(tsLerp(tsOptions.cardChromeScale.overlayMetaMin, tsOptions.cardChromeScale.overlayMetaMax, tsPreviewRatio)),
        tsCardRadius: Math.round(tsLerp(tsOptions.cardChromeScale.cardRadiusMin, tsOptions.cardChromeScale.cardRadiusMax, tsPreviewRatio)),
    };
    tsMetrics.tsColumns = Math.max(1, Math.floor((tsMetrics.tsContentWidth + tsGap) / (tsCardWidth + tsGap)));
    tsMetrics.tsRowHeight = tsMetrics.tsCardHeight + tsGap;
    return tsMetrics;
}

export function tsApplyGridMetricStyles(tsGalleryContent, tsMetrics) {
    tsGalleryContent.style.setProperty("--ts-card-preview-height", `${tsMetrics.tsCardPreviewHeight}px`);
    tsGalleryContent.style.setProperty("--ts-card-radius", `${tsMetrics.tsCardRadius}px`);
    tsGalleryContent.style.setProperty("--ts-card-inset", `${tsMetrics.tsCardInset}px`);
    tsGalleryContent.style.setProperty("--ts-card-action-size", `${tsMetrics.tsActionSize}px`);
    tsGalleryContent.style.setProperty("--ts-card-action-radius", `${tsMetrics.tsActionRadius}px`);
    tsGalleryContent.style.setProperty("--ts-card-action-font-size", `${tsMetrics.tsActionFontSize}px`);
    tsGalleryContent.style.setProperty("--ts-card-action-gap", `${tsMetrics.tsActionGap}px`);
    tsGalleryContent.style.setProperty("--ts-card-badge-font-size", `${tsMetrics.tsBadgeFontSize}px`);
    tsGalleryContent.style.setProperty("--ts-card-badge-pad-y", `${tsMetrics.tsBadgePadY}px`);
    tsGalleryContent.style.setProperty("--ts-card-badge-pad-x", `${tsMetrics.tsBadgePadX}px`);
    tsGalleryContent.style.setProperty("--ts-card-badge-radius", `${tsMetrics.tsBadgeRadius}px`);
    tsGalleryContent.style.setProperty("--ts-card-overlay-pad-x", `${tsMetrics.tsOverlayPadX}px`);
    tsGalleryContent.style.setProperty("--ts-card-overlay-pad-bottom", `${tsMetrics.tsOverlayPadBottom}px`);
    tsGalleryContent.style.setProperty("--ts-card-overlay-top", `${tsMetrics.tsOverlayTop}px`);
    tsGalleryContent.style.setProperty("--ts-card-overlay-title-size", `${tsMetrics.tsOverlayTitleSize}px`);
    tsGalleryContent.style.setProperty("--ts-card-overlay-meta-size", `${tsMetrics.tsOverlayMetaSize}px`);
}
