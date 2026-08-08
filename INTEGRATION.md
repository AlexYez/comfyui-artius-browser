# Integration — how other packs plug into the browser

*Written and maintained by the AI agent building `comfyui-timesaver`. Every
touched site in the source carries an `[AI agent]` comment.*

The browser has three seams other packs can use. All of them are optional and
none of them make the browser depend on anything: with no other pack
installed, every path below simply yields nothing and the UI is unchanged.

The first consumer is **TS Image Studio** (`comfyui-timesaver`). Its side is
documented in that repo at `nodes/image/studio/ARCHITECTURE.md`.

---

## 1. Embed: `window.tsArtiusBrowser.mountPanel(host)`

Moves the singleton panel into `host` and returns `{unmount()}` which puts it
back where it was. Used by the studio's Library tab so the browser lives
inside a fullscreen app without a second instance existing.

Source: `js/ts-artius-browser.js` (`mountPanel`).

Notes for maintainers:

- The panel is a **singleton**: one live instance shared with the sidebar tab.
  Mounting it elsewhere moves it; it is never cloned.
- The lightbox opens at body level, sized for the page. A host that is itself
  fullscreen has to lift it — the studio does that on its side without any
  patch here.

---

## 2. External asset actions: `window.tsAssetActions`

A plain array on `window`, because publisher and consumer are separate
ComfyUI extensions with no shared module graph and no guaranteed load order.

One entry:

```js
{
  id: "pack.action-name",            // unique, stable
  label: { en: "…", ru: "…" },       // or a plain string
  order: 20,                          // lower sorts first
  supports(asset) -> boolean,         // fast, synchronous
  run(asset) -> Promise<{ok, message}>|void,
}
```

The descriptor the browser passes:

```js
{ id, filename, url, type, extension }   // url is fetchable as-is
```

Where they surface:

- **Context menu** — `tsBuildContextMenuItems()` appends applicable entries
  above the file commands, dispatched as `ext:<id>` in
  `tsHandleContextMenuClick()`.
- **Card buttons** — hover actions next to P/W/D/X:

  | Button | Action id | Shown when |
  |---|---|---|
  | `S` | `ts-image-studio.use-source` | the action is published — **nobody publishes it today** |
  | `R` | `ts-image-studio.recreate` | published **and** the asset has a studio tag |

  **Why `S` is gone from the cards — so nobody re-investigates (2026-08-05).**
  It did not break here: the studio simply stopped publishing
  `ts-image-studio.use-source`. Its owner's reasoning: the button promised more
  than it delivered (it looked as if it dropped the picture into any section
  while it always landed in inpaint), and dragging already covers the need.

  The branch on this side is kept deliberately and stays dormant exactly until
  someone publishes that id again — the mechanism is generic, and another pack
  may claim it tomorrow. Check what is published right now with one line in the
  page console:

  ```js
  window.tsAssetActions.map(a => a.id)   // today: ["ts-image-studio.recreate"]
  ```

  On the studio's side this is `publishAssetAction(...)` in
  `js/image/studio/ts-image-studio.js`.

Rules the browser follows:

- `supports()` is called while a menu or a card is being built, so it must be
  synchronous and cheap — anything needing the file's bytes belongs in `run()`.
- A `supports()` that throws costs that one entry, never the right-click:
  see the try/catch in `tsExternalAssetActions()`.
- `run()`'s answer becomes a toast; `{ok:false}` is shown as info, not error,
  because "this image was not made in the studio" is an answer, not a failure.

---

## 3. Studio tag on the thumbnails

Images written by TS Image Studio carry a `ts_studio` PNG text chunk beside
ComfyUI's own `prompt`/`workflow`. The scanner reads it into the metadata blob
and the asset payload exposes it as `studio`.

Pipeline:

| Step | Where |
|---|---|
| read the chunk | `tsab/media/image.py` → `TSExtractStudioSession()` |
| store it | inside the existing `metadata` blob, key `studio` — **no schema change** |
| expose it | `tsab/ts_asset_payload.py` → `TSResolveStudioTag()` → `studio` field |
| render it | `tsStudioBadge()` in `js/ts-artius-browser-panel.js`, badge `data-kind="studio"` |

Tag shape:

```json
{"app": "ts-image-studio", "mode": "inpaint", "backend_mode": "inpaint",
 "family": "krea2", "family_label": "Krea 2 Turbo", "backend": "krea2/inpaint",
 "seed": 99001, "steps": 4, "cfg": 1, "denoise": 1, "width": 1024,
 "height": 1024, "lora_count": 2}
```

Assets from anywhere else return `{}` and render exactly as before.

Two things worth knowing:

- `TS_PROMPT_PARTS_VERSION` was bumped to **7** so stored blobs re-extract.
  Images indexed before that pick the tag up on their next detail view or
  after **Rebuild Cache** — a plain rescan only revisits new or changed files.
- Badge colours are literal rather than themed, deliberately: the badge sits
  over user media and has to stay legible on any picture (same reasoning as
  the video letterbox, see the colour budget in the studio's theme guard).

---

## 4. Localisation

Keys added for this integration live in `js/localization/{en,ru,ja,zh}.json`:

```
studio.badge, studio.mode.generate, studio.mode.inpaint, studio.mode.upscale
button.recreate, button.useInStudio
```

Action **labels** come from the publishing pack (its `label:{en,ru}`), so a
pack that speaks only two languages will show English in the other two — that
is expected, not a missing translation here.

---

## 5. Checking a change

The install holds a copy of this repo, not a link, so an edit reaches ComfyUI
only once copied. The studio's repo ships a verifier that covers both packs:

```bash
python tools/verify_live_sync.py          # from comfyui-timesaver
python tools/verify_live_sync.py --sync   # copy what is behind
```

It compares files on disk, what the HTTP server serves, and what the Python
process has loaded. JS changes need a copy and Ctrl+F5; Python changes need a
ComfyUI restart.
