# История релизов 1.19.1 — 1.13.0

[Каталог истории](README.md) · [Текущие записи](../CHANGELOG.md)

Это датированная история, а не описание текущих значений настроек или текущего API. Текст записей сохранён; номера строк и названия удалённых API относятся к указанной версии.

- [1.19.1](#release-1.19.1) — исходная запись релиза.
- [1.19.0](#release-1.19.0) — исходная запись релиза.
- [1.18.0](#release-1.18.0) — исходная запись релиза.
- [1.17.0](#release-1.17.0) — исходная запись релиза.
- [1.16.0](#release-1.16.0) — исходная запись релиза.
- [1.15.0](#release-1.15.0) — исходная запись релиза.
- [1.14.0](#release-1.14.0) — исходная запись релиза.
- [1.13.0](#release-1.13.0) — исходная запись релиза.

<a id="release-1.19.1"></a>

## [1.19.1] - 2026-09-20

### Fixed

- **Stepping through images in the lightbox no longer flashes.** Navigating
  rebuilt the stage, which threw the picture away before the next one was
  readable: measured on a 1.8 MB output, the new image reported itself
  undecoded and zero pixels tall for 30 to 60 ms per step, so the stage
  collapsed and the picture snapped back a frame later. The next file is now
  decoded before the swap and the neighbours are decoded ahead of time, so the
  usual press of an arrow key waits for nothing; a file too slow for that
  delays the picture by at most a moment and never the navigation itself. The
  image element is also given the size the index already knows, so the stage
  keeps its shape even then. Video, audio and 3D are untouched.

<a id="release-1.19.0"></a>

## [1.19.0] - 2026-09-08

An audit of what this pack costs the ComfyUI browser found nothing that slows
the canvas: with a 310-node graph the canvas draws in the same 10 ms whether
the sidebar is open, closed, or scrolling, and twelve idle seconds produce no
long tasks at all. It did find three pieces of work being done for no return,
and those are gone.

### Changed

- **After a generation the browser indexes the files that were just written,
  not the whole output folder.** ComfyUI's own event stream names what each
  node saved, so a handful of `stat()` calls replaces a full walk of the
  output root — measured at 6.7 seconds and 6128 files per generation on a
  real library, on the ComfyUI process, competing with it for CPU. The full
  rescan stays the fallback for anything that cannot be named that way, and
  still owns deletions: startup, the Rescan button, and any generation whose
  outputs the browser could not read.
- **The background 3D-thumbnail sweep stops re-walking a library it has
  already finished.** It asked the server for every 3D asset again on each
  return of window focus, only to discard the ones already captured — dozens
  of requests per alt-tab on a library with a few hundred models. The skip is
  now a server-side filter, and a sweep that reached the end is not repeated
  until a scan brings something new.
- **Workflow video previews play on hover instead of on sight.** Every visible
  card with a video sidecar used to decode continuously for as long as the
  sidebar was open. A resting card still shows its first frame.

<a id="release-1.18.0"></a>

## [1.18.0] - 2026-09-07

Dragging a video onto the canvas made the browser copy the whole file into
`input/` first, because that is the only place the native `Load Video` node
looks. That round trip is gone when TS Video Loader is installed, and when it
is not, a copy that fails no longer leaves a node holding an unrelated file.

### Added

- **Dragging a video onto the canvas uses TS Video Loader when that pack is
  installed.** It reads the file where it already sits, so nothing is copied
  into `input/` and the node opens on its own timeline. Without the pack, the
  native `Load Video` node is created exactly as before.

### Fixed

- **A loader node that could not be filled no longer keeps somebody else's
  file.** The native `Load Image` / `Load Video` / `Load Audio` nodes show the
  first entry of the input directory the moment they are created, so a failed
  copy of the dragged asset into `input/` left a node pointing at an unrelated
  file — looking exactly like the browser had dropped the wrong one. The node
  is now taken back out of the graph and the failure is reported.

<a id="release-1.17.0"></a>

## [1.17.0] - 2026-08-26

Users running ComfyUI and the browser on the same machine reported that a
generation or two in, the next one slows down — and that viewing the library
from a second computer makes the problem go away. An audit found no leak, but
it did find memory this pack was reserving without ever using it, and work it
was asking the server to do twice. Both are gone, and `/version` now reports
the numbers needed to tell whether any of it mattered.

### Changed

- **The cache database no longer reserves memory it never used.** SQLite opens
  one connection per thread and never closes it, and the HTTP routes run on
  Python's default thread pool, so the 8 MB page cache each connection asked
  for was multiplied by roughly 28 — about 220 MB of the ComfyUI process. It is
  2 MB now. Measured on a copy of a real 168 MB, 6 500-asset library, the whole
  panel workload (four pages of scrolling, filename and prompt search, type and
  folder counts) takes the same 155 ms at 7.8 MB per connection as it does at
  0.5 MB, and a 500-row write transaction is flat too. The memory map, which is
  what actually makes those queries four times faster, is untouched.
- **One rescan per browser after a generation, not one per open tab.** The
  post-generation rescan is triggered by the page, so two ComfyUI tabs on one
  machine asked the server to walk the output folder twice. Tabs now agree
  through browser storage on which of them asks. Where storage is unavailable
  every tab still asks, exactly as before.

### Added

- `/version` reports memory diagnostics: resident size of the ComfyUI process,
  thread count, how many database connections are open, and the cache size on
  disk. A "generation got slower" report can now carry numbers.

<a id="release-1.16.0"></a>

## [1.16.0] - 2026-08-26

ComfyUI writes the prompt and the workflow into a generated video exactly as it
writes them into a PNG. The browser had only ever looked at the PNG, so a clip
it produced itself looked like footage from a phone. It reads both now, and a
video card offers the same copy actions a picture does.

### Added

- **Videos carry their workflow too, and now the browser reads it.** ComfyUI
  embeds the prompt and the workflow in a video exactly as it does in a PNG —
  as container tags — but the browser ignored them, so a generated clip looked
  like one dragged in from a phone. Video cards now show the same **P** and
  **W** buttons a picture does when the file actually carries that data, the
  context menu offers the same two entries, and the lightbox shows the prompt,
  the seed and the model list above the technical panel. A clip that carries
  nothing shows nothing, exactly as before.
- Existing libraries pick this up on the next **Rescan**, not only after a full
  Rebuild Cache: a video whose stored metadata predates the change is treated
  as needing a re-read. It runs once per file — extraction stamps the version
  back, including for videos that turn out to have no tags at all.

<a id="release-1.15.0"></a>

## [1.15.0] - 2026-08-26

Comparing two renders usually comes down to one detail somewhere in the middle
of the frame, and until now the compare view could only show them fit to the
screen. Both compare layouts zoom together: the wheel zooms around the cursor,
the keyboard zooms and pans, and one scale drives every image so the same
region stays under inspection in all of them.

### Added

- **Zoomed image comparison.** The wipe and grid compare views now zoom: the
  wheel zooms around the cursor, `+` / `-` zoom from the keyboard, `1` jumps to
  actual pixels and `0` returns to fit, and the arrow keys pan (hold `Shift`
  for a coarse step; in the grid a left drag pans too, and in the wipe view a
  middle drag does, since the left button belongs to the divider). One scale
  and one offset drive every image, because two renders inspected at different
  zooms or different corners are not a comparison. A small readout shows the
  real pixel ratio, so "100%" means one image pixel per screen pixel.
- The wipe divider stays where the slider puts it at any zoom: the clip moved
  from the image onto a layer around it, since a clip-path is resolved in the
  element's own coordinate space and would otherwise slide with the zoom.

### Fixed

- The private test suite had been reporting nineteen skips as a pass. `aiohttp`
  was missing from the development environment, so thirty-seven tests never
  ran; several had drifted out of date behind that skip (a preview URL still
  expecting the pre-mtime cache-busting token, a delegation test still passing
  the offset parameter keyset pagination replaced, a workflow test unaware of
  the symlink containment check). Those expectations are corrected, and the
  aiohttp stubs now install only when the real package is genuinely absent, so
  the suite no longer passes or fails by discovery order.

<a id="release-1.14.0"></a>

## [1.14.0] - 2026-08-10

A hardening release, from a full audit of the pack. Two boundary defects are
closed — 3D staging could copy a file out of a root the user had already
revoked, and an OBJ's fallback material file was the one path that skipped
containment — and the release pipeline no longer allows anything to reach the
Comfy Registry without passing a gate first. The rest is durability: deleting
an asset can no longer be undone by work already in flight, favorites survive a
cache repair that is interrupted, a hand-edited config.json cannot stop the
browser from loading, and a burst of rescan requests cannot grow unbounded.

No schema, config or API change: existing libraries start straight up.

### Security

- **3D staging no longer bypasses the root boundary.** Serving a file
  re-checked that its database row still resolved inside a configured root;
  staging a 3D model for the native Load3D node did not, even though it
  *copies* the file into ComfyUI's input folder. A row outlives its root — a
  custom root removed or disabled stays in the index until the next full scan —
  so that route could still pull a file out of a location the user had already
  revoked. Both paths now go through one authorization helper.
- **An OBJ's same-stem `model.mtl` fallback is contained like every other
  dependency.** Explicit `mtllib` lines were always resolved and checked
  against the model's own folder; the fallback was resolved directly, so a
  symlink of that name pointed anywhere on disk and was staged into the input
  folder alongside the model.

### Fixed

- **Deleting an asset could not be undone by work already in flight.** Detail
  view, preview generation and thumbnail capture read a row, work for as long
  as ffmpeg or a decoder takes, then write it back. Delete took no lock, so a
  delete landing inside that window was overwritten and the card came back for
  a file already in the trash. Delete now holds the same per-asset lock.
- **A failed workflow deletion no longer takes the previews with it.** The
  workflow JSON and its sidecars were trashed in one best-effort loop, so a
  workflow that could not be deleted still lost its preview images. The JSON
  goes first and its failure aborts the operation.
- **Favorites survive a cache-database repair that is interrupted.** The
  corruption fallback carried starred paths in memory across drop → create →
  restore; a disk error or a killed process in that window lost them for good.
  They now cross through a holding table the rebuild does not drop, restored on
  the next start.
- **A hand-edited config.json can no longer stop the browser from loading.**
  Section shape was validated, the values inside were not, so
  `"ffprobe_workers": "fast"` raised while the extension was being constructed
  and ComfyUI started without the browser at all. Every runtime number and flag
  is now coerced and clamped in one place, including `"false"` — a string
  Python considers true.
- **Rescan requests are validated and the queue is bounded.** `scope` and
  `root_id` are checked against what can actually exist, and a burst of
  distinct requests during a long scan collapses into a single full scan
  instead of growing a list and running a long tail of scans nobody waited for.

### Changed

- Nothing reaches the Comfy Registry without passing a gate. Publishing ran in
  its own workflow with no dependency on CI, so a manual run — or any push that
  changed the version — could publish unverified code. `publish_action.yml` now
  carries a release-gate job (byte-compile, ruff, `node --check` on every
  frontend module, locale-key parity, registry metadata) and the publish job
  runs only after it passes.
- Ruff is pinned in both workflows: an unpinned "latest" turns a new upstream
  rule into a failed release with no change of ours behind it.

### Documentation

- The feature table claimed English and Russian; the pack ships English,
  Russian, Chinese and Japanese, all complete. Corrected in all ten language
  sections.

<a id="release-1.13.0"></a>

## [1.13.0] - 2026-08-09

Synchronised video compare, rebuilt. Selecting two, three or four clips now
plays them against one shared clock that holds them within a few hundredths of
a second of each other, waits together when one has to buffer, and steps frame
by frame exactly. The mode is also findable now: a Compare button sits in the
toolbar instead of the feature hiding behind a double-click.

### Added

- Compare now takes **three** clips as well as two or four, and a **Compare**
  button sits in the toolbar next to Delete Selected. It stays visible while
  the selection is too small — disabled, with a tooltip explaining that 2-4
  images or videos can be compared — because the feature was previously
  reachable only by knowing to double-click one of several selected cards.
  Three clips are laid out in a single row so all three keep the same width.

### Fixed

- **Videos in compare mode drifted apart and appeared to freeze.** Three
  separate causes, all fixed:
  - The correction loop ran on `requestAnimationFrame`, which a browser stops
    entirely once its tab is not in the foreground. The clips kept decoding
    while nothing was correcting them, so they drifted for as long as you were
    looking elsewhere and then jumped when you came back. It runs on a timer
    now, and re-aligns once when the tab becomes visible again.
  - Any drift at all was corrected by seeking, and a seek on a playing video
    flushes its decoder — the "freeze" was often the fix, not the fault. Drift
    under 350 ms is now absorbed by nudging playback rate, which is invisible;
    seeking is reserved for drift no viewer would miss anyway.
  - A clip that had to buffer was left behind by the others. The group now
    waits together (with a "Syncing clips..." note) and restarts together. A
    clip that is shorter than the rest, or that the browser cannot decode at
    all, is parked instead of holding everyone up.
- **Frame stepping could stall or skip.** Stepping added ±1/fps to the raw
  playback position, and rounding could land back inside the frame it started
  on. Steps are now computed from the frame index, so each click moves exactly
  one frame, in both directions, and every clip lands on the same timestamp.
  Pausing or scrubbing snaps the group to an exact common position.

### Changed

- Importing the package no longer does anything. The runtime — storage
  directories, the SQLite connection, the route table, the scan service — is
  now built in `ComfyExtension.on_load()`, ComfyUI's designated one-time
  initialization hook, which the host awaits immediately after
  `comfy_entrypoint()` and still before the HTTP server starts serving. A
  failure during startup is now reported against this extension instead of
  surfacing as an unrelated import error.
- Declared frontend compatibility: `comfyui-frontend-package>=1.42.10`, the
  version ComfyUI 0.19.0 ships (matching the `requires-comfyui` floor), tested
  up to 1.48.7. A lower bound only — the frontend can be switched
  independently of the backend, and an upper bound would let installing this
  pack downgrade a whole ComfyUI frontend.
- `.comfyignore` is tracked, so it finally applies. Being itself gitignored, it
  never reached the checkout the registry archive is built from and had no
  effect; it now lists the one dev-only path that IS tracked (`.github/`)
  instead of paths that were never published in the first place.
