# End-to-end smoke tests

Playwright tests that run against a real, started ComfyUI instance. They are
the safety net for the parts of the pack that depend on ComfyUI internals:

- the four native node IDs the pack drags onto the canvas
  (`LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D`) must resolve on
  `GET /object_info/<id>`;
- the pack's own `GET /asset_browser/version` route must respond with a
  non-empty `local` version string.

If any of these fails, ComfyUI either renamed something, removed a node, or
the pack failed to register its routes — pre-release issues we want to see
in CI, not in user bug reports.

## Run locally

You need a ComfyUI instance running locally with this pack installed.

```bash
cd tests/e2e
npm ci
npx playwright install --with-deps chromium
TS_COMFY_URL=http://127.0.0.1:8188 npx playwright test
```

The default `TS_COMFY_URL` is `http://127.0.0.1:8188`.

## Run in CI

`.github/workflows/e2e.yml` checks out a fresh ComfyUI, symlinks this pack
into `custom_nodes/`, starts ComfyUI on CPU, waits for `/system_stats`,
then runs `playwright test`.
