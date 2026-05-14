---
name: Hard invariants — must not break casually
description: Compatibility-critical rules from AGENTS.md and doc/ — public identifiers, payloads, and behaviors that require migration plans before changing
type: project
originSessionId: a2d6a6c9-e2d8-46d7-87d2-82cc7de3c081
---
These rules come from AGENTS.md §4 + §5 + §16 and `doc/LLM_TECHNICAL_GUIDE.md` §16.

**⚠ As of 2026-05-03 the project is in DEVELOPMENT MODE — see [dev_mode.md](dev_mode.md).** Compat-driven rules in this file (identifiers, payload field names, schema, cache paths, etc.) are RELAXED — they may change freely without migrations. **The behavioral / product / safety invariants below stay strict** because they are product decisions, not compatibility decisions.

**Why this list still matters even in dev mode:** behavioral rules (filename-only search, PNG metadata source-of-truth, native Comfy integration, delete-to-trash, etc.) are correctness guarantees, not compat shims. Breaking them silently corrupts UX or breaks Comfy integration regardless of who the user is.

**How to apply:**
- Identifier/payload/schema changes — proceed without compat aliases (dev mode). Update both ends of the contract in the same change.
- Behavioral invariants (§"Behavioral invariants" section below) — surface explicitly before changing.

## Identifiers / contracts that must NOT change without migration

- ComfyUI extension id (`timesaver.artius.browser`)
- Sidebar id (`timesaver-artius-browser`)
- Project / publisher / display name in `pyproject.toml`
- Route URLs under `/asset_browser/...` (also registered as `/api/asset_browser/...`)
- JSON API payload field names
- `config.json` keys (current version: `13`)
- SQLite table and column names
- `assets.is_companion_image` flag stays a stored, index-filtered column. Listing must never reintroduce a query-time correlated subquery over `assets_view`.
- Asset listing pagination is keyset-only (`after_sort` + `after_id` ↔ `next_cursor`). No `offset`.
- Tags / rating / `asset_user_fields` were dropped in schema v10. No user-annotation surface today.
- Frontend localStorage / sessionStorage keys
- CSS class names used cross-module
- DOM ids used cross-module
- Localization keys
- JS exported function names used by other project files
- Python function/class names used cross-module
- Cache directory names (`.ts_artius_browser/...`)
- Preview filename conventions
- Workflow sidecar naming
- Supported file extensions (image: `.png .jpg .jpeg .webp .avif`; video: `.mp4 .mov .webm .prores`; audio: `.mp3 .wav .flac .opus .ogg`; 3d: `.glb .obj`)
- Drag-drop MIME: `application/x-timesaver-artius-asset`
- Delete-to-trash semantics (uses `send2trash`)

If a rename is unavoidable: keep alias, add migration, keep old configs/DBs readable, document, add tests.

## Behavioral invariants

1. **No custom workflow loader nodes** — native Comfy: `LoadImage`, `LoadVideo`, `LoadAudio`, `Load3D`. `TSArtiusBrowserExtension.get_node_list()` returns `[]`.
2. **Filename-only search** — never silently expand to prompt/metadata. The `metadata` query param is rejected with `400 Bad Request` (`TSRejectUnsupportedAssetQueryParams`).
3. **No seed field** — do not reintroduce.
4. **PNG metadata source-of-truth:** prompt from PNG `Prompt` field; workflow from PNG `Workflow` field. Negative prompt parsed from same `Prompt`. Hide negative if it normalizes to identical positive.
5. **3D thumbnails are frontend-captured** — backend never renders true 3D thumbnails. Capture requires open ComfyUI page (browser-side WebGL).
6. **3D drag-drop stages files** into `<input>/3d/.ts_artius_browser/...` so native `Load3D` can find them. `.obj` deps stay together.
7. **Companion images stay hidden** — sidecar previews for video/audio/3D don't appear as standalone image cards.
8. **Delete uses system trash**, not permanent deletion. Cache files may be cleaned directly.
9. **`Workflows` tab is frontend-only** — reads `GET /v2/userdata?path=workflows`. Never enters asset DB or browser cache. Searches by filename only. Sidecar previews matched by stem.
10. **`Assets` and `Workflows` keep separate persisted UI state** — search, sort, preview size, Flat/Tree mode, selected folder.
11. **Workflow loading uses native `app.loadGraphData(..., workflowStorePath)`** when available so save-back stays attached to the original file.
12. **Companion-image suppression stays stored-flag-driven** — never reintroduce `TSCompanionImageExclusionClause`-style correlated subquery. `_TSRecomputeCompanionFlags(folder_keys)` is the only writer of `assets.is_companion_image`.
13. **Listing pagination stays keyset** — never reintroduce `OFFSET` for `/asset_browser/assets`. New sort keys must be registered in `TS_SORT_KEY_MAP` and in `_TSBuildNextCursor`'s row-field map.
13. **Legacy/private Comfy graph access is isolated** in `js/ts-artius-browser-api-workflow.js`. Other modules must call adapter helpers (`tsGetComfyGraph`, `tsCreateComfyGraphNode`, etc.), not `app.graph` / `app.graph._nodes` / `app.canvas.graph_mouse` / `app.canvas.visible_nodes` / `window.LiteGraph` directly.
14. **Listener teardown is mandatory** — viewer stage listeners return cleanup via `tsStageCleanup`; panel API listeners use `tsBindApiEvents`/`tsUnbindApiEvents`; 3D worker `tsStop()` removes API/document/window listeners.
15. **Theme awareness** — colors come from Comfy theme variables; placeholders are theme-friendly transparent PNGs.
16. **Startup is light** — no synchronous full-library scan, no `ffmpeg`/`ffprobe`/Node.js requirement at import. Optional features fail gracefully.

## Local-only artifacts (gitignored, do NOT publish to GitHub)

`AGENTS.md` (entry as `agents.md` in `.gitignore`), `doc/`, `tests/`, `.ts_artius_browser/`, `.codex_tmp*/`. Codex/Claude must not force-add these as tracked files without an explicit reversal request.
