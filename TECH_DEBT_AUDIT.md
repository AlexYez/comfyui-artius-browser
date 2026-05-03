# Технический аудит долга — Artius Browser for ComfyUI

Read-only обзор основной ветки `main` (HEAD `25759f0`). Артефакт ровно один — этот файл. Код не модифицировался, форматтеры и линтеры с автоисправлением не запускались. Тестовый прогон выполнен только для чтения (`python scripts/check_release.py`), никаких миграций или генераций не производилось.

Контекст: проект формально в `DEVELOPMENT MODE OVERRIDE` (см. `CLAUDE.md` §«⚠ DEVELOPMENT MODE OVERRIDE»), пользователей в продакшене нет. Это смягчает требования к схеме/конфигу/совместимости, но НЕ к корректности кода, безопасности и работоспособности тестов. Соответствующие пометки сделаны рядом с находками.

---

## Сжатый итог (executive summary)

1. **CRIT** — Глобальный 3D worker зацикливается. `js/ts-artius-browser-3d-worker.js:100-109` шлёт устаревший параметр `offset`, который backend молча игнорирует — для библиотек с >`backgroundPageSize` 3D-ассетов воркер бесконечно перезапрашивает первую страницу.
2. **HIGH** — `python scripts/check_release.py` не проходит. `tests/test_config_store.py:34,50,74` зашиты на `version == 13`, но `TS_DEFAULT_CONFIG["version"] = 14`. Релизный гейт сломан.
3. **HIGH** — Часть тестов падает с `ModuleNotFoundError: aiohttp / send2trash / PIL`. Импорт боевых модулей в тестах не изолирован, прогон без боевых рантайм-зависимостей невозможен.
4. **MED** — Эндпоинт `POST /asset_browser/preview/{id}/warm` зарегистрирован, но `TSWarmPreview` всегда возвращает `{queued: False, reason: "ready"|"disabled"}`. Фронтенд его не вызывает. Полностью мёртвая ветка.
5. **MED** — `js/ts-artius-browser-panel.js` — god-class на 2817 строк (122 KB) со ~600 строк inline-CSS. Любой touch — тяжёлый.
6. **MED** — Миграции `ts_config.py` (v8/v9/v14) не `setdefault`, а форсированная перезапись `tools.ffprobe_workers/ffmpeg_workers` и блока `preview` дефолтами. Любая ручная настройка пользователя теряется при следующем bump-е версии.
7. **MED** — `TSResolveCachePath` (`tsab/ts_storage.py:72-76`) не валидирует containment: для абсолютного входа возвращается `Path.resolve()` как есть. Сейчас единственный источник `preview_path` — индексер, но защиты по периметру нет.
8. **MED** — `TSNormalizeUISettings` (`tsab/ts_ui_settings.py:46-54`) не валидирует enum-поля при чтении (`asset_view_mode`, `asset_sort_key`, `*_sort_direction`); `TSApplyUISettingsUpdates` валидирует. На входе и выходе — разные правила.
9. **MED** — Дубль кодогенерации превью: `TSGenerateVideoPoster`/`TSGenerateWaveformPreview` (последовательные) живут параллельно с `*Parallel`-вариантами и `TSExtractVideoFrame`/`TSExtractWaveform` в `ts_tools.py`. Каждое продолжает развиваться отдельно.
10. **MED** — `TSBuildAssetCard` (`tsab/ts_asset_payload.py:65`) делает `os.stat` на каждый асс-карточку при сборке payload. На большой странице (limit ≤500) это сотни stat-ов на сетевом диске.

---

## Ментальная модель архитектуры (как она есть)

Backend — пакет `tsab` с явной композицией в `ts_runtime.py::TSAssetBrowserRuntime` (DI-стиль через конструктор). Слои:

- **Storage / config** — `ts_storage.TSStoragePaths`, `ts_config.TSConfigStore` (с in-memory cache + atomic write).
- **DB** — фасад `ts_db.TSDatabase` (per-thread SQLite connection, WAL, view `assets_view`), schema/SQL в `ts_db_schema.py`, query-builder в `ts_db_query.py`, row→payload в `ts_db_payload.py`. Пагинация — keyset (`after_sort` + `after_id`); `is_companion_image` хранится как флаг и пересчитывается в `_TSRecomputeCompanionFlags` после upsert/delete.
- **Indexer** — `ts_indexer.TSIndexer` оркестрирует scan через `ThreadPoolExecutor`, дискавери в `ts_indexer_discovery.py`, прогресс в `ts_indexer_progress.py`, обработка кандидата в `ts_indexer_processing.py`. Запускает `ffprobe`+`ffmpeg` параллельно внутри одного ассета через `ts_tools.TSToolLocator.TSRunCommandsParallel`.
- **Preview** — `ts_preview.TSPreviewCache` хранит thumbnails / video_frames / waveforms / placeholders в `<output>/.ts_artius_browser/cache/`. Дубль API: legacy + parallel.
- **Routes** — `ts_routes.py` регистрирует 14 групп эндпоинтов с парой вариантов `/...` и `/api/...` (lambda-замыкания на runtime).
- **Domain services** — `ts_asset_catalog`, `ts_asset_processing`, `ts_scan_service`, `ts_browser_settings`, `ts_workflows`, `ts_delete`, `ts_load3d_stage`, `ts_3d_thumbnail`.

Frontend — нативный JS, без бандлера. Sidebar-extension `js/ts-artius-browser.js` регистрирует панель и стартует глобальный 3D worker. Основной UI — `ts-artius-browser-panel.js` (web-component, Shadow DOM, ~2800 LOC, ~600 строк inline-CSS, 100+ методов в одном классе). Lightbox — отдельный `ts-artius-browser-viewer.js` (1968 LOC). API/адаптеры разнесены: `ts-artius-browser-api*.js`, `ts-artius-browser-panel-*.js` помощники (cache/format/grid/query/selection/state/workflows), `ts-artius-browser-viewer-*.js` и `ts-artius-browser-3d*.js`. Все динамические listener-ы возвращают cleanup-функции; глобальный 3D worker отвязывается в `tsDispose`.

Workflows-вкладка — целиком frontend: читает нативный `GET /v2/userdata?path=workflows`, индексирование через DB не идёт, sidecar-превью находятся по совпадающему stem.

Расхождений с README/AGENTS не нашёл, кроме небольшой неточности про дефолты `*_workers`: README пишет `min(4, cpu_count() // 2)`, фактически `max(1, min(4, cpu_count() // 2))` — несущественно.

---

## Что исключено из аудита и почему

- `node_modules/`, `dist/`, `build/`, `.next/`, `target/` — отсутствуют (нет бандлера и сборки).
- `__pycache__/` (по `.gitignore`) — артефакт.
- `.codex_tmp*/` (по `.gitignore`, ~10 директорий рядом с репо) — рабочие временные каталоги тестов.
- `.git/` — служебный.
- `img/`, `icon.png` — бинарные ассеты.
- `LICENSE.txt`, `.github/workflows/` — не в фокусе аудита (минимальная CI на публикацию, без флэков по истории).
- `AGENTS.md`, `CLAUDE.md`, `doc/`, `tests/` — gitignored, но прочитаны как контекст. Тесты включены в скоуп: они часть релизного гейта.

Внешний `pip-audit`, `npm audit`, `mypy`, `ruff` — запускать не стал: мутирующих/инсталляционных операций prompt запрещает, а локально устанавливать инструменты глобально нельзя. `pyflakes` существует в инструментарии репо, но в текущем env не установлен (`scripts/check_release.py` его пропускает с `skipped`).

---

## Таблица находок

Дедуплицировано: повторяющиеся паттерны (broad `except Exception`, дубли preview-путей, повторные `_TSRootMap` вызовы) сведены в одну строку с тремя примерами.

| ID | Категория | File:Line | Sev | Effort | Описание | Рекомендация |
|----|-----------|-----------|-----|--------|----------|--------------|
| F01 | Bug — runtime infinite loop | js/ts-artius-browser-3d-worker.js:100-109,138-163 | Critical | S | Воркер шлёт `offset` — backend (`tsab/ts_routes.py:137-171` + `tsab/ts_utils.py:134-148` `TSParseAssetCursor`) принимает только `after_sort`/`after_id`. Для библиотек с >`backgroundPageSize` (default 8) 3D-ассетов воркер бесконечно перезапрашивает первую страницу: `tsProcessAsset` пропускает уже захваченные превью, `has_more=true`, цикл не завершается. Сжигает CPU/трафик и держит соединения. | Заменить `offset += tsItems.length` на чтение `tsPayload.next_cursor` и передачу `after_sort`/`after_id` в `tsBuildSearchPath`; либо ввести в response `next_offset` и параметр `offset` в роутах (хуже — ломает контракт keyset-пагинации). |
| F02 | Test debt — broken release check | tests/test_config_store.py:34,50,74 | High | S | `TS_DEFAULT_CONFIG["version"] = 14` (`tsab/ts_settings.py:129`), но 3 теста ожидают `13`. `python scripts/check_release.py` падает: `FAILED (failures=3, errors=6)`. Релизный гейт неработоспособен. | Убрать литерал, читать `TS_DEFAULT_CONFIG["version"]` или `TS_DB_SCHEMA_VERSION`-аналог; либо обновить ожидаемое значение и поставить процесс bump-теста в CLAUDE.md. |
| F03 | Test debt — fragile imports | tests/test_3d_thumbnail.py:8, tests/test_delete_service.py:13, tests/test_image_prompt_metadata.py:13, tests/test_workflows.py, tests/test_runtime_*.py | High | M | 6 модулей падают на `import` из-за `ModuleNotFoundError: aiohttp/send2trash/PIL`. Эти зависимости — рантайм-сабсеты ComfyUI и не указаны в `requirements.txt` боевыми (PIL/aiohttp), а `send2trash` указан, но не установлен в env разработчика. Запуск тестов изолированно сейчас невозможен. | Либо переключиться на `unittest.skipIf` с `importlib.util.find_spec`, либо вынести хрупкие импорты в фикстуры/локальные импорты внутри тестов. Либо явно требовать всё в `requirements-dev.txt` и проверять в `check_release.py`. |
| F04 | Dead code | tsab/ts_routes.py:91-92, tsab/ts_runtime.py:238-239, tsab/ts_asset_processing.py:33-40 | Medium | S | Эндпоинт `POST /asset_browser/preview/{id}/warm` зарегистрирован, но `TSWarmPreview` возвращает только `{queued: False, reason: "ready"|"disabled"}`. Грепом по `js/` не нашёл ни одного caller. Полупустая поверхность, которую легко принять за рабочую. | Удалить роут + метод. Если фича прогрева задумана — реализовать (через `ts_asset_processing.TSEnsurePreview` + thread pool). |
| F05 | God-class | js/ts-artius-browser-panel.js:68-2769 | Medium | L | 2817 строк, 100+ методов на одном `HTMLElement`-классе, ~600 строк CSS как template-literal, состояние/рендер/фетч/события/drag&drop/3D thumbnails/настройки/workflows — всё в одном файле. Каждое изменение требует прокачки полного контекста; churn по файлу — top-1 за 6 месяцев (19 коммитов). | Постепенно вынести разделы: грид-рендер (`tsRenderGrid`, `tsRenderTree`, `tsHandleGalleryScroll`) уже частично выделены в `panel-grid.js` — добить остальное. CSS — в отдельный `.css.js` с constructable stylesheet (`new CSSStyleSheet()`). Без переписывания, по одной зоне за PR. |
| F06 | Config migration overwrites user values | tsab/ts_config.py:75-91,93-98,127-131 | Medium | S | Шаги v8/v9/v14 используют присваивание `ts_tools[...] = ts_default[...]` (НЕ `setdefault`), сбрасывая ручные настройки `ffprobe_workers`/`ffmpeg_workers` и почти весь `preview`-блок. В DEV-режиме это допустимо, но после релиза это окно потерь данных пользователя на каждом version-bump. | Заменить присваивание на `setdefault` (как в v7/v10/v11/v12); если требуется одноразовый принудительный сброс — версионировать его отдельным маркёром (`ts_force_reset_v8`), а не в общей миграции. |
| F07 | Path-traversal latent | tsab/ts_storage.py:72-76 | Medium | S | `TSResolveCachePath` для `Path.is_absolute()` возвращает `Path.resolve()` без проверки `relative_to(ts_asset_browser_directory)`. Сейчас единственный writer `preview_path` — индексер (всегда относительный), но если в БД попадёт абсолютный путь, `TSBuildPreviewResponse` (`tsab/ts_runtime.py:279-291`) превратит это в произвольное чтение файла через HTTP. Защиты в глубину нет. | После `resolve()` проверять `relative_to(self.ts_asset_browser_directory)` и кидать `ValueError`/возвращать None. Подключить к `TSPurgePreview` тоже. |
| F08 | Inconsistent input validation | tsab/ts_ui_settings.py:46-49,52-54 | Medium | S | `TSNormalizeUISettings` не проверяет enum для `asset_view_mode`, `workflow_view_mode`, `asset_sort_key`, `workflow_sort_key`, `asset_sort_direction`, `workflow_sort_direction`. `TSApplyUISettingsUpdates` (тот же файл, строки 73-84) — проверяет через `TSNormalizeChoice`. Если в `config.json` руками или после миграции окажется мусор, нормализация его пропустит, фронтенд получит невалидное значение. | Применить `TSNormalizeChoice(..., TS_VIEW_MODES, "flat")` и аналогичные на чтении тоже. Заодно дефолт `TSClampInt` в строке 50/54 сделать `TS_DEFAULT_PREVIEW_SIZE` (=120) вместо хард-кода 180 — сейчас расходится с `tsab/ts_settings.py:96`. |
| F09 | Code duplication — preview pipelines | tsab/ts_preview.py:118-132 vs 134-157, 188-207 vs 159-186; tsab/ts_tools.py:338-404 | Medium | M | Один и тот же путь записан дважды: legacy sequential (`TSGenerateVideoPoster`/`TSGenerateWaveformPreview`/`TSExtractVideoFrame`/`TSExtractWaveform`) и parallel-варианты. Sequential остался для `TSGeneratePreview` post-discovery flow (когда ffprobe уже не нужен). Любой fix приходится дублировать. | В `TSGenerateVideoPoster`/`*Waveform*` принимать опциональный флаг `with_probe`; sequential-обёртку оставить тонким адаптером, либо удалить, заменив `TSAssetProcessingService.TSEnsurePreview` на parallel-путь и игнорировать ffprobe-результат. |
| F10 | Per-card `os.stat` | tsab/ts_asset_payload.py:65 | Medium | S | `TSBuildAssetCard` делает `ts_preview_cache.TSResolvePreviewPath(...).exists()` на каждый ассет. На сетевом диске или с лимитом 500 — заметно. Hot path: `TSAssetCatalogService.TSQueryAssets` → `TSBuildAssetCard` × N. | Полагаться на флаг `assets.has_preview` (он уже хранится в БД и выставляется индексером). `exists()` нужен только если хотим само-исцеляться от внешнего удаления preview-файлов — тогда вынести это в фоновый health-check, а не в hot path. |
| F11 | Bug — partial workflow delete | tsab/ts_workflows.py:81-90 | Medium | S | В цикле `for ts_target_path in [workflow, *sidecars]` нет try/except вокруг `send_to_trash`. Если корзина откажет на втором файле, основной workflow уже удалён, sidecar — нет, ответ — exception, фронтенд не знает что произошло. | Обернуть `self.ts_send_to_trash(...)` в try/except, собирать `failed_paths`, возвращать в payload. |
| F12 | Dead code in DB migration | tsab/ts_db.py:45-63 | Medium | S | `TSMigrate` — две ветки `if/else`, обе делают `executescript(TS_DB_SCHEMA_SQL)`. Различие только в обработке ошибки. После исключения вызывается `_TSRebuildSchema` (drop + create). `or 0` в `int(... or 0)` лишний (`PRAGMA user_version` всегда возвращает int). | Переписать как: `try: executescript(SCHEMA_SQL) except DatabaseError: _TSRebuildSchema(...)` без if/else. Ясность важнее. |
| F13 | Dead variable | tsab/ts_indexer.py:171-177 | Low | S | `ts_needs_index` вычисляется в первом проходе и не используется (затирается на 198-204 во втором). | Удалить блок 171-177. |
| F14 | Dead branch | tsab/ts_hashing.py:87-91 | Low | S | Для `.obj` сначала проверяется текстовая сигнатура и условный `return "3d"`, затем безусловный `return "3d"`. Проверка декоративная. | Удалить условную ветку, оставить `return "3d"`. Либо начать использовать сигнатуру для отказа от не-OBJ. |
| F15 | Frontend — folder updates lost | js/ts-artius-browser-panel.js:2049-2070 | Low | S | `tsApplyRevalidatedPayload` сравнивает только items-key; folders обновляются лишь если items уже разъехались. Если на бэке появилась новая папка без новых ассетов, дерево останется устаревшим до следующего полного fetch. | Добавить отдельное сравнение для `folders` и обновлять при расхождении ключа. |
| F16 | Observability gap — verbose-only logs | tsab/ts_indexer.py:273-281, tsab/ts_indexer_processing.py:61-68, tsab/ts_preview.py:113,129,154,183,204,247,294,372 (и 9 других) | Medium | S | Все ошибки скана/превью пишутся через `TSLogVerbose`. По умолчанию verbose выключен (`tsab/ts_settings.py:16`). При проблемах в проде/у пользователей логи молчат, кроме `TSLogger.exception` верхнего уровня в `_TSRunScanAsync`. | `_indexer_processing` и preview-исключения логировать как `logger.warning(... exc_info=True)` хотя бы агрегированно (например, счётчик неудач + один WARN на N=50). Verbose оставить для деталей. |
| F17 | Routes — module-global registration flag | tsab/ts_routes.py:9, 70-114 | Low | M | `TSRoutesRegistered` — module-level. Если runtime пересоздаётся (тесты, hot-reload, повторный bootstrap), повторно роуты уже не зарегистрировать. Текущее поведение работает только для одного процесса/одного runtime. | Перенести флаг внутрь runtime (или прицепить к `ts_server.app`-объекту), чтобы повторный init с другим server-instance проходил. |
| F18 | Route — closure over runtime | tsab/ts_routes.py:83-111 | Low | M | Все 14 групп — `lambda ts_request: TSHandleX(ts_runtime, ts_request)`. Замыкания не различаются между вариантами `/...` и `/api/...`, не позволяют отвязать обработчик. | Вынести `partial(TSHandleX, ts_runtime)` или поднять `make_handler(ts_runtime)`-фабрику. Косметика, но проще диагностировать. |
| F19 | 3D staging — name collision | tsab/ts_load3d_stage.py:118-122 | Low | S | Для `.obj` стэйджинг идёт под подпапку `<stem>`, для `.glb` — общий `<input>/3d/.ts_artius_browser/`. Два разных GLB с одинаковым именем перезатрут друг друга в стейджинге; `_TSCopyOrLinkFile` сравнивает size+mtime и просто заменяет файл. | Добавить `<stem>`-подпапку и для `.glb`/прочих non-obj форматов. |
| F20 | DB — leftover legacy table not dropped on reset | tsab/ts_db_schema.py:138-148 | Low | S | `TS_DB_RESET_INDEX_SQL` чистит `assets/asset_metadata/...`, но не упоминает `asset_user_fields` (которая в drop-скрипте есть, в schema-скрипте — нет). На свежей БД таблицы нет; на «старой» после resetIndex таблица останется с данными. Тривиальная утечка. | Добавить `DROP TABLE IF EXISTS asset_user_fields;` в `TS_DB_RESET_INDEX_SQL` или сделать reset через `_TSRebuildSchema` (drop+create). |
| F21 | Frontend — `tsConsoleWarn` hidden by default | js/ts-artius-browser-api.js:53-68 | Low | S | `tsEnableConsoleDebug = Boolean(tsBrowserRuntimeSettings.enableConsoleDebug)` — по умолчанию false, поэтому `tsConsoleWarn`/`tsConsoleDebug` молчат. Все catch-блоки фронта (фетчи, drag&drop, 3D capture, workflow load) тихо проглатывают ошибки. Жалобы пользователей будут диагностироваться слепым методом. | Минимум: для `console.warn` оставлять вывод всегда (warning ≠ debug). Альтернатива: отдельный флаг `enableErrorLogs` с дефолтом true. |
| F22 | Caching — config never reloaded after external edit | tsab/ts_config.py:21-22, 38-42 | Low | S | `TSCachedConfig` живёт всю жизнь процесса. `TSReloadConfig` существует, но не вызывается ни разу. Если оператор отредактирует `config.json` вручную — изменения не подхватятся до рестарта ComfyUI. | Решение продуктовое: либо зафиксировать поведение в README, либо добавить mtime-инвалидцию (одна `Path.stat()` при каждом `TSLoadConfig`). |
| F23 | Performance — repeat work in detail path | tsab/ts_asset_catalog.py:77-94 | Low | S | `TSGetAssetDetail` дополнительно вызывает `_TSRootMap()` после `ts_ensure_metadata`. На каждый одиночный detail запрос пересобирается список рутов из конфига. Не bottleneck, но симметрия с listing-путём не соблюдена (там кешируется в локальную). | Передать map один раз сверху или закешировать в сервисе по-короткому. |
| F24 | Documentation drift — minor | README.md:206 | Low | S | README говорит `min(4, cpu_count() // 2)`. Реально — `max(1, min(4, cpu_count() // 2))` (`tsab/ts_settings.py:6`). На большинстве машин совпадает; на 1-CPU виртуалках — нет. | Заменить формулу в README на корректную. |
| F25 | DB index alignment | tsab/ts_db_schema.py:80-92 | Low | S | На горячий запрос `assets_view` фильтр обычно `(root_id, folder_path)` + сортировка `created_at`/`mtime`/`filename`/`size_bytes`. Композитный индекс `(root_lookup_id, folder_lookup_id, created_at)` помог бы keyset-пагинации; сейчас есть только одиночные `idx_assets_root_lookup_id`/`idx_assets_folder_lookup_id`/`idx_assets_created_at`, и SQLite вынужден сортировать в памяти/выбирать одно из них. | После профилирования (EXPLAIN QUERY PLAN на типовом фильтре) добавить композит. До замеров — Open Question, не делать спекулятивно. |

**80-cap не достигнут.** Дедупликация уменьшила список с ~110 кандидатов до 25 строк.

---

## Top-5 «если ничего больше — почините это»

1. **F01 — починить keyset-пагинацию в 3D worker.**
   Файл `js/ts-artius-browser-3d-worker.js`:
   - В `tsBuildSearchPath` принимать `tsCursor` (`{sort_value, id}`-объект или null), а не `tsOffset`.
   - Заменить `tsParams.set("offset", ...)` на `tsParams.set("after_sort", ...)` + `tsParams.set("after_id", ...)`.
   - В `tsRun` хранить `tsCursor` в локальной переменной, обновлять из `tsPayload.next_cursor` после каждой страницы; цикл выходит при `!tsPayload?.has_more` или `next_cursor === null`.
   - Уложиться в ~10 строк изменений; добавить characterization-тест в `scripts/check_frontend_3d_characterization.mjs`.

2. **F02 — обновить тесты `test_config_store.py`.**
   - Заменить три литерала `13` на чтение из источника правды: `from tsab.ts_settings import TS_DEFAULT_CONFIG` и сравнивать с `TS_DEFAULT_CONFIG["version"]`.
   - В `CLAUDE.md` (или `AGENTS.md`) добавить пункт: «при bump-е `TS_DEFAULT_CONFIG['version']` запустить `python scripts/check_release.py`».
   - <10 строк диффа.

3. **F03 — изоляция импортов в тестах.**
   - В тестах, импортирующих `aiohttp`/`send2trash`/`PIL` сверху файла, перенести импорт внутрь setup или применить:
     ```python
     try: import aiohttp
     except ImportError: aiohttp = None
     ...
     @unittest.skipIf(aiohttp is None, "aiohttp not installed")
     ```
   - Альтернативно: добавить `requirements-dev.txt` с runtime-зависимостями ComfyUI, и в `check_release.py` дать ясный hint при их отсутствии.
   - Эффект: суит проходит локально без полного ComfyUI окружения.

4. **F07 — closing the path-traversal hole.**
   - В `tsab/ts_storage.py::TSResolveCachePath` после `resolve()` добавить проверку:
     ```python
     ts_resolved = ts_candidate.resolve() if ts_candidate.is_absolute() else (self.ts_asset_browser_directory / ts_candidate).resolve()
     try:
         ts_resolved.relative_to(self.ts_asset_browser_directory)
     except ValueError:
         raise ValueError(f"Preview path escapes cache root: {ts_relative_cache_path}")
     return ts_resolved
     ```
   - Прогнать `tests/test_storage_paths.py` + добавить негативный кейс.

5. **F06 — миграции не должны затирать пользовательскую конфигурацию.**
   - В `tsab/ts_config.py` строки 77-78, 96-97, 129-130: заменить `ts_tools["ffprobe_workers"] = ts_default[...]` на `ts_tools.setdefault("ffprobe_workers", ts_default[...])`.
   - Аналогично для всего блока v8 (`ts_preview[...]` строки 82-90).
   - Если был осознанный одноразовый сброс — пометить отдельным `force_reset_v8`-маркером, чтобы не повторяться при повторных миграциях.

---

## Quick wins (Low effort × Medium+ severity)

- [ ] **F02** — поправить ожидаемую версию в `test_config_store.py`. ~5 минут.
- [ ] **F12** — упростить `TSMigrate` if/else. ~10 минут.
- [ ] **F13** — удалить мёртвый блок `ts_needs_index` (171-177). ~2 минуты.
- [ ] **F14** — удалить декоративный if-else в `TSDetectSupportedType` для `.obj`. ~2 минуты.
- [ ] **F11** — обернуть `send_to_trash` в try/except в `TSDeleteWorkflowFile`. ~5 минут.
- [ ] **F20** — добавить `DROP TABLE IF EXISTS asset_user_fields` в `TS_DB_RESET_INDEX_SQL`. ~1 минута.
- [ ] **F24** — синхронизировать формулу `*_workers` в README с кодом. ~1 минута.

Эти семь точек закрываются за ~30 минут, при этом два пункта (F02, F11) реально снижают риск.

---

## Что выглядит подозрительно, но это нормально

- **Везде префикс `TS_` / `ts_`.** Не ошибка — это политика именования, зафиксированная в `CLAUDE.md` §22. Trying to «исправить» сломает компилятор стиля и характеризации.
- **Огромные `assets_view` JOIN-ы (`tsab/ts_db_schema.py:101-135`).** Похоже на тяжёлый view, но используется почти везде, а LEFT JOIN на `asset_metadata` даёт реальный выигрыш на keyset-странице (метадата не блокирует). Менять без замеров не стоит.
- **`ts_thread_lock` поверх `ts_async_lock` в `TSIndexer`.** Кажется избыточным, но реально работает: async-lock сериализует входы из коробок aiohttp, thread-lock — закрывает гонку в `TSRunScanSync`, который запускают через `asyncio.to_thread`.
- **Двойная регистрация роутов `/asset_browser/*` и `/api/asset_browser/*`.** Не баг — нужно для совместимости со старыми/новыми клиентами фронтенда ComfyUI.
- **`subprocess.Popen` с `text=True, errors="replace"` в `ts_tools`.** Выглядит небрежно, но как раз нужно: ffprobe-вывод может содержать невалидный UTF-8 в metadata, а `replace` спасает от падения. На Windows кодировка хоста ≠ UTF-8 — `encoding="utf-8"` форсит правильное поведение.
- **`TSExtractMetadata` всегда возвращает `has_metadata=True`.** Можно прочитать как «всегда true=ничего не делает». На самом деле флаг означает «попытка извлечения завершена», и продвигает статус до `metadata_ready` в `TSComputeAssetStatus`. Не баг.
- **Inline CSS как template-literal в `panel.js`/`viewer.js`.** Громоздко, но Shadow DOM ограничивает варианты: `link[rel="stylesheet"]` мог бы тащить лишний RTT, constructable stylesheets — вариант для рефакторинга, но не «ошибка».
- **`TSPersist3DCapturePreview` молча возвращает `""` при отказе.** Оставлено осознанно — фронтенд тогда показывает плейсхолдер, повторит позже. Логирование через `TSLogVerbose("preview.3d_capture.rejected", ...)` есть.
- **Два варианта `TSDeleteAssetIds`/`TSDeleteAssetPaths` в `ts_db.py`.** Path-вариант — для тестов и корректировки по path после изменения root, ID-вариант — для рантайма. Не дубликат.
- **`hashlib.blake2b(digest_size=32)` фолбэк при отсутствии `blake3`.** 256 бит — тот же hex-длиной 64; БД-схема не привязана к конкретному алгоритму, поэтому фолбэк не ломает контракт. Тоже осознано.
- **Глобальный `tsGlobal3DThumbnailWorkerSingleton` в frontend.** Не настоящий singleton-смерть — `tsDispose` отвязывает listener-ы, и init/dispose согласованы.

Если бы этого раздела не было, аудит выглядел бы фантомно-критичным. Включаю всё, что я рассматривал и решил не флагать.

---

## Открытые вопросы для мейнтейнера

1. **F04 (`/preview/{id}/warm`)** — это план для будущего фонового прогрева превью или огрызок удалённой фичи? Если первое — оставить с `TODO`-комментарием; если второе — снести.
2. **F06** — форс-сброс `*_workers` и `preview` в миграциях v8/v9/v14 — намеренный «заставить всех взять новый дефолт после перфоманс-фикса» или баг? В текущем DEV-режиме разница незаметна.
3. **F25** — есть ли реальный плохой EXPLAIN QUERY PLAN на keyset-странице с большой библиотекой (>50k записей)? Без замеров добавление композитного индекса — спекуляция.
4. **F22** — должно ли изменение `config.json` снаружи подхватываться без рестарта? Сейчас не подхватывается.
5. **F17 / F18** — есть ли сценарий пересоздания runtime в одном процессе (тесты в одном прогоне)? Текущий module-global flag это блокирует.
6. **F21** — `tsConsoleWarn` молчит по умолчанию. Это намеренная тишина в DevTools или просто забытый дефолт?
7. **F19** — конфликт имён в стейджинге `.glb` (без stem-подпапки) — реальный кейс для пользователей с одинаково названными ассетами в разных коллекциях?
