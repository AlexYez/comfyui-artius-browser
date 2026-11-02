# Changelog

Release history for **Timesaver Artius Browser**. Entries follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

[Archive and version index](changelog/README.md) · [Project entry](README.md)

## [1.20.3] - 2026-11-02

### Fixed

- Language changes in ComfyUI update the sidebar, hidden/reopened panel, open
  viewer, help, menus and status labels. Switching language preserves media
  elements, playback, zoom and comparison state; stale locale responses cannot
  override a newer selection.
- Completed Chinese and Japanese dictionaries, refined Russian wording and
  added checks for missing translations, duplicate keys and placeholders.

### Changed

- Split user guides and older release notes into linked topic files, keeping
  the root README short and the public integration contract self-contained.

### Removed

- TS Image Studio-specific card buttons, badges and PNG producer-tag parsing after
  the project was retired. Existing images retain ordinary prompt/workflow
  inspection. Generic external actions, panel embedding and preferred loaders
  remain available to other packs.

## [1.20.2] - 2026-10-31

### Changed

- Video comparison uses the available screen area without fixed width or height
  caps. Two clips can switch between side-by-side and wipe comparison while
  keeping their playback position, synchronization and frame controls.
- Autoscan indexes the files from each completed generation while the rest of
  the queue continues. Requests run one at a time, rapid completions are batched,
  and full-directory fallback scans wait until the queue is idle.

### Fixed

- Newly indexed assets now appear in the panel without a manual rescan, with
  the current filters, sort order and selection preserved.
- Different generations finishing less than eight seconds apart no longer
  suppress each other's indexing. A busy indexer retries the named files.

## [1.20.1] - 2026-10-06

### Added

- **Download selected as a ZIP.** Select any mix of images, videos, audio and
  3D models and press the new "Download Selected (N)" button, or right-click
  inside the selection and choose "Download selected as ZIP". Several files
  are packed into one archive and the browser downloads it like any other
  file, with a progress bar; a single selected file downloads as itself.
  Files are stored, not recompressed, so packing runs at disk speed; files
  with the same name from different folders get " (2)", " (3)". Every file is
  checked against the configured roots exactly like a single download; a file
  that has gone missing is left out and reported. The archive is written next
  to the browser's cache, refused when it would leave the drive with less than
  512 MB free, and deleted as soon as the download finishes (or after an hour
  if it never does).

### Changed

- **Players are built for comparing, not just watching.** Videos no longer
  restart by themselves at the end: they stop on their last frame, and a new
  "Loop" toggle (one remembered setting for the video player, the comparison
  and audio) brings repeating back for whoever wants it. Home / End and new
  ⇤ ⇥ buttons jump to the first / last frame. Flipping through videos keeps
  your place: leave a clip paused (on a frame, or on its end) and the next one
  opens paused on the same moment - on its own last frame if you were at the
  end - so you can step through a batch comparing endings; a clip left playing
  lets the next one autoplay as before. In a comparison, End (or the end of
  playback with Loop off) parks every clip on its OWN last frame, even when
  their lengths differ, instead of one clip's timestamp.

## [1.20.0] - 2026-09-23

### Added

- **Show in folder.** Every asset and workflow can now be revealed in the
  system file manager with the file already selected: from the right-click
  menu in both tabs, and from a new button in the lightbox header. Windows
  Explorer, the macOS Finder and any Linux file manager that speaks the
  freedesktop `FileManager1` interface select the file; elsewhere on Linux the
  folder opens. The window opens on the machine that runs ComfyUI, which is the
  user's own in the usual local setup. The path is checked against the
  configured roots exactly like a file download is.
- **Formats the browser cannot show now play and display.** ProRes, DNxHD and
  HEVC clips, AVI and Matroska files, MOVs with PCM sound, OpenEXR renders and
  16-bit/float TIFFs used to open as an empty player or a broken image. The
  lightbox now shows them through a copy ffmpeg makes the first time one is
  opened (H.264 MP4 for video, capped at 1920 px; WebP for stills - a 4-second
  1080p ProRes clip converted in under half a second in testing), cached and
  trimmed to 4 GB.
  The file itself is never touched: download, "open in new tab" and
  drag-and-drop still use the original. If a file the codec list called
  playable still fails in the browser, the lightbox asks for the copy by
  itself. `.tif`, `.tiff`, `.exr`, `.mkv`, `.avi` and `.m4v` are now indexed;
  EXR and TIFF thumbnails go through ffmpeg too, with EXR's linear light mapped
  to sRGB (works with ffmpeg 8, which has the decoder option, and ffmpeg 9,
  which removed it).

### Changed

- **The grid no longer jumps back to the top.** After every generation, every
  time the sidebar was shown again and after a rescan, the grid reset: scroll
  position, selection and every page scrolled through were gone. A refresh of
  the same query now keeps the first visible card in place, the selection and
  the keyboard focus, and new renders simply appear. Switching Assets ⇄
  Workflows returns each tab to where it was; changing the preview size or the
  sidebar width keeps the same cards in view.
- **Faster everywhere the library is large.** The listing query read the
  prompt and workflow text of every matching asset before cutting the page
  (148 MB of workflow JSON on a real 7k-asset library): a page now takes ~1 ms
  instead of ~45 ms, plus composite indexes so sorting no longer builds a
  temporary B-tree. A rescan walks the output folder about 7x faster (one
  system call per file and pathlib overhead removed). Five indexes no query
  used were dropped, which speeds up every scan write and Rebuild Cache.
  Original files are cached by the browser and revalidated instead of being
  downloaded again every time the lightbox shows them.
- **Deleting is honest and safer.** Only the files the backend really moved to
  the trash leave the grid; a file open in another program stays and a warning
  says why. Deleting several files asks first and says how many; "Delete
  Selected (N)" shows the count; every delete confirms with a "Moved to trash"
  message. The X on a card sits apart from Download. A file deleted in the
  lightbox no longer comes back when the list re-syncs.
- **Lightbox.** Videos, audio, 3D models and comparisons are no longer rebuilt
  when the asset's details arrive (a video restarted from 0:00 and downloaded
  again; a 3D model loaded twice). Details are requested in parallel with the
  image decode and are no longer thrown away on every forward step. Space plays
  and pauses; ↑ ↓ step a frame in compare mode too; the mouse Back/Forward
  buttons step through assets; a held arrow over videos no longer starts a
  download per key repeat. Wheel and trackpad zoom scale with the gesture
  instead of jumping a full step per event, and a trackpad pinch zooms the
  comparison instead of the page. A zoom readout, the right cursor, no flicker
  on double-click, a minimap that keeps up with the pointer, and zoom that
  survives a window resize. Videos show their poster while loading, keep their
  shape, loop, and remember volume and mute. The header shows "3 / 120". The
  metadata panel says "Loading..." instead of "No prompt metadata found" while
  the details load, starts at the top for each asset, caps long prompts in
  their own scroll box, and images got a technical block (format, resolution,
  size). The lightbox fades in, closes on a click on the empty stage, and has
  tooltips on its buttons.
- **Keyboard and accessibility.** The lightbox is a proper dialog: focus moves
  in and returns to the card on close, Tab stays inside, and the keys it uses
  never reach ComfyUI underneath (Delete could delete selected graph nodes).
  In the grid, Enter on a toolbar button presses that button instead of
  opening the lightbox; Shift+arrows extend the selection; Esc and a click on
  empty space clear it; the grid scrolls to follow the keyboard and the
  lightbox; Shift-click ranges grow from the anchor, as in a file manager. The
  context menu opens with the Menu key or Shift+F10 and works with the arrow
  keys. Toggles announce their state, card buttons have spoken names, and
  focus rings are visible on the search box, selects and card buttons.
- **Smaller things.** A backend that cannot be reached shows "Could not load
  the library" with a Try again button instead of "Your library is empty"; a
  changed query dims the grid while it loads. "Reset filters" keeps the search
  text. The Filters button shows a dot while filters narrow the grid. The
  search box says what it searches when the Prompt scope is on. Typed filter
  values wait for the whole number before querying. Workflow names sort
  naturally ("shot 2" before "shot 10"). The tree layout follows the panel's
  width, not the window's. Dragging several cards shows how many.
- **Polish.** The lightbox has its own shortcut sheet (`?` or the new `?`
  button in its header), and the panel shows a `?` button for its sheet too.
  Esc in a zoomed picture first returns to the whole picture, the next Esc
  closes; the lightbox now fades out as well as in. A focused slider (the
  compare wipe, the seek bar, the audio waveform) keeps its arrow keys instead
  of stepping to the next asset, and the audio waveform can be scrubbed from
  the keyboard (←/→ 5 s, Shift 15 s, Home/End). Video comparisons got a
  Mute button that shares the remembered volume. Two-finger pinch zooms a
  picture on a touch screen. A 3D model that fails to load offers Try again.
  The sort-direction control is a single button that says what it does
  ("↓ Desc" / "↑ Asc") and flips on click.

### Fixed

- **Stepping through images in the lightbox is now a crossfade instead of a
  cut.** Two things still blinked after 1.19.1. The picture's details arrive a
  moment after every step, and their arrival rebuilt the stage, replacing the
  image a second time (and resetting any zoom); a re-render of the same picture
  now leaves the stage alone. And a hard swap between two pictures reads as a
  flash even when both are decoded: the outgoing picture now fades out over the
  new one, which sits fully opaque underneath, so the blend never dips to the
  background. The fade honours the system's "reduce motion" preference.
