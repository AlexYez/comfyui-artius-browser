export function tsGetSelectedNodes(tsApp) {
    const tsSelected = tsApp?.canvas?.selected_nodes;
    if (!tsSelected) {
        return [];
    }
    if (Array.isArray(tsSelected)) {
        return tsSelected;
    }
    return Object.values(tsSelected);
}

export function tsFindWidget(tsNode, tsNames) {
    if (!tsNode?.widgets?.length) {
        return null;
    }
    const tsLowerNames = tsNames.map((tsName) => tsName.toLowerCase());
    return tsNode.widgets.find((tsWidget) => {
        const tsWidgetName = String(tsWidget?.name || "").toLowerCase();
        return tsLowerNames.includes(tsWidgetName);
    }) || null;
}

export function tsEnsureWidgetOptionValue(tsWidget, tsValue) {
    const tsValues = tsWidget?.options?.values;
    if (!Array.isArray(tsValues) || !tsValue) {
        return;
    }
    if (!tsValues.includes(tsValue)) {
        tsValues.push(tsValue);
    }
}

export function tsSetWidgetValue(tsNode, tsWidget, tsValue, tsDeps) {
    if (!tsWidget) {
        return false;
    }
    tsWidget.value = tsValue;
    if (typeof tsWidget.callback === "function") {
        try {
            tsWidget.callback(tsValue, tsDeps.app, tsNode);
        } catch (tsError) {
            tsDeps.consoleDebug("Timesaver Artius Browser widget callback failed", tsError);
        }
    }
    tsDeps.app?.graph?.setDirtyCanvas?.(true, true);
    tsDeps.app?.canvas?.setDirty?.(true, true);
    return true;
}
