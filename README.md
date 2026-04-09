# Timesaver Artius Browser

[English](#english) | [Русский](#russian)

---

<a id="english"></a>
## English

### What It Is

**Timesaver Artius Browser** is a fast sidebar asset browser for modern ComfyUI workflows.
It indexes your media, builds lightweight cached previews, and gives you a clean browsing experience for:

- images
- videos
- audio files
- 3D models
- input, output, and custom folders

The extension is designed around three priorities:

- **speed**
- **stability**
- **smooth workflow integration**

It lives inside the ComfyUI sidebar and works with native ComfyUI nodes and viewers whenever possible.

### Core Highlights

- Native ComfyUI sidebar tab
- Flat feed and Tree folder view
- Filename search
- Asset type filters: image, video, audio, 3D
- Sort by date, filename, or size
- Adjustable preview size
- Persistent cached previews and metadata
- Fullscreen/lightbox viewer for every supported asset type
- Drag and drop assets directly into the workflow canvas
- PNG prompt and workflow extraction
- Native ComfyUI 3D integration for viewing and loading models
- Delete to system trash via `send2trash`
- Autoscan toggle plus manual rescan

### Supported Formats

#### Images

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.avif`

#### Video

- `.mp4`
- `.mov`
- `.webm`
- `.prores`

#### Audio

- `.mp3`
- `.wav`
- `.flac`
- `.opus`
- `.ogg`

#### 3D

- `.glb`
- `.obj`

### What The Browser Can Do

#### Browse Assets

You can browse assets from:

- `ComfyUI/output`
- `ComfyUI/input`
- custom roots defined in config

The browser supports:

- **Flat mode** for a single feed across the selected root
- **Tree mode** for browsing by folders
- **All Folders** view to browse all enabled roots together

#### Preview Media Quickly

The browser builds and caches optimized previews:

- image thumbnails
- video frame posters
- audio waveforms
- 3D thumbnails cached through the native ComfyUI 3D renderer path

Internal browser storage is kept in:

- `ComfyUI/output/.ts_artius_browser/`

This folder stores:

- `db.sqlite`
- `config.json`
- cached previews
- internal runtime files

#### Inspect Assets In The Lightbox

##### Images

- full image preview
- wheel zoom
- pan with left or middle mouse drag when zoomed in
- prompt display
- workflow copy button when workflow exists in PNG metadata
- open in new tab
- download
- delete

##### Videos

- inline video playback
- ffprobe-based technical metadata in the right panel
- open in new tab
- download
- delete

##### Audio

- waveform preview
- playback controls
- ffprobe-based technical metadata in the right panel
- open in new tab
- download
- delete

##### 3D Models

- native ComfyUI 3D viewer in the lightbox
- technical metadata in the right panel
- download
- delete

### Card Actions In The Grid

Asset cards include compact quick actions:

- `P` = copy prompt
- `W` = copy workflow
- `D` = download
- `X` = delete

Notes:

- `W` is shown only for **PNG images that actually contain an embedded workflow**
- delete is available only for roots that allow deletion
- workflow and prompt metadata are loaded only when needed

### Workflow Integration

The browser is designed for **drag and drop first** workflow use.

You can drag assets from the browser to the ComfyUI canvas.
The extension maps them to native nodes where possible:

- images -> `LoadImage`
- videos -> `LoadVideo`
- audio -> `LoadAudio`
- 3D models -> `Load 3D & Animation` / `Load3D`

For 3D assets, the extension stages files into ComfyUI input storage so the native `Load3D` node can load them the same way as if they were selected through the node UI.

### PNG Metadata Support

For ComfyUI PNG files, the browser can extract:

- prompt text
- workflow JSON

Current behavior is intentionally strict and simple:

- prompt is read only from the PNG `Prompt` field
- workflow is read only from the PNG `Workflow` field
- workflow copy is exposed only when workflow is actually present

### Audio / Video Metadata

For audio and video assets, the browser stores only the metadata it actually needs.
That keeps indexing and the database smaller and faster.

Typical fields include:

- resolution
- duration
- bitrate
- format
- FPS where available

### Performance Approach

The browser is optimized to stay responsive on large libraries.
Current design choices include:

- SQLite with normalized lookup tables
- filename-focused search
- compact preview cache
- companion preview filtering
- ignored internal cache folders during scan
- conservative external tool concurrency
- virtualized grid rendering in the frontend

### Optional External Tools

The browser works best when these tools are available:

- `ffmpeg`
- `ffprobe`

They are used for:

- video frame previews
- audio waveforms
- technical metadata for video/audio

If they are missing, the browser will still run, but some previews or metadata may be limited.

### Installation

1. Copy this repository into `ComfyUI/custom_nodes/`.
2. Install Python requirements:

```bash
pip install -r requirements.txt
```

3. Make sure `ffmpeg` and `ffprobe` are available in your system `PATH`, or configure them in the browser config.
4. Restart ComfyUI.
5. Hard refresh the frontend with `Ctrl+F5`.

### Configuration

Main runtime config lives in:

- `ComfyUI/output/.ts_artius_browser/config.json`

This file stores things like:

- enabled roots
- custom roots
- delete permissions
- UI state
- preview settings
- worker counts
- autoscan state

### UI Features

#### Toolbar

The main toolbar includes:

- search
- type filters
- root selector
- sort controls
- flat/tree mode switch
- preview size slider
- autoscan toggle button
- rescan button
- delete selected button

#### Tree View

Tree mode lets you browse by folders with aggregated counts from child folders.
It is useful when the feed is too broad and you want folder-first navigation.

#### Selection

The browser supports:

- click to select
- Ctrl/Cmd click to toggle selection
- Shift click for range selection
- keyboard navigation in the grid

### Delete Behavior

Deleting an asset sends it to the **system trash / recycle bin** instead of permanently removing it directly.

That means:

- Windows -> Recycle Bin
- macOS -> Trash
- Linux -> desktop trash where supported

Internal browser cache files are still cleaned directly when needed.

### Things This Extension Does Not Try To Be

This project is intentionally focused.
It is not trying to be:

- a DAM system
- a tag-heavy media catalog
- a replacement for ComfyUI workflow editing
- a giant plugin with many parallel node types

It is primarily a fast, practical browser for media that is already part of a ComfyUI workflow.

### Troubleshooting

#### Browser tab opens but looks stale

Try:

- restart ComfyUI
- `Ctrl+F5`

#### Missing video/audio metadata

Check:

- `ffmpeg`
- `ffprobe`

#### Want a full reset

Delete:

- `ComfyUI/output/.ts_artius_browser/`

Then restart ComfyUI and rescan.

### Architecture Notes

A few implementation details that may help contributors:

- frontend settings live in `js/ts-artius-browser-settings.js`
- backend settings live in `tsab/ts_settings.py`
- runtime data is stored under `.ts_artius_browser`
- the extension currently adds **no custom workflow nodes** and integrates through the sidebar plus native nodes

### Why The Project Exists

ComfyUI users often generate and collect large amounts of images, videos, audio, and 3D assets.
This browser exists to make that material easy to:

- find
- inspect
- preview
- reuse
- drag back into workflows

without turning the workflow itself into a file manager.

---

<a id="russian"></a>
## Русский

### Что Это Такое

**Timesaver Artius Browser** — это быстрый sidebar-браузер ассетов для современных workflow в ComfyUI.
Он индексирует медиафайлы, строит лёгкие кешированные превью и даёт удобный интерфейс для работы с:

- изображениями
- видео
- аудио
- 3D-моделями
- папками `input`, `output` и пользовательскими root-папками

Расширение изначально строится вокруг трёх приоритетов:

- **скорость**
- **стабильность**
- **удобная интеграция с workflow**

Оно живёт в sidebar ComfyUI и по возможности использует родные ноды и viewer'ы самого ComfyUI.

### Основные Возможности

- Вкладка в sidebar ComfyUI
- Режимы `Flat` и `Tree`
- Поиск по имени файла
- Фильтры по типу ассета: image, video, audio, 3D
- Сортировка по дате, имени файла и размеру
- Изменяемый размер превью
- Постоянный кеш превью и метаданных
- Полноэкранный/lightbox viewer для всех поддерживаемых типов
- Drag and drop ассетов прямо на canvas workflow
- Извлечение prompt и workflow из PNG
- Нативная интеграция с ComfyUI 3D viewer и `Load3D`
- Удаление в системную корзину
- Кнопка `Autoscan` и ручной `Rescan`

### Поддерживаемые Форматы

#### Изображения

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.avif`

#### Видео

- `.mp4`
- `.mov`
- `.webm`
- `.prores`

#### Аудио

- `.mp3`
- `.wav`
- `.flac`
- `.opus`
- `.ogg`

#### 3D

- `.glb`
- `.obj`

### Что Умеет Браузер

#### Навигация По Ассетам

Можно просматривать файлы из:

- `ComfyUI/output`
- `ComfyUI/input`
- пользовательских root-папок из конфига

Поддерживаются:

- **Flat mode** — единая лента ассетов в выбранном root
- **Tree mode** — навигация по дереву папок
- **All Folders** — просмотр сразу по всем включённым root-папкам

#### Быстрые Превью

Браузер создаёт и кеширует оптимизированные превью:

- thumbnails для изображений
- кадры-постеры для видео
- waveform для аудио
- 3D thumbnails, кешируемые через нативный ComfyUI 3D renderer path

Все внутренние данные браузера хранятся в:

- `ComfyUI/output/.ts_artius_browser/`

Там находятся:

- `db.sqlite`
- `config.json`
- кеш превью
- служебные runtime-файлы

#### Просмотр В Lightbox

##### Изображения

- полноразмерный просмотр
- zoom колесом мыши
- pan левой или средней кнопкой мыши при увеличении
- отображение prompt
- кнопка копирования workflow, если он есть в PNG
- открытие в новой вкладке
- скачивание
- удаление

##### Видео

- встроенное воспроизведение
- техническая метадата из ffprobe в правой панели
- открытие в новой вкладке
- скачивание
- удаление

##### Аудио

- waveform-превью
- playback controls
- техническая метадата из ffprobe в правой панели
- открытие в новой вкладке
- скачивание
- удаление

##### 3D-модели

- нативный ComfyUI 3D viewer в lightbox
- техническая информация о модели в правой панели
- скачивание
- удаление

### Быстрые Действия На Карточках

На карточках в сетке есть компактные действия:

- `P` = копировать prompt
- `W` = копировать workflow
- `D` = скачать файл
- `X` = удалить

Важно:

- `W` показывается только для **PNG-изображений, в которых реально есть workflow**
- удаление доступно только в root-папках, где это разрешено
- prompt и workflow подгружаются только когда это действительно нужно

### Интеграция С Workflow

Браузер изначально рассчитан на **drag and drop** в workflow.

Можно перетаскивать ассеты из браузера прямо на canvas ComfyUI.
Расширение старается использовать родные ноды ComfyUI:

- изображения -> `LoadImage`
- видео -> `LoadVideo`
- аудио -> `LoadAudio`
- 3D -> `Load 3D & Animation` / `Load3D`

Для 3D ассетов расширение сначала staging'ит файлы во входное хранилище ComfyUI, чтобы `Load3D` получал модель так же, как при обычной загрузке через интерфейс самой ноды.

### Поддержка PNG Metadata

Для ComfyUI PNG браузер умеет извлекать:

- prompt text
- workflow JSON

Текущее поведение сделано намеренно простым и предсказуемым:

- prompt читается только из поля PNG `Prompt`
- workflow читается только из поля PNG `Workflow`
- кнопка копирования workflow есть только когда workflow реально найден

### Метаданные Видео И Аудио

Для video и audio браузер хранит только те данные, которые ему действительно нужны.
Это помогает ускорить индексацию и держать БД компактной.

Обычно это:

- разрешение
- длительность
- битрейт
- формат
- FPS, если доступен

### Подход К Производительности

Браузер оптимизирован так, чтобы оставаться отзывчивым на больших библиотеках.
Сейчас используются такие решения:

- SQLite с нормализованными lookup-таблицами
- поиск, ориентированный на filename
- компактный preview cache
- фильтрация companion preview-файлов
- игнорирование внутренних cache-папок при скане
- консервативная конкурентность внешних инструментов
- виртуализированная сетка на фронтенде

### Необязательные Внешние Инструменты

Браузер лучше всего работает, если доступны:

- `ffmpeg`
- `ffprobe`

Они используются для:

- кадровых превью видео
- waveform аудио
- технической метадаты для video/audio

Если их нет, браузер всё равно будет работать, но часть превью и метадаты может быть ограничена.

### Установка

1. Скопируй этот репозиторий в `ComfyUI/custom_nodes/`.
2. Установи Python-зависимости:

```bash
pip install -r requirements.txt
```

3. Убедись, что `ffmpeg` и `ffprobe` доступны в системном `PATH`, либо настрой их в конфиге браузера.
4. Перезапусти ComfyUI.
5. Сделай `Ctrl+F5` для жёсткого обновления фронтенда.

### Конфигурация

Главный runtime-config находится в:

- `ComfyUI/output/.ts_artius_browser/config.json`

В нём хранятся, например:

- включённые root-папки
- custom roots
- права на удаление
- UI state
- настройки превью
- число worker'ов
- состояние autoscan

### Возможности Интерфейса

#### Верхнее Меню

В тулбаре есть:

- поиск
- фильтры по типу ассета
- selector root-папки
- управление сортировкой
- переключатель `Flat / Tree`
- слайдер размера превью
- toggle-кнопка `Autoscan`
- кнопка `Rescan`
- кнопка `Delete Selected`

#### Tree View

В режиме дерева можно ходить по папкам с агрегированными счётчиками ассетов по дочерним веткам.
Это удобно, когда лента слишком широкая и хочется сначала сузить область просмотра по папкам.

#### Выделение

Поддерживаются:

- обычный клик
- `Ctrl/Cmd + click` для добавления или снятия выделения
- `Shift + click` для диапазона
- навигация по сетке с клавиатуры

### Поведение Удаления

Удаление отправляет файл не в безвозвратное удаление, а в **системную корзину**.

То есть:

- Windows -> Recycle Bin
- macOS -> Trash
- Linux -> desktop trash, если поддерживается системой

Внутренние cache-файлы браузера при необходимости очищаются напрямую.

### Чем Это Расширение Не Пытается Быть

Проект сделан намеренно сфокусированным.
Он не пытается быть:

- полноценной DAM-системой
- сложным медиа-каталогом с большим количеством тегов
- заменой самому редактору workflow в ComfyUI
- гигантским plugin'ом с кучей параллельных custom nodes

Его главная задача — быть быстрым и удобным браузером уже существующих ассетов внутри ComfyUI-процесса.

### Если Что-то Пошло Не Так

#### Браузер открылся, но выглядит устаревшим

Попробуй:

- перезапустить ComfyUI
- сделать `Ctrl+F5`

#### Нет метадаты у видео или аудио

Проверь:

- `ffmpeg`
- `ffprobe`

#### Нужен полный сброс

Удали:

- `ComfyUI/output/.ts_artius_browser/`

После этого перезапусти ComfyUI и заново сделай `Rescan`.

### Заметки По Архитектуре

Несколько деталей, полезных для разработчиков:

- frontend settings живут в `js/ts-artius-browser-settings.js`
- backend settings живут в `tsab/ts_settings.py`
- runtime-данные лежат внутри `.ts_artius_browser`
- расширение сейчас **не добавляет собственные workflow-ноды**, а работает через sidebar и нативные узлы ComfyUI

### Зачем Нужен Этот Проект

В ComfyUI очень быстро накапливаются большие объёмы:

- изображений
- видео
- аудио
- 3D-моделей

Этот браузер существует для того, чтобы всё это было легко:

- находить
- просматривать
- проверять
- переиспользовать
- перетаскивать обратно в workflow

не превращая сам workflow в файловый менеджер.
