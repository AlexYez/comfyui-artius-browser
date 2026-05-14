---
name: No Claude co-author trailer in commits
description: Owner wants AlexYez as the sole author on GitHub for this repo — never add `Co-Authored-By: Claude` to commit messages
type: feedback
originSessionId: e9cc521c-1ba4-4c38-bafa-087e88c6868d
---
Never append a `Co-Authored-By: Claude <noreply@anthropic.com>` (or any other Claude / Anthropic) trailer to commit messages on this project.

**Why:** owner inspected the GitHub repo and saw "AlexYez and claude" listed as contributors / co-authors (driven by `Co-Authored-By` trailers Claude Code adds by default). They want only `AlexYez` visible as author and contributor on https://github.com/AlexYez/comfyui-artius-browser.

**How to apply:** when constructing a commit with `git commit -m "$(cat <<'EOF' ... EOF)"`, omit the `Co-Authored-By:` line from the heredoc body. This overrides the default commit-message footer the Claude Code harness suggests. Applies to every commit on this repo from now on, including future sessions.

**Historical cleanup (2026-05-13):** owner noticed `@claude` still listed in GitHub Contributors despite the rule being in place — caused by 4 older commits on `main` (`63750f6`, `f440c44`, `94ff632`, `f1ae381`) that still carried the trailer from before the rule existed. Fixed with `git filter-branch --msg-filter` over `25759f0..HEAD` to strip the line, then `git push --force-with-lease origin main`. Local backup branch `backup/before-trailer-strip` kept in case rollback is needed. Lesson: when the owner brings up the @claude-contributor concern, also check `git log --grep "Co-Authored-By: Claude"` on `origin/main` — not just future commits.
