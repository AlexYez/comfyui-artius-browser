# Changelog

All notable changes to **Timesaver Artius Browser** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Workflow ids are now derived from a djb2 hash of the workflow's
  relative path instead of the workflow's position in the sorted
  library array. Before this change, deleting one workflow renumbered
  all positions; a section round-trip rebuilt the library with the
  same numeric ids pointing at different files. Path-based ids are
  stable across re-fetches so a pending reference (selection, drag
  source, deferred load) always resolves to the same file.
- Tree-mode folder counts now decrement immediately after deletion.
  Previously `tsRemoveItemsByIds` updated only `tsState.tsItems`, so
  the sidebar tree kept showing the pre-delete count
  (e.g. "output/foo (12)" stayed at 12 after deleting 3 of them)
  until the next full fetch. Now the helper partitions the removed
  items, buckets them by `(root_id, folder_path)`, decrements the
  matching `asset_count` entries on `tsState.tsFolders`, bumps
  `tsFoldersRevision`, and force-renders the tree panel. Aggregate
  counts on ancestor folders update for free because
  `tsBuildFolderTree` rolls up direct counts at build time.
- Bulk-deleting every currently-loaded asset no longer leaves the
  gallery permanently blank when more rows exist server-side.
  Previously `tsRemoveItemsByIds` drained `tsState.tsItems` to length
  0 while `tsHasMore` stayed `true`; `tsHandleGalleryScroll`
  short-circuits on empty items so the infinite-scroll trigger
  never fired. Now we pull the next page automatically when removal
  empties the visible list and the backend still has more.

### Changed
- Preview encoding fast-path restored. `image_quality` 82 → 60 and
  WebP `method` 4 → 0 (the 1.2.0 settings were 4–5× slower per encode
  and ~2× larger on disk than necessary for thumbnail readability).
  The HiDPI win came from `thumbnail_size` 104 → 256, which stays.
  Net: Rebuild Cache on a 30k-image library drops back from ~10–15 min
  to roughly the pre-1.2.0 1–2 min while keeping the sharper 256 px
  thumbnails. Visual quality at 256×256 is essentially indistinguishable
  from q82 because the artifact regions are far below pixel resolution
  on a typical card.
- Config schema v17 → v18 with smarter migration logic. v17 now
  overwrites preview keys *only* when they still hold the v8 baked-in
  defaults (104 / 384 / 200) — any deliberate user customization is
  preserved. v18 corrects `image_quality` for installs already touched
  by the original v17 migration: rewrites 42 (v8) or 82 (v17) to 60,
  leaves anything else alone.

## [1.2.0] - 2026-05-27

### Added
- Resizable toolbar with proportional scaling. A thin drag handle
  along the toolbar's bottom edge lets you compress the entire top
  bar — when dragged up, every control (filters, search, buttons,
  fonts, gaps) scales down uniformly via a single CSS variable
  `--ts-toolbar-scale`. The asset grid below grows to fill the
  reclaimed vertical room. Scale is clamped to `[0.6, 1.0]` and
  persists per install via a new `ui.toolbar_scale` config key
  (additive, no schema bump). Default: `1.0` (unchanged from
  pre-existing layout).

### Fixed
- Asset deletion no longer scrolls the grid back to the top. The old
  flow called `tsFetchAssets(true)` after the `/delete` POST, which
  reset the virtualized grid and lost scroll position. Replaced with
  in-place removal from the cached items array via a new
  `tsRemoveItemsByIds` helper. Selection set and last-selected index
  are kept in sync; the response-cache invalidates so a later
  refetch from filter / sort change still gets fresh data. Workflow
  delete (`tsDeleteWorkflowById`) was switched to the same helper
  and additionally prunes the deleted entry from the in-memory
  workflow library so folder switches do not re-show it.
- Autoscan no longer goes silent after a cancelled / interrupted
  workflow. The 1.1.0 idle gate used a sticky `tsIsComfyExecuting`
  boolean that was set on `execution_start` and only cleared on
  `execution_success` / `execution_error`. If anything ended the
  prompt through a different path (`execution_interrupted` from the
  Cancel button, WebSocket reconnect mid-execution, ComfyUI builds
  that emit a different terminal event), the flag stayed `true` and
  every subsequent rescan attempt looped forever in the 250 ms
  idle-retry. Replaced the flag with a "last execution activity"
  timestamp: any of `execution_start`, `executing`,
  `execution_success`, `execution_error`, `execution_interrupted`
  updates it; the gate fires `/rescan` once the timestamp is older
  than `executionRescanIdleWindowMs` (default 800 ms). Self-healing
  — if events stop arriving for any reason, the gate opens
  automatically after 800 ms of silence instead of staying stuck.

### Changed
- Preview quality defaults raised. Thumbnails are now 256 px (was
  104 px), WebP `quality` is `82` (was `42`), WebP `method` is `4`
  (was `0`), waveforms are 768×320 px (was 384×200 px), 3D capture
  is 480 px (was 320 px). Visible difference on HiDPI / retina
  displays — previous numbers were sized for non-retina screens and
  were noticeably soft on modern monitors. Cache footprint grows
  roughly 5–8× per image (still small in absolute terms — a typical
  256×256 WebP at quality 82 is ~12–25 KB). Hit **Rebuild Cache**
  once to regenerate existing previews at the new quality; new
  assets pick it up automatically.
- Config schema bumped to v17. The v17 migration overwrites the four
  preview keys (`thumbnail_size`, `image_quality`, `waveform_width`,
  `waveform_height`) with the new defaults so existing installs
  actually receive the bump (the v8 migration had baked the old
  values into every config file).

## [1.1.0] - 2026-05-14

### Fixed
- Autoscan no longer gets stuck when ComfyUI runs a tight queue of
  short prompts. The execution-end debounce in
  `js/ts-artius-browser.js` was a pure trailing-edge debounce: every
  `execution_success` cleared the pending 1200 ms timer and started a
  new one, so a stream of executions with inter-prompt gaps below
  1200 ms could starve the rescan indefinitely. Added a maximum
  deferral cap (`executionRescanMaxDeferralMs`, default 5000 ms) so
  the timer is guaranteed to fire even during a continuous burst.

### Added
- Execution-state idle gate around the rescan POST. The frontend now
  tracks `execution_start` / `execution_success` / `execution_error`
  and only fires `/asset_browser/rescan` when ComfyUI is idle. If the
  debounce timer expires mid-execution, it re-arms on a short retry
  interval (`executionRescanIdleRetryMs`, default 250 ms) instead of
  hitting the backend during sampling. Net effect: zero rescan
  traffic while a workflow is actively running; one rescan ~1.2 s
  after the queue settles. Degrades to the prior debounce behaviour
  on ComfyUI builds that do not emit `execution_start`.

## [1.0.0] - 2026-05-13

### Added
- `.comfyignore` at the repository root. Excludes `tests/`, `scripts/`,
  `.github/`, and `.pre-commit-config.yaml` from the published archive
  so the Comfy Registry security scanner stops flagging Playwright /
  subprocess usage in dev-only tooling. Pack size shrinks too. No
  runtime change for end users.

## [0.9.0] - 2026-05-08

### Fixed
- Image lightbox no longer shows ComfyUI node IDs (e.g. `"28"`, `"39"`)
  in place of prompts when the PNG `Prompt` chunk has no literal
  `inputs.text` strings — the fallback walker in
  `tsab/media/prompt_metadata.py` now skips ComfyUI link tuples
  `[node_id, output_index]` instead of treating their string node ID as
  a prompt value. Affects workflows where the prompt is produced
  dynamically (Qwen-VL-style nodes, primitive-fed CLIP encoders, etc.).

### Changed
- `prompt_parts_version` bumped from `3` to `4`. `TSEnsureMetadata`
  re-extracts image metadata for previously-indexed assets on the next
  lightbox open, so users recover automatically without a manual
  Rebuild Cache.

## [0.8.0] - 2026-05-07

Modernization-plan landing, README rewrite, and re-publish on Comfy
Registry with a clean commit history (the earlier `v0.7.0` tag was
withdrawn).

### Added
- Sidebar **version label** rendered next to the title (e.g. `v0.8.0`),
  with a daily `New version available` chip when a newer release ships.
- `GET /asset_browser/version` endpoint and `tsab/ts_version.py`: reads
  the local pack version from `pyproject.toml`, fetches the remote
  `pyproject.toml` from `main` (24 h cache), reports `update_available`.
- `.pre-commit-config.yaml` with six project-specific guards: no `torch*`
  in `requirements.txt`, no runtime `print()` in `tsab/`, no `LiteGraph`
  / `app.canvas` / `app.graph` access outside the workflow adapter, no
  `comfy_api.latest` import, no native node ID literals outside
  `js/ts-artius-browser-settings.js`, no `os.getcwd` outside
  `tsab/ts_storage.py`.
- `.github/workflows/test.yml` that runs `scripts/check_release.py` on
  every push and pull request across Linux + Windows on Python
  3.10 / 3.12.
- `.github/ISSUE_TEMPLATE/bug.yml` with structured bug-report fields
  (versions, install type, OS, browser, ffmpeg, repro, server log,
  DevTools log).
- Local-only test suites: `tests/integration/` (pytest, 18 HTTP route
  tests against a live ComfyUI) and `tests/e2e/` (Playwright, 5 native
  node ID + version smoke tests).

### Changed
- Pinned `comfy_api` import to the versioned subpackage
  `comfy_api.v0_0_2` (was `comfy_api.latest`, which is officially marked
  unstable). Available since ComfyUI v0.19.0.
- `pyproject.toml`: bumped `version` to `0.8.0` (semver), added `readme`,
  `[project.urls]` `"Bug Tracker"`, and
  `[tool.comfy] requires-comfyui = ">=0.19.0"`.
- `js/ts-artius-browser-api.js`: replaced literal `"Load3D"` in
  `tsSyncNative3DNode` with
  `tsNativeWorkflowTargets["3d"]?.tsNodeType`, keeping
  `js/ts-artius-browser-settings.js` as the single source of truth for
  native node IDs.
- `scripts/check_release.py`: `git diff --check` now passes
  `core.whitespace=cr-at-eol` so CRLF working trees on Windows stop
  tripping the trailing-whitespace rule.
- **README**: rewritten with a friendlier tone, badges, emoji-tagged
  sections, collapsible feature blocks, and a hero-style header.
  Multilingual short sections kept (es / zh / de / it / fr / pt / ja /
  ko) but unified in style.

### Fixed
- `tests/test_asset_payload.py` and `tests/test_asset_catalog.py` now
  assert the current `preview_url` cache-busting contract
  (`?v=<preview mtime_ns>`) instead of the legacy `?v=<preview_path>`
  format.

## [0.7.0] - 2026-05-03

Baseline release. See `git log` for prior commit-level history.

### Added
- Per-section tree-panel column width — Assets and Workflows tabs persist
  independently (`ui.asset_tree_panel_width`, `ui.workflow_tree_panel_width`,
  range 120–700px each).
- Resizable tree-panel column (drag the divider to adjust, value persists
  across reloads).
- Donate button and automatic preview cache busting via
  `?v=<preview_file_mtime_ns>` token.
- Stale-while-revalidate response cache and chip-debounce on filter/sort
  changes.
- Companion-image flag stored at upsert/delete (`assets.is_companion_image`)
  instead of a query-time correlated subquery.
- Frontend Comfy-graph adapter (`js/ts-artius-browser-api-workflow.js`)
  — single source of truth for `LiteGraph` / `app.canvas` / `app.graph` access.

### Changed
- Asset listing pagination switched from offset to keyset
  (`after_sort` + `after_id` → `next_cursor`).
- Asset search rejects unsupported `metadata` query param with
  `400 Bad Request`.
- Schema bumped to v10 (companion-image flag stored, FTS filename-only,
  keyset pagination).
- Config schema bumped through v16 (per-section tree widths replace
  the single `tree_panel_width` key from v15).

### Removed
- Tags, rating, `asset_user_fields` table (schema v10).
- `exiftool` dependency from the image pipeline.

[Unreleased]: https://github.com/AlexYez/comfyui-artius-browser/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v1.2.0
[1.1.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v1.1.0
[1.0.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v1.0.0
[0.9.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v0.9.0
[0.8.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v0.8.0
[0.7.0]: https://github.com/AlexYez/comfyui-artius-browser/blob/main/CHANGELOG.md#070---2026-05-03
