# Frontend Refactor Report

## Confirmed scope

Согласованный scope: безопасный frontend-refactor без изменения поведения. Работа была разделена на два независимых среза:

- `js/ts-artius-browser-panel.js`: основной браузер ассетов и workflows.
- `js/ts-artius-browser-viewer.js`: lightbox/viewer для image, video, audio, 3D и compare modes.

Цель обоих срезов: уменьшить monolith files, вынести уже существующую чистую или почти чистую логику в маленькие ES modules, оставить публичные exports, DOM-контракты, API-запросы, клавиатурное/мышиное поведение и user-facing markup без изменений.

Подтверждение пользователя: "Делай все пункты плана по очереди, делай всегда коммиты после каждой итерации, делай всегда все возможные тесты, делай все без вопросов..."

## Behavior preservation contract

Сохранены публичные frontend exports:

- `TSArtiusBrowserPanel`
- `tsEnsurePanelElement`
- `tsGetPanelSingleton`
- `TSArtiusBrowserViewer`
- `tsEnsureViewerElement`
- `tsOpenAssetViewer`

Сохранены observable behaviors:

- вкладки `assets` / `workflows`;
- независимые настройки вкладок;
- `Flat` / `Tree`;
- search / filters / sort / preview-size persistence;
- формирование `/asset_browser/search` query params;
- workflow filtering / direct folder counts / sorting;
- grid metrics, CSS variables, virtualized grid layout;
- item index, selected item lookup, `null` id behavior;
- lightbox image/video/audio/3D stage markup;
- image compare modes для 2 и 4 изображений;
- video compare mode для 2 и 4 видео;
- prompt / negative prompt / workflow metadata markup;
- 3D metadata markup;
- technical video/audio metadata markup;
- существующие DOM entrypoints и event handlers.

## Baseline state

Baseline перед frontend production refactor:

- Python tests: `116 passed / 0 failed / 0 skipped / 0 errored`.
- JavaScript syntax: clean через `node --check` для всех production `.js`.
- Release check: clean через `D:\AiApps\ComfyUI\comfyui\python\python.exe scripts\check_release.py`.
- Typecheck: отдельного TypeScript/typechecker в проекте нет; доступный equivalent: `node --check` плюс `scripts/check_release.py`.
- Coverage on scope: unavailable. В проекте нет подключенного JS coverage tool/package для browser modules.

## Characterization tests added in Phase 1

Добавлен `scripts/check_frontend_panel_characterization.mjs`.

Panel test groups:

- `scripts/check_frontend_panel_characterization.mjs:251` `tsRunFormatTests`: фиксирует `tsLerp`, FPS labels, duration labels.
- `scripts/check_frontend_panel_characterization.mjs:265` `tsRunSearchParamTests`: фиксирует query params для default, filtered и override cases.
- `scripts/check_frontend_panel_characterization.mjs:322` `tsRunWorkflowTests`: фиксирует workflow search, tree folder visibility, direct folder counts, date/name sorting.
- `scripts/check_frontend_panel_characterization.mjs:357` `tsRunSectionStateTests`: фиксирует section-specific settings sync/apply для `assets` и `workflows`.
- `scripts/check_frontend_panel_characterization.mjs:417` `tsRunGridTests`: фиксирует grid columns, row height, preview aspect ratio, chrome scaling, CSS variable writes.
- `scripts/check_frontend_panel_characterization.mjs:445` `tsRunSelectionTests`: фиксирует item index, selected lookup, missing ids и сохранение `null` id в индексе.

Добавлен `scripts/check_frontend_viewer_characterization.mjs`.

Viewer test groups:

- `scripts/check_frontend_viewer_characterization.mjs:168` `tsRunFormatTests`: фиксирует `tsFormatTime` и `tsFormatBitrate`.
- `scripts/check_frontend_viewer_characterization.mjs:180` `tsRunChannelLayoutTests`: фиксирует labels для mono/stereo/surround channel layouts.
- `scripts/check_frontend_viewer_characterization.mjs:188` `tsRunCompareModeTests`: фиксирует image/video compare mode detection.
- `scripts/check_frontend_viewer_characterization.mjs:220` `tsRunSyncItemsTests`: фиксирует синхронизацию viewer items и selection fallback.
- `scripts/check_frontend_viewer_characterization.mjs:245` `tsRunMetaMarkupTests`: фиксирует prompt, negative prompt, workflow, 3D и technical metadata markup.
- `scripts/check_frontend_viewer_characterization.mjs:304` `tsRunStageMarkupTests`: фиксирует stage markup для image, image compare, video, video compare, audio, 3D и fallback.

Первый panel characterization baseline на неизмененном `panel.js`: `66 assertions OK`.

После добавления selection coverage перед selection-refactor: `70 assertions OK`.

Первый viewer characterization baseline на неизмененном `viewer.js`: `41 assertions OK`.

После добавления stage markup coverage перед stage extraction: `53 assertions OK`.

`scripts/check_release.py` запускает оба frontend characterization checks автоматически.

## No-test mode declaration

No-test mode не использовался.

## Plan executed

1. Add frontend panel characterization harness.
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

7. Add panel selection characterization checks.
   Verification: `frontend panel characterization: 70 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `15b4545 Add panel selection characterization checks`.

8. Extract panel selection helpers.
   Verification: `frontend panel characterization: 70 assertions OK`; Python tests `116 passed`; release check clean.
   Commit: `ce9f19b Extract panel selection helpers`.

9. Document panel refactor.
   Verification: release check clean; Python tests `116 passed`; panel characterization `70 assertions OK`.
   Commit: `02671d6 Document frontend panel refactor`.

10. Add frontend viewer characterization checks.
    Verification: `frontend viewer characterization: 41 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `66e9e86 Add frontend viewer characterization checks`.

11. Extract viewer format helpers.
    Verification: `frontend viewer characterization: 41 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `56971c2 Extract viewer format helpers`.

12. Extract viewer state helpers.
    Verification: `frontend viewer characterization: 41 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `0eced40 Extract viewer state helpers`.

13. Extract viewer metadata helpers.
    Verification: `frontend viewer characterization: 41 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `24b4054 Extract viewer metadata helpers`.

14. Add viewer stage markup characterization checks.
    Verification: `frontend viewer characterization: 53 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `1be8619 Add viewer stage markup characterization checks`.

15. Extract viewer stage markup helper.
    Verification: `frontend viewer characterization: 53 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `330d9b7 Extract viewer stage markup helper`.

## Diff summary

Production code:

- `js/ts-artius-browser-panel-format.js`: new focused formatting helpers.
- `js/ts-artius-browser-panel-grid.js`: new grid metrics helpers.
- `js/ts-artius-browser-panel-query.js`: new asset search query helper.
- `js/ts-artius-browser-panel-selection.js`: new selection/index helpers.
- `js/ts-artius-browser-panel-state.js`: new section settings helpers.
- `js/ts-artius-browser-panel-workflows.js`: new workflow filtering/sorting helpers.
- `js/ts-artius-browser-panel.js`: delegates to extracted helpers, public exports unchanged.
- `js/ts-artius-browser-viewer-format.js`: new viewer format helpers.
- `js/ts-artius-browser-viewer-meta.js`: new metadata markup helpers.
- `js/ts-artius-browser-viewer-stage.js`: new stage markup helper.
- `js/ts-artius-browser-viewer-state.js`: new compare/sync state helpers.
- `js/ts-artius-browser-viewer.js`: delegates to extracted helpers, public exports unchanged.

Test/tooling:

- `scripts/check_frontend_panel_characterization.mjs`: panel behavior characterization.
- `scripts/check_frontend_viewer_characterization.mjs`: viewer behavior characterization.
- `scripts/check_release.py`: runs panel and viewer frontend characterization checks.

Aggregate diff for frontend refactor slice through `330d9b7`: about `1464 insertions / 650 deletions` across production and test/tooling files. Большая часть insertions находится в characterization scripts, то есть это safety net, а не runtime-size growth.

## Final state

Final verification before this report update:

- Python tests: `116 passed / 0 failed / 0 skipped / 0 errored`.
- Frontend panel characterization: `70 assertions OK`.
- Frontend viewer characterization: `53 assertions OK`.
- JavaScript syntax: clean through `scripts/check_release.py`.
- Pyflakes: clean through `scripts/check_release.py`.
- JSON/localization/dead-def checks: clean through `scripts/check_release.py`.
- Git diff whitespace check: clean through `scripts/check_release.py`.
- Release check: clean.
- Coverage delta: unavailable, no JS coverage tool exists in this repo.

## Full-suite final run from a clean state

Commands used after the last production refactor step:

```powershell
D:\AiApps\ComfyUI\comfyui\python\python.exe scripts\check_release.py
D:\AiApps\ComfyUI\comfyui\python\python.exe -m unittest discover -s tests -p "test_*.py"
node scripts\check_frontend_viewer_characterization.mjs
node --check js\ts-artius-browser-viewer.js
node --check js\ts-artius-browser-viewer-stage.js
node --check scripts\check_frontend_viewer_characterization.mjs
```

Observed result: release checks clean, Python tests `116 passed`, panel characterization `70 assertions OK`, viewer characterization `53 assertions OK`.

## Behavior preservation evidence

No previously passing test failed.

No previously failing test started passing.

No test expectation was changed to hide a production failure. One early panel characterization assumption for `23.976 FPS` was corrected before production refactor because unchanged code proved the current behavior is `24 FPS`.

Public panel/viewer exports and browser entrypoints are unchanged.

The refactor was mechanical: extract helper modules, delegate from original class methods, keep the original public method names as wrappers where external or intra-class code may rely on them.

## What was deliberately not touched

- `js/ts-artius-browser-panel.js`: `tsBuildShell()` still contains the main DOM/CSS template. Splitting this safely needs DOM snapshot or browser-level tests, not only pure helper tests.
- `js/ts-artius-browser-panel.js`: toolbar event wiring remains in the panel class. Extracting it would require event-level characterization first.
- `js/ts-artius-browser-viewer.js`: `tsSetupVideoStage()`, `tsSetupVideoCompareStage()`, `tsSetupImageCompareStage()`, `tsSetup3DStage()` and `tsSetupAudioStage()` remain in the viewer class because they are DOM/event/WebGL integration points, not pure markup.
- `js/ts-artius-browser-viewer.js`: CSS shell/template logic remains in the viewer class. Moving it without visual/browser snapshot tests would be higher risk.
- `js/ts-artius-browser-api.js`: `tsLoadAssetIntoWorkflow()` remains in API/bridge module. Drag/drop workflow behavior is sensitive and was outside this refactor.
- `js/ts-artius-browser-api.js`: `tsEnsureCanvasDropBridge()` still owns canvas drag/drop binding. It should be handled only with dedicated drag/drop characterization.

## Open questions / decisions that needed user input

No open questions were asked during execution per user instruction. Decisions were made conservatively: extract only covered, cohesive helpers; avoid public API changes; avoid event/DOM lifecycle rewrites.

## Rollback instructions

Rollback by commit:

- Revert viewer stage extraction: `git revert 330d9b7`.
- Revert viewer stage characterization: `git revert 1be8619`.
- Revert viewer metadata extraction: `git revert 24b4054`.
- Revert viewer state extraction: `git revert 0eced40`.
- Revert viewer format extraction: `git revert 56971c2`.
- Revert viewer characterization harness: `git revert 66e9e86`.
- Revert panel report-only commit: `git revert 02671d6`.
- Revert panel selection helper extraction: `git revert ce9f19b`.
- Revert panel selection characterization: `git revert 15b4545`.
- Revert panel grid extraction: `git revert 5405223`.
- Revert panel state extraction: `git revert 9b3cbe1`.
- Revert panel search query extraction: `git revert 8c076fa`.
- Revert panel workflow query extraction: `git revert d66d1fb`.
- Revert panel format extraction: `git revert 927b59c`.
- Revert panel characterization harness: `git revert 68dcd88`.

Recommended rollback policy: keep characterization scripts unless they block runtime work, because they are valuable independent coverage for future frontend refactors.
