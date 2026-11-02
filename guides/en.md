# Artius Browser — English

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

For a persistent failure, collect the [server and browser diagnostics](README.md#diagnostics).

> **Artius Browser** lives in your ComfyUI sidebar and makes it painless to find,
> preview, drag, and load assets — images, videos, audio, 3D models, and
> workflow files. It stays fast on huge libraries and uses native ComfyUI
> behavior wherever it can.

### ✨ Highlights

| | |
|---|---|
| 🖼️ **Images** | Cached thumbnails, PNG prompt + workflow extraction, lightbox with wipe / 2×2 grid compare, zoomed in step |
| 🎬 **Videos** | Frame-stepping, codec / FPS / duration / audio info, embedded prompt + workflow, sync compare for 2-4 clips |
| 🎵 **Audio** | Waveform preview, transport controls, channel layout |
| 🎲 **3D** | Native ComfyUI 3D viewer in the lightbox, captured 3D thumbnails |
| 📜 **Workflows** | Reads ComfyUI's native workflow folder, sidecar previews, drag-to-load |
| 🪟 **Two tabs** | `Assets` and `Workflows` with **independent** state (search, sort, view, preview size, tree-panel width) |
| 🔍 **Filename-first search** | Fast and predictable by default; one toggle inside the search field extends it to prompts and model names |
| ⭐ **Favorites** | Star the keepers, filter the grid down to them — survives a full `Rebuild Cache` |
| 🧬 **Model info** | Checkpoints, LoRAs and VAEs read from the PNG prompt, shown in the lightbox and searchable |
| 🔎 **Click to 100%** | One click in the lightbox jumps to true pixel scale, with a navigator minimap for panning |
| 🚀 **Drag-and-drop** | Direct into native `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` nodes |
| 🗑️ **Safe delete** | Sends to system trash via `send2trash` — never hard-delete |
| 🔄 **Autoscan / Rebuild Cache** | Refresh on demand, or rebuild from scratch |
| 🏷️ **Version label + update badge** | Current version next to the title; checks GitHub once a day, surfaces a `New version available` chip when a newer release ships |
| 🧲 **Multi-select drag** | Drag a whole selection onto the canvas — one native node per asset, auto-arranged in a grid |
| 📦 **Download selected** | Select any mix of images, videos, audio and 3D, press `Download Selected` — several files arrive as one ZIP, a single file as itself |
| 📝 **Export prompts**  [local draft](README.md#local-draft-features) | Select images and press `Export Prompts` — one image gives `<name>.txt` with its prompt, several give one ZIP with a `.txt` per image, named after it |
| 📋 **Copy paths**  [local draft](README.md#local-draft-features) | `Copy Path` in the lightbox, or select files and press `Copy Paths` — full paths on the ComfyUI machine, one per line |
| 🔔 **Action feedback** | Toast notifications when a copy / delete / load / rescan succeeds or fails — no more silent failures |
| 🌍 **Localized UI** | Follows ComfyUI's own language setting — English, Russian, Chinese and Japanese ship today |
| ♿ **Accessible grid** | Screen-reader listbox semantics with selection state, plus a keyboard focus ring |

### 📁 Supported formats

- 🖼️ Images: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 Videos: `.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 Formats a browser cannot show by itself (ProRes, HEVC, AVI, MKV, EXR, TIFF) play and display in the lightbox through a copy ffmpeg makes on demand; the file itself is never touched
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Quick start

#### Recommended — via Comfy Registry

…or search **Timesaver Artius Browser** in **ComfyUI Manager**.

#### Manual install

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Then **restart ComfyUI** and **hard refresh** the browser with `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) powers video/audio metadata and the audio waveforms — optional (ComfyUI still starts without it), but recommended:
>
> - **Windows:** `winget install ffmpeg` (or `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Restart ComfyUI after installing, then verify with `ffmpeg -version`.

### ⌨️ Keyboard & card actions

#### Keyboard — asset grid

| Key | Action |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Move the selection |
| <kbd>Enter</kbd> | Open the lightbox *(or load the workflow in the `Workflows` tab)* |

#### Keyboard — lightbox

| Key | Action |
|:---:|---|
| <kbd>Esc</kbd> | Close |
| <kbd>←</kbd> <kbd>→</kbd> | Previous / next asset *(steps frames in video compare mode)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Step one video frame |
| <kbd>Home</kbd> <kbd>End</kbd> | First / last frame of a video (each clip's own, in compare); Loop is off by default, so clips stop on their last frame |
| <kbd>Delete</kbd> | Send to system trash |

#### Card buttons

> These are **buttons on the card** (hover to reveal), not keyboard keys.

| Button | Action |
|:---:|---|
| `P` | Copy prompt |
| `W` | Copy workflow *(only when the PNG actually has workflow data)* |
| `D` | Download |
| `X` | Send to system trash *(only where the root allows deletion)* |

#### Workflow card buttons

| Button | Action |
|:---:|---|
| `L` · double-click | Load workflow into ComfyUI |
| `D` | Download workflow JSON |
| `X` | Trash workflow + matching preview sidecars |

### 🎯 Native ComfyUI integration

This pack doesn't reinvent loaders — it routes drag-and-drop to native nodes:

| Asset type | Native node |
|---|---|
| Image | `LoadImage` |
| Video | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Native frontend workflow loader |

3D files are staged into ComfyUI input storage so the native 3D nodes see them
exactly like files picked from the node UI. The `Workflows` tab reads
`workflows` ([userdata](README.md#released-and-local-changes)) directly — no separate cache, no parallel index.

When another installed pack publishes a better loader, it wins: a video dropped on the canvas becomes a **TS Video Loader** node (from `comfyui-timesaver`) reading the file where it already sits, instead of a copy landing in `input/`. Without that pack, the native node is created exactly as above.

### 🔬 Lightbox tour

<details>
<summary><strong>🖼️ Images</strong></summary>

- Mouse-wheel zoom, left/middle-button pan
- 2-image **wipe** compare with a left-to-right slider
- 4-image **2×2 grid** compare
- Separate `Prompt` and `Negative Prompt` panels
- One-click `Copy Workflow` when the PNG carries it
- Open in new tab, show in folder, download, delete

</details>

<details>
<summary><strong>🎬 Videos</strong></summary>

- Inline playback with current-frame display
- ⬅️ / ➡️ frame-stepping
- Codec, FPS, duration, bitrate, format, audio-track info
- Sync compare for 2, 3 or 4 selected videos with one shared transport (**Compare** button in the toolbar)

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Waveform preview
- Playback controls
- Duration · bitrate · codec · channel layout

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Native ComfyUI 3D viewer in-lightbox
- Technical model info in the sidebar
- No fake texture-sheet stand-in — it's the real thing

</details>

### 🧠 PNG metadata rules

- **Prompt** is read **only** from the PNG `Prompt` field
- **Workflow** is read **only** from the PNG `Workflow` field
- Positive and negative prompts are split before display
- If positive and negative are identical, only the positive is shown
- **Seed** is read from the PNG `Prompt` field and shown in the lightbox (copyable)

### 🛡️ Compatibility & safety

- Drag-and-drop graph access goes through a thin Comfy adapter — current
  canvas APIs preferred, legacy `LiteGraph` paths isolated.
- Asset search is filename-focused. Unsupported `metadata` query params
  return `400 Bad Request` instead of silently doing nothing.
- Asset listing pagination is **keyset-based** (`after_sort` + `after_id`);
  deep pages are O(1) regardless of library size.
- Companion images (PNG sidecars whose stem matches a sibling video / audio
  / 3D asset) are suppressed via a stored flag, not a query-time subquery.
- Frontend listeners are explicitly torn down on stage close / worker stop.

### ⚡ Performance notes

- Filename-only search · compact metadata · compact preview cache
- Virtualized grid · keyset pagination · stale-while-revalidate response cache
  *(LRU 10, 30 s TTL)* for instant filter / sort re-toggles
- Frontend-only workflow browsing · frontend-generated 3D thumbnails persisted to disk
- `ffprobe` + `ffmpeg` run **in parallel per asset** (single Popen pair)
- FFmpeg / ffprobe: Worker pools default to `max(1, min(4, cpu_count() // 2))` — tweak in `config.json`
- Video poster: ffmpeg pre-downscales the captured frame so PIL only LANCZOS-finishes a small image
- WebP previews are written with `method=0` (fastest, visually identical at thumbnail sizes)
- Preview URLs carry the cached file's `mtime` as a cache-buster — no hard refresh after Rebuild Cache
- Optional accelerators:
  - `Pillow-SIMD` — optional Pillow-compatible implementation; actual speed depends on the workload.
  - 🚀 `blake3` — already in `requirements.txt`, avoids the slower `blake2b` fallback

### 🆘 Troubleshooting

<details>
<summary><strong>Some previews look stale</strong></summary>

Hit **Rebuild Cache**. Preview URLs auto-bust the browser cache via an `mtime` token, so a hard refresh is usually unnecessary. If it still looks stale, restart ComfyUI and `Ctrl+F5`.

</details>

<details>
<summary><strong>Video or audio metadata is missing</strong></summary>

You probably don't have `ffmpeg` / `ffprobe` on `PATH`. Install them and restart.

</details>

<details>
<summary><strong>I want a complete reset</strong></summary>

Use Rebuild Cache for index/preview regeneration. A complete directory reset has different data-loss implications: see [reset policy](README.md#сброс-индекса-и-полный-сброс).

</details>

### 🗂️ Runtime layout

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # asset index
├── config.json        # UI + tools settings
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

See [CHANGELOG.md](../CHANGELOG.md). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
