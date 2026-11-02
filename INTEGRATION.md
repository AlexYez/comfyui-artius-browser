# Integration with other ComfyUI packs

This is the public contract for packs integrating with Artius Browser. It is self-contained: the optional consumer's repository and the maintainer's private documentation are not required. Verified against source on 2026-11-02.

All three seams are optional. Artius Browser does not import the publishing pack, assume it is installed, or require a fixed extension load order.

| Seam | Purpose | Browser implementation |
|---|---|---|
| [Embed](#1-embed-the-panel) | Move the shared panel into a host UI. | [extension entry](js/ts-artius-browser.js) |
| [Asset actions](#2-publish-asset-actions) | Offer commands in the asset context menu. | [panel](js/ts-artius-browser-panel.js) |
| [Preferred loaders](#3-preferred-loader-nodes-on-drop) | Fill an installed loader directly instead of using the native target. | [settings](js/ts-artius-browser-settings.js), [API facade](js/ts-artius-browser-api.js) |

## 1. Embed the panel

```js
const mounted = window.tsArtiusBrowser.mountPanel(hostElement);
// Later, when the host UI closes:
mounted.unmount();
```

`mountPanel(host)` moves the existing singleton panel into the host and returns `{unmount()}`. Unmount returns it to its previous parent and sibling position when possible; if it previously had no parent, it removes it. It never creates a second panel instance.

The lightbox is a separate body-level viewer. A host using its own fullscreen/top-layer surface must arrange viewer layering on its side; the embed call does not change this contract.

The entry also exposes `window.tsArtiusBrowser.getRecentErrors()` for a bounded snapshot of frontend warnings. Treat that as diagnostics, not an event stream or a persistent data store.

## 2. Publish asset actions

Publish descriptors to the shared array. Keep ids unique and stable:

```js
window.tsAssetActions = window.tsAssetActions || [];
window.tsAssetActions.push({
    id: "my-pack.open-image",
    label: { en: "Open in my pack", ru: "Открыть в моём пакете" },
    supports(asset) { return asset.type === "image"; },
    async run(asset) {
        // Fetch asset.url or pass it to your own application here.
        return { ok: true, message: "Opened" };
    },
});
```

The browser passes only this descriptor to `supports` and `run`:

```js
{ id, filename, url, type, extension }
```

`url` is fetchable as supplied. Do not assume the callback receives the complete list/detail row or filesystem access. Fetch bytes only in `run`, not while constructing every card/menu.

Rules implemented by `tsExternalAssetActions`, `tsExternalActionLabel` and `tsRunExternalAction`:

- `id` and a callable `run` are required. An omitted `supports` accepts all assets; a present predicate must be synchronous and cheap.
- A predicate exception excludes that action and records a warning; it does not break the context menu.
- Actions follow **array order**. An `order` property is not consumed by this browser, so sort the published array yourself if order matters.
- A label can be a string or locale map. The current locale falls back to `en`, then the action id; this does not require adding keys to browser locales.
- `run` may return nothing or a result. `{ok:false, message}` produces an info toast; another result with `message` produces success. A thrown error is warned and shown as an error toast. `{ok:false}` is an ordinary negative answer, such as an image that cannot be restored by the producer.
- The context menu dispatches an applicable action as `ext:<id>` above plain file commands.

External actions are exposed through the context menu. Card buttons are reserved for the browser's built-in file/workflow commands.

<a id="4-preferred-loader-nodes-on-drop"></a>

## 3. Preferred loader nodes on drop

`tsApiSettings.preferredWorkflowTargets` lists ordered descriptors per asset type. `tsResolveWorkflowTarget` picks the first descriptor whose node type is registered in this ComfyUI. If none is registered, the configured native loader remains the target. The current video entry is:

```js
{
    tsNodeType: "TS_VideoLoader",
    tsWidgetNames: ["source_path"],
    tsValueKind: "path",
    tsHiddenWidgetStash: "_tsHiddenWidgets",
    tsRefreshHook: "_tsVideoLoaderRehydrate",
}
```

`tsValueKind: "path"` fills the asset's path on the ComfyUI machine. The node reads it in place, avoiding a native input-copy round trip. A path on the server is not a path on a remote browser's computer.

The browser first looks in `node.widgets`, then in the optional stash named by `tsHiddenWidgetStash`. It waits briefly for a widget created asynchronously. The real widget value is written because that is what workflow serialization reads; matching `node.properties` is mirrored too. A properties-only update could appear correct in the node UI while queuing an empty input.

After filling the widget, an optional zero-argument `tsRefreshHook` is called with the node as `this`. A missing hook is harmless; a throwing hook records a warning after the value has been set. A node without hidden widgets needs neither optional surface.

**A renamed or missing stash is not a promise of native fallback.** Selection has already chosen a registered preferred node. If its required widget cannot be filled, the new loader node is removed and the browser reports failure. This avoids leaving an unrelated first combo entry in the graph. Native fallback happens at target selection when no preferred node type is registered.

Sources: `tsResolveTargetForAsset`, `tsFindTargetWidget`, `tsApplyPathTargetToNode`, `tsCreateWorkflowNode` in [API facade](js/ts-artius-browser-api.js); `tsResolveWorkflowTarget` in [Comfy adapter](js/ts-artius-browser-api-workflow.js).

## 4. Verify an integration

Check the live registry and available node types, a matching and nonmatching asset, one successful command, and one ordinary negative result. For a loader, verify the serialized widget value and queue the node: a visually filled interface alone does not prove the input was persisted. For embed, close/unmount and reopen both host and sidebar to check singleton lifecycle.

Test the browser without the publishing pack as well. Its native loaders, normal cards, deletion and downloads must remain usable. Browser code should not reach into another pack's private storage or import its modules to implement these seams.
