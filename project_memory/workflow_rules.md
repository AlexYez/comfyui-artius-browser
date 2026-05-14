---
name: Working rules — refactoring, verification, response format
description: Operational rules from AGENTS.md — surgical changes, verification commands, required response format for code changes
type: feedback
originSessionId: a2d6a6c9-e2d8-46d7-87d2-82cc7de3c081
---
These come from AGENTS.md §3, §25, §26, §31, §32. They override personal coding preferences for this project.

**Why:** project owner is following AGENTS.md as a strict working contract — safety/stability/compatibility first, refactoring last. Project is installed in real users' ComfyUI setups.

**How to apply:** every code change in this repo.

## Surgical changes

- Touch only what the task requires. Every changed line must trace to the user's request.
- Don't reformat, rename stable APIs, or improve adjacent code.
- Match existing style even when you'd write it differently.
- Mention dead code if found, but don't delete it unless it's from your own change.

## Refactoring boundaries (AGENTS.md §26)

Safe: extracting private helpers, reducing duplication inside one module, local constants, type hints, validation/path tightening, replacing runtime `print()` with logging, tests.

Unsafe (do NOT do): rewriting modules from scratch, new architecture without request, behavior change during cleanup, full-file reformat, deleting compatibility logic, deleting unrelated dead code, merging backend/frontend concerns, mass file moves.

## Verification (AGENTS.md §25)

Preferred command after any change:
```bash
python scripts/check_release.py
```
It validates Python+JS syntax, JSON, localization keys, dead helpers, unit tests, whitespace, and frontend characterization (when Node.js available).

Subset commands when full check can't run:
```bash
python -m compileall .
python -m unittest discover tests
node --check js/changed-file.js
python -m pyflakes .
git diff --check
```

**Never claim a check passed unless it actually ran.** If skipped because tool is missing, say so.

## Git safety (AGENTS.md §31)

Do NOT run without explicit user request: `git reset --hard`, `git clean -fd`, `git checkout -- .`, `git rebase`, `git push --force`. Never `--no-verify` or skip signing. Don't commit unless asked.

## Required response format for code changes (AGENTS.md §32)

```
Что изменено
- ...

Почему это безопасно
- ...

Проверка
- [passed] command
- [skipped] command — reason

Риски / примечания
- ...
```

For larger tasks add:
```
Затронутые файлы
- path/to/file.py
- path/to/file.js
```

Never claim behavior is preserved unless compatibility-sensitive checks were considered.

## Communication mode (AGENTS.md §0)

- Russian by default unless user requests otherwise.
- SILENT: no progress updates, plans, or intermediate findings unless user asks.
- Brief, technically precise. State assumptions explicitly.
- For trivial one-liners: don't over-process.
- For complex tasks: keep plan internal unless user asks to see it.
