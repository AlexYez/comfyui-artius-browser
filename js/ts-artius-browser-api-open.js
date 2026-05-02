export function tsResolveOpenableURL(tsURL, tsApiURL) {
    const tsValue = String(tsURL || "");
    if (!tsValue) {
        return "";
    }
    if (tsValue.startsWith("/api/") || tsValue.startsWith("http://") || tsValue.startsWith("https://") || tsValue.startsWith("blob:") || tsValue.startsWith("data:")) {
        return tsValue;
    }
    return tsApiURL(tsValue);
}

export function tsOpenDownload(tsAsset, tsDeps) {
    if (!tsAsset?.file_url) {
        return;
    }
    const tsLink = tsDeps.document.createElement("a");
    tsLink.href = tsResolveOpenableURL(tsAsset.file_url, tsDeps.apiURL);
    tsLink.download = tsAsset.filename || "asset";
    tsLink.rel = "noopener";
    tsDeps.document.body.append(tsLink);
    tsLink.click();
    tsLink.remove();
}

export function tsOpenAssetInNewTab(tsAsset, tsDeps) {
    if (!tsAsset?.file_url) {
        return false;
    }
    const tsLink = tsDeps.document.createElement("a");
    tsLink.href = tsResolveOpenableURL(tsAsset.file_url, tsDeps.apiURL);
    tsLink.target = "_blank";
    tsLink.rel = "noopener noreferrer";
    tsDeps.document.body.append(tsLink);
    tsLink.click();
    tsLink.remove();
    return true;
}
