# Backend HTTP integration tests

`pytest`-based tests that hit a live ComfyUI server and assert the public
HTTP surface of Timesaver Artius Browser:

- `/asset_browser/assets` happy path and rejection of unsupported `metadata`;
- `/asset_browser/asset/{id}` rejects non-numeric IDs;
- `/asset_browser/workflow/delete` rejects path-traversal payloads;
- `/asset_browser/file` returns 404 for paths not in the asset DB whitelist;
- `/asset_browser/version` returns a non-empty `local` version;
- `/asset_browser/settings` and `/asset_browser/3d/viewer` respond OK.

If the server isn't reachable, the whole module is skipped — no failures
just because you forgot to start ComfyUI.

## Run locally

You need ComfyUI running with this pack installed.

```bash
pip install -r tests/integration/requirements.txt
TS_COMFY_URL=http://127.0.0.1:8188 pytest tests/integration -v
```

Default `TS_COMFY_URL` is `http://127.0.0.1:8188`.

## Notes

These tests are intentionally **local-only** — they require a running
ComfyUI with this pack installed, which is not provisioned in CI. Run
them on your dev machine before tagging a release.
