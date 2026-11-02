# История релизов 1.8.0 — 1.4.0

[Каталог истории](README.md) · [Текущие записи](../CHANGELOG.md)

Это датированная история, а не описание текущих значений настроек или текущего API. Текст записей сохранён; номера строк и названия удалённых API относятся к указанной версии.

- [1.8.0](#release-1.8.0) — исходная запись релиза.
- [1.7.0](#release-1.7.0) — исходная запись релиза.
- [1.6.4](#release-1.6.4) — исходная запись релиза.
- [1.6.3](#release-1.6.3) — исходная запись релиза.
- [1.6.2](#release-1.6.2) — исходная запись релиза.
- [1.6.1](#release-1.6.1) — исходная запись релиза.
- [1.6.0](#release-1.6.0) — исходная запись релиза.
- [1.5.1](#release-1.5.1) — исходная запись релиза.
- [1.5.0](#release-1.5.0) — исходная запись релиза.
- [1.4.1](#release-1.4.1) — исходная запись релиза.
- [1.4.0](#release-1.4.0) — исходная запись релиза.

<a id="release-1.8.0"></a>

## [1.8.0] - 2026-07-28

### Added
- Date + resolution filter panel (assets): a collapsible Filters row exposes a
  date range and min/max width/height, persisted per new config keys. The
  listing route already accepted these params.
- Opt-in prompt search: a "Prompt" toggle next to the search box also searches
  inside prompts (FTS `prompt_text` column, schema v11, migrated from existing
  rows without a re-scan). Search stays filename-only by default.
- Right-click context menu on cards (copy prompt / copy workflow / download /
  open in new tab / delete) as larger, discoverable targets.
- "?" opens a keyboard-shortcut help overlay.
- Chinese (zh) and Japanese (ja) localizations, following ComfyUI's locale.
- First-load skeleton grid with a one-shot fade when real cards arrive.
- `POST /asset_browser/client_log`: recent frontend warnings are mirrored to a
  bounded backend ring and surfaced in `/version` diagnostics for
  self-contained bug reports.

### Fixed
- The card context menu was dismissed by a click inside it (shadow-DOM
  retargeting), so menu actions never fired; now uses `composedPath()`.
- First-load skeletons no longer stick when a search or filter legitimately
  returns zero results.

### Changed
- Shared `tsEscapeHTML`/`tsEscapeAttribute` (deduplicated into `api-utils`).
- Lightweight typing: mypy --strict over a curated set of pure modules, ruff,
  and a locale-orphan-key check, all wired into the release gate.
- A Playwright GUI e2e suite (opt-in) covering the filter panel, context menu,
  shortcut overlay, search scope, plus a screenshot-capture spec.

<a id="release-1.7.0"></a>

## [1.7.0] - 2026-07-23

### Added
- User-facing toast notifications (via ComfyUI's native toast service) for the
  common actions that previously failed silently: copy prompt / workflow,
  delete asset or workflow, load workflow, rescan, and rebuild cache. The helper
  is a safe no-op on ComfyUI builds without the toast service.
- Russian localization (`ru.json`). The panel now follows ComfyUI's own locale
  automatically (falling back to the `ui.language` config value, then English),
  so a Russian ComfyUI shows a Russian panel.
- Multi-asset drag-and-drop: dragging a card that is part of a multi-selection
  drops every selected asset onto the graph, one native node per asset, laid out
  in a grid from the drop point. Single-asset drag is unchanged.
- A bounded in-memory ring of the most recent non-fatal warnings, captured
  regardless of the debug console flag and exposed as
  `window.tsArtiusBrowser.getRecentErrors()` / `window.__tsArtiusErrors` for
  self-contained bug reports.
- Accessibility: the asset grid is now a `listbox` and each card an `option`
  with `aria-selected`, and the panel shows a keyboard focus ring.
- Continuous integration (`.github/workflows/ci.yml`): byte-compiles and lints
  the backend (ruff) and syntax-checks every frontend module on push / PR.

### Fixed
- The lightbox delete action now handles a failed delete (toast + no-op) instead
  of leaving an unhandled promise rejection and a stale on-screen asset.

### Documentation
- Corrected the README in all ten languages: `P` / `W` / `D` / `X` / `L` were
  documented as *keyboard shortcuts*, but they are labels on the card's hover
  buttons — pressing those keys never did anything. Each language now lists the
  real keyboard shortcuts (arrows / `Enter` in the grid; `Esc`, arrows and
  `Delete` in the lightbox) separately from the card buttons.

<a id="release-1.6.4"></a>

## [1.6.4] - 2026-07-18

### Fixed
- Opening the detail view / lightbox for an image with no PNG prompt metadata
  no longer re-reads the file, re-writes its database row and re-emits an
  asset-upsert event on every single open. The empty metadata blob is now
  treated as a finished state; the one-time `prompt_parts_version` 5 upgrade for
  images that do carry prompt data is unchanged.
- Stale-while-revalidate no longer collapses the asset grid back to the first
  page (losing the scroll position) when a revalidation completes after the user
  has scrolled and appended more pages.
- The `GET /asset_browser/version` remote check no longer serializes concurrent
  callers on the network round-trip: the HTTP fetch now runs outside the cache
  lock.
- End-of-scan orphaned-preview reconciliation now skips preview files younger
  than 10 minutes, so a preview generated on demand mid-scan is not deleted as a
  false orphan and immediately regenerated.
- Batch asset upserts now recompute the `is_companion_image` flags inside the
  same transaction, so the flags always commit atomically with the rows they
  describe.

### Changed
- Per-asset and per-preview-key locks are now reference-counted and reclaimed
  when released, so their registries no longer grow for the lifetime of the
  process on very large libraries.
- Internal cleanup: removed dead front-end settings (`previewWarmup`,
  `threeDThumbnails.idlePollMs`) and an unused preview-normalization parameter;
  decoupled `Content-Length` parsing from asset-id parsing; asset URLs in the
  lightbox stage markup are now HTML-attribute-escaped for consistency with the
  surrounding attributes.

<a id="release-1.6.3"></a>

## [1.6.3] - 2026-07-07

### Added
- The `GET /asset_browser/version` response now carries a `diagnostics` block
  (database schema version, config version, resolved `ffmpeg` / `ffprobe`
  paths, indexed asset counts) so a bug report can include environment state
  without shell access. The existing version fields are unchanged.
- Verbose logging and the scan progress console are now runtime-toggleable
  without editing source: `logging.enable_verbose` /
  `logging.enable_progress_console` in `config.json`, or the
  `TS_ARTIUS_VERBOSE` / `TS_ARTIUS_PROGRESS_CONSOLE` environment variables
  (which override the config). Defaults are unchanged (verbose off, progress
  on).

### Changed
- An unhandled server error in any of the browser's own routes now returns a
  clean `500 {"error": "internal_error"}` JSON response and a logged warning
  instead of leaking a stack trace or a broken half-response.
- The scan's hashing phase is pipelined with a sliding window instead of a
  per-batch barrier, so one slow video no longer stalls a batch of fast
  images. Behavior and results are unchanged; large libraries index more
  evenly.
- Orphaned preview files left behind by a crash or an interrupted scan are now
  reconciled against the database and removed at the end of a full scan
  (never on the per-generation autoscan), keeping the preview cache compact.

### Internal
- Extracted the panel's 3D-thumbnail capture queue and its inline CSS into
  their own modules, and made the per-section (Assets/Workflows) settings sync
  table-driven. No user-visible behavior change; covered by new
  characterization checks and unit tests.

<a id="release-1.6.2"></a>

## [1.6.2] - 2026-07-05

### Fixed
- A cancelled asset drag (Esc, or dropping outside the graph) no longer
  hijacks the next thing dropped onto the canvas. The drag-payload fallback is
  now cleared on drag end, so an OS file or workflow dropped later is handled
  natively by ComfyUI instead of re-inserting the previously dragged asset.
- Opening asset details no longer fails with a server error when the source
  file vanished mid-request, the image is corrupt, or the asset's root was
  removed from the config. The detail view degrades to the stored card data
  and the preview route falls back to the type placeholder.
- Duplicate files (identical content) indexed in the same scan batch no longer
  race each other while generating their shared preview, which could persist a
  corrupt thumbnail. Preview generation is now serialized per preview key.
- Startup no longer walks the whole library twice: the frontend's initial
  rescan checks the scan status first and skips when the backend's own startup
  autoscan is already running or has just finished. Rescan-on-page-reload for
  a long-running server is preserved.

### Changed
- Removed dead internal helpers and constants; backend asset events are
  emitted via the shared event-name constants.

<a id="release-1.6.1"></a>

## [1.6.1] - 2026-07-02

### Fixed
- Fixed a renderer memory/GPU churn that could crash the browser tab on
  libraries with 3D models. Newer ComfyUI frontends stopped returning the
  model from `loadModelInternal`, so every 3D thumbnail capture fully loaded
  the model (WebGL context + parse) and then discarded it as a failure; the
  failure list was also cleared after every scan, so the post-generation
  autoscan re-loaded every uncapturable model after each prompt. Captures now
  read the loaded model back from the model manager (thumbnails work again on
  current frontends), failed captures are capped at two attempts per page
  load, sweeps no longer start in a hidden tab, and a context-loss fallback
  releases the WebGL context even if the viewer's own dispose fails.

<a id="release-1.6.0"></a>

## [1.6.0] - 2026-07-02

### Added
- The image lightbox now shows the generation **seed** parsed from the PNG
  `Prompt` field (sampler `seed` / `noise_seed`), with a one-click copy
  button. Existing images pick it up on first open — no cache rebuild needed.

### Fixed
- Freshly generated images now appear reliably after ComfyUI finishes a
  prompt. A response-cache invalidation that raced an in-flight request could
  re-store a stale asset list and suppress the follow-up refresh; cache writes
  are now gated on a cache epoch so a pre-invalidation response is discarded.
- The lightbox metadata panel (prompt / negative prompt / seed / technical
  info) no longer stays blank when a page prefetch renders concurrently with
  the detail fetch. The detail-request token is kept monotonic instead of
  being reset during stage teardown.
- The gallery and toolbar resize observers are re-attached when the sidebar
  tab is shown again, so toolbar height keeps tracking layout after switching
  tabs away and back.
- 3D-capture detection for card previews is anchored to the preview filename
  suffix instead of a path substring, so a normal preview can no longer be
  mislabeled as a 3D capture.

### Changed
- On Windows, `ffmpeg` / `ffprobe` are spawned with `CREATE_NO_WINDOW`, so
  indexing a library no longer flashes console windows over ComfyUI.
- Removed unused internal helpers and routed the last graph/canvas access
  through the sanctioned Comfy adapter module.

<a id="release-1.5.1"></a>

## [1.5.1] - 2026-06-25

### Fixed
- The PNG positive prompt no longer leaks into the negative-prompt panel
  when an image carries both a positive and a negative prompt.

### Changed
- Development-only tooling (`scripts/`, `.comfyignore`,
  `.pre-commit-config.yaml`) and the `test.yml` CI workflow are no longer
  tracked in the public repository. They stay in the private working copy;
  the published package and runtime behavior are unchanged.

<a id="release-1.5.0"></a>

## [1.5.0] - 2026-06-19

### Fixed
- 3D assets are staged into per-source subfolders, so identically named
  models from different folders no longer collide when dragged into a
  native `Load3D` node.
- The global 3D thumbnail worker no longer recreates a WebGL viewer for
  models it already failed to capture. A corrupt or unsupported model
  previously got a fresh WebGL context on every window-focus sweep, which
  could exhaust GPU contexts and crash the renderer.
- Panel resilience: staggered sidebar refreshes, recovery after a failed
  rescan, and a bounded 3D capture cache.
- Settings hardening: config-store locking, external-tool re-probe on
  scan, and GET-side UI-settings normalization.
- Lightbox media is released when the viewer closes, the grid refreshes
  when returning to the browser tab, and toolbar height is hardened.
- Miscellaneous request/payload hardening.

### Performance
- Scan upserts skip a redundant per-row refetch, and bulk deletes are
  batched into fewer database operations.

### Changed
- Companion images are excluded from scan summary counts. Dead backend
  methods and the unused 3D warmup path were removed.

<a id="release-1.4.1"></a>

## [1.4.1] - 2026-06-11

### Fixed
- Asset detail, preview, file, delete, workflow delete and 3D
  thumbnail/stage route handlers now run their synchronous work via
  `asyncio.to_thread` instead of on the aiohttp event loop. On-demand
  indexing in that path can hash a whole media file, run
  ffprobe/ffmpeg (120-180 s timeouts), generate previews and call
  `send2trash`; previously this froze the entire ComfyUI web server
  (all routes and websocket progress) for the duration.
- A scan no longer treats an unavailable `output`/`input` root
  (unplugged external drive, network share down) as "all assets
  deleted". Roots whose directory is missing are skipped from both the
  walk and the stale-row prune with a warning, instead of wiping the
  root's index rows and purging its cached previews. Custom roots
  already had this protection.
- `TSDeleteAssetIds` now chunks its `IN (...)` clauses at 500 ids.
  Mass prunes above SQLite's 32766-variable limit (e.g. moving a very
  large folder out of a root) previously failed every scan with
  "too many SQL variables" until a manual cache rebuild.
- Folder tree markup now escapes folder paths, tree keys and root ids
  in data attributes, and the root selector escapes root labels/ids in
  its options. Folder names containing a double quote (legal on
  Linux/macOS) previously broke the tree row markup.
- The Rescan button with "All Folders" selected now asks the backend
  to scan every configured root (output, input, custom) as the tooltip
  promises, instead of silently scanning only `output`. Automatic
  rescans (startup bootstrap, post-execution) keep their explicit
  output-only behavior.

### Performance
- Added an index on `assets.preview_path`. Preview reference counting
  (`TSCountPreviewReferences`) runs per changed file during scans, per
  pruned row and per deleted asset, and previously did a full table
  scan each time — seconds of extra CPU per rescan on 100k-asset
  libraries. Existing databases pick the index up automatically on the
  next startup; no rebuild needed.

<a id="release-1.4.0"></a>

## [1.4.0] - 2026-06-07

### Changed
- Audio waveform previews are now rendered as SoundCloud-style discrete
  vertical bars filled with a greenish-steel vertical gradient, replacing
  the continuous filled wave. The bars are generated by post-processing the
  `ffmpeg showwavespic` output in Pillow (per-bucket mean alpha drives each
  bar height), kept on a transparent background so the theme shows through.
  The same cached preview feeds both the asset card grid and the lightbox
  audio player. Run **Rebuild Cache** to restyle already-cached audio.

### Added
- README now documents how to install FFmpeg on Windows / macOS / Linux and
  clarifies that `ffmpeg` + `ffprobe` are optional but recommended (they power
  video/audio metadata and the audio waveforms), across all language sections.
