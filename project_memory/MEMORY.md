# Memory index for comfyui-artius-browser

- [User language](user_language.md) — User writes in Russian; respond in Russian by default.
- [Project architecture](project_architecture.md) — High-level map of entry points, backend services, frontend modules, storage layout, invariants.
- [Project invariants](project_invariants.md) — Hard compatibility rules: identifiers, payloads, schemas that need migration plans before changing.
- [Workflow rules](workflow_rules.md) — Surgical changes, verification commands, required response format from AGENTS.md §3/§25/§26/§31/§32.
- [Dev mode (historic)](dev_mode.md) — **Outdated as of 2026-05-07:** project went public with v0.7.0; dev-mode override block removed from CLAUDE.md / AGENTS.md. Compat rules now strict.
- [No Claude co-author trailer](commit_no_claude_coauthor.md) — Don't add `Co-Authored-By: Claude` to commit messages on this repo; AlexYez must be the sole GitHub author.
- [Temp file naming](feedback_temp_file_naming.md) — Never use `.codex_tmp_*` or any `codex` prefix for scratch files; I'm Claude, not Codex.
