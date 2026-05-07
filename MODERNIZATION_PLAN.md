# План модернизации Artius Browser

## 1. Сводка

- **Тип пака:** V3 `ComfyExtension` (UI sidebar). `comfy_entrypoint()` возвращает `TSArtiusBrowserExtension`, `get_node_list()` возвращает `[]` — нод нет, только sidebar + кастомные HTTP-роуты + drag-into-native.
- **Чек-лист:** ✓ 2 / ⚠ 7 / ✗ 6 (из 15 пунктов; шаги по multi-version CI matrix и `COMPATIBILITY.md`/ADRs сознательно исключены из плана внедрения).
- **Главный риск:** `from comfy_api.latest` в `tsab/ts_nodes.py:8` — официально нестабильный импорт; `requires-comfyui` отсутствует. Любое breaking-изменение `comfy_api.latest` или фронтенд-API ломает пак тихо, у пользователей.

## 2. Контекст

- **Имя / версия / publisher:** `comfyui-artius-browser` / `0.7` / `timesaver`.
- **`comfy_api` импорты:** mixed-bad — единственная точка входа `tsab/ts_nodes.py:8` использует `comfy_api.latest`. В системе доступны `v0_0_1` и `v0_0_2` (проверено в локальном `ComfyUI/comfy_api/`).
- **HTTP routes:** 15 групп, обе формы (`/asset_browser/...` и `/api/asset_browser/...`), регистрируются в `tsab/ts_routes.py:73-140` через `PromptServer.instance.app.add_routes`.
- **Тестовая инфра:** в репо — 35+ unit-тестов в `tests/` (моки/фейки aiohttp), `scripts/check_release.py` (Python/JS syntax, JSON, локализация, dead defs, unit-tests, git whitespace, frontend characterization). Live-ComfyUI / Playwright / e2e тестов в репо нет.
- **CI:** `.github/workflows/publish_action.yml` (Comfy-Org/publish-node-action на push в `main` при изменении `pyproject.toml`). Test-workflow нет.

## 3. Чек-лист — статус

1. **comfy_api pinned:** ⚠ — `tsab/ts_nodes.py:8` импортирует `comfy_api.latest`. По V3-доке `latest` помечен нестабильным.
2. **Native node IDs в одном модуле + smoke-test:** ⚠ — централизованы в `js/ts-artius-browser-settings.js:22-25` через `tsApiSettings.nativeWorkflowTargets`, но один литерал `"Load3D"` остался в `js/ts-artius-browser-api.js:359`. Smoke-теста (`GET /object_info/<id>` против живого сервера) нет.
3. **Доступ к внутренностям ComfyUI funnelled + lint-enforced:** ⚠ — фронт-адаптер реально соблюдается (только `js/ts-artius-browser-api-workflow.js` трогает `LiteGraph.*` / `app.canvas.*` / `app.graph.*`, проверено `Grep`-ом); бэкенд использует `folder_paths` API в `tsab/ts_storage.py`. Однако lint-rule (pre-commit / CI) нет — в любой момент новый файл может пробить стену.
4. **Drag-and-drop adapter тест в репо + CI:** ✗ — отсутствует. Самая хрупкая граница пака без e2e-покрытия.
5. **Backend HTTP integration тесты в репо + CI:** ⚠ — unit-тесты с fake-aiohttp есть (`tests/test_route_validation.py`, `tests/test_workflow_routes.py`). Live-ComfyUI integration / negative-path для отсутствующего `ffmpeg`/`ffprobe` нет.
6. **Multi-version CI матрица:** ✗ — нет `comfy-env.toml`, нет test-workflow, `windows_portable` не покрыт.
7. **`requires-comfyui` + `comfyui-frontend-package` pinned:** ✗ — `requires-comfyui` отсутствует в `pyproject.toml`. `comfyui-frontend-package` **не релевантен** — пак не импортирует его как Python-пакет (проверено грепом).
8. **`requirements.txt` чистый:** ✓ — только `blake3`, `send2trash`, `typing_extensions`. Нет `torch*`, нет `xformers`/`triton`/`flash-attn`. Pillow-SIMD только в комментарии.
9. **On-disk schema migration:** ✓ — `tsab/ts_db.py:45-77` использует `PRAGMA user_version` + safe rebuild fallback (DB schema v10), WAL включён (`tsab/ts_db.py:29`). `tsab/ts_config.py:48-148` имеет каскадные миграции v5→v16 для `config.json`.
10. **Path traversal protection на HTTP routes:** ⚠ — дизайн безопасен: `/asset_browser/file?path=` смотрит точное совпадение в БД (`TSGetAssetByPath`, `tsab/ts_db.py:422-426`, exact-match parameterized), `/asset_browser/workflow/delete` проходит через `TSNormalizeWorkflowRelativePath` (отказ на `..`, требование префикса `workflows/` и `.json`) + ComfyUI `user_manager.get_request_user_filepath`. Однако автоматических fuzz-тестов с векторами `..`, `..\`, URL-encoded, абсолютными путями в `tests/` нет.
11. **`pyproject.toml` Registry-compliant:** ⚠ — `name`, `version`, `[tool.comfy] PublisherId`, `[project.urls] Repository`, `license = { file = "LICENSE.txt" }` ✓; **отсутствует** `[tool.comfy] requires-comfyui`, `[project.urls] Bug Tracker`, поле `readme`. `version = "0.7"` не в semver (нужно `0.7.0`).
12. **`LICENSE` + `CHANGELOG.md` + `publish.yml` + `test.yml`:** ⚠ — `LICENSE.txt` есть и валиден (PEP 621 допускает любое имя в `license.file`, GitHub Licensee тоже распознаёт `.txt`), `publish_action.yml` есть. **Отсутствуют:** `CHANGELOG.md`, `test.yml` (с обвязкой `scripts/check_release.py`).
13. **`.pre-commit-config.yaml` с проектными правилами:** ✗ — отсутствует. Solo-dev защиты от случайного `print()` в `tsab/`, `torch` в `requirements.txt`, `LiteGraph.*` вне адаптера, литералов native node ID, `comfy_api.latest` нет.
14. **`.github/ISSUE_TEMPLATE/bug.yml`:** ✗ — отсутствует. Каждый bug-report стоит лишних 30 минут переписки.
15. **`COMPATIBILITY.md` + 3-5 ADR в `docs/adr/`:** ✗ — отсутствует. Контракта обратной совместимости и хроники архитектурных решений нет (хотя `AGENTS.md` / `CLAUDE.md` частично перекрывают рабочие правила).

## 4. План внедрения

Шаги отсортированы: сначала critical-cheap (один вечер), потом high-leverage защиты, потом тест-инфра, потом долгая гигиена. ✓-пункты не включены.

---

### Шаг 1: Закрепить версию `comfy_api`

**Пункт чек-листа:** 1
**Приоритет:** Critical
**Effort:** S (10 мин)
**Что сделать:** Заменить `from comfy_api.latest` на `comfy_api.v0_0_2` (самая свежая стабильная — проверено в локальном `ComfyUI/comfy_api/`, доступны `v0_0_1` и `v0_0_2`).
**Куда положить:** `tsab/ts_nodes.py:8`
**Шаблон:**
```python
# было:
# from comfy_api.latest import ComfyExtension as TSComfyExtension, IO as TSIO
# стало:
from comfy_api.v0_0_2 import ComfyExtension as TSComfyExtension, IO as TSIO
```
**Проверка:** `python -m compileall .`; перезапуск ComfyUI — пак регистрируется, sidebar появляется.

---

### Шаг 2: Дополнить `pyproject.toml` обязательными Registry-полями

**Пункт чек-листа:** 7, 11
**Приоритет:** Critical
**Effort:** S (30 мин)
**Что сделать:** Добавить `[tool.comfy] requires-comfyui`, `[project.urls] "Bug Tracker"`, `readme`. Перевести `version` в semver (`0.7` → `0.7.0`).
**Куда положить:** `pyproject.toml`
**Шаблон:**
```toml
[project]
name = "comfyui-artius-browser"
version = "0.7.0"
description = "Timesaver Artius Browser: lightweight asset browser for modern ComfyUI workflows."
readme = "README.md"
license = { file = "LICENSE.txt" }
requires-python = ">=3.10"
dependencies = [
    "blake3>=1.0.5",
    "send2trash>=1.8.3",
    "typing_extensions>=4.8.0",
]

[project.urls]
Repository = "https://github.com/AlexYez/comfyui-artius-browser"
"Bug Tracker" = "https://github.com/AlexYez/comfyui-artius-browser/issues"

[tool.comfy]
PublisherId = "timesaver"
DisplayName = "Timesaver Artius Browser"
Icon = "https://raw.githubusercontent.com/AlexYez/comfyui-artius-browser/refs/heads/main/icon.png"
requires-comfyui = ">={{REAL_LOWER_BOUND}}"
```
**Заменить `{{REAL_LOWER_BOUND}}` на минимальную проверенную версию ComfyUI** (та, что поддерживает `comfy_entrypoint` + V3 `ComfyExtension` — проверить вручную, какая версия сейчас стоит локально и работает).
**Проверка:** `python -c "import tomllib; tomllib.loads(open('pyproject.toml','rb').read())"`; затем тестовая публикация в Registry с feature-бранча.

---

### Шаг 3: Убрать литерал `"Load3D"` из `ts-artius-browser-api.js`

**Пункт чек-листа:** 2
**Приоритет:** High
**Effort:** S (5 мин — `tsNativeWorkflowTargets` уже импортирован на строке 50)
**Что сделать:** Использовать уже доступную константу `tsNativeWorkflowTargets["3d"].tsNodeType` вместо литерала `"Load3D"`.
**Куда положить:** `js/ts-artius-browser-api.js:359`
**Шаблон:**
```javascript
// было:
// if (!tsNode || tsNodeClass !== "Load3D" || tsAsset?.type !== "3d") {

// стало (tsNativeWorkflowTargets уже доступен из строки 50):
const tsExpected3DNodeClass = tsNativeWorkflowTargets["3d"]?.tsNodeType;
if (!tsNode || tsNodeClass !== tsExpected3DNodeClass || tsAsset?.type !== "3d") {
```
**Проверка:** `node --check js/ts-artius-browser-api.js`; запуск ComfyUI, drag 3D-ассета на Load3D — поведение прежнее.

---

### Шаг 4: Защитить путь-обхода fuzz-тестами на unit-уровне

**Пункт чек-листа:** 10
**Приоритет:** Medium (дизайн уже безопасный — whitelist через БД и нативный валидатор; не хватает регрессионных тестов)
**Effort:** S (1-2 ч)
**Что сделать:** Добавить unit-тест, который вызывает `TSHandleFile` и `TSHandleWorkflowDelete` с набором векторов и проверяет, что `TSHandleFile` возвращает `HTTPNotFound` (когда `TSGetAssetByPath` возвращает `None`), а `TSDeleteRequestWorkflowFile` поднимает `HTTPBadRequest` через `TSNormalizeWorkflowRelativePath`.
**Куда положить:** `tests/test_path_traversal_vectors.py`
**Шаблон (структура — повторить заглушку aiohttp как в `tests/test_route_validation.py:39-49`):**
```python
import asyncio, pathlib, sys, types, unittest, urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
# ... (повторить sys.modules['aiohttp'] заглушку как в test_route_validation.py)

VECTORS = [
    "../../../../etc/passwd",
    "..\\..\\..\\Windows\\System32\\config\\SAM",
    "/etc/passwd",
    urllib.parse.quote("../../../../etc/passwd"),
    "../" * 30 + "etc/passwd",
    "workflows/../../../../etc/passwd",
    "workflows/.\\..\\secrets.json",
]

class TSPathTraversalTests(unittest.TestCase):
    def test_file_route_returns_not_found_for_traversal(self):
        # стенд: TSFakeRuntime с TSGetAssetByPath -> None для всех путей
        # ассертим HTTPNotFound для каждого VECTORS
        ...

    def test_workflow_delete_rejects_traversal(self):
        # ассертим HTTPBadRequest на TSDeleteRequestWorkflowFile
        # (TSNormalizeWorkflowRelativePath отбивает все векторы выше)
        ...
```
**Проверка:** `python -m unittest tests.test_path_traversal_vectors`.

---

### Шаг 5: Добавить `.pre-commit-config.yaml` с проектными правилами

**Пункт чек-листа:** 3, 13
**Приоритет:** High
**Effort:** S (1 ч)
**Что сделать:** Lint-rule превращают конвенции из `CLAUDE.md` в исполняемые. На Windows pre-commit использует bash от Git for Windows (ставится по умолчанию с Git) — должно работать без доп. установки.
**Куда положить:** `.pre-commit-config.yaml` в корне.
**Шаблон:**
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
    hooks: [{ id: ruff, args: [--fix=false] }]
  - repo: local
    hooks:
      - id: no-torch-in-requirements
        name: No torch* in requirements.txt
        entry: bash -c '! grep -nE "^(torch|torchvision|torchaudio)([<>=!~]|$)" requirements.txt'
        language: system
        pass_filenames: false
      - id: no-print-in-tsab
        name: No print() in tsab/ runtime code
        entry: bash -c '! grep -rnE "^[^#]*\bprint\(" --include="*.py" tsab/'
        language: system
        pass_filenames: false
      - id: no-comfy-internals-outside-adapter
        name: LiteGraph/canvas/graph access only in api-workflow.js
        entry: bash -c '! grep -rnE "(LiteGraph\.|app\.canvas\.|app\.graph\.)" --include="*.js" js/ | grep -v "ts-artius-browser-api-workflow\.js"'
        language: system
        pass_filenames: false
      - id: no-comfy-api-latest
        name: comfy_api.latest is unstable; pin a versioned subpackage
        entry: bash -c '! grep -rnE "from comfy_api\.latest|import comfy_api\.latest" --include="*.py" tsab/'
        language: system
        pass_filenames: false
      - id: no-native-node-id-literals
        name: Native node IDs only in ts-artius-browser-settings.js
        entry: bash -c '! grep -rnE "\"(LoadImage|LoadVideo|LoadAudio|Load3D)\"" --include="*.js" js/ | grep -v "ts-artius-browser-settings\.js"'
        language: system
        pass_filenames: false
```
**Проверка:** `pip install pre-commit && pre-commit install && pre-commit run --all-files`. Все хуки должны зелёно пройти после шагов 1, 3.

---

### Шаг 6: Добавить `test.yml` поверх `scripts/check_release.py`

**Пункт чек-листа:** 12
**Приоритет:** High
**Effort:** S (30 мин)
**Что сделать:** Workflow на push/PR, прогоняющий существующий `scripts/check_release.py` под Linux и Windows (Node + Python в matrix). Не переписывать check — он уже зрелый.
**Куда положить:** `.github/workflows/test.yml`
**Шаблон:**
```yaml
name: Test
on: [push, pull_request]
jobs:
  release-check:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        python: ["3.10", "3.12"]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "${{ matrix.python }}" }
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: pip install pyflakes
      - run: pip install -r requirements.txt
      - run: python scripts/check_release.py
```
**Проверка:** push в feature-branch → workflow зелёный по всем 4 комбинациям матрицы.

---

### Шаг 7: Добавить `.github/ISSUE_TEMPLATE/bug.yml`

**Пункт чек-листа:** 14
**Приоритет:** High
**Effort:** S (30 мин)
**Что сделать:** YAML-форма с обязательными полями: версия пака, версия ComfyUI, версия `comfyui-frontend-package`, OS, браузер+версия, `ffmpeg -version`, Python, repro, server console log, devtools console log, скриншот.
**Куда положить:** `.github/ISSUE_TEMPLATE/bug.yml`
**Шаблон:**
```yaml
name: Bug report
description: Report a bug in Timesaver Artius Browser
body:
  - type: input
    id: pack-version
    attributes:
      label: Pack version (timesaver-artius-browser)
    validations: { required: true }
  - type: input
    id: comfyui-version
    attributes:
      label: ComfyUI version (commit hash или версия из лога)
    validations: { required: true }
  - type: input
    id: frontend-version
    attributes:
      label: comfyui-frontend-package version
    validations: { required: true }
  - type: dropdown
    id: install
    attributes:
      label: ComfyUI install type
      options: [Portable Windows, Manual Linux/macOS, Docker, Other]
    validations: { required: true }
  - type: input
    id: os
    attributes: { label: "OS + version" }
    validations: { required: true }
  - type: input
    id: browser
    attributes: { label: "Browser + version" }
    validations: { required: true }
  - type: input
    id: ffmpeg
    attributes: { label: "Output of `ffmpeg -version` (или 'не установлен')" }
    validations: { required: true }
  - type: textarea
    id: repro
    attributes: { label: "Repro steps" }
    validations: { required: true }
  - type: textarea
    id: server-log
    attributes: { label: "ComfyUI server console log (фрагмент с ошибкой)" }
    validations: { required: true }
  - type: textarea
    id: devtools-log
    attributes: { label: "Browser DevTools console log" }
    validations: { required: true }
```
**Проверка:** Открыть New Issue в GitHub UI — форма отображается.

---

### Шаг 8: `CHANGELOG.md` в формате Keep a Changelog

**Пункт чек-листа:** 12
**Приоритет:** Medium
**Effort:** S (1 ч)
**Что сделать:** Стартовать с записи `[0.7.0] - 2026-05-07`, перенести из `git log` основные изменения. Дальше — обновлять перед каждым tag.
**Куда положить:** `CHANGELOG.md`
**Шаблон:**
```markdown
# Changelog
All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-05-07
### Added
- Per-section tree-panel column width (Assets / Workflows persist independently).
- Resizable tree-panel column (drag to resize, persisted).
- Donate button.
- Automatic preview cache busting via `?v=<mtime_ns>` token.

### Changed
- Schema v10 (companion-image flag stored, FTS filename-only, keyset pagination).
- Config v16 (per-section tree widths replace single tree_panel_width).

### Removed
- Tags, rating, asset_user_fields table (schema v10).
```
**Проверка:** ручной просмотр; перед тегом нового релиза — заполнить раздел `[Unreleased]`.

---

### Шаг 9: Smoke-test для native node ID + drag-and-drop e2e

**Пункт чек-листа:** 2, 4
**Приоритет:** High
**Effort:** L (1-2 дня — но опирается на уже работающий локальный Playwright)
**Что сделать:** Поднять локальный Playwright + Chromium → CI. Один e2e на каждый тип ассета: image / video / audio / 3d. Тест: открыть sidebar → перетащить карточку на canvas → проверить, что созданная нода имеет ожидаемый `class_type` и нужный widget заполнен. Плюс отдельный smoke-тест на старте: для каждого native node ID запросить `GET /object_info/<id>` — non-empty.
**Куда положить:** `tests/e2e/` (новая директория) + `playwright.config.mjs` + `.github/workflows/e2e.yml`.
**Шаблон smoke (`tests/e2e/native-node-ids.spec.mjs`):**
```javascript
import { test, expect } from "@playwright/test";

// Эти ID должны соответствовать js/ts-artius-browser-settings.js:21-26
// (tsApiSettings.nativeWorkflowTargets[*].tsNodeType).
// Если добавляется новый тип ассета — добавить ID и сюда.
const NATIVE_IDS = ["LoadImage", "LoadVideo", "LoadAudio", "Load3D"];

for (const tsId of NATIVE_IDS) {
    test(`${tsId} resolves on running ComfyUI server`, async ({ request }) => {
        const tsResponse = await request.get(`/object_info/${tsId}`);
        expect(tsResponse.ok()).toBeTruthy();
        const tsBody = await tsResponse.json();
        expect(tsBody[tsId]).toBeDefined();
    });
}
```
**Проверка:** Локальный прогон против запущенного ComfyUI — все 4 ID резолвятся. CI workflow запускает headless ComfyUI + Playwright.
**Примечание:** В `js/ts-artius-browser-api.js:359` и `js/ts-artius-browser-settings.js:25` используется именно `"Load3D"` (не `"Load 3D & Animation"`), так что ID совпадает с native node.

---

### Шаг 10: Backend HTTP integration-тесты против живого ComfyUI

**Пункт чек-листа:** 5
**Приоритет:** High
**Effort:** M (1 день, переиспользует фикстуру из шага 9)
**Что сделать:** `pytest`-тесты, бьющие в живой ComfyUI на 15 групп роутов. Покрыть happy path, отсутствие required-параметра, `metadata`-параметр (ожидаем 400), отсутствие `ffmpeg`/`ffprobe` (clear error в логе, не глубокий `FileNotFoundError`).
**Куда положить:** `tests/integration/test_routes_live.py` + `tests/integration/conftest.py` (фикстура `comfy_url`).
**Шаблон:**
```python
import pytest, requests

@pytest.fixture(scope="session")
def comfy_url():
    return "http://127.0.0.1:8188"

def test_assets_route_happy_path(comfy_url):
    ts_response = requests.get(f"{comfy_url}/asset_browser/assets", params={"limit": 10})
    assert ts_response.status_code == 200
    assert "items" in ts_response.json()

def test_assets_route_rejects_metadata_param(comfy_url):
    ts_response = requests.get(f"{comfy_url}/asset_browser/assets", params={"metadata": "1"})
    assert ts_response.status_code == 400

def test_workflow_delete_rejects_traversal(comfy_url):
    ts_response = requests.post(
        f"{comfy_url}/asset_browser/workflow/delete",
        json={"path": "../../../etc/passwd"},
    )
    assert ts_response.status_code in (400, 404)
```
**Проверка:** `pytest tests/integration -v` против живого сервера. В CI — после поднятия headless ComfyUI.

---

---

## Затронутые файлы

- `pyproject.toml` (шаг 2)
- `tsab/ts_nodes.py:8` (шаг 1)
- `js/ts-artius-browser-api.js:359` (шаг 3)
- `tests/test_path_traversal_vectors.py` (шаг 4 — новый)
- `tests/e2e/` (шаг 9 — новая директория)
- `tests/integration/` (шаг 10 — новая директория)
- `.pre-commit-config.yaml` (шаг 5 — новый)
- `.github/workflows/test.yml` (шаг 6 — новый)
- `.github/workflows/e2e.yml` (шаг 9 — новый)
- `.github/ISSUE_TEMPLATE/bug.yml` (шаг 7 — новый)
- `CHANGELOG.md` (шаг 8 — новый)

## Порядок выполнения и оценка времени

- **Один вечер (Critical-cheap, ~1 час):** шаги 1, 2. После этого пак не сломается на следующем релизе ComfyUI и валиден для Registry.
- **Следующий день (High-leverage защиты, ~3 часа):** шаги 3, 4, 5, 6, 7, 8. Lint + CI + bug-template дают «второго ревьюера» бесплатно.
- **Тест-инфра (~2-3 дня):** шаги 9, 10 — самые ценные, требуют поднять Playwright + headless ComfyUI в CI.
