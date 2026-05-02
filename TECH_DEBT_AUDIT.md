# Аудит технического долга

## Краткое резюме

- **High:** `custom_roots` без явного `id` получают нестабильный `root_id` через Python `hash()`, поэтому сохраненный UI state и DB root identity могут меняться после каждого рестарта.
- **High:** один плохой или исчезнувший файл может оборвать весь scan: обработка кандидата не изолирует исключения на уровне файла.
- **High:** staging для OBJ/MTL может скопировать texture-файлы за пределами папки модели, если модель ссылается на `../...`.
- **High:** `typing_extensions` импортируется на critical import path, но не объявлен в `pyproject.toml` / `requirements.txt`.
- **Medium:** DB migration при любом изменении `user_version` делает drop schema; это уничтожает `tags` / `rating`, которые код явно пытается сохранять.
- **Medium:** release workflow публикует в registry без `scripts/check_release.py` и использует mutable action `@main` с registry token.
- **Medium:** config загружается без schema validation и сохраняется неатомарно; битый JSON молча заменяется defaults.
- **Medium:** frontend все еще держит основные UI state/render/fetch/event paths в двух god components.
- **Medium:** route handlers валят невалидные request payloads в 500 вместо контролируемого 400/404.
- **Low:** README обещает многоязычность, но локализованные секции в файле повреждены mojibake.

## Архитектурная модель

Это ComfyUI custom extension без собственных workflow nodes: Python bootstrap поднимает runtime singleton, регистрирует HTTP routes и хранит SQLite/cache в `ComfyUI/output/.ts_artius_browser`; frontend монтирует sidebar panel, lightbox viewer, workflow browser и 3D thumbnail worker. Backend разделен на runtime facade, scan service, indexer, SQLite repository, media handlers и preview cache; frontend разделен на entry/API/helpers, но фактические UI surfaces все еще сосредоточены в `ts-artius-browser-panel.js` и `ts-artius-browser-viewer.js`.

README и local LLM docs в целом совпадают с кодом по главным invariants: workflow browser frontend-only, search filename-only, delete через trash, 3D thumbnails frontend-captured. Противоречия есть не в mental model, а в release/test reality: README говорит, что release check валидирует unit tests, но `tests/` и `doc/` намеренно игнорируются и не публикуются, а CI publish job эти checks вообще не запускает.

## Исключено из аудита

- `.git/` — служебные данные Git.
- `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.coverage`, `htmlcov/` — generated/cache artifacts.
- `.codex_tmp*/` — локальные временные директории тестов и прошлых запусков; часть путей даже недоступна для чтения.
- `build/`, `dist/`, `*.egg-info/`, `node_modules/`, `vendor/`, `.next/`, `target/` — build/vendor/generated patterns; в текущем checkout почти отсутствуют.
- `img/ts-artius-browser.jpg`, `icon.png` — binary assets, не анализировались как code debt.

## Ориентация и метрики

Точки входа и hot paths:

- Python import/startup: `__init__.py:8`, `__init__.py:9`, `__init__.py:12`.
- Route layer: `tsab/ts_routes.py:16`.
- Runtime facade: `tsab/ts_runtime.py:33`.
- Scan/index hot path: `tsab/ts_indexer.py:95`, `tsab/ts_indexer_processing.py:11`, `tsab/ts_indexer_discovery.py:88`.
- DB/query hot path: `tsab/ts_db.py:15`, `tsab/ts_db_query.py:59`.
- Frontend entry/UI: `js/ts-artius-browser.js:44`, `js/ts-artius-browser-panel.js:67`, `js/ts-artius-browser-viewer.js:33`, `js/ts-artius-browser-3d-worker.js:15`.
- Редко затрагиваемые зоны: release scripts, local ignored tests/docs, workflow delete path, 3D OBJ staging.

Топ-20 самых больших text/code файлов по числу строк:

| Lines | File |
|---:|---|
| 2445 | `js/ts-artius-browser-panel.js` |
| 1886 | `js/ts-artius-browser-viewer.js` |
| 1129 | `doc/LLM_TECHNICAL_GUIDE.md` |
| 526 | `js/ts-artius-browser-api.js` |
| 512 | `scripts/check_frontend_panel_characterization.mjs` |
| 477 | `agents.md` |
| 442 | `tsab/ts_db.py` |
| 407 | `scripts/check_frontend_api_characterization.mjs` |
| 383 | `README.md` |
| 357 | `scripts/check_frontend_viewer_characterization.mjs` |
| 317 | `tests/test_asset_processing.py` |
| 299 | `tsab/ts_indexer.py` |
| 290 | `tsab/ts_runtime.py` |
| 288 | `tsab/ts_preview.py` |
| 285 | `tests/test_asset_catalog.py` |
| 265 | `REFACTOR_REPORT.md` |
| 219 | `doc/LLM_QUICK_HANDOFF.md` |
| 213 | `tsab/ts_tools.py` |
| 213 | `tests/test_indexer_processing.py` |
| 194 | `tests/benchmark_indexer_scan.py` |

Топ-20 чаще всего изменявшихся файлов за последние 6 месяцев:

| Changes | File |
|---:|---|
| 16 | `tsab/ts_runtime.py` |
| 15 | `js/ts-artius-browser-panel.js` |
| 12 | `pyproject.toml` |
| 11 | `js/ts-artius-browser-viewer.js` |
| 10 | `scripts/check_frontend_api_characterization.mjs` |
| 10 | `js/ts-artius-browser-api.js` |
| 7 | `tsab/ts_indexer.py` |
| 7 | `README.md` |
| 7 | `js/localization/en.json` |
| 6 | `tsab/media/image.py` |
| 6 | `scripts/check_release.py` |
| 5 | `tsab/ts_db.py` |
| 5 | `.gitignore` |
| 5 | `tsab/ts_routes.py` |
| 4 | `REFACTOR_REPORT.md` |
| 4 | `scripts/check_frontend_panel_characterization.mjs` |
| 4 | `tests/test_image_prompt_metadata.py` |
| 3 | `tsab/media/audio.py` |
| 3 | `tests/test_media_probe.py` |
| 3 | `tests/test_database_query.py` |

Пересечение size и churn: `js/ts-artius-browser-panel.js`, `js/ts-artius-browser-viewer.js`, `js/ts-artius-browser-api.js`, `tsab/ts_runtime.py`, `tsab/ts_indexer.py`, `tsab/ts_db.py`, `tsab/media/image.py`, `tsab/ts_routes.py`.

## Таблица находок

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|---|---|---|---|---|---|---|
| TD-001 | Архитектура / consistency | `tsab/ts_storage.py:121` | High | S | `custom_roots` без явного `id` получают `custom_{abs(hash(path))}`. Python `hash()` salted per process, поэтому root identity меняется между рестартами. Для этого проекта это ломает persisted `selected_root_id`, DB `asset_roots`, tree/filter state и любое будущее user data, привязанное к root. | Заменить на стабильный digest от normalized path, например `blake2b(..., digest_size=8)`. При наличии старых generated IDs оставить fallback/alias на один релиз. |
| TD-002 | Обработка ошибок / надежность | `tsab/ts_indexer_processing.py:26`, `tsab/ts_indexer_processing.py:37`, `tsab/ts_hashing.py:20`, `tsab/media/image.py:81`, `tsab/ts_indexer.py:273` | High | M | Per-file processing не изолирован: hash read, preview/metadata extraction и image metadata read могут бросить исключение; верхний catch стоит вокруг всего scan и переводит весь scan в error. В output/input папках ComfyUI реалистичны полузаписанные, удаленные или битые файлы. Один такой файл останавливает индексирование всей библиотеки. | Обернуть обработку одного candidate в narrow `try`, логировать path/type/reason, возвращать placeholder/failed status или `None`, не валить весь scan. Добавить тест на битый `.png` и файл, исчезающий между walk/hash. |
| TD-003 | Безопасность | `tsab/ts_load3d_stage.py:40`, `tsab/ts_load3d_stage.py:74`, `tsab/ts_load3d_stage.py:122`, `tsab/ts_load3d_stage.py:125` | High | M | OBJ/MTL reference resolver принимает пути, которые после `resolve()` могут выйти за папку модели. Если MTL ссылается на `../../secret.png`, staging скопирует найденный texture в `input/3d/.ts_artius_browser/...` под basename. Для локального browser это превращает импорт untrusted OBJ в copy/read primitive за пределами asset folder. | Разрешать references только внутри директории модели или внутри configured asset root. После `resolve()` проверять `relative_to(allowed_root)`, абсолютные и escaping refs отклонять с verbose warning. |
| TD-004 | Зависимости | `tsab/ts_nodes.py:3`, `pyproject.toml:7`, `requirements.txt:1` | High | S | `typing_extensions.override` импортируется при загрузке extension, но `typing_extensions` не указан ни в `dependencies`, ни в `requirements.txt`. На Python 3.10/3.11 это не stdlib; отсутствие пакета ломает import всего custom node. | Добавить `typing_extensions>=4.8` в `pyproject.toml` и `requirements.txt`, либо сделать fallback `try: from typing import override`. |
| TD-005 | Schema / migrations | `tsab/ts_db.py:45`, `tsab/ts_db.py:46`, `tsab/ts_db_schema.py:5`, `tsab/ts_db_schema.py:49`, `tsab/ts_db_schema.py:50` | Medium | M | При любом несовпадении `PRAGMA user_version` код делает full drop schema. Это терпимо для purely generated cache, но schema уже содержит `tags` и `rating`, а indexer специально переносит эти поля между reindex runs. Следующее изменение schema уничтожит эти данные. | Ввести additive migrations по версиям. Если full rebuild нужен, сначала сохранить user fields keyed by normalized path и восстановить после schema upgrade. |
| TD-006 | Config / contract debt | `tsab/ts_config.py:40`, `tsab/ts_config.py:42`, `tsab/ts_storage.py:102`, `tsab/ts_storage.py:105`, `tsab/ts_ui_settings.py:17`, `tsab/ts_ui_settings.py:36` | Medium | S | Config deep-merge принимает произвольные типы. `custom_roots: "x"` даст iteration по символам и `.get` на `str`; нечисловой `asset_preview_size` падает в `int()` внутри settings read path. Это превращает ручную правку или поврежденный config в runtime 500/scan failure. | Добавить компактную schema-normalization layer: `custom_roots` только list[dict], numeric fields через safe parse, invalid values сбрасывать с warning. |
| TD-007 | Config / надежность | `tsab/ts_config.py:25`, `tsab/ts_config.py:30`, `tsab/ts_config.py:32`, `tsab/ts_utils.py:40`, `tsab/ts_utils.py:42` | Medium | S | `config.json` пишется через `write_text()` прямо поверх файла, а JSON parse error молча возвращает default. Crash/kill во время save может оставить partial JSON; следующий запуск без сообщения потеряет custom roots, tool paths и UI state. | Писать во временный файл рядом и делать atomic replace; при parse error сохранять `.corrupt` backup и логировать предупреждение. |
| TD-008 | Обработка ошибок / API contract | `tsab/ts_routes.py:122`, `tsab/ts_routes.py:123`, `tsab/ts_routes.py:164`, `tsab/ts_routes.py:166`, `tsab/ts_routes.py:196`, `tsab/ts_routes.py:197` | Medium | S | Route handlers делают raw `int()` и `ts_payload.get()` без type guards. Невалидный `{id}` или body вроде `[]` на delete даст `ValueError`/`AttributeError` и 500. Для browser API это шумит logs и скрывает реальные failures. | Ввести helper `TSParseRequiredAssetId()` и body validation. Возвращать `HTTPBadRequest` для invalid id/body, `HTTPNotFound` только для отсутствующего asset. |
| TD-009 | Performance / resource hygiene | `tsab/ts_routes.py:196`, `tsab/ts_routes.py:199`, `tsab/ts_preview.py:142`, `tsab/ts_preview.py:149`, `tsab/ts_preview.py:150` | Medium | S | 3D thumbnail endpoint принимает произвольный data URL, полностью base64-decode в память и затем открывает через Pillow. Локальный frontend обычно шлет маленький canvas, но route открыт для любого request в ComfyUI server context; большой payload может съесть память. | Ограничить `Content-Length`, длину base64 и decoded bytes; проверять MIME whitelist и размеры image до decode/open, возвращать 413/400. |
| TD-010 | Build / CI | `.github/workflows/publish_action.yml:17`, `.github/workflows/publish_action.yml:18`, `.github/workflows/publish_action.yml:20`, `README.md:213`, `README.md:217`, `scripts/check_release.py:181` | Medium | M | GitHub workflow сразу публикует custom node через `Comfy-Org/publish-node-action@main` с registry token. Он не запускает `scripts/check_release.py`, хотя README называет его release gate. `@main` mutable, поэтому supply-chain risk прямо на publish path. | Добавить pre-publish job/step: install deps, run `python scripts/check_release.py`, then publish. Pin action to version/SHA and restrict permissions. |
| TD-012 | Архитектура | `js/ts-artius-browser-panel.js:67`, `js/ts-artius-browser-panel.js:1150`, `js/ts-artius-browser-panel.js:1835`, `js/ts-artius-browser-viewer.js:33`, `js/ts-artius-browser-viewer.js:57`, `js/ts-artius-browser-viewer.js:1212` | Medium | L | Два frontend custom elements остаются god components: panel owns state, settings persistence, fetch, tree/grid virtualization, 3D thumbnail scheduling, event binding; viewer owns markup/CSS, detail loading, media rendering and media controls. Это не просто "большие файлы": оба файла одновременно входят в top size и top churn, значит каждое изменение UI идет через самые рискованные modules. | Не переписывать. Выделять по одному responsibility при следующих изменениях: request controller, render builders, event subscription lifecycle, media controllers. Зафиксировать public DOM/event contracts characterization tests. |
| TD-013 | ComfyUI compatibility / frontend debt | `js/ts-artius-browser-api.js:420`, `js/ts-artius-browser-api.js:422`, `js/ts-artius-browser-api.js:471`, `js/ts-artius-browser-api.js:482`, `js/ts-artius-browser-api.js:491` | Medium | M | Drag/drop integration падает на private/legacy surfaces: `app.graph._nodes`, `window.LiteGraph.createNode`, `app.canvas.graph_mouse`. В проекте заявлен modern ComfyUI / Vue migration context; эти fallback paths станут brittle при frontend API changes. | Инкапсулировать legacy access в отдельный adapter с feature detection и явным compatibility matrix. Где есть public Comfy API, использовать его первым; legacy fallback логировать один раз. |
| TD-014 | Resource hygiene / observability | `js/ts-artius-browser-panel.js:1208`, `js/ts-artius-browser-panel.js:1213`, `js/ts-artius-browser-panel.js:167`, `js/ts-artius-browser-panel.js:175`, `js/ts-artius-browser-3d-worker.js:40`, `js/ts-artius-browser-3d-worker.js:54` | Medium | S | Long-lived event subscriptions не имеют полного teardown. Panel добавляет API listeners, но `disconnectedCallback()` чистит только observers/timers; 3D worker добавляет API listeners через anonymous callbacks, поэтому `tsDispose()` не может их снять. При hot reload/sidebar remount это дает stale handlers и duplicate reactions. | Хранить bound listener references, удалять их в `disconnectedCallback()` / `tsDispose()`. Для singleton добавить idempotent subscription guard и тест на repeated mount. |
| TD-015 | Документация | `README.md:9`, `README.md:10`, `README.md:11`, `README.md:352`, `README.md:354`, `README.md:381` | Low | S | README advertises localized sections, но большая часть non-English text повреждена mojibake (`Р Сѓ...`, `дё­...`, `FranГ§ais`). Это делает install/troubleshooting docs для этих языков фактически нечитаемыми. | Переоткрыть исходник в правильной encoding и заменить поврежденные sections, либо временно оставить только English до нормальной локализации. |
| TD-016 | Consistency / API contract | `tsab/ts_routes.py:98`, `tsab/ts_db_query.py:59`, `tsab/ts_db_query.py:79`, `tsab/ts_db_query.py:114` | Low | S | Route layer принимает `metadata` query param как `metadata_filter`, но query builder его не использует. При этом рядом реально работают `types`, `root_ids`, dimensions и rating filters. Это мертвый API hook, который выглядит поддержанным, но ничего не делает. | Удалить param из route до появления feature или реализовать фильтр с тестом. Если filename-only invariant остается, явно не принимать `metadata`. |

## Топ-5: если больше ничего не исправлять, исправьте это

1. Стабилизировать `custom_root` identity.

```python
# tsab/ts_storage.py
import hashlib

def _TSStableCustomRootId(ts_path: Path) -> str:
    ts_key = TSNormalizePathString(ts_path).encode("utf-8")
    return f"custom_{hashlib.blake2b(ts_key, digest_size=8).hexdigest()}"

ts_root_id = str(ts_custom_root.get("id") or _TSStableCustomRootId(ts_custom_path))
```

2. Изолировать per-file scan failures.

```python
# tsab/ts_indexer_processing.py
try:
    ts_hash = ts_compute_file_hash(ts_asset_stat.ts_path)
    ts_payload = ts_handler.TSBuildIndexedPayload(ts_asset_stat, ts_hash)
    ts_preview_path = ts_handler.TSGeneratePreview(ts_processing_row)
    ts_metadata_payload = ts_handler.TSExtractMetadata(ts_processing_row)
except (OSError, ValueError) as ts_error:
    TSLogVerbose("indexer.candidate.failed", path=str(ts_asset_stat.ts_path), error=str(ts_error))
    return None, ts_existing_row
```

3. Запретить OBJ/MTL references вне allowed root.

```python
def _TSResolveReferenceCandidates(ts_base_directory: Path, ts_reference_text: str) -> list[Path]:
    ts_base = ts_base_directory.resolve()
    ...
    ts_candidate_path = (ts_base / ts_candidate).resolve()
    try:
        ts_candidate_path.relative_to(ts_base)
    except ValueError:
        continue
```

4. Сделать config save atomic и типизировать вход.

```python
# tsab/ts_config.py
def TSSaveConfig(self, ts_config: dict) -> dict:
    ts_merged = self.TSMergeDefaults(TSNormalizeConfig(ts_config))
    ts_temp_path = self.ts_config_path.with_suffix(".json.tmp")
    ts_temp_path.write_text(TSJsonDumps(ts_merged), encoding="utf-8")
    ts_temp_path.replace(self.ts_config_path)
    self.ts_cached_config = ts_merged
    return copy.deepcopy(ts_merged)
```

5. Закрыть release gate.

```yaml
# .github/workflows/publish_action.yml
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
- run: pip install -r requirements.txt
- run: python scripts/check_release.py
- uses: Comfy-Org/publish-node-action@<pinned-sha>
  with:
    personal_access_token: ${{ secrets.REGISTRY_ACCESS_TOKEN }}
```

## Быстрые победы

- [ ] TD-001: заменить `hash()` на stable digest.
- [ ] TD-004: добавить `typing_extensions` или stdlib fallback.
- [ ] TD-008: централизовать parsing/validation для route ids и JSON bodies.
- [ ] TD-009: поставить size limit на 3D thumbnail payload.
- [ ] TD-014: сохранить listener references и снять их в teardown.
- [ ] TD-016: удалить или реализовать `metadata_filter`.

## Выглядит плохо, но на деле нормально

- `send2trash` в delete path выглядит опасно, но asset delete проверяет `allow_delete` и `relative_to(root)` перед trash: `tsab/ts_delete.py:38`, `tsab/ts_delete.py:48`, `tsab/ts_delete.py:54`.
- `subprocess.run()` для ffmpeg/ffprobe не является shell injection: команды передаются списком аргументов и `shell=True` не используется: `tsab/ts_tools.py:92`, `tsab/ts_tools.py:93`.
- Dynamic SQL через f-strings в DB layer в основном строит placeholder lists и fixed identifiers, а пользовательские значения идут параметрами: `tsab/ts_db.py:131`, `tsab/ts_db.py:134`, `tsab/ts_db_query.py:81`.
- `ts-artius-browser-viewer-meta.js` все еще содержит `tsBuildPromptSeedMetaMarkup`, но actual image path использует `tsBuildImageMetaMarkup`, а README invariant "seed is not stored anymore" соблюдается: `js/ts-artius-browser-viewer.js:1024`, `js/ts-artius-browser-viewer.js:1025`, `README.md:171`.
- Большой `ts_runtime.py` больше не выглядит главным god file: он 290 LOC и в основном делегирует scan/settings/catalog/delete/workflow services: `tsab/ts_runtime.py:66`, `tsab/ts_runtime.py:74`, `tsab/ts_runtime.py:258`, `tsab/ts_runtime.py:307`.
- Игнорирование `tests/` и `doc/` не является debt для этого проекта: maintainer policy — держать unit/characterization tests и техническую документацию только локально, вне public repo: `.gitignore:39`, `.gitignore:40`.

## Открытые вопросы maintainer

- `tags` и `rating` в DB schema — будущая user-facing feature или остатки старой модели? От ответа зависит severity TD-005.
- Можно ли считать все OBJ/MTL из asset roots trusted? Если пользователи скачивают модели из интернета, TD-003 надо чинить раньше UI debt.
- Гарантирует ли целевой ComfyUI runtime наличие `typing_extensions`? Если нет, TD-004 является hard import bug.
- Нужен ли публичный `metadata` filter в `/asset_browser/search`, или filename-only search должен отвергать этот параметр?

## Проверки и ограничения инструментов

- Выполнено: `git log --oneline -200`.
- Выполнено: churn analysis через PowerShell equivalent `git log --since="6 months ago" --pretty=format: --name-only | Group-Object ...`.
- Выполнено: Python syntax parse через `ast.parse` без записи `.pyc`.
- Выполнено: `node --check` для production `*.js`.
- Выполнено: JSON parse для `*.json`.
- Выполнено: `git diff --check`.
- Не запускалось: `python scripts/check_release.py`, потому что он использует `py_compile` и unit tests, которые создают `__pycache__` / `.codex_tmp*`, что нарушает read-only constraint этого аудита.
- Не запускалось: `pytest`, потому что текущие tests hardcode temp dirs under repo (`tests/test_asset_catalog.py:17`, `tests/test_delete_service.py:15`) и уже есть `.codex_tmp*` artifacts.
- Недоступно в окружении: `ast-grep`, `ruff`, `pip-audit`, `mypy`, `vulture`.
- Не запускалось: `npm audit`, `knip`, `madge`, `depcheck`, `tsc --noEmit`, потому что в repo нет `package.json` / TS project manifest.
