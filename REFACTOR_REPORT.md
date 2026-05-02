# Frontend Refactor Report

## Confirmed scope

Согласованный scope: безопасный frontend-refactor без изменения поведения. Работа была разделена на два независимых среза:

- `js/ts-artius-browser-panel.js`: основной браузер ассетов и workflows.
- `js/ts-artius-browser-viewer.js`: lightbox/viewer для image, video, audio, 3D и compare modes.
- `js/ts-artius-browser-api.js`: frontend API/bridge module, но только покрытые helper-зоны без изменения drag/drop lifecycle.

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
- workflow userdata path normalization and preview matching;
- Comfy workflow load options and store-path behavior;
- folder-tree count rollup;
- open/download link behavior;
- widget lookup/options/value-setting behavior;
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

Добавлен `scripts/check_frontend_api_characterization.mjs`.

API test groups:

- `scripts/check_frontend_api_characterization.mjs:220` `tsRunPathTests`: фиксирует relative path normalization, userdata URLs, workflow folder/store paths.
- `scripts/check_frontend_api_characterization.mjs:234` `tsRunFormattingTests`: фиксирует modified timestamps, clamp и byte labels.
- `scripts/check_frontend_api_characterization.mjs:245` `tsRunDebounceTests`: фиксирует timeout clearing, wait time и передачу последних аргументов.
- `scripts/check_frontend_api_characterization.mjs:270` `tsRunWorkflowLibraryTests`: фиксирует `/v2/userdata` workflow parsing, preview sidecars, spaces in filenames, image/video preview kind.
- `scripts/check_frontend_api_characterization.mjs:299` `tsRunWorkflowLoadTests`: фиксирует `app.loadGraphData` call, Comfy store path и native workflow load options.
- `scripts/check_frontend_api_characterization.mjs:319` `tsRunFolderTreeTests`: фиксирует root sorting и rollup child counts for tree mode.
- `scripts/check_frontend_api_characterization.mjs:343` `tsRunOpenableUrlTests`: фиксирует openable URL resolution, download link и new-tab link behavior.
- `scripts/check_frontend_api_characterization.mjs:361` `tsRunAssetPathTests`: фиксирует asset fetch path, relative asset path, node class resolution и graph bounds check.
- `scripts/check_frontend_api_characterization.mjs:373` `tsRunWidgetHelperTests`: фиксирует selected node normalization, widget lookup, widget options, callback и dirty-canvas side effects.

Первый API characterization baseline на неизмененном `api.js`: `52 assertions OK`.

После debounce/open/widget coverage перед соответствующими extracts: `71 assertions OK`.

`scripts/check_release.py` запускает API, panel и viewer frontend characterization checks автоматически.

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

16. Add frontend API characterization checks.
    Verification: `frontend api characterization: 52 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `5de5c5c Add frontend API characterization checks`.

17. Extract frontend API workflow path helpers.
    Verification: `frontend api characterization: 52 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `a2f54e8 Extract frontend API workflow path helpers`.

18. Extract frontend API folder tree helper.
    Verification: `frontend api characterization: 52 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `8864e5c Extract frontend API folder tree helper`.

19. Add frontend API debounce characterization.
    Verification: `frontend api characterization: 56 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `4878fc0 Add frontend API debounce characterization`.

20. Extract frontend API utility helpers.
    Verification: `frontend api characterization: 56 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `3b47ec5 Extract frontend API utility helpers`.

21. Add frontend API open helper characterization.
    Verification: `frontend api characterization: 61 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `c035ce9 Add frontend API open helper characterization`.

22. Extract frontend API open helpers.
    Verification: `frontend api characterization: 61 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `b90cf1d Extract frontend API open helpers`.

23. Extract frontend API workflow pure helpers.
    Verification: `frontend api characterization: 61 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `23b6dbb Extract frontend API workflow pure helpers`.

24. Add frontend API widget characterization.
    Verification: `frontend api characterization: 71 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `8729619 Add frontend API widget characterization`.

25. Extract frontend API widget helpers.
    Verification: `frontend api characterization: 71 assertions OK`; Python tests `116 passed`; release check clean.
    Commit: `8a014e2 Extract frontend API widget helpers`.

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
- `js/ts-artius-browser-api-open.js`: new open/download URL helpers.
- `js/ts-artius-browser-api-paths.js`: new workflow userdata path and library item helpers.
- `js/ts-artius-browser-api-tree.js`: new folder tree helper.
- `js/ts-artius-browser-api-utils.js`: new debounce/clamp/format helpers.
- `js/ts-artius-browser-api-workflow.js`: new pure workflow/node path helpers.
- `js/ts-artius-browser-api-widgets.js`: new widget helper functions.
- `js/ts-artius-browser-api.js`: delegates covered helper logic, public exports unchanged.

Test/tooling:

- `scripts/check_frontend_api_characterization.mjs`: API/bridge helper behavior characterization.
- `scripts/check_frontend_panel_characterization.mjs`: panel behavior characterization.
- `scripts/check_frontend_viewer_characterization.mjs`: viewer behavior characterization.
- `scripts/check_release.py`: runs API, panel and viewer frontend characterization checks.

Большая часть insertions находится в characterization scripts, то есть это safety net, а не runtime-size growth.

## Final state

Final verification before this report update:

- Python tests: `116 passed / 0 failed / 0 skipped / 0 errored`.
- Frontend API characterization: `71 assertions OK`.
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
node scripts\check_frontend_api_characterization.mjs
node scripts\check_frontend_panel_characterization.mjs
node scripts\check_frontend_viewer_characterization.mjs
```

Observed result: release checks clean, Python tests `116 passed`, API characterization `71 assertions OK`, panel characterization `70 assertions OK`, viewer characterization `53 assertions OK`.

## Behavior preservation evidence

No previously passing test failed.

No previously failing test started passing.

No test expectation was changed to hide a production failure. One early panel characterization assumption for `23.976 FPS` was corrected before production refactor because unchanged code proved the current behavior is `24 FPS`.

Public API/panel/viewer exports and browser entrypoints are unchanged.

The refactor was mechanical: extract helper modules, delegate from original class methods, keep the original public method names as wrappers where external or intra-class code may rely on them.

## What was deliberately not touched

- `js/ts-artius-browser-panel.js`: `tsBuildShell()` still contains the main DOM/CSS template. Splitting this safely needs DOM snapshot or browser-level tests, not only pure helper tests.
- `js/ts-artius-browser-panel.js`: toolbar event wiring remains in the panel class. Extracting it would require event-level characterization first.
- `js/ts-artius-browser-viewer.js`: `tsSetupVideoStage()`, `tsSetupVideoCompareStage()`, `tsSetupImageCompareStage()`, `tsSetup3DStage()` and `tsSetupAudioStage()` remain in the viewer class because they are DOM/event/WebGL integration points, not pure markup.
- `js/ts-artius-browser-viewer.js`: CSS shell/template logic remains in the viewer class. Moving it without visual/browser snapshot tests would be higher risk.
- `js/ts-artius-browser-api.js`: `tsEnsureNativeInputPath()`, `tsApplyNativeAssetToNode()`, `tsSyncNative3DNode()`, `tsResolveNativeWidgetValue()`, `tsResolveDropTargetNode()`, `tsTryLoadIntoNodes()`, `tsCreateWorkflowNode()` and `tsLoadAssetIntoWorkflow()` remain in API/bridge module. They are Comfy/LiteGraph lifecycle integration points and need browser-level drag/drop smoke tests before deeper extraction.
- `js/ts-artius-browser-api.js`: `tsEnsureCanvasDropBridge()` still owns canvas drag/drop binding. It should be handled only with dedicated drag/drop characterization.

## Open questions / decisions that needed user input

No open questions were asked during execution per user instruction. Decisions were made conservatively: extract only covered, cohesive helpers; avoid public API changes; avoid event/DOM lifecycle rewrites.

## Rollback instructions

Rollback by commit:

- Revert API widget extraction: `git revert 8a014e2`.
- Revert API widget characterization: `git revert 8729619`.
- Revert API workflow pure helper extraction: `git revert 23b6dbb`.
- Revert API open helper extraction: `git revert b90cf1d`.
- Revert API open helper characterization: `git revert c035ce9`.
- Revert API utility extraction: `git revert 3b47ec5`.
- Revert API debounce characterization: `git revert 4878fc0`.
- Revert API folder tree extraction: `git revert 8864e5c`.
- Revert API workflow path extraction: `git revert a2f54e8`.
- Revert API characterization harness: `git revert 5de5c5c`.
- Revert viewer report commit: `git revert 784ce80`.
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
