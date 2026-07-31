# Changelog

All notable changes to **Timesaver Artius Browser** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.10.2] - 2026-07-31

### Fixed
- A damaged cache database could leave the browser permanently broken. SQLite
  does not resolve column references when a view is created, so a missing or
  mis-shaped table behind `assets_view` passed startup silently and then failed
  every listing query with "no such column" — with nothing to repair it. Startup
  now proves the view and the search index are actually readable and rebuilds
  once if they are not. Starred assets are carried across that rebuild.
- The scan-result toast could fire for an automatic scan. Finishing a
  user-started scan while the Workflows tab was open left the toast armed, so
  the next post-generation scan reported numbers nobody asked for.

### Changed
- The lightbox navigator now draws the cached thumbnail instead of the original
  file, so panning a large render no longer keeps a second full-resolution
  bitmap in memory.
- Documented schema and config versions are verified against the code by
  `check_release.py`; the version number was removed from the README file tree,
  where it duplicated the same fact in seven languages and drifted twice.

## [1.10.1] - 2026-07-31

### Fixed
- An out-of-range integer in a request returned `500` instead of `400`.
  Python's integers are unbounded while SQLite's are 64-bit, so a 30-digit
  asset id, pagination cursor or resolution filter reached the database as an
  unbindable parameter. Ids outside the storable range are now rejected as bad
  input and filter values are clamped. Found by a live API sweep; covered by
  new regression tests.

## [1.10.0] - 2026-07-31

### Added
- **Favorites.** A star on every asset card, a `Favorites` filter in the
  toolbar and an entry in the right-click menu. Favorites are stored per file
  path in a table that `Rebuild Cache` deliberately leaves alone, so starring
  survives a full re-index.
- **Model names.** Checkpoints, LoRAs and VAEs are read from the PNG `Prompt`
  data, listed in the lightbox as copyable chips, and indexed for search — the
  opt-in `Prompt` scope now matches prompts *and* model names. Images indexed
  before this release pick the data up when their detail view is opened, or all
  at once via `Rebuild Cache`.
- **Click to 100%.** Clicking an image in the lightbox zooms to true pixel
  scale at the clicked point (clicking again returns to fit), with a navigator
  minimap in the corner for panning large renders.
- **Informative empty states.** A first run explains what gets indexed and
  offers `Rescan`; a fruitless filename search offers to search prompts and
  models instead; an over-filtered view offers a one-click reset.
- **Scan results.** A rescan or cache rebuild you started now reports what it
  found ("12 indexed, 2 removed"). Automatic post-generation scans stay silent.
- **Missing-tool warning.** When ffmpeg/ffprobe cannot be found, the toolbar
  says what that actually costs ("Video and audio previews are disabled") and
  how to fix it, instead of a quiet note. Cards whose preview could not be
  generated now explain why on hover.

### Changed
- The prompt-scope toggle moved inside the search field's right edge, so the
  field keeps the same height as the surrounding controls instead of wrapping
  onto a second row in a narrow sidebar.
- The panel now follows ComfyUI's language setting live, without a page reload,
  and the sidebar entry itself is translated (`Браузер` / `浏览器` / `ブラウザ`).

### Compatibility
- Database schema 12 (additive: `asset_favorites`, `asset_metadata.model_text`,
  a rebuilt full-text index). Existing databases upgrade in place; no re-scan
  is required.
- Config version 20 (adds `ui.asset_favorites_only`, default off).
- New route `POST /asset_browser/favorite/{id}`; `/assets` and `/search` accept
  `favorites=1`.

## [1.9.1] - 2026-07-30

Stability and hardening release: every confirmed finding of a full-project
audit, fixed in one pass.

### Fixed
- A transient SQLite lock at startup (second ComfyUI instance on the same
  `output/`, external tool holding `db.sqlite`) was treated as corruption and
  rebuilt the schema, wiping the whole index cache. Lock errors now propagate
  instead of triggering a rebuild.
- A failed `COMMIT` (full disk, I/O error) left the connection with an open
  transaction, permanently failing every later write on that thread.
- `Rebuild Cache` could interleave with a scan that was scheduled but not yet
  marked running; the reset now runs under the same lock that creates scan
  tasks.
- `Reset` of the index ran each `DELETE` in autocommit; a crash mid-reset could
  leave assets silently unsearchable. The statements now run in one
  transaction.
- The 3D lightbox passed the raw `loadModelInternal` result to `setupModel()`,
  which fails on current ComfyUI builds (wrapper object); it now unwraps the
  result the same way the 3D thumbnail pipeline does.
- Corrupt media retriggered ffmpeg/ffprobe on every detail view (retry storm);
  failed previews and probes are now remembered until the source file changes
  or `Rebuild Cache`.
- Rescanning root A then root B while a scan was running silently dropped A's
  request (single pending slot); queued scan requests are now kept as a list.
- The discovery-time and DB-side companion-image rules disagreed, so an image
  like `final.png` next to `final_preview.mp4` was indexed but never shown.
  Both sides now use the same normalized-stem rule.
- A literal backslash in the search text broke the `LIKE` fallback pattern.
- Two 3D-capture pipelines could briefly capture the same model twice after
  `Rebuild Cache` (double-released claim); capture claims are now owner-tagged.
- `.source.png` temp files abandoned by a killed process are now reclaimed by
  the orphan purge after 24 hours.
- Timed-out external tools could leak pipe handles when the post-kill reap
  itself timed out; a semaphore permit could leak on interpreter shutdown.

### Security / hardening
- Oversized images (>120 Mpx) get a placeholder instead of a full decode
  (decompression-bomb guard for the thumbnail path).
- Workflow deletion re-validates the resolved path against the workflows
  folder (a planted symlink/junction could otherwise redirect the delete) and
  rejects Windows-reserved characters including NTFS alternate data streams.
- `/file` re-checks that the asset still lies inside a currently configured
  root, so rows outliving a removed custom root no longer serve files.
- Body-size caps can no longer be bypassed with chunked transfer encoding.
- Free-text settings values are length-capped before being persisted to
  `config.json`.
- Attribute escaping also covers single quotes; the update badge accepts only
  `https://` URLs.
- The registry publish action is pinned to a commit SHA and publishes only
  when `project.version` actually changed.

## [1.9.0] - 2026-07-28

### Fixed (whole-project review)
- 3D thumbnails never generated on current ComfyUI builds. `loadModelInternal`
  now resolves to a wrapper (`{object, capabilities, adapter}`) rather than the
  Object3D itself; passing that to `setupModel()` threw and corrupted the
  viewer's model state, so every capture failed and every 3D asset kept a
  placeholder. The load result is now unwrapped defensively.
- Typing in the search box or a resolution filter triggered grid shortcuts:
  `?` opened the help overlay instead of inserting the character, the arrow
  keys moved the grid selection instead of the caret, and Enter opened the
  lightbox.
- Every keypress was handled twice while the lightbox was open, so the grid
  selection silently drifted away from the asset being viewed.
- `Rebuild Cache` ran a full `VACUUM` and a recursive cache delete on the
  asyncio event loop, freezing all of ComfyUI for the duration.
- A symlinked asset whose target resolved outside its root aborted the entire
  scan (`ValueError` escaping an `except OSError`).
- An unreadable subdirectory (network share blip, permission error) was treated
  as "everything under it was deleted": the stale-row prune removed those rows
  and purged their previews. The prune is now skipped for any root whose walk
  was incomplete.
- Sidebar tree folder counts included companion images the grid never shows.
- A folder whose name contains `_` or `%` also matched sibling folders
  (unescaped `LIKE` wildcards).
- `TSUpsertAsset` and `TSDeleteAssetIds` wrote across several tables without a
  transaction, so a mid-write failure could leave an asset with no FTS row.
- `fps` stayed unknown for VFR/WebM sources (ffprobe's `"0/0"` short-circuited
  the `r_frame_rate` fallback), which also re-ran ffprobe on every detail view.
- A failed or timed-out ffmpeg left its `.source.png` temp file behind forever.
- The on-demand video poster path skipped the ffmpeg pre-scale, decoding a
  full-resolution frame in PIL.
- Junk input returned `500` instead of `400`: non-decimal Unicode digits in an
  asset id, and huge numeric query params (`OverflowError`).
- One infinite value in a settings POST discarded every other key in the same
  request.
- The date filter interpreted the user's local calendar day as UTC, shifting
  every boundary by the machine's timezone offset.
- Workflow sidecar previews were paired case-sensitively in the UI but trashed
  case-insensitively by the backend, so `X` could delete a preview the card
  never showed as attached.
- Tree → Flat → Tree lost the selected folder; loading straight into the
  Workflows section discarded the restored folder selection.
- The toolbar resizer stopped working after the first sidebar hide/show.
- Stale previews could survive a rebuild: the SWR revalidation diff keyed on a
  field the asset payload never carried.
- A queue-only status event (clear/cancel/reconnect) fired an immediate
  unconditional rescan, bypassing the debounce.
- A missing 3D file reported `500 internal_error` instead of `404`.

### Changed (internal)
- The panel's visible-card 3D queue and the background sweeper now share one
  skip predicate and a cross-pipeline in-flight registry, so a model can no
  longer be captured twice at once (two WebGL contexts, two racing writes).
- Batched row fetch in `TSUpsertAssets` instead of one query per id.
- PNG text chunks are only read when the prompt/workflow keys are absent from
  the header, avoiding a second full decode of every indexed PNG.
- Removed dead code (an unused runtime facade method, a dead CSS rule, an
  unused import) and de-duplicated path normalization.

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

## [1.5.1] - 2026-06-25

### Fixed
- The PNG positive prompt no longer leaks into the negative-prompt panel
  when an image carries both a positive and a negative prompt.

### Changed
- Development-only tooling (`scripts/`, `.comfyignore`,
  `.pre-commit-config.yaml`) and the `test.yml` CI workflow are no longer
  tracked in the public repository. They stay in the private working copy;
  the published package and runtime behavior are unchanged.

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

## [1.3.0] - 2026-06-04

### Fixed
- Toolbar resizer polish (findings #7-#11):
  - `tsApplyToolbarScale` no longer locks the wrap height at
    `60 × scale` when the toolbar hasn't been laid out yet
    (`scrollHeight === 0`). It now skips and lets the `ResizeObserver`
    re-fire once the toolbar paints with a real size.
  - The toolbar `ResizeObserver` now skips before
    `tsState.tsSettingsHydrated` and dedupes against the last observed
    natural height, eliminating the open-sidebar flash from default
    `scale=1` to the persisted scale and the `width: calc(100%/scale)`
    feedback loop that produced sporadic
    `ResizeObserver loop completed` warnings.
  - Drag sensitivity is now a fixed `0.005 scale-units/pixel`
    constant. A full `0.6 → 1.0` range takes ~80 px of drag regardless
    of the current scale, instead of the 1.2.0 behaviour where the
    captured `scrollHeight` shrank with the inverse-scale width and
    the slider felt ~2× more sensitive when growing the toolbar.
  - The `pointerdown` listener on `.ts-toolbar-resizer` is now stored
    and removed in `disconnectedCallback`, matching the
    CLAUDE.md §8 teardown rule for new listeners.

### Changed
- `tsHandleAssetRemoveEvent` now delegates to `tsRemoveItemsByIds`
  instead of duplicating the splice / revision / selection / anchor
  bookkeeping inline. Both code paths (explicit Delete button + the
  backend `tsab:asset-remove` push event) now share one canonical
  removal helper, so folder counts decrement and pagination
  back-fills happen on both paths. Guards stay at the call site:
  the event handler still skips workflow-section and in-flight-scan
  cases.
- Autoscan idle gate switched from event-timing heuristic to
  ComfyUI's `status` event with `exec_info.queue_remaining`.
  Previously the gate used `tsLastExecutionActivityAt` plus an
  800 ms idle window — heuristic that false-fired during long
  sampling between progress events (rescan triggered mid-workflow)
  and false-deferred during very rapid event chains. Now the gate
  reads queue length directly: rescan runs only when
  `queue_remaining === 0`. When the queue drains, the timer also
  fires immediately on the next tick instead of waiting another
  debounce cycle. Removed: `executionRescanIdleWindowMs` setting,
  `tsLastExecutionActivityAt` state, and the `executing` /
  `execution_start` activity-noting listeners that fed it. Old
  installs with the setting in their config silently ignore it.

### Fixed
- Shift-click after delete no longer extends from a stale anchor.
  `tsRemoveItemsByIds` previously only clamped `tsLastSelectedIndex`
  to the new length; if items before the anchor were removed it
  stayed pointing at a different item than the one the user had
  clicked. Now the anchor is reset to `-1` whenever the items array
  changes shape — matching the pre-1.2.0 path
  (`tsFetchAssets(true)`) which also reset it.
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

[Unreleased]: https://github.com/AlexYez/comfyui-artius-browser/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/AlexYez/comfyui-artius-browser/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/AlexYez/comfyui-artius-browser/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v1.2.0
[1.1.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v1.1.0
[1.0.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v1.0.0
[0.9.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v0.9.0
[0.8.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v0.8.0
[0.7.0]: https://github.com/AlexYez/comfyui-artius-browser/blob/main/CHANGELOG.md#070---2026-05-03
