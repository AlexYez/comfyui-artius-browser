# Frontend Refactor Report

## Confirmed scope

Согласованный scope: безопасный frontend-refactor основного browser panel без изменения поведения. В production-коде целевой файл был `js/ts-artius-browser-panel.js`; из него были вынесены только уже существующие чистые или почти чистые участки логики в маленькие ES modules. `js/ts-artius-browser-viewer.js` и runtime-поведение lightbox не входили в этот этап.

Подтверждение пользователя: "Делай все пункты плана по очереди, делай всегда коммиты после каждой итерации, делай всегда все возможные тесты, делай все без вопросов..."

## Behavior preservation contract

Сохранены публичные frontend exports: `TSArtiusBrowserPanel`, `tsEnsurePanelElement`, `tsGetPanelSingleton`.

Сохранены observable behaviors:

- вкладки `assets` / `workflows`;
- независимые настройки вкладок;
- `Flat` / `Tree`;
- search / filters / sort / preview-size persistence;
- формирование `/asset_browser/search` query params;
- workflow filtering / direct folder counts / sorting;
- grid metrics, CSS variables, virtualized grid layout;
- item index, selected item lookup, `null` id behavior;
- существующие DOM entrypoints и event handlers.

## Baseline state

Baseline до production-изменений:

- Python tests: `116 passed / 0 failed / 0 skipped / 0 errored`.
- JavaScript syntax: clean через `node --check` для всех production `.js`.
- Release check: clean через `D:\AiApps\ComfyUI\comfyui\python\python.exe scripts\check_release.py`.
- Typecheck: отдельного TypeScript/typechecker в проекте нет; доступный baseline-equivalent: `node --check` плюс `scripts/check_release.py`.
- Coverage on scope: unavailable. В проекте нет подключенного JS coverage tool/package для browser modules.

## Characterization tests added in Phase 1

Добавлен `scripts/check_frontend_panel_characterization.mjs`.

Test groups:

- `scripts/check_frontend_panel_characterization.mjs:251` `tsRunFormatTests`: фиксирует `tsLerp`, FPS labels, duration labels.
- `scripts/check_frontend_panel_characterization.mjs:265` `tsRunSearchParamTests`: фиксирует query params для default, filtered и override cases.
- `scripts/check_frontend_panel_characterization.mjs:322` `tsRunWorkflowTests`: фиксирует workflow search, tree folder visibility, direct folder counts, date/name sorting.
- `scripts/check_frontend_panel_characterization.mjs:357` `tsRunSectionStateTests`: фиксирует section-specific settings sync/apply для `assets` и `workflows`.
- `scripts/check_frontend_panel_characterization.mjs:417` `tsRunGridTests`: фиксирует grid columns, row height, preview aspect ratio, chrome scaling, CSS variable writes.
- `scripts/check_frontend_panel_characterization.mjs:445` `tsRunSelectionTests`: фиксирует item index, selected lookup, missing ids и сохранение `null` id в индексе.

Первый characterization baseline на неизмененном `panel.js`: `66 assertions OK`.

После добавления selection coverage перед selection-refactor: `70 assertions OK`.

`scripts/check_release.py` теперь запускает frontend characterization автоматически.

## No-test mode declaration

No-test mode не использовался.

## Plan executed

1. Add frontend characterization harness.
   Verification: `frontend panel characterization: 66 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `68dcd88 Add frontend panel characterization checks`.

2. Extract panel format helpers.
   Verification: `frontend panel characterization: 66 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `927b59c Extract panel format helpers`.

3. Extract panel workflow query helpers.
   Verification: `frontend panel characterization: 66 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `d66d1fb Extract panel workflow query helpers`.

4. Extract panel search query helper.
   Verification: `frontend panel characterization: 66 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `8c076fa Extract panel search query helper`.

5. Extract panel section state helpers.
   Verification: `frontend panel characterization: 66 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `9b3cbe1 Extract panel section state helpers`.

6. Extract panel grid metrics helpers.
   Verification: `frontend panel characterization: 66 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `5405223 Extract panel grid metrics helpers`.

7. Add selection characterization checks.
   Verification: `frontend panel characterization: 70 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `15b4545 Add panel selection characterization checks`.

8. Extract panel selection helpers.
   Verification: `frontend panel characterization: 70 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `ce9f19b Extract panel selection helpers`.

## Diff summary

Production code:

- `js/ts-artius-browser-panel-format.js`: `+30 / -0`.
- `js/ts-artius-browser-panel-grid.js`: `+67 / -0`.
- `js/ts-artius-browser-panel-query.js`: `+38 / -0`.
- `js/ts-artius-browser-panel-selection.js`: `+27 / -0`.
- `js/ts-artius-browser-panel-state.js`: `+78 / -0`.
- `js/ts-artius-browser-panel-workflows.js`: `+52 / -0`.
- `js/ts-artius-browser-panel.js`: `+153 / -308`.

Test/tooling:

- `scripts/check_frontend_panel_characterization.mjs`: `+475 / -0`.
- `scripts/check_release.py`: `+9 / -0`.

## Final state

Final verification before this report:

- Python tests: `116 passed / 0 failed / 0 skipped / 0 errored`.
- Frontend characterization: `70 assertions OK`.
- JavaScript syntax: clean through `scripts/check_release.py`.
- Release check: clean.
- Coverage delta: unavailable, no JS coverage tool exists in this repo.

## Full-suite final run from a clean state

Commands used after writing the report:

```powershell
D:\AiApps\ComfyUI\comfyui\python\python.exe scripts\check_release.py
D:\AiApps\ComfyUI\comfyui\python\python.exe -m unittest discover -s tests -p "test_*.py"
node scripts\check_frontend_panel_characterization.mjs
```

Observed result: release checks clean, Python tests `116 passed`, frontend characterization `70 assertions OK`.

## Behavior preservation evidence

No previously passing test failed.

No previously failing test started passing.

No test expectation was changed to hide a production failure. One early characterization assumption for `23.976 FPS` was corrected before production refactor because unchanged code proved the current behavior is `24 FPS`.

Public panel exports and browser entrypoints are unchanged.

## What was deliberately not touched

- `js/ts-artius-browser-viewer.js:37`: `TSArtiusBrowserViewer` remains a large lightbox component. It has separate responsibilities for image/video/audio/3D stages and should be refactored in a separate tested phase.
- `js/ts-artius-browser-viewer.js:1393`: video compare stage remains inside viewer; not touched to avoid mixing panel refactor with lightbox behavior.
- `js/ts-artius-browser-viewer.js:1671`: image compare stage remains inside viewer; not touched for the same reason.
- `js/ts-artius-browser-panel.js:450`: `tsBuildShell()` still contains the main DOM/CSS template. Splitting this safely needs DOM snapshot or browser-level tests, not just pure helper tests.
- `js/ts-artius-browser-api.js:825`: `tsLoadAssetIntoWorkflow()` remains in API/bridge module. Drag/drop workflow behavior is sensitive and was outside this refactor.
- `js/ts-artius-browser-api.js:842`: `tsEnsureCanvasDropBridge()` still owns canvas drag/drop binding. It should be handled only with dedicated drag/drop characterization.

## Open questions / decisions that needed user input

No open questions were asked during execution per user instruction. The working decision was to complete the first safe frontend panel refactor slice and stop before the untested viewer/lightbox refactor.

## Rollback instructions

Rollback by commit:

- Revert only selection helper extraction: `git revert ce9f19b`.
- Revert selection characterization: `git revert 15b4545`.
- Revert grid extraction: `git revert 5405223`.
- Revert state extraction: `git revert 9b3cbe1`.
- Revert search query extraction: `git revert 8c076fa`.
- Revert workflow query extraction: `git revert d66d1fb`.
- Revert format extraction: `git revert 927b59c`.
- Revert frontend characterization harness: `git revert 68dcd88`.

Recommended rollback policy: keep `scripts/check_frontend_panel_characterization.mjs` unless it blocks runtime work, because it is valuable independent coverage for future frontend refactors.
