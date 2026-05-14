---
name: Temp file naming — never use codex prefix
description: For scratch/debug files in this repo, never use `.codex_tmp_*` or any `codex` prefix. I am Claude, not Codex.
type: feedback
originSessionId: b300dcda-548d-44ba-82d3-c492518f1553
---
For scratch/debug files in this repo, never use `.codex_tmp_*` (or any other `codex*`) prefix. Use `_tmp_*` or another neutral prefix instead.

**Why:** The repo contains pre-existing `.codex_tmp_*` directories from old Codex sessions, and I once mindlessly copied that naming for my own debug scripts. The user (correctly) called it out — I'm Claude, not Codex, and shouldn't pretend otherwise via naming.

**How to apply:** Whenever creating a temporary debug/scratch file in this project, pick a name that does **not** start with `codex` or `.codex`. Default to something like `_tmp_debug.py`. Always delete temp files when done.
