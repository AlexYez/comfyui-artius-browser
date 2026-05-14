---
name: Active development mode — bolder changes allowed
description: Project is pre-release with no real users — compat rules relaxed, DB can be wiped, schema/routes/payloads may change freely
type: project
originSessionId: a2d6a6c9-e2d8-46d7-87d2-82cc7de3c081
---
**Status as of 2026-05-03:** Artius Browser is in active solo pre-release development. **No real users yet.** No public ComfyUI registry release.

**Why:** owner is the only user; DB and config under `ComfyUI/output/.ts_artius_browser/` can be deleted or rebuilt at any time. Codified in `AGENTS.md` / `CLAUDE.md` as a "Development Mode Override" block at the top.

**How to apply:**

- AGENTS.md/CLAUDE.md §4 (Hard Compatibility), §12 (SQLite), §24 (Deps), §30 (Docs), §32 (Response brief), §33 (New features) — RELAXED. Bolder changes OK.
- Schema changes: no migrations, no compat aliases, no version bumps for backward-compat. May rename/add/drop tables and columns.
- Route URLs, JSON payload field names, config keys, frontend state keys, public function names — all freely changeable.
- `asset_user_fields` was already removed in schema v10 (tags/rating/created_at preservation no longer exists). Don't try to "preserve" what isn't there.
- Cache directory layout and preview filenames may change.
- DB wipe (`rm -rf .ts_artius_browser/` or `Rebuild Cache`) is an acceptable migration path.

**What stays strict (product/safety, not compat):**

- §3 Four Agent Principles, §5 Native ComfyUI integration, §6 Light startup, §7 Python safety (no `eval`/`exec`, parameterized SQL), §10 Path safety, §11 Delete-to-trash, §17 Security, §25 Testing, §31 Git safety
- Product invariants: filename-only search, PNG `Prompt`/`Workflow` source-of-truth, no seed field, 3D as frontend-captured special path, no custom loader nodes, `Workflows` tab is frontend-only

**Reversal trigger:** when preparing first public release / registry publish, the override block at the top of AGENTS.md/CLAUDE.md must be removed; §4/§12/§24/§30/§32/§33 snap back to strict.
