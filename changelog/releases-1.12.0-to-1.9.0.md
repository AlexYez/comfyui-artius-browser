# История релизов 1.12.0 — 1.9.0

[Каталог истории](README.md) · [Текущие записи](../CHANGELOG.md)

Это датированная история, а не описание текущих значений настроек или текущего API. Текст записей сохранён; номера строк и названия удалённых API относятся к указанной версии.

- [1.12.0](#release-1.12.0) — исходная запись релиза.
- [1.11.0](#release-1.11.0) — исходная запись релиза.
- [1.10.2](#release-1.10.2) — исходная запись релиза.
- [1.10.1](#release-1.10.1) — исходная запись релиза.
- [1.10.0](#release-1.10.0) — исходная запись релиза.
- [1.9.1](#release-1.9.1) — исходная запись релиза.
- [1.9.0](#release-1.9.0) — исходная запись релиза.

<a id="release-1.12.0"></a>

## [1.12.0] - 2026-08-08

Two independent lines of work. The browser gained a public integration surface
— other ComfyUI packs can now embed the panel, publish their own commands on an
asset, and tag the renders they produce — all of it optional in both
directions: installed alone, the browser behaves exactly as in 1.11.0. And a
macOS compatibility audit fixed three defects that made the extension quietly
worse on a Mac (search blind to Cyrillic filenames, previews disabled when
ffmpeg came from Homebrew, ghost cards from external drives).

Existing libraries rebuild their search index once at startup (schema 13). No
re-scan, no lost favorites, about 0.3 s for 6 000 assets.

### Added

- `window.tsArtiusBrowser.mountPanel(host)` — embed API that mounts the
  singleton browser panel into a host element and restores it on `unmount()`.
  Added 2026-08-02 by the AI agent building `comfyui-timesaver`'s
  TS Image Studio (its Library tab hosts the panel through this call);
  review alongside that project's `js/_studio/_assets.js`.
- `INTEGRATION.md` — the three seams other packs plug into (embed API,
  external asset actions, the studio tag), with contracts and the rules the
  browser follows. Added 2026-08-03 by the AI agent building `comfyui-timesaver`.
- External asset actions: any pack may publish a command on an asset by
  pushing `{id, label, order, supports(asset), run(asset)}` onto
  `window.tsAssetActions`. Applicable entries appear in the asset context
  menu, above the file commands; `run()` receives
  `{id, filename, url, type, extension}` and may answer
  `{ok, message}` to raise a toast. The browser never learns what an action
  does, so neither side constrains the other's releases. First consumer:
  TS Image Studio's "Restore studio session".
  Added 2026-08-03 by the AI agent building `comfyui-timesaver`.
- Studio session tag: PNGs written by TS Image Studio carry a `ts_studio`
  text chunk, which the scanner now reads into the metadata blob and the
  asset payload exposes as `studio` (`{app, mode, family, family_label,
  backend, seed, steps, cfg, denoise, width, height, lora_count}`). Cards for
  those renders show an accented badge — "Generate · Krea 2 Turbo" — with the
  settings on hover, localised in all four UI languages. Assets from anywhere
  else return `{}` and render exactly as before. `TS_PROMPT_PARTS_VERSION` is
  bumped to 7 so stored blobs re-extract; images indexed earlier pick the tag
  up on their next detail view or after Rebuild Cache.
  Added 2026-08-03 by the AI agent building `comfyui-timesaver`.
- Card buttons for external actions: `R` restores the studio session that made
  a render, `S` sends a picture into the studio's current mode. Each renders
  only while a pack publishes the matching action id (`R` additionally needs
  the asset to carry a studio tag), so with the browser installed alone the
  card is unchanged. `S` is dormant today — the studio withdrew
  `ts-image-studio.use-source`; the branch stays for the next publisher.

### Documentation

- `CLAUDE.md` now covers the integration: §36 states the rules for the three
  seams, §4 lists them among the contracts that may not change silently
  (they live in another repository's code path, where a rename fails without
  an import error), §15 documents the `ts_studio` chunk, §21 the conditional
  `S`/`R` buttons, §9 the runtime-built `studio.mode.*` keys, plus rows in
  both appendices. The README documents the two buttons in all ten language
  sections; `INTEGRATION.md` is now single-language like the rest of the
  public docs.

### Fixed (macOS)

- **Search found nothing for names with `й` or `ё`.** macOS stores filenames
  decomposed, so `мой` on disk is `и` + a combining mark while the search box
  sends the composed form; SQLite's tokenizer folds Latin accents but not
  Cyrillic ones. Indexed text and queries are both normalized now. Existing
  libraries rebuild their search index once at startup (schema 13, ~0.3 s for
  6 000 assets, no re-scan, favorites untouched).
- **Video and audio previews stayed disabled for Homebrew installs.** ComfyUI
  started from Finder or a `.app` does not inherit the shell `PATH`, so ffmpeg
  in `/opt/homebrew/bin` was invisible. Those locations (plus `/usr/local/bin`
  and MacPorts) are now checked directly.
- **Ghost cards from external drives.** macOS writes an `._name` sidecar beside
  every file copied to exFAT/FAT32/SMB volumes; `._render.png` was indexed as a
  broken image. Those sidecars are skipped, as are macOS packages (`.app`,
  `.photoslibrary`, `.fcpbundle`, …) which a walker sees as ordinary folders.
- Workflows whose name contains `:` — legal on macOS — could not be deleted.
  That character is only rejected on Windows now, where it opens an NTFS
  alternate data stream.
- `Cmd`+`←`/`→` (Back/Forward) no longer gets swallowed by the asset grid.
- The same folder added twice as a custom root under different capitalisation
  is recognised as one directory instead of indexing everything twice.

### Fixed

- `check_release.py` failed on the integration commits: the `studio.mode.*`
  keys are built at runtime, so the used-key regex could not see them and
  called them unused. They are allowlisted now, the way the `type.*` chips
  already were.
- The `studio` card field is part of the asset-card contract check, so the
  backend can no longer drop a key the grid reads.
- Documented-version parity now also covers `TS_PROMPT_PARTS_VERSION` and
  scans `INTEGRATION.md`.

<a id="release-1.11.0"></a>

## [1.11.0] - 2026-08-01

Stable release of the 1.10.x line. No code changes since 1.10.2 — the version
is promoted after a full verification pass against a live ComfyUI: the complete
HTTP surface, the schema self-repair against copies of a real 6k-asset
database, concurrent read load during a scan, and the whole GUI suite.

Everything the line introduced is listed under 1.10.0 (favorites, model-name
search, click-to-100% lightbox with navigator, live localization, informative
empty states) and 1.10.1 / 1.10.2 (request-integer bounds, self-repairing
schema probe, scan-toast disarm, thumbnail-backed navigator).

<a id="release-1.10.2"></a>

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

<a id="release-1.10.1"></a>

## [1.10.1] - 2026-07-31

### Fixed
- An out-of-range integer in a request returned `500` instead of `400`.
  Python's integers are unbounded while SQLite's are 64-bit, so a 30-digit
  asset id, pagination cursor or resolution filter reached the database as an
  unbindable parameter. Ids outside the storable range are now rejected as bad
  input and filter values are clamped. Found by a live API sweep; covered by
  new regression tests.

<a id="release-1.10.0"></a>

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

<a id="release-1.9.1"></a>

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

<a id="release-1.9.0"></a>

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
