# Artius Browser for ComfyUI

Browse images, videos, audio, 3D assets and workflows from the ComfyUI sidebar. Preview and compare assets, inspect their metadata, and drag them into native loader nodes.

**Start here:** [User guides](guides/README.md) · [Русское руководство](guides/ru.md) · [Integration API](INTEGRATION.md) · [Release history](CHANGELOG.md)

## Install and run

Find **Timesaver Artius Browser** in ComfyUI Manager, or install manually:

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

The command above uses an example ComfyUI installation directory. Restart ComfyUI, hard-refresh the page with `Ctrl+F5`, then open **Browser** in the sidebar. FFmpeg and ffprobe are optional but needed for video/audio probing and previews; see the [English guide](guides/en.md).

There is no separate frontend build: ComfyUI serves the JavaScript modules directly. Package requirements and Registry identity live in [pyproject.toml](pyproject.toml).

## What it does

- **Assets and Workflows** have independent search, view and preview settings.
- **Images:** prompt/workflow inspection, zoom, wipe comparison and a comparison grid.
- **Videos:** shared playback and frame stepping; two-video comparison switches between side-by-side and wipe.
- **Autoscan:** completed generations index their named output files while the queue continues. Full-directory fallback scans wait for an idle queue.
- **Library actions:** favorites, native drag-and-drop, downloads and deletion to the system trash.
- **Language:** follows ComfyUI without a page reload; complete English, Russian, Simplified Chinese and Japanese dictionaries.

Search matches filenames by default; the **Prompt** toggle also searches prompt/model text. The [guides](guides/README.md) cover formats, shortcuts, filters and troubleshooting. Local-only drafts are labelled there; the published behavior is recorded in the [changelog](CHANGELOG.md).

## Repository map and development

| Entry | Purpose |
|---|---|
| [__init__.py](__init__.py) | ComfyUI extension entry point; no custom loader nodes |
| [tsab/](tsab/) | Python routes, indexing, metadata, storage and previews |
| [js/](js/) | Sidebar, media viewers, native integration and localization |
| [INTEGRATION.md](INTEGRATION.md) | Stable contracts for other node packs |
| [.github/workflows/](.github/workflows/) | Public CI and Registry publishing |

Public CI checks Python syntax/lint, JavaScript syntax and release metadata/localization. A version change on `main` triggers the gated Registry publish workflow; publishing requires maintainer credentials.

The owner's full development checkout also contains private `AGENTS.md`, `CLAUDE.md`, `doc/README.md`, `project_memory/MEMORY.md`, `scripts/` and `tests/`. These are intentionally excluded from the public repository. Start with `AGENTS.md` there: it links architecture, build/test/run/release instructions, configuration/log locations and failure diagnosis. The full local gate is `python scripts/check_release.py`; its scripts and test suites are not included in a public clone.

Keep filesystem containment, trash-only deletion, stable native integration and separate Assets/Workflows state intact. For a typical missing-output problem, check Autoscan, the selected root and active filters, then use **Rescan**; collect [diagnostics](guides/README.md#diagnostics) if the failure persists.

## License

[MIT](LICENSE.txt). [Repository and issue tracker](https://github.com/AlexYez/comfyui-artius-browser).
