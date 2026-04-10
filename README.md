# Timesaver Artius Browser

[English](#english) | [Русский](#russian) | [Español](#spanish) | [中文](#chinese)

![Timesaver Artius Browser](img/ts-artius-browser.jpg)

---

<a id="english"></a>
## English

### A friendly asset browser for ComfyUI

**Timesaver Artius Browser** is a fast sidebar browser for the files you actually use in ComfyUI every day.  
It helps you browse, preview, inspect, and reuse:

- 🖼️ images
- 🎬 videos
- 🎵 audio
- 🧊 3D models
- 📁 files from `input`, `output`, and custom folders

The goal is simple: keep your workflow focused while giving your assets a clean, practical home.

### Why people use it

- ⚡ Fast browsing with cached previews
- 🧭 Flat feed and Tree folder navigation
- 🔎 Filename search
- 🏷️ Filters by asset type
- ↕️ Sorting by date, filename, or size
- 🔍 Adjustable preview size
- 🖥️ Lightbox viewer for every supported media type
- 🧲 Drag and drop into the ComfyUI canvas
- 🧠 PNG prompt and workflow extraction
- 🧩 Native 3D integration with ComfyUI viewers and `Load 3D & Animation`
- 🗑️ Delete to the system trash instead of hard delete
- 🔄 Autoscan toggle plus manual rescan

### Supported formats

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

### Main browsing features

#### Browse your library

You can browse assets from:

- `ComfyUI/output`
- `ComfyUI/input`
- custom roots from config

Available browsing modes:

- **Flat**: one feed across the selected root
- **Tree**: folder-first browsing with aggregated child counts
- **All Folders**: browse all enabled roots together

#### Fast cached previews

The browser builds optimized previews and stores them in:

- `ComfyUI/output/.ts_artius_browser/`

That storage includes:

- `db.sqlite`
- `config.json`
- cached previews
- internal runtime files

Preview types:

- image thumbnails
- video posters
- audio waveforms
- 3D thumbnails

### Lightbox viewer

#### Images

- full image preview
- mouse wheel zoom
- pan with left or middle mouse button when zoomed
- prompt display
- `Copy Workflow` when workflow exists in PNG metadata
- open in new tab
- download
- delete

#### Videos

- inline playback
- technical metadata in the right panel
- open in new tab
- download
- delete

#### Audio

- waveform preview
- playback controls
- technical metadata in the right panel
- open in new tab
- download
- delete

#### 3D models

- native ComfyUI 3D viewer
- technical info in the right panel
- download
- delete

### Quick card actions

Each asset card can show small quick-action buttons:

- `P` = copy prompt
- `W` = copy workflow
- `D` = download
- `X` = delete

Notes:

- `W` appears only for PNG images that really contain workflow data
- delete is shown only when that root allows deleting files

### Workflow integration

The browser is designed around **drag and drop first**.

You can drag assets from the browser directly into the ComfyUI graph.  
Whenever possible, it uses native nodes:

- images → `LoadImage`
- videos → `LoadVideo`
- audio → `LoadAudio`
- 3D → `Load 3D & Animation` / `Load3D`

For 3D assets, files are staged into ComfyUI input storage so the native 3D node can load them the same way as files selected from the node UI.

### PNG metadata support

For ComfyUI PNG files, the browser extracts:

- prompt text
- workflow JSON

Current behavior is intentionally strict:

- prompt is read only from the PNG `Prompt` field
- workflow is read only from the PNG `Workflow` field

### Audio and video metadata

The browser keeps only the metadata it actually needs, which helps indexing stay lighter and faster.

Typical fields include:

- resolution
- duration
- bitrate
- format
- FPS when available

### Performance approach

This project is built around three priorities:

- ⚡ speed
- 🧱 stability
- 🧰 practical workflow integration

Current design choices include:

- SQLite with normalized lookup tables
- filename-focused search
- compact preview cache
- filtered companion previews
- ignored internal cache folders during scan
- conservative external tool concurrency
- virtualized frontend grid rendering

### Optional external tools

Best experience:

- `ffmpeg`
- `ffprobe`

Used for:

- video frame previews
- audio waveforms
- technical video/audio metadata

### Installation

1. Copy this repository into `ComfyUI/custom_nodes/`
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Make sure `ffmpeg` and `ffprobe` are available
4. Restart ComfyUI
5. Hard refresh with `Ctrl+F5`

### Configuration

Main runtime config:

- `ComfyUI/output/.ts_artius_browser/config.json`

This file stores things like:

- enabled roots
- custom roots
- delete permissions
- UI state
- preview settings
- worker counts
- autoscan state

### Toolbar overview

The main toolbar includes:

- search
- asset type filters
- root selector
- sort controls
- flat/tree switch
- preview size slider
- autoscan toggle
- rescan button
- delete selected button

### Delete behavior

Deleting an asset sends it to the **system trash**:

- Windows → Recycle Bin
- macOS → Trash
- Linux → desktop trash where supported

Internal cache files are still cleaned directly when needed.

### Troubleshooting

#### The browser opens but looks stale

- restart ComfyUI
- press `Ctrl+F5`

#### Video or audio metadata is missing

Check:

- `ffmpeg`
- `ffprobe`

#### You want a full reset

Delete:

- `ComfyUI/output/.ts_artius_browser/`

Then restart ComfyUI and run a new rescan.

### For contributors

- frontend settings: `js/ts-artius-browser-settings.js`
- backend settings: `tsab/ts_settings.py`
- runtime storage: `.ts_artius_browser`
- the extension currently does **not** add custom workflow nodes

---

<a id="russian"></a>
## Русский

### Дружелюбный браузер ассетов для ComfyUI

**Timesaver Artius Browser** — это быстрый sidebar-браузер для файлов, с которыми вы реально работаете в ComfyUI каждый день.  
Он помогает удобно просматривать, искать, открывать и повторно использовать:

- 🖼️ изображения
- 🎬 видео
- 🎵 аудио
- 🧊 3D-модели
- 📁 файлы из `input`, `output` и пользовательских папок

Главная идея очень простая: workflow остаётся чистым и удобным, а файлы получают нормальный и быстрый браузер прямо внутри ComfyUI.

### Почему им удобно пользоваться

- ⚡ Быстрый просмотр с кешированными превью
- 🧭 Режимы `Flat` и `Tree`
- 🔎 Поиск по имени файла
- 🏷️ Фильтры по типам ассетов
- ↕️ Сортировка по дате, имени и размеру
- 🔍 Настраиваемый размер превью
- 🖥️ Lightbox viewer для всех поддерживаемых типов
- 🧲 Drag and drop прямо на canvas ComfyUI
- 🧠 Извлечение prompt и workflow из PNG
- 🧩 Нативная интеграция с 3D viewer ComfyUI и `Load 3D & Animation`
- 🗑️ Удаление в системную корзину
- 🔄 Переключатель `Autoscan` и ручной `Rescan`

### Поддерживаемые форматы

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

### Основные возможности

#### Просмотр библиотеки

Можно работать с файлами из:

- `ComfyUI/output`
- `ComfyUI/input`
- пользовательских root-папок из конфига

Доступные режимы:

- **Flat** — единая лента по выбранному root
- **Tree** — навигация по дереву папок
- **All Folders** — просмотр сразу по всем включённым root-папкам

#### Быстрые кешированные превью

Браузер создаёт оптимизированные превью и хранит их в:

- `ComfyUI/output/.ts_artius_browser/`

Там лежат:

- `db.sqlite`
- `config.json`
- кеш превью
- внутренние служебные файлы

Типы превью:

- thumbnails для изображений
- постеры для видео
- waveform для аудио
- thumbnails для 3D

### Просмотр в lightbox

#### Изображения

- полноразмерный просмотр
- zoom колесом мыши
- pan левой или средней кнопкой мыши при увеличении
- показ prompt
- `Copy Workflow`, если workflow есть в PNG
- открытие в новой вкладке
- скачивание
- удаление

#### Видео

- встроенное воспроизведение
- техническая метадата в правой панели
- открытие в новой вкладке
- скачивание
- удаление

#### Аудио

- waveform-превью
- кнопки воспроизведения
- техническая метадата в правой панели
- открытие в новой вкладке
- скачивание
- удаление

#### 3D-модели

- нативный 3D viewer ComfyUI
- техническая информация в правой панели
- скачивание
- удаление

### Быстрые кнопки на карточках

На карточках ассетов могут быть маленькие action-кнопки:

- `P` = копировать prompt
- `W` = копировать workflow
- `D` = скачать файл
- `X` = удалить

Важно:

- `W` показывается только у PNG, где действительно есть workflow
- удаление доступно только в тех root-папках, где оно разрешено

### Интеграция с workflow

Браузер изначально рассчитан на **drag and drop**.

Можно перетаскивать ассеты прямо на canvas ComfyUI.  
По возможности используются родные ноды:

- изображения → `LoadImage`
- видео → `LoadVideo`
- аудио → `LoadAudio`
- 3D → `Load 3D & Animation` / `Load3D`

Для 3D файлы staging-ятся во входное хранилище ComfyUI, чтобы `Load3D` загружал их так же, как если бы вы выбрали модель через интерфейс самой ноды.

### Поддержка PNG metadata

Для PNG из ComfyUI браузер умеет извлекать:

- prompt
- workflow JSON

Текущее поведение сделано намеренно простым и предсказуемым:

- prompt читается только из поля `Prompt`
- workflow читается только из поля `Workflow`

### Метаданные видео и аудио

Браузер хранит только те данные, которые реально нужны для работы.  
Это помогает держать индексирование быстрее, а базу — компактнее.

Обычно это:

- разрешение
- длительность
- битрейт
- формат
- FPS, если есть

### Подход к производительности

Проект строится вокруг трёх приоритетов:

- ⚡ скорость
- 🧱 стабильность
- 🧰 удобная интеграция с workflow

Сейчас для этого используются:

- SQLite с нормализованными lookup-таблицами
- поиск, ориентированный на filename
- компактный preview cache
- фильтрация companion preview-файлов
- игнорирование внутренних cache-папок при скане
- аккуратная ограниченная конкуррентность внешних инструментов
- виртуализированная сетка на фронтенде

### Необязательные внешние инструменты

Лучше всего браузер работает, если доступны:

- `ffmpeg`
- `ffprobe`

Они используются для:

- кадров-превью видео
- waveform аудио
- технической метадаты видео и аудио

### Установка

1. Скопируйте репозиторий в `ComfyUI/custom_nodes/`
2. Установите зависимости:

```bash
pip install -r requirements.txt
```

3. Убедитесь, что `ffmpeg` и `ffprobe` доступны в системе
4. Перезапустите ComfyUI
5. Сделайте `Ctrl+F5`

### Конфигурация

Основной runtime-конфиг находится здесь:

- `ComfyUI/output/.ts_artius_browser/config.json`

В нём хранятся, например:

- включённые root-папки
- custom roots
- права на удаление
- UI state
- настройки превью
- число worker-потоков
- состояние autoscan

### Что есть в верхнем меню

- поиск
- фильтры по типам ассетов
- выбор root-папки
- сортировка
- переключатель `Flat / Tree`
- слайдер размера превью
- toggle-кнопка `Autoscan`
- кнопка `Rescan`
- кнопка `Delete Selected`

### Поведение удаления

При удалении файл отправляется в **системную корзину**:

- Windows → Recycle Bin
- macOS → Trash
- Linux → desktop trash, если поддерживается системой

Внутренний кеш браузера при необходимости очищается напрямую.

### Если что-то пошло не так

#### Браузер открылся, но выглядит устаревшим

- перезапустите ComfyUI
- нажмите `Ctrl+F5`

#### Нет метадаты у видео или аудио

Проверьте:

- `ffmpeg`
- `ffprobe`

#### Нужен полный сброс

Удалите:

- `ComfyUI/output/.ts_artius_browser/`

После этого перезапустите ComfyUI и сделайте новый `Rescan`.

### Для разработчиков

- frontend settings: `js/ts-artius-browser-settings.js`
- backend settings: `tsab/ts_settings.py`
- runtime storage: `.ts_artius_browser`
- расширение сейчас **не добавляет собственные workflow-ноды**

---

<a id="spanish"></a>
## Español

### Un navegador de assets amable para ComfyUI

**Timesaver Artius Browser** es un navegador lateral rápido para los archivos que usas todos los días en ComfyUI.  
Te ayuda a explorar, previsualizar, inspeccionar y reutilizar:

- 🖼️ imágenes
- 🎬 videos
- 🎵 audio
- 🧊 modelos 3D
- 📁 archivos de `input`, `output` y carpetas personalizadas

La idea es muy simple: mantener el workflow limpio y hacer que los archivos sean fáciles de encontrar y reutilizar.

### Lo más importante

- ⚡ Navegación rápida con vistas previas en caché
- 🧭 Modos `Flat` y `Tree`
- 🔎 Búsqueda por nombre de archivo
- 🏷️ Filtros por tipo de asset
- ↕️ Orden por fecha, nombre o tamaño
- 🔍 Tamaño de preview ajustable
- 🖥️ Visor lightbox para todos los formatos soportados
- 🧲 Drag and drop directo al canvas de ComfyUI
- 🧠 Extracción de prompt y workflow desde PNG
- 🧩 Integración 3D nativa con ComfyUI
- 🗑️ Eliminación a la papelera del sistema
- 🔄 `Autoscan` y `Rescan`

### Formatos soportados

- Imágenes: `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`
- Video: `.mp4`, `.mov`, `.webm`, `.prores`
- Audio: `.mp3`, `.wav`, `.flac`, `.opus`, `.ogg`
- 3D: `.glb`, `.obj`

### Qué puede hacer

- Navegar por `ComfyUI/output`, `ComfyUI/input` y roots personalizados
- Cambiar entre vista plana y árbol de carpetas
- Mostrar previews optimizadas de imágenes, video, audio y 3D
- Abrir assets en un lightbox
- Copiar prompt y workflow cuando existan
- Arrastrar archivos al grafo de ComfyUI
- Cargar modelos 3D con `Load 3D & Animation`
- Guardar configuración y caché en `.ts_artius_browser`

### Visor lightbox

- Imágenes: zoom, pan, prompt, workflow, abrir en nueva pestaña, descargar, borrar
- Videos: reproducción, metadatos técnicos, nueva pestaña, descargar, borrar
- Audio: waveform, controles, metadatos técnicos, nueva pestaña, descargar, borrar
- 3D: visor 3D nativo, información técnica, descargar, borrar

### Instalación

1. Copia el repositorio en `ComfyUI/custom_nodes/`
2. Instala dependencias:

```bash
pip install -r requirements.txt
```

3. Asegúrate de tener `ffmpeg` y `ffprobe`
4. Reinicia ComfyUI
5. Haz un `Ctrl+F5`

### Configuración

Archivo principal:

- `ComfyUI/output/.ts_artius_browser/config.json`

### Herramientas externas opcionales

- `ffmpeg`
- `ffprobe`

Se usan para previews de video, waveforms de audio y metadatos técnicos.

---

<a id="chinese"></a>
## 中文

### 一个更友好的 ComfyUI 资源浏览器

**Timesaver Artius Browser** 是一个为 ComfyUI 工作流设计的快速侧边栏资源浏览器。  
它可以帮助你更轻松地浏览、预览、检查和重复使用：

- 🖼️ 图片
- 🎬 视频
- 🎵 音频
- 🧊 3D 模型
- 📁 来自 `input`、`output` 和自定义目录的文件

它的目标很直接：让工作流保持清爽，同时让素材管理更轻松。

### 核心亮点

- ⚡ 快速浏览与缓存预览
- 🧭 `Flat` 和 `Tree` 两种浏览模式
- 🔎 按文件名搜索
- 🏷️ 按资源类型过滤
- ↕️ 按日期、文件名、大小排序
- 🔍 可调节预览尺寸
- 🖥️ 支持所有媒体类型的 lightbox 查看器
- 🧲 可直接拖拽到 ComfyUI 画布
- 🧠 支持从 PNG 提取 prompt 和 workflow
- 🧩 与 ComfyUI 原生 3D 查看器和 `Load 3D & Animation` 集成
- 🗑️ 删除时发送到系统回收站
- 🔄 支持 `Autoscan` 和手动 `Rescan`

### 支持的格式

- 图片：`.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`
- 视频：`.mp4`, `.mov`, `.webm`, `.prores`
- 音频：`.mp3`, `.wav`, `.flac`, `.opus`, `.ogg`
- 3D：`.glb`, `.obj`

### 主要功能

- 浏览 `ComfyUI/output`、`ComfyUI/input` 和自定义根目录
- 在平铺视图与树状视图之间切换
- 查看图片缩略图、视频海报、音频波形和 3D 缩略图
- 在 lightbox 中查看资源
- 复制 prompt 与 workflow
- 将资源拖拽到 ComfyUI 工作流画布
- 使用 `Load 3D & Animation` 加载 3D 模型
- 将缓存与配置保存到 `.ts_artius_browser`

### Lightbox 查看器

- 图片：缩放、拖动、查看 prompt、复制 workflow、在新标签页打开、下载、删除
- 视频：播放、技术元数据、新标签页打开、下载、删除
- 音频：波形、播放控件、技术元数据、新标签页打开、下载、删除
- 3D：原生 3D 查看器、技术信息、下载、删除

### 安装

1. 将此仓库复制到 `ComfyUI/custom_nodes/`
2. 安装依赖：

```bash
pip install -r requirements.txt
```

3. 确保系统中可用 `ffmpeg` 和 `ffprobe`
4. 重启 ComfyUI
5. 执行 `Ctrl+F5`

### 配置

主配置文件位于：

- `ComfyUI/output/.ts_artius_browser/config.json`

### 可选外部工具

- `ffmpeg`
- `ffprobe`

它们用于视频预览帧、音频波形和技术元数据提取。
