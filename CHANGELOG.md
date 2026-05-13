# Changelog

All notable changes to **Timesaver Artius Browser** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/AlexYez/comfyui-artius-browser/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v1.0.0
[0.9.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v0.9.0
[0.8.0]: https://github.com/AlexYez/comfyui-artius-browser/releases/tag/v0.8.0
[0.7.0]: https://github.com/AlexYez/comfyui-artius-browser/blob/main/CHANGELOG.md#070---2026-05-03
