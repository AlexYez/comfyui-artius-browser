<div align="center">

# 🎨 Artius Browser for ComfyUI

**A fast, friendly sidebar for the files you actually use every day.**

![Version](https://img.shields.io/github/v/release/AlexYez/comfyui-artius-browser?style=flat-square&label=version&color=5fa14f)
![License](https://img.shields.io/github/license/AlexYez/comfyui-artius-browser?style=flat-square&color=8a7fc8)
![ComfyUI](https://img.shields.io/badge/ComfyUI-%E2%89%A50.19.0-blue?style=flat-square)
![Frontend](https://img.shields.io/badge/frontend-1.42.10%20%E2%80%93%201.48.7-blue?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=flat-square&logo=python&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square)

🇬🇧 [English](#english) ·
🇷🇺 [Русский](#russian) ·
🇪🇸 [Español](#spanish) ·
🇨🇳 [中文](#chinese) ·
🇯🇵 [日本語](#japanese) ·
🇰🇷 [한국어](#korean) ·
🇩🇪 [Deutsch](#german) ·
🇮🇹 [Italiano](#italian) ·
🇫🇷 [Français](#french) ·
🇵🇹 [Português](#portuguese)

![Artius Browser](img/ts-artius-browser.jpg)

</div>

---

<a id="english"></a>

## 🇬🇧 English

> **Artius Browser** lives in your ComfyUI sidebar and makes it painless to find,
> preview, drag, and load assets — images, videos, audio, 3D models, and
> workflow files. It stays fast on huge libraries and uses native ComfyUI
> behavior wherever it can.

### ✨ Highlights

| | |
|---|---|
| 🖼️ **Images** | Cached thumbnails, PNG prompt + workflow extraction, lightbox with wipe / 2×2 grid compare, zoomed in step |
| 🎬 **Videos** | Frame-stepping, codec / FPS / duration / audio info, sync compare for 2-4 clips |
| 🎵 **Audio** | Waveform preview, transport controls, channel layout |
| 🎲 **3D** | Native ComfyUI 3D viewer in the lightbox, captured 3D thumbnails |
| 📜 **Workflows** | Reads ComfyUI's native workflow folder, sidecar previews, drag-to-load |
| 🪟 **Two tabs** | `Assets` and `Workflows` with **independent** state (search, sort, view, preview size, tree-panel width) |
| 🔍 **Filename-first search** | Fast and predictable by default; one toggle inside the search field extends it to prompts and model names |
| ⭐ **Favorites** | Star the keepers, filter the grid down to them — survives a full `Rebuild Cache` |
| 🧬 **Model info** | Checkpoints, LoRAs and VAEs read from the PNG prompt, shown in the lightbox and searchable |
| 🔎 **Click to 100%** | One click in the lightbox jumps to true pixel scale, with a navigator minimap for panning |
| 🚀 **Drag-and-drop** | Direct into native `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` nodes |
| 🗑️ **Safe delete** | Sends to system trash via `send2trash` — never hard-delete |
| 🔄 **Autoscan / Rebuild Cache** | Refresh on demand, or rebuild from scratch |
| 🏷️ **Version label + update badge** | Current version next to the title; checks GitHub once a day, surfaces a `New version available` chip when a newer release ships |
| 🧲 **Multi-select drag** | Drag a whole selection onto the canvas — one native node per asset, auto-arranged in a grid |
| 🔔 **Action feedback** | Toast notifications when a copy / delete / load / rescan succeeds or fails — no more silent failures |
| 🌍 **Localized UI** | Follows ComfyUI's own language setting — English, Russian, Chinese and Japanese ship today |
| ♿ **Accessible grid** | Screen-reader listbox semantics with selection state, plus a keyboard focus ring |

### 📁 Supported formats

- 🖼️ Images: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Videos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Quick start

#### Recommended — via Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…or search **Timesaver Artius Browser** in **ComfyUI Manager**.

#### Manual install

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Then **restart ComfyUI** and **hard refresh** the browser with `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) powers video/audio metadata and the audio waveforms — optional (ComfyUI still starts without it), but recommended:
>
> - **Windows:** `winget install ffmpeg` (or `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Restart ComfyUI after installing, then verify with `ffmpeg -version`.

### ⌨️ Keyboard & card actions

#### Keyboard — asset grid

| Key | Action |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Move the selection |
| <kbd>Enter</kbd> | Open the lightbox *(or load the workflow in the `Workflows` tab)* |

#### Keyboard — lightbox

| Key | Action |
|:---:|---|
| <kbd>Esc</kbd> | Close |
| <kbd>←</kbd> <kbd>→</kbd> | Previous / next asset *(steps frames in video compare mode)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Step one video frame |
| <kbd>Delete</kbd> | Send to system trash |

#### Card buttons

> These are **buttons on the card** (hover to reveal), not keyboard keys.

| Button | Action |
|:---:|---|
| `P` | Copy prompt |
| `W` | Copy workflow *(only when the PNG actually has workflow data)* |
| `D` | Download |
| `X` | Send to system trash *(only where the root allows deletion)* |
| `S` `R` | Appear only when another installed pack publishes an action for the asset (e.g. TS Image Studio: *use in the studio* / *restore the session that made it*) |

#### Workflow card buttons

| Button | Action |
|:---:|---|
| `L` · double-click | Load workflow into ComfyUI |
| `D` | Download workflow JSON |
| `X` | Trash workflow + matching preview sidecars |

### 🎯 Native ComfyUI integration

This pack doesn't reinvent loaders — it routes drag-and-drop to native nodes:

| Asset type | Native node |
|---|---|
| Image | `LoadImage` |
| Video | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Native frontend workflow loader |

3D files are staged into ComfyUI input storage so the native 3D nodes see them
exactly like files picked from the node UI. The `Workflows` tab reads
`user/default/workflows` directly — no separate cache, no parallel index.

### 🔬 Lightbox tour

<details>
<summary><strong>🖼️ Images</strong></summary>

- Mouse-wheel zoom, left/middle-button pan
- 2-image **wipe** compare with a left-to-right slider
- 4-image **2×2 grid** compare
- Separate `Prompt` and `Negative Prompt` panels
- One-click `Copy Workflow` when the PNG carries it
- Open in new tab, download, delete

</details>

<details>
<summary><strong>🎬 Videos</strong></summary>

- Inline playback with current-frame display
- ⬅️ / ➡️ frame-stepping
- Codec, FPS, duration, bitrate, format, audio-track info
- Sync compare for 2, 3 or 4 selected videos with one shared transport (**Compare** button in the toolbar)

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Waveform preview
- Playback controls
- Duration · bitrate · codec · channel layout

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Native ComfyUI 3D viewer in-lightbox
- Technical model info in the sidebar
- No fake texture-sheet stand-in — it's the real thing

</details>

### 🧠 PNG metadata rules

- **Prompt** is read **only** from the PNG `Prompt` field
- **Workflow** is read **only** from the PNG `Workflow` field
- Positive and negative prompts are split before display
- If positive and negative are identical, only the positive is shown
- **Seed** is read from the PNG `Prompt` field and shown in the lightbox (copyable)

### 🛡️ Compatibility & safety

- Drag-and-drop graph access goes through a thin Comfy adapter — current
  canvas APIs preferred, legacy `LiteGraph` paths isolated.
- Asset search is filename-focused. Unsupported `metadata` query params
  return `400 Bad Request` instead of silently doing nothing.
- Asset listing pagination is **keyset-based** (`after_sort` + `after_id`);
  deep pages are O(1) regardless of library size.
- Companion images (PNG sidecars whose stem matches a sibling video / audio
  / 3D asset) are suppressed via a stored flag, not a query-time subquery.
- Frontend listeners are explicitly torn down on stage close / worker stop.

### ⚡ Performance notes

- Filename-only search · compact metadata · compact preview cache
- Virtualized grid · keyset pagination · stale-while-revalidate response cache
  *(LRU 10, 30 s TTL)* for instant filter / sort re-toggles
- Frontend-only workflow browsing · frontend-generated 3D thumbnails persisted to disk
- `ffprobe` + `ffmpeg` run **in parallel per asset** (single Popen pair)
- Worker pools default to `max(1, min(4, cpu_count() // 2))` — tweak in `config.json`
- Video poster: ffmpeg pre-downscales the captured frame so PIL only LANCZOS-finishes a small image
- WebP previews are written with `method=0` (fastest, visually identical at thumbnail sizes)
- Preview URLs carry the cached file's `mtime` as a cache-buster — no hard refresh after Rebuild Cache
- Optional accelerators:
  - 🚀 `Pillow-SIMD` — drop-in Pillow replacement, **4–6×** faster image thumbnailing
  - 🚀 `blake3` — already in `requirements.txt`, avoids the slower `blake2b` fallback

### 🆘 Troubleshooting

<details>
<summary><strong>Some previews look stale</strong></summary>

Hit **Rebuild Cache**. Preview URLs auto-bust the browser cache via an `mtime` token, so a hard refresh is usually unnecessary. If it still looks stale, restart ComfyUI and `Ctrl+F5`.

</details>

<details>
<summary><strong>Video or audio metadata is missing</strong></summary>

You probably don't have `ffmpeg` / `ffprobe` on `PATH`. Install them and restart.

</details>

<details>
<summary><strong>I want a complete reset</strong></summary>

Delete `ComfyUI/output/.ts_artius_browser/`, restart ComfyUI, scan again. All previews and indexes will rebuild.

</details>

### 🗂️ Runtime layout

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # asset index
├── config.json        # UI + tools settings
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<a id="russian"></a>

## 🇷🇺 Русский

> **Artius Browser** живёт в боковой панели ComfyUI и делает работу с
> ассетами — картинками, видео, аудио, 3D и workflow — простой и быстрой.
> Хорошо себя ведёт на больших библиотеках, везде где можно — использует
> нативное поведение ComfyUI.

### ✨ Главное

| | |
|---|---|
| 🖼️ **Картинки** | Кэш-превью, чтение PNG `Prompt` + `Workflow`, лайтбокс с wipe / 2×2 grid сравнением и синхронным зумом |
| 🎬 **Видео** | Покадровая навигация, кодек / FPS / длительность / инфо аудиодорожки, синхронное сравнение 2-4 клипов |
| 🎵 **Аудио** | Waveform-превью, плеер, channel layout |
| 🎲 **3D** | Нативный 3D viewer в лайтбоксе, фронтенд-сгенерированные 3D-thumbnail'ы |
| 📜 **Workflows** | Читает нативную папку workflow, sidecar-превью, drag-to-load |
| 🪟 **Две вкладки** | `Assets` и `Workflows` с **независимыми** настройками |
| 🔍 **Поиск по имени** | Быстро и предсказуемо по умолчанию; переключатель прямо в поле поиска расширяет его на промпты и названия моделей |
| ⭐ **Избранное** | Отмечайте удачное звёздочкой и фильтруйте грид по нему — переживает полную пересборку кэша |
| 🧬 **Модели** | Чекпоинты, LoRA и VAE читаются из PNG-промпта, показываются в лайтбоксе и участвуют в поиске |
| 🔎 **Клик = 100%** | Клик по картинке в лайтбоксе показывает реальные пиксели, миникарта помогает не потеряться |
| 🚀 **Drag-and-drop** | Прямо в нативные `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Безопасное удаление** | В системную корзину через `send2trash`, не навсегда |
| 🔄 **Autoscan / Rebuild Cache** | Обновление по запросу или полная пересборка |
| 🏷️ **Версия + бейдж обновления** | Текущая версия рядом с заголовком; раз в сутки проверяется GitHub, появляется чип `New version available` при выходе нового релиза |
| 🧲 **Drag выделения** | Перетащите всё выделение на канвас — по одной нативной ноде на ассет, автоматически разложенные сеткой |
| 🔔 **Обратная связь** | Всплывающие уведомления при копировании / удалении / загрузке / сканировании — больше никаких «молчаливых» ошибок |
| 🌍 **Локализация** | Следует языку, выбранному в ComfyUI — есть английский, русский, китайский и японский |
| ♿ **Доступность** | Семантика listbox для скринридеров с состоянием выбора и кольцо фокуса для клавиатуры |

### 🚀 Установка

#### Рекомендуется — через Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…или ищите **Timesaver Artius Browser** в **ComfyUI Manager**.

#### Вручную

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Перезапустите ComfyUI и сделайте hard refresh `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) нужен для метаданных видео/аудио и звуковых waveform — опционален (ComfyUI запускается и без него), но рекомендуется:
>
> - **Windows:** `winget install ffmpeg` (или `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> После установки перезапустите ComfyUI и проверьте: `ffmpeg -version`.

### ⌨️ Клавиатура и кнопки карточек

#### Клавиатура — сетка ассетов

| Клавиша | Действие |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Переместить выделение |
| <kbd>Enter</kbd> | Открыть лайтбокс *(или загрузить workflow во вкладке `Workflows`)* |

#### Клавиатура — лайтбокс

| Клавиша | Действие |
|:---:|---|
| <kbd>Esc</kbd> | Закрыть |
| <kbd>←</kbd> <kbd>→</kbd> | Предыдущий / следующий ассет *(покадрово в режиме сравнения видео)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Шаг на один кадр видео |
| <kbd>Delete</kbd> | В системную корзину |

#### Кнопки на карточке

> Это **кнопки на карточке** (появляются при наведении), а не горячие клавиши.

| Кнопка | Действие |
|:---:|---|
| `P` | Скопировать `Prompt` |
| `W` | Скопировать workflow *(только если PNG реально содержит workflow)* |
| `D` | Скачать |
| `X` | В системную корзину *(только там, где root разрешает удаление)* |
| `S` `R` | Появляются, только если другой установленный пак публикует действие для ассета (например, TS Image Studio: *использовать в студии* / *восстановить сессию, в которой он сделан*) |

#### Кнопки на карточке workflow

| Кнопка | Действие |
|:---:|---|
| `L` · двойной клик | Загрузить в ComfyUI |
| `D` | Скачать JSON |
| `X` | В корзину workflow + sidecar-превью |

### 🛡️ Совместимость

- Доступ к graph / canvas / LiteGraph проходит через adapter — новые API ComfyUI и legacy fallback не расползаются по UI-коду
- Поиск ассетов — по имени файла; неподдерживаемый query-параметр `metadata` возвращает `400 Bad Request`
- Пагинация keyset-based (`after_sort` + `after_id`) — глубокие страницы стоят столько же, сколько первая
- Companion-картинки (PNG-сайдкары к видео / аудио / 3D с тем же stem) скрываются через сохранённый флаг, без подзапросов в query-time
- Frontend listeners снимаются при закрытии stage / остановке worker

### ⚡ Производительность

- Поиск по имени · компактные метаданные · компактный preview-кэш
- Virtualized grid · keyset pagination · stale-while-revalidate cache *(LRU 10, TTL 30 сек)*
- `ffprobe` + `ffmpeg` параллельно на каждом ассете (один pair Popen)
- Worker pools по умолчанию `max(1, min(4, cpu_count() // 2))` — настраивается в `config.json`
- ffmpeg сразу downscale-ит кадр видео до 2× размера превью, PIL только финиширует LANCZOS
- WebP-превью пишутся с `method=0` (быстрейшее кодирование, визуально идентично на превью)
- URL превью содержит `mtime` как cache-busting токен — после Rebuild Cache hard refresh не нужен
- Опционально:
  - 🚀 `Pillow-SIMD` — drop-in замена Pillow, **4–6×** ускорение thumbnail
  - 🚀 `blake3` — уже в `requirements.txt`, обходит более медленный `blake2b`

### 🆘 Troubleshooting

<details>
<summary><strong>Превью выглядят устаревшими</strong></summary>

Нажмите **Rebuild Cache**. URL превью автоматически инвалидируют HTTP-кэш браузера через `mtime` токен. Если всё равно стейл — перезапустите ComfyUI + `Ctrl+F5`.

</details>

<details>
<summary><strong>Не показываются метаданные видео / аудио</strong></summary>

Проверьте, что `ffmpeg` и `ffprobe` есть в `PATH`. Установите и перезапустите.

</details>

<details>
<summary><strong>Полный сброс</strong></summary>

Удалите `ComfyUI/output/.ts_artius_browser/`, перезапустите ComfyUI, отсканируйте заново.

</details>

### 📋 Changelog

История релизов — в [CHANGELOG.md](CHANGELOG.md). Формат: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<a id="spanish"></a>

## 🇪🇸 Español

> **Artius Browser** vive en la barra lateral de ComfyUI y hace que encontrar,
> previsualizar, arrastrar y cargar tus assets — imágenes, vídeos, audios,
> modelos 3D y workflows — sea rápido e indoloro. Se mantiene ágil incluso
> con bibliotecas enormes y usa el comportamiento nativo de ComfyUI siempre
> que puede.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas cacheadas, extracción de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 y zoom sincronizado |
| 🎬 **Vídeos** | Navegación cuadro a cuadro, info de códec / FPS / duración / audio, comparación sincronizada de 2-4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de transporte, layout de canales |
| 🎲 **3D** | Viewer 3D nativo de ComfyUI dentro del lightbox, miniaturas 3D capturadas |
| 📜 **Workflows** | Lee la carpeta de workflows nativa de ComfyUI, previews sidecar, drag-to-load |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` con estado **independiente** (búsqueda, orden, vista, tamaño de preview, ancho del panel árbol) |
| 🔍 **Búsqueda solo por nombre** | Rápida, predecible, sin escaneos full-text sorpresivos |
| 🚀 **Drag-and-drop** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Borrado seguro** | A la papelera del sistema vía `send2trash` — nunca borrado definitivo |
| 🔄 **Autoscan / Rebuild Cache** | Refresco bajo demanda, o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + chip de actualización** | Versión actual junto al título; comprueba GitHub una vez al día y muestra `New version available` cuando hay una nueva |
| 🧲 **Arrastre de selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por asset, colocados automáticamente en cuadrícula |
| 🔔 **Feedback de acciones** | Notificaciones cuando copiar / borrar / cargar / reescanear tiene éxito o falla — se acabaron los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue el idioma configurado en ComfyUI — inglés, ruso, chino y japonés disponibles |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Instalación

#### Recomendado — vía Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…o busca **Timesaver Artius Browser** en **ComfyUI Manager**.

#### Instalación manual

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Luego **reinicia ComfyUI** y haz un **hard refresh** del navegador con `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) genera los metadatos de vídeo/audio y las formas de onda — opcional (ComfyUI arranca igual sin él), pero recomendado:
>
> - **Windows:** `winget install ffmpeg` (o `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Reinicia ComfyUI tras instalarlo y comprueba con `ffmpeg -version`.

### ⌨️ Teclado y botones de tarjeta

#### Teclado — cuadrícula de assets

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(o cargar el workflow en la pestaña `Workflows`)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Asset anterior / siguiente *(avanza fotogramas en modo comparación de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanzar un fotograma de vídeo |
| <kbd>Delete</kbd> | Enviar a la papelera |

#### Botones de la tarjeta

> Son **botones en la tarjeta** (aparecen al pasar el cursor), no teclas.

| Botón | Acción |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(solo cuando el PNG realmente contiene datos de workflow)* |
| `D` | Descargar |
| `X` | Enviar a la papelera *(solo donde el root permite borrado)* |
| `S` `R` | Aparecen solo cuando otro pack instalado publica una acción para el asset (p. ej. TS Image Studio: *usar en el estudio* / *restaurar la sesión que lo creó*) |

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar workflow en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | Enviar a la papelera workflow + previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — redirige el drag-and-drop a los nodos nativos:

| Tipo de asset | Nodo nativo |
|---|---|
| Imagen | `LoadImage` |
| Vídeo | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader nativo de workflows del frontend |

Los archivos 3D se preparan automáticamente en el almacenamiento de input de ComfyUI para que los nodos 3D nativos los vean exactamente como archivos seleccionados desde la UI del nodo. La pestaña `Workflows` lee `user/default/workflows` directamente — sin caché separado, sin índice paralelo.

### 🔬 Recorrido por el lightbox

<details>
<summary><strong>🖼️ Imágenes</strong></summary>

- Zoom con rueda del ratón, paneo con botón izquierdo/medio
- Comparación **wipe** de 2 imágenes con slider izquierda-derecha
- Comparación **grid 2×2** de 4 imágenes
- Paneles separados para `Prompt` y `Negative Prompt`
- `Copy Workflow` en un clic cuando el PNG lo lleva
- Abrir en nueva pestaña, descargar, borrar

</details>

<details>
<summary><strong>🎬 Vídeos</strong></summary>

- Reproducción inline con visualización del cuadro actual
- ⬅️ / ➡️ navegación cuadro a cuadro
- Códec, FPS, duración, bitrate, formato, info de pista de audio
- Comparación sincronizada de 2, 3 o 4 vídeos seleccionados con un transporte compartido (botón **Compare**)

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Viewer 3D nativo de ComfyUI dentro del lightbox
- Información técnica del modelo en la barra lateral
- Sin sustitutos de texturas falsas — es el modelo real

</details>

### 🧠 Reglas de metadatos PNG

- **Prompt** se lee **solo** del campo `Prompt` del PNG
- **Workflow** se lee **solo** del campo `Workflow` del PNG
- Los prompts positivos y negativos se separan antes de mostrarse
- Si positivo y negativo son idénticos, solo se muestra el positivo
- El **seed** se lee del campo `Prompt` del PNG y se muestra en el lightbox (copiable)

### 🛡️ Compatibilidad y seguridad

- El acceso al graph para drag-and-drop pasa por un adaptador delgado de Comfy — se prefieren las APIs actuales del canvas, los caminos legacy de `LiteGraph` quedan aislados.
- La búsqueda de assets se centra en el nombre del archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en vez de fallar silenciosamente.
- La paginación del listado de assets es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) sin importar el tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un asset hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché stale-while-revalidate *(LRU 10, TTL 30 s)* para re-toggles instantáneos de filtro / orden
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por asset** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-downscale el cuadro capturado para que PIL solo termine con LANCZOS una imagen pequeña
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo cacheado como cache-buster — no hace falta hard refresh tras Rebuild Cache
- Aceleradores opcionales:
  - 🚀 `Pillow-SIMD` — reemplazo drop-in de Pillow, thumbnailing de imágenes **4–6×** más rápido
  - 🚀 `blake3` — ya en `requirements.txt`, evita el fallback más lento `blake2b`

### 🆘 Solución de problemas

<details>
<summary><strong>Algunas previews se ven desactualizadas</strong></summary>

Pulsa **Rebuild Cache**. Las URLs de preview invalidan la caché del navegador automáticamente vía un token `mtime`, así que normalmente no hace falta hard refresh. Si sigue mal, reinicia ComfyUI y `Ctrl+F5`.

</details>

<details>
<summary><strong>Faltan metadatos de vídeo o audio</strong></summary>

Probablemente no tienes `ffmpeg` / `ffprobe` en `PATH`. Instálalos y reinicia.

</details>

<details>
<summary><strong>Quiero un reset completo</strong></summary>

Borra `ComfyUI/output/.ts_artius_browser/`, reinicia ComfyUI, escanea de nuevo. Todas las previews e índices se reconstruirán.

</details>

### 🗂️ Layout en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de assets
├── config.json        # ajustes de UI + herramientas
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

Consulta [CHANGELOG.md](CHANGELOG.md). Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<a id="chinese"></a>

## 🇨🇳 中文

> **Artius Browser** 驻留在 ComfyUI 的侧边栏中，让你轻松查找、预览、拖拽
> 和加载各种素材 — 图片、视频、音频、3D 模型和 workflow 文件。即使面对超大
> 规模的资产库也能保持流畅，并尽可能使用 ComfyUI 的原生行为。

### ✨ 主要特性

| | |
|---|---|
| 🖼️ **图片** | 缩略图缓存、提取 PNG 中的 `Prompt` 与 `Workflow`、灯箱支持 wipe / 2×2 网格对比与同步缩放 |
| 🎬 **视频** | 逐帧导航、显示编码器 / FPS / 时长 / 音频信息、2-4 个剪辑的同步对比 |
| 🎵 **音频** | 波形预览、播放控制、声道布局 |
| 🎲 **3D** | 灯箱中嵌入 ComfyUI 原生 3D 查看器、自动捕获 3D 缩略图 |
| 📜 **Workflows** | 直接读取 ComfyUI 原生 workflow 文件夹、sidecar 预览、拖拽即可加载 |
| 🪟 **双标签页** | `Assets` 与 `Workflows` 拥有**独立**状态(搜索、排序、视图、预览大小、树面板宽度) |
| 🔍 **仅按文件名搜索** | 快速、可预期、不会出现意外的全文扫描 |
| 🚀 **拖拽** | 直接拖入原生 `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` 节点 |
| 🗑️ **安全删除** | 通过 `send2trash` 移至系统回收站 — 永不硬删除 |
| 🔄 **自动扫描 / 重建缓存** | 按需刷新或从零重建 |
| 🏷️ **版本标签 + 更新提示** | 标题旁显示当前版本;每天检查一次 GitHub,新版本发布时显示 `New version available` |
| 🧲 **多选拖拽** | 将整个选择拖到画布 — 每个资产一个原生节点,自动网格排列 |
| 🔔 **操作反馈** | 复制 / 删除 / 加载 / 扫描成功或失败时弹出提示 — 不再有静默失败 |
| 🌍 **界面本地化** | 跟随 ComfyUI 的语言设置 — 目前提供英文、俄文、中文与日文 |
| ♿ **无障碍网格** | 面向屏幕阅读器的 listbox 语义(含选中状态),以及键盘焦点环 |

### 📁 支持的格式

- 🖼️ 图片:`.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 视频:`.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 音频:`.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D:`.glb` · `.obj`
- 📜 Workflow:`.json`

### 🚀 快速开始

#### 推荐 — 通过 Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…或在 **ComfyUI Manager** 中搜索 **Timesaver Artius Browser**。

#### 手动安装

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

然后**重启 ComfyUI**并使用 `Ctrl+F5` 进行**强制刷新**。

> 💡 **FFmpeg**(`ffmpeg` + `ffprobe`)用于生成视频/音频元数据和音频波形 — 可选(没有它 ComfyUI 也能启动),但推荐安装:
>
> - **Windows:** `winget install ffmpeg`(或 `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> 安装后重启 ComfyUI,并用 `ffmpeg -version` 验证。

### ⌨️ 键盘与卡片按钮

#### 键盘 — 资产网格

| 按键 | 操作 |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | 移动选择 |
| <kbd>Enter</kbd> | 打开灯箱 *(在 `Workflows` 标签页则加载 workflow)* |

#### 键盘 — 灯箱

| 按键 | 操作 |
|:---:|---|
| <kbd>Esc</kbd> | 关闭 |
| <kbd>←</kbd> <kbd>→</kbd> | 上一个 / 下一个资产 *(视频对比模式下为逐帧)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | 视频逐帧步进 |
| <kbd>Delete</kbd> | 移至系统回收站 |

#### 卡片按钮

> 这些是**卡片上的按钮**(悬停显示),不是键盘快捷键。

| 按钮 | 操作 |
|:---:|---|
| `P` | 复制 prompt |
| `W` | 复制 workflow *(仅当 PNG 真正包含 workflow 数据时)* |
| `D` | 下载 |
| `X` | 移至系统回收站 *(仅在 root 允许删除的位置)* |
| `S` `R` | 仅当另一个已安装的扩展为该素材发布动作时出现（例如 TS Image Studio：*在工作室中使用* / *恢复生成它的会话*） |

#### Workflow 卡片按钮

| 按钮 | 操作 |
|:---:|---|
| `L` · 双击 | 加载到 ComfyUI |
| `D` | 下载 workflow JSON |
| `X` | 将 workflow 与匹配的预览 sidecar 移至回收站 |

### 🎯 ComfyUI 原生集成

本扩展不重新发明 loader — 它将拖拽路由到原生节点:

| 资产类型 | 原生节点 |
|---|---|
| 图片 | `LoadImage` |
| 视频 | `LoadVideo` |
| 音频 | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | 原生前端 workflow 加载器 |

3D 文件会自动暂存到 ComfyUI 的 input 存储中,这样原生 3D 节点看到它们的方式就和从节点 UI 中选择的文件完全一样。`Workflows` 标签页直接读取 `user/default/workflows` — 没有独立缓存,没有并行索引。

### 🔬 灯箱概览

<details>
<summary><strong>🖼️ 图片</strong></summary>

- 鼠标滚轮缩放、左/中键平移
- 2 张图片的 **wipe** 对比,带左右滑块
- 4 张图片的 **2×2 网格**对比
- `Prompt` 与 `Negative Prompt` 独立面板
- 当 PNG 包含 workflow 时,一键 `Copy Workflow`
- 在新标签页打开、下载、删除

</details>

<details>
<summary><strong>🎬 视频</strong></summary>

- 内联播放并显示当前帧
- ⬅️ / ➡️ 逐帧导航
- 编码器、FPS、时长、比特率、格式、音轨信息
- 选中的 2、3 或 4 个视频可同步对比,共享一个传输控件(工具栏 **Compare** 按钮)

</details>

<details>
<summary><strong>🎵 音频</strong></summary>

- 波形预览
- 播放控制
- 时长 · 比特率 · 编码器 · 声道布局

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- 灯箱中嵌入 ComfyUI 原生 3D 查看器
- 侧边栏显示模型的技术信息
- 没有伪造的贴图替代品 — 这是真实的 3D 模型

</details>

### 🧠 PNG 元数据规则

- **Prompt** **只**从 PNG 的 `Prompt` 字段读取
- **Workflow** **只**从 PNG 的 `Workflow` 字段读取
- 正向与负向 prompt 在显示前会被分离
- 如果正向与负向相同,只显示正向
- **Seed** 从 PNG `Prompt` 字段读取并显示在灯箱中（可复制）

### 🛡️ 兼容性与安全

- 拖拽时对 graph 的访问通过一个轻量的 Comfy 适配器 — 优先使用当前 canvas API,旧版 `LiteGraph` 路径被隔离。
- 资产搜索专注于文件名。不支持的 `metadata` query 参数会返回 `400 Bad Request` 而不是静默无效。
- 资产列表的分页是 **keyset-based** (`after_sort` + `after_id`); 无论库的大小如何,深页都是 O(1)。
- Companion 图片(stem 与同目录视频 / 音频 / 3D 资产相匹配的 PNG sidecar)通过存储的标记隐藏,而不是查询时的子查询。
- 前端 listener 在 stage 关闭 / worker 停止时显式拆除。

### ⚡ 性能说明

- 仅按文件名搜索 · 紧凑的元数据 · 紧凑的预览缓存
- 虚拟化网格 · keyset 分页 · stale-while-revalidate 响应缓存 *(LRU 10, TTL 30 秒)* 让筛选/排序的反复切换即时响应
- 前端独立的 workflow 浏览 · 前端生成并持久化到磁盘的 3D 缩略图
- 每个资产的 `ffprobe` + `ffmpeg` **并行运行**(单个 Popen 对)
- Worker pool 默认 `max(1, min(4, cpu_count() // 2))` — 可在 `config.json` 中调整
- 视频海报:ffmpeg 预先缩小捕获的帧,PIL 只用 LANCZOS 完成一张小图
- WebP 预览以 `method=0` 写入(最快,在缩略图尺寸下视觉上无差异)
- 预览 URL 携带缓存文件的 `mtime` 作为 cache-buster — 重建缓存后无需 hard refresh
- 可选加速器:
  - 🚀 `Pillow-SIMD` — Pillow 的 drop-in 替代,图片缩略图速度提升 **4–6×**
  - 🚀 `blake3` — 已经在 `requirements.txt` 中,避免较慢的 `blake2b` 回退

### 🆘 故障排查

<details>
<summary><strong>有些预览看起来过时</strong></summary>

点击 **Rebuild Cache**。预览 URL 通过 `mtime` token 自动失效浏览器缓存,所以通常不需要 hard refresh。如果仍然过时,重启 ComfyUI 并 `Ctrl+F5`。

</details>

<details>
<summary><strong>视频或音频元数据缺失</strong></summary>

很可能 `ffmpeg` / `ffprobe` 不在 `PATH` 中。安装它们并重启。

</details>

<details>
<summary><strong>我想完全重置</strong></summary>

删除 `ComfyUI/output/.ts_artius_browser/`,重启 ComfyUI,再次扫描。所有预览和索引将重建。

</details>

### 🗂️ 运行时目录结构

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # 资产索引
├── config.json        # UI + 工具设置
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 更新日志

参见 [CHANGELOG.md](CHANGELOG.md)。格式:[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)。

---

<a id="japanese"></a>

## 🇯🇵 日本語

> **Artius Browser** は ComfyUI のサイドバーに常駐し、画像・動画・音声・
> 3D モデル・workflow ファイルといったアセットの検索、プレビュー、
> ドラッグ、読み込みを快適にするツールです。大規模なライブラリでも
> 軽快に動作し、可能な限り ComfyUI のネイティブな挙動を利用します。

### ✨ 主な機能

| | |
|---|---|
| 🖼️ **画像** | キャッシュ済みサムネイル、PNG の `Prompt` + `Workflow` 抽出、ライトボックスでの wipe / 2×2 グリッド比較と同期ズーム |
| 🎬 **動画** | フレーム単位のナビゲーション、コーデック / FPS / 長さ / オーディオ情報、2〜4 クリップの同期比較 |
| 🎵 **音声** | 波形プレビュー、再生コントロール、チャンネルレイアウト |
| 🎲 **3D** | ライトボックス内でネイティブ ComfyUI 3D ビューアー、キャプチャした 3D サムネイル |
| 📜 **Workflows** | ComfyUI ネイティブの workflow フォルダを直接読み込み、サイドカープレビュー、ドラッグで読み込み |
| 🪟 **2 つのタブ** | `Assets` と `Workflows` は**独立した**状態(検索、ソート、表示、プレビューサイズ、ツリーパネル幅)を保持 |
| 🔍 **ファイル名のみ検索** | 高速で予測可能、意図しないフルテキストスキャンなし |
| 🚀 **ドラッグ&ドロップ** | ネイティブ `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` ノードに直接 |
| 🗑️ **安全な削除** | `send2trash` 経由でシステムのゴミ箱へ — 完全削除はしません |
| 🔄 **自動スキャン / キャッシュ再構築** | オンデマンドの更新、またはゼロからの再構築 |
| 🏷️ **バージョンラベル + 更新通知** | タイトル横に現在のバージョン;1 日 1 回 GitHub をチェックし、新しいリリースがあれば `New version available` チップを表示 |
| 🧲 **複数選択のドラッグ** | 選択全体をキャンバスにドラッグ — アセットごとにネイティブノードを 1 つ、自動でグリッド配置 |
| 🔔 **操作フィードバック** | コピー / 削除 / 読み込み / 再スキャンの成功・失敗をトースト表示 — 無言の失敗をなくします |
| 🌍 **UI ローカライズ** | ComfyUI の言語設定に追従 — 現在は英語・ロシア語・中国語・日本語を同梱 |
| ♿ **アクセシブルなグリッド** | 選択状態を持つスクリーンリーダー向け listbox セマンティクスとキーボードフォーカスリング |

### 📁 対応フォーマット

- 🖼️ 画像: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 動画: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 音声: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 クイックスタート

#### 推奨 — Comfy Registry 経由

```bash
comfy node install timesaver-artius-browser
```

…または **ComfyUI Manager** で **Timesaver Artius Browser** を検索してください。

#### 手動インストール

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

その後、**ComfyUI を再起動**し、`Ctrl+F5` でブラウザの**ハードリフレッシュ**を行ってください。

> 💡 **FFmpeg**(`ffmpeg` + `ffprobe`)は動画/音声のメタデータと音声波形の生成に使われます — 任意(なくても ComfyUI は起動します)ですが推奨:
>
> - **Windows:** `winget install ffmpeg`(または `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> インストール後に ComfyUI を再起動し、`ffmpeg -version` で確認してください。

### ⌨️ キーボードとカードボタン

#### キーボード — アセットグリッド

| キー | 動作 |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | 選択を移動 |
| <kbd>Enter</kbd> | ライトボックスを開く *(`Workflows` タブでは workflow を読み込む)* |

#### キーボード — ライトボックス

| キー | 動作 |
|:---:|---|
| <kbd>Esc</kbd> | 閉じる |
| <kbd>←</kbd> <kbd>→</kbd> | 前 / 次のアセット *(動画比較モードではフレーム送り)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | 動画を 1 フレーム送る |
| <kbd>Delete</kbd> | システムのゴミ箱へ |

#### カードのボタン

> これらは**カード上のボタン**(ホバーで表示)であり、キーボードショートカットではありません。

| ボタン | 動作 |
|:---:|---|
| `P` | プロンプトをコピー |
| `W` | workflow をコピー *(PNG が実際に workflow データを持っている場合のみ)* |
| `D` | ダウンロード |
| `X` | システムのゴミ箱へ *(root が削除を許可している場所のみ)* |
| `S` `R` | 別の導入済みパックがそのアセット向けのアクションを公開している場合のみ表示（例: TS Image Studio の *スタジオで使う* / *作成時のセッションを復元*） |

#### Workflow カードのボタン

| ボタン | 動作 |
|:---:|---|
| `L` · ダブルクリック | ComfyUI に読み込む |
| `D` | workflow JSON をダウンロード |
| `X` | workflow + 一致するプレビューサイドカーをゴミ箱へ |

### 🎯 ComfyUI ネイティブ統合

この pack は loader を再発明しません — ドラッグ&ドロップをネイティブノードにルーティングします:

| アセット種類 | ネイティブノード |
|---|---|
| 画像 | `LoadImage` |
| 動画 | `LoadVideo` |
| 音声 | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | ネイティブフロントエンド workflow loader |

3D ファイルは ComfyUI の input ストレージに自動的にステージングされ、ネイティブ 3D ノードからは UI で選択したファイルと全く同じように見えます。`Workflows` タブは `user/default/workflows` を直接読み込み — 別キャッシュも並列インデックスもありません。

### 🔬 ライトボックスツアー

<details>
<summary><strong>🖼️ 画像</strong></summary>

- マウスホイールでズーム、左/中ボタンでパン
- 2 枚の画像の **wipe** 比較、左右スライダー付き
- 4 枚の画像の **2×2 グリッド**比較
- `Prompt` と `Negative Prompt` の独立パネル
- PNG に含まれていれば 1 クリックで `Copy Workflow`
- 新しいタブで開く、ダウンロード、削除

</details>

<details>
<summary><strong>🎬 動画</strong></summary>

- インライン再生、現在のフレーム表示付き
- ⬅️ / ➡️ フレーム単位のナビゲーション
- コーデック、FPS、長さ、ビットレート、フォーマット、音声トラック情報
- 選択した 2〜4 個の動画を、共有トランスポートで同期比較(ツールバーの **Compare** ボタン)

</details>

<details>
<summary><strong>🎵 音声</strong></summary>

- 波形プレビュー
- 再生コントロール
- 長さ · ビットレート · コーデック · チャンネルレイアウト

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- ライトボックス内でネイティブ ComfyUI 3D ビューアー
- サイドバーにモデルの技術情報
- 偽のテクスチャシートの代替品ではない — 本物の 3D モデル

</details>

### 🧠 PNG メタデータルール

- **Prompt** は PNG の `Prompt` フィールド**のみ**から読み込み
- **Workflow** は PNG の `Workflow` フィールド**のみ**から読み込み
- ポジティブとネガティブの prompt は表示前に分離
- ポジティブとネガティブが同じ場合、ポジティブのみ表示
- **Seed** は PNG の `Prompt` フィールドから読み取られ、ライトボックスに表示されます（コピー可能）

### 🛡️ 互換性と安全性

- ドラッグ&ドロップのグラフアクセスは薄い Comfy アダプタを経由 — 現在の canvas API を優先し、レガシーな `LiteGraph` パスは隔離されます。
- アセット検索はファイル名重視。サポートされていない `metadata` query パラメータは `400 Bad Request` を返します(静かに無視しません)。
- アセット一覧のページネーションは **keyset ベース** (`after_sort` + `after_id`);深いページもライブラリサイズに関係なく O(1) です。
- Companion 画像(動画 / 音声 / 3D アセットと同じ stem を持つ PNG サイドカー)は、クエリ時のサブクエリではなく、保存されたフラグで非表示にします。
- フロントエンドのリスナーは stage クローズ / worker 停止時に明示的に解除されます。

### ⚡ パフォーマンスについて

- ファイル名のみ検索 · コンパクトなメタデータ · コンパクトなプレビューキャッシュ
- 仮想化グリッド · keyset ページネーション · stale-while-revalidate レスポンスキャッシュ *(LRU 10, TTL 30 秒)* でフィルタ / ソートの再切り替えが瞬時に
- フロントエンドのみの workflow ブラウジング · フロントエンド生成の 3D サムネイルはディスクに永続化
- `ffprobe` + `ffmpeg` は**アセットごとに並列実行**(1 つの Popen ペア)
- Worker pool のデフォルトは `max(1, min(4, cpu_count() // 2))` — `config.json` で調整可能
- 動画のポスター: ffmpeg がキャプチャしたフレームを事前にダウンスケールし、PIL は小さな画像を LANCZOS で仕上げるだけ
- WebP プレビューは `method=0` で書き込み(最速、サムネイルサイズでは視覚的に同等)
- プレビュー URL はキャッシュファイルの `mtime` を cache-buster として持つ — Rebuild Cache 後にハードリフレッシュ不要
- オプションのアクセラレータ:
  - 🚀 `Pillow-SIMD` — Pillow のドロップイン置き換え、画像サムネイル化が **4–6×** 高速
  - 🚀 `blake3` — すでに `requirements.txt` に含まれており、遅い `blake2b` フォールバックを回避

### 🆘 トラブルシューティング

<details>
<summary><strong>一部のプレビューが古く見える</strong></summary>

**Rebuild Cache** を押してください。プレビュー URL は `mtime` トークンでブラウザキャッシュを自動的に無効化するので、通常ハードリフレッシュは不要です。それでも古い場合は ComfyUI を再起動し、`Ctrl+F5`。

</details>

<details>
<summary><strong>動画や音声のメタデータが欠けている</strong></summary>

おそらく `ffmpeg` / `ffprobe` が `PATH` にありません。インストールして再起動してください。

</details>

<details>
<summary><strong>完全リセットしたい</strong></summary>

`ComfyUI/output/.ts_artius_browser/` を削除し、ComfyUI を再起動して再スキャンしてください。すべてのプレビューとインデックスが再構築されます。

</details>

### 🗂️ ランタイム構成

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # アセットインデックス
├── config.json        # UI + ツール設定
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 変更履歴

[CHANGELOG.md](CHANGELOG.md) を参照してください。フォーマット: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)。

---

<a id="korean"></a>

## 🇰🇷 한국어

> **Artius Browser**는 ComfyUI 사이드바에 자리잡아 이미지, 비디오, 오디오,
> 3D 모델, workflow 파일 같은 에셋을 빠르게 찾고, 미리보고, 드래그하고,
> 불러올 수 있도록 도와줍니다. 대용량 라이브러리에서도 가볍게 동작하며,
> 가능한 한 ComfyUI 의 네이티브 동작을 사용합니다.

### ✨ 주요 특징

| | |
|---|---|
| 🖼️ **이미지** | 캐시된 썸네일, PNG `Prompt` + `Workflow` 추출, 라이트박스의 wipe / 2×2 그리드 비교와 동기 확대 |
| 🎬 **비디오** | 프레임 단위 탐색, 코덱 / FPS / 길이 / 오디오 정보, 2-4 개 클립의 동기화 비교 |
| 🎵 **오디오** | 파형 미리보기, 재생 컨트롤, 채널 레이아웃 |
| 🎲 **3D** | 라이트박스 내 ComfyUI 네이티브 3D 뷰어, 캡처된 3D 썸네일 |
| 📜 **Workflows** | ComfyUI 네이티브 workflow 폴더를 직접 읽음, sidecar 미리보기, 드래그로 로드 |
| 🪟 **두 개의 탭** | `Assets`와 `Workflows`가 **독립적인** 상태(검색, 정렬, 보기, 미리보기 크기, 트리 패널 너비)를 가짐 |
| 🔍 **파일명 검색만** | 빠르고 예측 가능, 의외의 풀텍스트 스캔 없음 |
| 🚀 **드래그 앤 드롭** | 네이티브 `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` 노드로 직접 |
| 🗑️ **안전한 삭제** | `send2trash`를 통해 시스템 휴지통으로 — 영구 삭제 안 함 |
| 🔄 **자동 스캔 / 캐시 재구성** | 필요시 새로고침, 또는 처음부터 재구성 |
| 🏷️ **버전 라벨 + 업데이트 칩** | 제목 옆에 현재 버전; GitHub 을 하루 1 회 확인하고 새 릴리스가 있으면 `New version available` 칩 표시 |
| 🧲 **다중 선택 드래그** | 선택 전체를 캔버스로 드래그 — 에셋마다 네이티브 노드 1 개, 자동 격자 배치 |
| 🔔 **동작 피드백** | 복사 / 삭제 / 불러오기 / 재스캔의 성공·실패를 토스트로 알림 — 조용한 실패 없음 |
| 🌍 **UI 현지화** | ComfyUI 의 언어 설정을 따름 — 현재 영어, 러시아어, 중국어, 일본어 제공 |
| ♿ **접근성 그리드** | 선택 상태를 포함한 스크린 리더용 listbox 시맨틱과 키보드 포커스 링 |

### 📁 지원 형식

- 🖼️ 이미지: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 비디오: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 오디오: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 빠른 시작

#### 권장 — Comfy Registry 사용

```bash
comfy node install timesaver-artius-browser
```

…또는 **ComfyUI Manager** 에서 **Timesaver Artius Browser** 를 검색하세요.

#### 수동 설치

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

그 다음 **ComfyUI 를 재시작**하고 브라우저에서 `Ctrl+F5` 로 **하드 새로고침** 하세요.

> 💡 **FFmpeg**(`ffmpeg` + `ffprobe`)는 비디오/오디오 메타데이터와 오디오 파형 생성에 사용됩니다 — 선택 사항(없어도 ComfyUI 는 실행됩니다)이지만 권장합니다:
>
> - **Windows:** `winget install ffmpeg` (또는 `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> 설치 후 ComfyUI 를 재시작하고 `ffmpeg -version` 으로 확인하세요.

### ⌨️ 키보드와 카드 버튼

#### 키보드 — 에셋 그리드

| 키 | 동작 |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | 선택 이동 |
| <kbd>Enter</kbd> | 라이트박스 열기 *(`Workflows` 탭에서는 workflow 불러오기)* |

#### 키보드 — 라이트박스

| 키 | 동작 |
|:---:|---|
| <kbd>Esc</kbd> | 닫기 |
| <kbd>←</kbd> <kbd>→</kbd> | 이전 / 다음 에셋 *(영상 비교 모드에서는 프레임 이동)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | 영상 한 프레임 이동 |
| <kbd>Delete</kbd> | 시스템 휴지통으로 |

#### 카드 버튼

> 이는 **카드 위의 버튼**(마우스를 올리면 표시)이며 키보드 단축키가 아닙니다.

| 버튼 | 동작 |
|:---:|---|
| `P` | 프롬프트 복사 |
| `W` | workflow 복사 *(PNG 에 실제로 workflow 데이터가 있을 때만)* |
| `D` | 다운로드 |
| `X` | 시스템 휴지통으로 *(root 가 삭제를 허용하는 경우에만)* |
| `S` `R` | 설치된 다른 팩이 해당 에셋용 동작을 게시한 경우에만 표시됩니다 (예: TS Image Studio 의 *스튜디오에서 사용* / *생성 세션 복원*) |

#### Workflow 카드 버튼

| 버튼 | 동작 |
|:---:|---|
| `L` · 더블 클릭 | ComfyUI 로 불러오기 |
| `D` | workflow JSON 다운로드 |
| `X` | workflow + 일치하는 미리보기 sidecar 를 휴지통으로 |

### 🎯 ComfyUI 네이티브 통합

이 팩은 loader 를 재발명하지 않습니다 — 드래그 앤 드롭을 네이티브 노드로 라우팅합니다:

| 에셋 유형 | 네이티브 노드 |
|---|---|
| 이미지 | `LoadImage` |
| 비디오 | `LoadVideo` |
| 오디오 | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | 네이티브 프론트엔드 workflow loader |

3D 파일은 ComfyUI 의 input 저장소에 자동으로 스테이징되어, 네이티브 3D 노드에서는 노드 UI 에서 선택한 파일과 정확히 같은 방식으로 보입니다. `Workflows` 탭은 `user/default/workflows` 를 직접 읽습니다 — 별도 캐시도 병렬 인덱스도 없습니다.

### 🔬 라이트박스 둘러보기

<details>
<summary><strong>🖼️ 이미지</strong></summary>

- 마우스 휠 줌, 왼쪽/가운데 버튼 팬
- 2 장 이미지의 **wipe** 비교, 좌우 슬라이더
- 4 장 이미지의 **2×2 그리드** 비교
- `Prompt` 와 `Negative Prompt` 분리 패널
- PNG 가 가지고 있을 때 원클릭 `Copy Workflow`
- 새 탭에서 열기, 다운로드, 삭제

</details>

<details>
<summary><strong>🎬 비디오</strong></summary>

- 인라인 재생 + 현재 프레임 표시
- ⬅️ / ➡️ 프레임 단위 탐색
- 코덱, FPS, 길이, 비트레이트, 형식, 오디오 트랙 정보
- 선택된 2-4 개의 비디오를 공유 transport 로 동기화 비교 (툴바 **Compare** 버튼)

</details>

<details>
<summary><strong>🎵 오디오</strong></summary>

- 파형 미리보기
- 재생 컨트롤
- 길이 · 비트레이트 · 코덱 · 채널 레이아웃

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- 라이트박스 내 ComfyUI 네이티브 3D 뷰어
- 사이드바에 모델의 기술적 정보
- 가짜 텍스처 시트 대용품 없음 — 실제 3D 모델

</details>

### 🧠 PNG 메타데이터 규칙

- **Prompt** 는 PNG `Prompt` 필드**에서만** 읽음
- **Workflow** 는 PNG `Workflow` 필드**에서만** 읽음
- 긍정 / 부정 프롬프트는 표시 전에 분리됨
- 긍정과 부정이 동일하면 긍정만 표시
- **Seed** 는 PNG `Prompt` 필드에서 읽어 라이트박스에 표시됩니다 (복사 가능)

### 🛡️ 호환성 및 안전성

- 드래그 앤 드롭 시 graph 접근은 얇은 Comfy 어댑터를 거칩니다 — 현재 canvas API 가 우선시되고, 레거시 `LiteGraph` 경로는 격리됩니다.
- 에셋 검색은 파일명 중심입니다. 지원하지 않는 `metadata` 쿼리 파라미터는 조용히 무시되는 대신 `400 Bad Request` 를 반환합니다.
- 에셋 목록 페이지네이션은 **keyset 기반** (`after_sort` + `after_id`); 라이브러리 크기와 무관하게 깊은 페이지도 O(1) 입니다.
- Companion 이미지(동일 stem 을 가진 비디오 / 오디오 / 3D 에셋의 PNG sidecar)는 쿼리 시점의 서브쿼리가 아닌 저장된 플래그로 숨겨집니다.
- 프론트엔드 리스너는 stage 닫힘 / worker 정지 시 명시적으로 해제됩니다.

### ⚡ 성능 노트

- 파일명 검색만 · 컴팩트한 메타데이터 · 컴팩트한 미리보기 캐시
- 가상화 그리드 · keyset 페이지네이션 · stale-while-revalidate 응답 캐시 *(LRU 10, TTL 30 초)* 로 필터 / 정렬 토글 즉시 반영
- 프론트엔드 전용 workflow 브라우징 · 프론트엔드 생성 3D 썸네일을 디스크에 영구 저장
- `ffprobe` + `ffmpeg` 는 **에셋별로 병렬 실행** (단일 Popen 페어)
- Worker pool 기본값은 `max(1, min(4, cpu_count() // 2))` — `config.json` 에서 조정 가능
- 비디오 포스터: ffmpeg 가 캡처한 프레임을 사전에 다운스케일하고, PIL 은 작은 이미지만 LANCZOS 로 마무리
- WebP 미리보기는 `method=0` 으로 작성됨(가장 빠름, 썸네일 크기에서는 시각적으로 동일)
- 미리보기 URL 은 캐시 파일의 `mtime` 을 cache-buster 로 포함 — Rebuild Cache 후 하드 새로고침 불필요
- 선택적 가속기:
  - 🚀 `Pillow-SIMD` — Pillow 의 드롭인 교체, 이미지 썸네일 처리 **4–6×** 빠름
  - 🚀 `blake3` — 이미 `requirements.txt` 에 있음, 느린 `blake2b` 폴백을 회피

### 🆘 문제 해결

<details>
<summary><strong>일부 미리보기가 오래된 것처럼 보임</strong></summary>

**Rebuild Cache** 를 클릭하세요. 미리보기 URL 은 `mtime` 토큰으로 브라우저 캐시를 자동 무효화하므로 일반적으로 하드 새로고침은 불필요합니다. 그래도 오래된 것처럼 보이면 ComfyUI 를 재시작하고 `Ctrl+F5`.

</details>

<details>
<summary><strong>비디오 또는 오디오 메타데이터가 누락됨</strong></summary>

`ffmpeg` / `ffprobe` 가 `PATH` 에 없을 가능성이 큽니다. 설치하고 재시작하세요.

</details>

<details>
<summary><strong>완전히 리셋하고 싶음</strong></summary>

`ComfyUI/output/.ts_artius_browser/` 를 삭제하고, ComfyUI 를 재시작하고 다시 스캔하세요. 모든 미리보기와 인덱스가 재구성됩니다.

</details>

### 🗂️ 런타임 레이아웃

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # 에셋 인덱스
├── config.json        # UI + 도구 설정
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 변경 이력

[CHANGELOG.md](CHANGELOG.md) 를 참조하세요. 형식: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<a id="german"></a>

## 🇩🇪 Deutsch

> **Artius Browser** lebt in der Seitenleiste von ComfyUI und macht das Finden,
> Voranzeigen, Ziehen und Laden deiner Assets — Bilder, Videos, Audio,
> 3D-Modelle und Workflow-Dateien — schmerzfrei. Bleibt auch bei riesigen
> Bibliotheken schnell und nutzt wo immer möglich das native Verhalten von ComfyUI.

### ✨ Highlights

| | |
|---|---|
| 🖼️ **Bilder** | Gecachte Thumbnails, Extraktion von PNG `Prompt` + `Workflow`, Lightbox mit Wipe / 2×2-Grid-Vergleich und synchronem Zoom |
| 🎬 **Videos** | Frame-genaue Navigation, Codec- / FPS- / Dauer- / Audio-Infos, synchroner Vergleich von 2-4 Clips |
| 🎵 **Audio** | Waveform-Vorschau, Transport-Steuerung, Channel-Layout |
| 🎲 **3D** | Nativer ComfyUI 3D-Viewer in der Lightbox, automatisch erfasste 3D-Thumbnails |
| 📜 **Workflows** | Liest den nativen Workflow-Ordner von ComfyUI direkt, Sidecar-Previews, Drag-to-Load |
| 🪟 **Zwei Tabs** | `Assets` und `Workflows` mit **unabhängigem** Zustand (Suche, Sortierung, Ansicht, Vorschaugröße, Baumbreite) |
| 🔍 **Suche nur nach Dateiname** | Schnell, vorhersagbar, keine überraschenden Volltextscans |
| 🚀 **Drag-and-Drop** | Direkt in native `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D`-Nodes |
| 🗑️ **Sicheres Löschen** | In den Systempapierkorb via `send2trash` — niemals endgültig |
| 🔄 **Autoscan / Cache neu aufbauen** | Aktualisierung auf Abruf oder kompletter Neuaufbau |
| 🏷️ **Versionslabel + Update-Chip** | Aktuelle Version neben dem Titel; prüft GitHub einmal täglich und blendet `New version available` ein, wenn eine neuere Version erscheint |
| 🧲 **Mehrfachauswahl ziehen** | Ganze Auswahl auf die Canvas ziehen — ein nativer Node pro Asset, automatisch im Raster angeordnet |
| 🔔 **Aktions-Feedback** | Toast-Meldungen, wenn Kopieren / Löschen / Laden / Rescan gelingt oder fehlschlägt — keine stillen Fehler mehr |
| 🌍 **Lokalisierte Oberfläche** | Folgt der Spracheinstellung von ComfyUI — Englisch, Russisch, Chinesisch und Japanisch sind enthalten |
| ♿ **Barrierefreies Raster** | Listbox-Semantik für Screenreader inkl. Auswahlstatus, plus Tastatur-Fokusring |

### 📁 Unterstützte Formate

- 🖼️ Bilder: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Videos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Schnellstart

#### Empfohlen — via Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…oder suche nach **Timesaver Artius Browser** im **ComfyUI Manager**.

#### Manuelle Installation

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Danach **ComfyUI neu starten** und im Browser mit `Ctrl+F5` einen **Hard Refresh** ausführen.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) erzeugt Video-/Audio-Metadaten und die Audio-Waveforms — optional (ComfyUI startet auch ohne), aber empfohlen:
>
> - **Windows:** `winget install ffmpeg` (oder `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Starte ComfyUI nach der Installation neu und prüfe mit `ffmpeg -version`.

### ⌨️ Tastatur und Karten-Buttons

#### Tastatur — Asset-Raster

| Taste | Aktion |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Auswahl bewegen |
| <kbd>Enter</kbd> | Lightbox öffnen *(im Tab `Workflows` den Workflow laden)* |

#### Tastatur — Lightbox

| Taste | Aktion |
|:---:|---|
| <kbd>Esc</kbd> | Schließen |
| <kbd>←</kbd> <kbd>→</kbd> | Vorheriges / nächstes Asset *(im Video-Vergleich Einzelbildschritte)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Ein Videobild weiter |
| <kbd>Delete</kbd> | In den Systempapierkorb |

#### Karten-Buttons

> Das sind **Buttons auf der Karte** (erscheinen beim Hovern), keine Tastaturkürzel.

| Button | Aktion |
|:---:|---|
| `P` | Prompt kopieren |
| `W` | Workflow kopieren *(nur wenn das PNG tatsächlich Workflow-Daten enthält)* |
| `D` | Herunterladen |
| `X` | In den Systempapierkorb *(nur dort, wo das Root das Löschen erlaubt)* |
| `S` `R` | Erscheinen nur, wenn ein anderes installiertes Pack eine Aktion für das Asset veröffentlicht (z. B. TS Image Studio: *im Studio verwenden* / *die erzeugende Sitzung wiederherstellen*) |

#### Buttons auf Workflow-Karten

| Button | Aktion |
|:---:|---|
| `L` · Doppelklick | Workflow in ComfyUI laden |
| `D` | Workflow-JSON herunterladen |
| `X` | Workflow + passende Vorschau-Sidecars in den Papierkorb |

### 🎯 Native ComfyUI-Integration

Dieses Pack erfindet keine Loader neu — es leitet Drag-and-Drop an die nativen Nodes weiter:

| Asset-Typ | Nativer Node |
|---|---|
| Bild | `LoadImage` |
| Video | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Nativer Frontend-Workflow-Loader |

3D-Dateien werden automatisch in den ComfyUI-Input-Speicher gestaged, sodass native 3D-Nodes sie genauso sehen wie Dateien, die aus der Node-UI ausgewählt wurden. Der `Workflows`-Tab liest direkt `user/default/workflows` — kein separater Cache, kein paralleler Index.

### 🔬 Lightbox-Tour

<details>
<summary><strong>🖼️ Bilder</strong></summary>

- Mausrad-Zoom, Pan mit linker/mittlerer Maustaste
- **Wipe**-Vergleich von 2 Bildern mit links-rechts-Slider
- **2×2-Grid**-Vergleich von 4 Bildern
- Separate `Prompt`- und `Negative Prompt`-Panels
- Ein-Klick-`Copy Workflow`, wenn das PNG ihn mitbringt
- In neuem Tab öffnen, herunterladen, löschen

</details>

<details>
<summary><strong>🎬 Videos</strong></summary>

- Inline-Wiedergabe mit Anzeige des aktuellen Frames
- ⬅️ / ➡️ Frame-für-Frame-Navigation
- Codec, FPS, Dauer, Bitrate, Format, Audio-Track-Infos
- Synchroner Vergleich von 2, 3 oder 4 ausgewählten Videos mit einer gemeinsamen Transport-Steuerung (**Compare**-Schaltflache)

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Waveform-Vorschau
- Wiedergabesteuerung
- Dauer · Bitrate · Codec · Channel-Layout

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Nativer ComfyUI 3D-Viewer in der Lightbox
- Technische Modell-Infos in der Seitenleiste
- Kein falscher Textur-Sheet-Ersatz — das echte Modell

</details>

### 🧠 PNG-Metadaten-Regeln

- **Prompt** wird **ausschließlich** aus dem PNG-Feld `Prompt` gelesen
- **Workflow** wird **ausschließlich** aus dem PNG-Feld `Workflow` gelesen
- Positive und negative Prompts werden vor der Anzeige getrennt
- Sind positive und negative Prompts identisch, wird nur der positive gezeigt
- **Seed** wird aus dem PNG-`Prompt`-Feld gelesen und in der Lightbox angezeigt (kopierbar)

### 🛡️ Kompatibilität und Sicherheit

- Der Graph-Zugriff für Drag-and-Drop läuft durch einen dünnen Comfy-Adapter — aktuelle Canvas-APIs werden bevorzugt, Legacy-`LiteGraph`-Pfade sind isoliert.
- Die Asset-Suche fokussiert auf Dateinamen. Nicht unterstützte `metadata`-Query-Parameter liefern `400 Bad Request` statt stiller Wirkungslosigkeit.
- Die Asset-Listen-Paginierung ist **keyset-basiert** (`after_sort` + `after_id`); tiefe Seiten kosten O(1), unabhängig von der Bibliotheksgröße.
- Companion-Bilder (PNG-Sidecars, deren Stamm zu einem benachbarten Video- / Audio- / 3D-Asset passt) werden über ein gespeichertes Flag ausgeblendet, nicht über eine Subquery zur Abfragezeit.
- Frontend-Listener werden beim Schließen des Stages / Stoppen des Workers explizit abgemeldet.

### ⚡ Performance-Notizen

- Suche nur nach Dateiname · kompakte Metadaten · kompakter Vorschau-Cache
- Virtualisiertes Grid · keyset-Paginierung · stale-while-revalidate-Response-Cache *(LRU 10, TTL 30 s)* für sofortiges Umschalten von Filter / Sortierung
- Workflow-Browsing nur im Frontend · Frontend-erzeugte 3D-Thumbnails persistent auf Disk
- `ffprobe` + `ffmpeg` laufen **pro Asset parallel** (ein Popen-Paar)
- Worker-Pools standardmäßig `max(1, min(4, cpu_count() // 2))` — in `config.json` anpassbar
- Video-Poster: ffmpeg skaliert den eingefangenen Frame schon vor, sodass PIL nur ein kleines Bild per LANCZOS finalisiert
- WebP-Previews werden mit `method=0` geschrieben (schnellste Einstellung, visuell identisch bei Thumbnail-Größen)
- Vorschau-URLs tragen den `mtime` der Cache-Datei als Cache-Buster — nach Rebuild Cache ist kein Hard Refresh nötig
- Optionale Beschleuniger:
  - 🚀 `Pillow-SIMD` — Drop-in-Ersatz für Pillow, **4–6×** schnelleres Thumbnailing
  - 🚀 `blake3` — bereits in `requirements.txt`, vermeidet den langsameren `blake2b`-Fallback

### 🆘 Fehlerbehebung

<details>
<summary><strong>Manche Previews wirken veraltet</strong></summary>

Klicke auf **Rebuild Cache**. Vorschau-URLs invalidieren den Browser-Cache automatisch via `mtime`-Token, ein Hard Refresh ist meist unnötig. Falls es weiter veraltet aussieht: ComfyUI neu starten und `Ctrl+F5`.

</details>

<details>
<summary><strong>Video- oder Audio-Metadaten fehlen</strong></summary>

Wahrscheinlich liegen `ffmpeg` / `ffprobe` nicht im `PATH`. Installiere sie und starte neu.

</details>

<details>
<summary><strong>Ich möchte komplett zurücksetzen</strong></summary>

Lösche `ComfyUI/output/.ts_artius_browser/`, starte ComfyUI neu, scanne erneut. Alle Previews und Indizes werden neu aufgebaut.

</details>

### 🗂️ Laufzeit-Layout

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # Asset-Index
├── config.json        # UI- + Tool-Einstellungen (Schema v18)
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

Siehe [CHANGELOG.md](CHANGELOG.md). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<a id="italian"></a>

## 🇮🇹 Italiano

> **Artius Browser** vive nella barra laterale di ComfyUI e rende indolore
> trovare, anteprimare, trascinare e caricare i tuoi asset — immagini, video,
> audio, modelli 3D e file di workflow. Rimane reattivo anche con librerie
> enormi e usa il comportamento nativo di ComfyUI ovunque possibile.

### ✨ Caratteristiche principali

| | |
|---|---|
| 🖼️ **Immagini** | Miniature in cache, estrazione di `Prompt` + `Workflow` dal PNG, lightbox con confronto wipe / 2×2 e zoom sincronizzato |
| 🎬 **Video** | Navigazione frame per frame, info su codec / FPS / durata / audio, confronto sincronizzato di 2-4 clip |
| 🎵 **Audio** | Anteprima della forma d'onda, controlli di riproduzione, layout dei canali |
| 🎲 **3D** | Viewer 3D nativo di ComfyUI nel lightbox, miniature 3D catturate |
| 📜 **Workflows** | Legge la cartella di workflow nativa di ComfyUI, anteprime sidecar, drag-to-load |
| 🪟 **Due tab** | `Assets` e `Workflows` con stato **indipendente** (ricerca, ordinamento, vista, dimensione anteprima, larghezza pannello albero) |
| 🔍 **Ricerca solo per nome** | Veloce, prevedibile, nessuna scansione full-text a sorpresa |
| 🚀 **Drag-and-drop** | Direttamente nei nodi nativi `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminazione sicura** | Inviato al cestino di sistema tramite `send2trash` — mai eliminato definitivamente |
| 🔄 **Autoscan / Ricostruzione cache** | Aggiornamento on-demand, o ricostruzione da zero |
| 🏷️ **Etichetta versione + chip aggiornamento** | Versione corrente accanto al titolo; controlla GitHub una volta al giorno e mostra `New version available` quando esce una nuova release |
| 🧲 **Trascinamento multi-selezione** | Trascina l'intera selezione sul canvas — un nodo nativo per asset, disposti automaticamente a griglia |
| 🔔 **Feedback delle azioni** | Notifiche quando copia / elimina / carica / riscansione riesce o fallisce — niente più errori silenziosi |
| 🌍 **Interfaccia localizzata** | Segue la lingua impostata in ComfyUI — inglese, russo, cinese e giapponese già inclusi |
| ♿ **Griglia accessibile** | Semantica listbox per screen reader con stato di selezione, più anello di focus da tastiera |

### 📁 Formati supportati

- 🖼️ Immagini: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Video: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Avvio rapido

#### Consigliato — via Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…oppure cerca **Timesaver Artius Browser** in **ComfyUI Manager**.

#### Installazione manuale

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Poi **riavvia ComfyUI** e fai un **hard refresh** del browser con `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) genera i metadati di video/audio e le forme d'onda — opzionale (ComfyUI si avvia anche senza), ma consigliato:
>
> - **Windows:** `winget install ffmpeg` (o `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Riavvia ComfyUI dopo l'installazione e verifica con `ffmpeg -version`.

### ⌨️ Tastiera e pulsanti della card

#### Tastiera — griglia degli asset

| Tasto | Azione |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Sposta la selezione |
| <kbd>Enter</kbd> | Apri il lightbox *(nella scheda `Workflows` carica il workflow)* |

#### Tastiera — lightbox

| Tasto | Azione |
|:---:|---|
| <kbd>Esc</kbd> | Chiudi |
| <kbd>←</kbd> <kbd>→</kbd> | Asset precedente / successivo *(avanza per fotogrammi nel confronto video)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanza di un fotogramma video |
| <kbd>Delete</kbd> | Invia al cestino di sistema |

#### Pulsanti della card

> Sono **pulsanti sulla card** (compaiono al passaggio del mouse), non tasti.

| Pulsante | Azione |
|:---:|---|
| `P` | Copia prompt |
| `W` | Copia workflow *(solo quando il PNG contiene davvero dati di workflow)* |
| `D` | Scarica |
| `X` | Invia al cestino di sistema *(solo dove il root permette l'eliminazione)* |
| `S` `R` | Compaiono solo quando un altro pack installato pubblica un'azione per l'asset (es. TS Image Studio: *usa nello studio* / *ripristina la sessione che l'ha creato*) |

#### Pulsanti della card workflow

| Pulsante | Azione |
|:---:|---|
| `L` · doppio clic | Carica workflow in ComfyUI |
| `D` | Scarica JSON del workflow |
| `X` | Sposta workflow + anteprime sidecar corrispondenti nel cestino |

### 🎯 Integrazione nativa con ComfyUI

Questo pack non reinventa i loader — instrada il drag-and-drop ai nodi nativi:

| Tipo di asset | Nodo nativo |
|---|---|
| Immagine | `LoadImage` |
| Video | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader nativo del frontend |

I file 3D vengono automaticamente messi in staging nello storage di input di ComfyUI, così i nodi 3D nativi li vedono esattamente come file selezionati dall'UI del nodo. Il tab `Workflows` legge direttamente `user/default/workflows` — nessuna cache separata, nessun indice parallelo.

### 🔬 Tour del lightbox

<details>
<summary><strong>🖼️ Immagini</strong></summary>

- Zoom con rotella del mouse, pan con pulsante sinistro/centrale
- Confronto **wipe** di 2 immagini con slider sinistra-destra
- Confronto **grid 2×2** di 4 immagini
- Pannelli separati per `Prompt` e `Negative Prompt`
- `Copy Workflow` in un click quando il PNG lo contiene
- Apri in una nuova tab, scarica, elimina

</details>

<details>
<summary><strong>🎬 Video</strong></summary>

- Riproduzione inline con visualizzazione del frame corrente
- ⬅️ / ➡️ navigazione frame per frame
- Codec, FPS, durata, bitrate, formato, info traccia audio
- Confronto sincronizzato di 2, 3 o 4 video selezionati con un transport condiviso (pulsante **Compare**)

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Anteprima della forma d'onda
- Controlli di riproduzione
- Durata · bitrate · codec · layout canali

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Viewer 3D nativo di ComfyUI nel lightbox
- Informazioni tecniche del modello nella sidebar
- Niente texture-sheet finto come surrogato — è il modello reale

</details>

### 🧠 Regole metadati PNG

- **Prompt** viene letto **solo** dal campo `Prompt` del PNG
- **Workflow** viene letto **solo** dal campo `Workflow` del PNG
- Prompt positivi e negativi sono separati prima della visualizzazione
- Se positivo e negativo sono identici, viene mostrato solo il positivo
- Il **seed** viene letto dal campo `Prompt` del PNG e mostrato nel lightbox (copiabile)

### 🛡️ Compatibilità e sicurezza

- L'accesso al graph per il drag-and-drop passa attraverso un adapter sottile di Comfy — le API attuali del canvas sono preferite, i percorsi legacy di `LiteGraph` sono isolati.
- La ricerca degli asset è focalizzata sul nome del file. Parametri di query `metadata` non supportati restituiscono `400 Bad Request` invece di fallire silenziosamente.
- La paginazione dell'elenco asset è **keyset-based** (`after_sort` + `after_id`); pagine profonde sono O(1) indipendentemente dalla dimensione della libreria.
- Le immagini companion (sidecar PNG il cui stem corrisponde a un asset video / audio / 3D adiacente) vengono nascoste tramite un flag memorizzato, non tramite subquery a query-time.
- I listener del frontend vengono smontati esplicitamente alla chiusura dello stage / arresto del worker.

### ⚡ Note sulle performance

- Ricerca solo per nome · metadati compatti · cache delle anteprime compatta
- Grid virtualizzata · paginazione keyset · cache stale-while-revalidate *(LRU 10, TTL 30 s)* per scambi istantanei di filtro / ordinamento
- Browsing dei workflow solo nel frontend · miniature 3D generate dal frontend e persistenti su disco
- `ffprobe` + `ffmpeg` girano **in parallelo per asset** (una sola coppia di Popen)
- Worker pool di default `max(1, min(4, cpu_count() // 2))` — modificabile in `config.json`
- Poster video: ffmpeg riduce in anticipo la dimensione del frame catturato, PIL si limita a finire una piccola immagine con LANCZOS
- Anteprime WebP scritte con `method=0` (più veloce, visivamente identico a dimensioni thumbnail)
- Le URL delle anteprime portano l'`mtime` del file in cache come cache-buster — nessun hard refresh necessario dopo Rebuild Cache
- Acceleratori opzionali:
  - 🚀 `Pillow-SIMD` — sostituzione drop-in di Pillow, thumbnail delle immagini **4–6×** più veloci
  - 🚀 `blake3` — già in `requirements.txt`, evita il fallback più lento `blake2b`

### 🆘 Risoluzione problemi

<details>
<summary><strong>Alcune anteprime sembrano vecchie</strong></summary>

Premi **Rebuild Cache**. Le URL delle anteprime invalidano automaticamente la cache del browser tramite un token `mtime`, quindi normalmente un hard refresh non serve. Se sembra ancora vecchio, riavvia ComfyUI e `Ctrl+F5`.

</details>

<details>
<summary><strong>I metadati di video o audio mancano</strong></summary>

Probabilmente `ffmpeg` / `ffprobe` non sono nel `PATH`. Installali e riavvia.

</details>

<details>
<summary><strong>Voglio un reset completo</strong></summary>

Elimina `ComfyUI/output/.ts_artius_browser/`, riavvia ComfyUI, esegui di nuovo la scansione. Tutte le anteprime e gli indici verranno ricostruiti.

</details>

### 🗂️ Layout runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # indice asset
├── config.json        # impostazioni UI + strumenti
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

Vedi [CHANGELOG.md](CHANGELOG.md). Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<a id="french"></a>

## 🇫🇷 Français

> **Artius Browser** vit dans la barre latérale de ComfyUI et rend agréable
> la recherche, la prévisualisation, le glisser-déposer et le chargement de
> vos assets — images, vidéos, audios, modèles 3D et fichiers de workflow.
> Reste rapide même avec d'immenses bibliothèques et utilise le comportement
> natif de ComfyUI partout où c'est possible.

### ✨ Points forts

| | |
|---|---|
| 🖼️ **Images** | Miniatures en cache, extraction de `Prompt` + `Workflow` du PNG, lightbox avec comparaison wipe / 2×2 et zoom synchronisé |
| 🎬 **Vidéos** | Navigation image par image, infos codec / FPS / durée / audio, comparaison synchronisée de 2-4 clips |
| 🎵 **Audio** | Aperçu de la forme d'onde, contrôles de transport, layout des canaux |
| 🎲 **3D** | Viewer 3D natif de ComfyUI dans la lightbox, miniatures 3D capturées |
| 📜 **Workflows** | Lit le dossier de workflows natif de ComfyUI, aperçus sidecar, drag-to-load |
| 🪟 **Deux onglets** | `Assets` et `Workflows` avec un état **indépendant** (recherche, tri, vue, taille des aperçus, largeur du panneau arborescence) |
| 🔍 **Recherche par nom uniquement** | Rapide, prévisible, pas de scan full-text surprise |
| 🚀 **Glisser-déposer** | Directement vers les nœuds natifs `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Suppression sûre** | Envoyé à la corbeille système via `send2trash` — jamais de suppression définitive |
| 🔄 **Autoscan / Reconstruction du cache** | Rafraîchissement à la demande, ou reconstruction depuis zéro |
| 🏷️ **Étiquette de version + chip de mise à jour** | Version actuelle à côté du titre ; vérifie GitHub une fois par jour et affiche `New version available` quand une nouvelle release sort |
| 🧲 **Glisser une sélection multiple** | Glissez toute la sélection sur le canvas — un nœud natif par asset, disposés automatiquement en grille |
| 🔔 **Retour d'action** | Notifications quand copier / supprimer / charger / rescanner réussit ou échoue — fini les échecs silencieux |
| 🌍 **Interface localisée** | Suit la langue configurée dans ComfyUI — anglais, russe, chinois et japonais déjà fournis |
| ♿ **Grille accessible** | Sémantique listbox pour lecteurs d'écran avec état de sélection, plus un anneau de focus clavier |

### 📁 Formats pris en charge

- 🖼️ Images : `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vidéos : `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio : `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D : `.glb` · `.obj`
- 📜 Workflows : `.json`

### 🚀 Démarrage rapide

#### Recommandé — via Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…ou recherchez **Timesaver Artius Browser** dans **ComfyUI Manager**.

#### Installation manuelle

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Puis **redémarrez ComfyUI** et faites un **rafraîchissement forcé** du navigateur avec `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) génère les métadonnées vidéo/audio et les formes d'onde — optionnel (ComfyUI démarre quand même sans), mais recommandé :
>
> - **Windows :** `winget install ffmpeg` (ou `choco install ffmpeg`)
> - **macOS :** `brew install ffmpeg`
> - **Linux :** `sudo apt install ffmpeg`
>
> Redémarrez ComfyUI après l'installation, puis vérifiez avec `ffmpeg -version`.

### ⌨️ Clavier et boutons de carte

#### Clavier — grille d'assets

| Touche | Action |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Déplacer la sélection |
| <kbd>Enter</kbd> | Ouvrir la lightbox *(dans l'onglet `Workflows`, charger le workflow)* |

#### Clavier — lightbox

| Touche | Action |
|:---:|---|
| <kbd>Esc</kbd> | Fermer |
| <kbd>←</kbd> <kbd>→</kbd> | Asset précédent / suivant *(image par image en mode comparaison vidéo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avancer d'une image vidéo |
| <kbd>Delete</kbd> | Envoyer à la corbeille système |

#### Boutons de la carte

> Ce sont des **boutons sur la carte** (au survol), pas des raccourcis clavier.

| Bouton | Action |
|:---:|---|
| `P` | Copier le prompt |
| `W` | Copier le workflow *(uniquement quand le PNG contient vraiment des données de workflow)* |
| `D` | Télécharger |
| `X` | Envoyer à la corbeille système *(uniquement là où le root autorise la suppression)* |
| `S` `R` | N'apparaissent que si un autre pack installé publie une action pour l'asset (par ex. TS Image Studio : *utiliser dans le studio* / *restaurer la session d'origine*) |

#### Boutons de la carte workflow

| Bouton | Action |
|:---:|---|
| `L` · double-clic | Charger le workflow dans ComfyUI |
| `D` | Télécharger le JSON du workflow |
| `X` | Envoyer à la corbeille le workflow + sidecars d'aperçu correspondants |

### 🎯 Intégration native avec ComfyUI

Ce pack ne réinvente pas les loaders — il route le glisser-déposer vers les nœuds natifs :

| Type d'asset | Nœud natif |
|---|---|
| Image | `LoadImage` |
| Vidéo | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader natif du frontend |

Les fichiers 3D sont automatiquement préparés dans le stockage d'input de ComfyUI, de sorte que les nœuds 3D natifs les voient exactement comme des fichiers sélectionnés depuis l'UI du nœud. L'onglet `Workflows` lit `user/default/workflows` directement — pas de cache séparé, pas d'index parallèle.

### 🔬 Tour de la lightbox

<details>
<summary><strong>🖼️ Images</strong></summary>

- Zoom à la molette, pan avec le bouton gauche/milieu
- Comparaison **wipe** de 2 images avec slider gauche-droite
- Comparaison **grille 2×2** de 4 images
- Panneaux séparés `Prompt` et `Negative Prompt`
- `Copy Workflow` en un clic quand le PNG le contient
- Ouvrir dans un nouvel onglet, télécharger, supprimer

</details>

<details>
<summary><strong>🎬 Vidéos</strong></summary>

- Lecture inline avec affichage de l'image courante
- ⬅️ / ➡️ navigation image par image
- Codec, FPS, durée, débit, format, infos piste audio
- Comparaison synchronisée de 2, 3 ou 4 vidéos sélectionnées avec un transport partagé (bouton **Compare**)

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Aperçu de la forme d'onde
- Contrôles de lecture
- Durée · débit · codec · layout des canaux

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Viewer 3D natif de ComfyUI dans la lightbox
- Informations techniques du modèle dans la barre latérale
- Pas de feuille de texture factice — c'est le vrai modèle

</details>

### 🧠 Règles des métadonnées PNG

- **Prompt** est lu **uniquement** depuis le champ `Prompt` du PNG
- **Workflow** est lu **uniquement** depuis le champ `Workflow` du PNG
- Les prompts positifs et négatifs sont séparés avant affichage
- Si positif et négatif sont identiques, seul le positif est affiché
- Le **seed** est lu depuis le champ `Prompt` du PNG et affiché dans la lightbox (copiable)

### 🛡️ Compatibilité et sécurité

- L'accès au graph pour le glisser-déposer passe par un adaptateur fin de Comfy — les API actuelles du canvas sont préférées, les chemins legacy de `LiteGraph` sont isolés.
- La recherche d'assets se concentre sur le nom de fichier. Les paramètres de requête `metadata` non pris en charge retournent `400 Bad Request` au lieu d'échouer silencieusement.
- La pagination de la liste d'assets est **keyset-based** (`after_sort` + `after_id`) ; les pages profondes sont en O(1) quelle que soit la taille de la bibliothèque.
- Les images companion (sidecars PNG dont le stem correspond à un asset vidéo / audio / 3D frère) sont masquées via un flag stocké, pas une sous-requête au moment de la requête.
- Les listeners frontend sont démontés explicitement à la fermeture du stage / arrêt du worker.

### ⚡ Notes de performance

- Recherche par nom uniquement · métadonnées compactes · cache d'aperçus compact
- Grille virtualisée · pagination keyset · cache stale-while-revalidate *(LRU 10, TTL 30 s)* pour des bascules instantanées de filtre / tri
- Navigation de workflows uniquement côté frontend · miniatures 3D générées par le frontend et persistées sur disque
- `ffprobe` + `ffmpeg` tournent **en parallèle par asset** (une seule paire Popen)
- Worker pools par défaut `max(1, min(4, cpu_count() // 2))` — ajustable dans `config.json`
- Poster vidéo : ffmpeg réduit d'avance la taille du frame capturé, PIL termine simplement une petite image avec LANCZOS
- Aperçus WebP écrits avec `method=0` (le plus rapide, visuellement identique à la taille thumbnail)
- Les URL d'aperçu portent le `mtime` du fichier en cache comme cache-buster — pas besoin de rafraîchissement forcé après Rebuild Cache
- Accélérateurs optionnels :
  - 🚀 `Pillow-SIMD` — remplacement drop-in de Pillow, miniatures d'images **4–6×** plus rapides
  - 🚀 `blake3` — déjà dans `requirements.txt`, évite le fallback plus lent `blake2b`

### 🆘 Dépannage

<details>
<summary><strong>Certains aperçus paraissent obsolètes</strong></summary>

Cliquez sur **Rebuild Cache**. Les URL d'aperçu invalident le cache du navigateur automatiquement via un token `mtime`, donc un rafraîchissement forcé n'est généralement pas nécessaire. Si ça reste obsolète, redémarrez ComfyUI et `Ctrl+F5`.

</details>

<details>
<summary><strong>Métadonnées vidéo ou audio manquantes</strong></summary>

Vous n'avez probablement pas `ffmpeg` / `ffprobe` dans le `PATH`. Installez-les et redémarrez.

</details>

<details>
<summary><strong>Je veux une remise à zéro complète</strong></summary>

Supprimez `ComfyUI/output/.ts_artius_browser/`, redémarrez ComfyUI, scannez à nouveau. Tous les aperçus et index seront reconstruits.

</details>

### 🗂️ Layout d'exécution

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # index des assets
├── config.json        # paramètres UI + outils (schéma v18)
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

Voir [CHANGELOG.md](CHANGELOG.md). Format : [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<a id="portuguese"></a>

## 🇵🇹 Português

> **Artius Browser** vive na barra lateral do ComfyUI e torna indolor
> encontrar, pré-visualizar, arrastar e carregar os teus assets — imagens,
> vídeos, áudios, modelos 3D e ficheiros de workflow. Mantém-se rápido mesmo
> em bibliotecas enormes e usa o comportamento nativo do ComfyUI sempre que
> possível.

### ✨ Destaques

| | |
|---|---|
| 🖼️ **Imagens** | Thumbnails em cache, extracção de `Prompt` + `Workflow` do PNG, lightbox com comparação wipe / 2×2 e zoom sincronizado |
| 🎬 **Vídeos** | Navegação frame a frame, info de codec / FPS / duração / áudio, comparação sincronizada de 2-4 clips |
| 🎵 **Áudio** | Pré-visualização de forma de onda, controlos de reprodução, layout de canais |
| 🎲 **3D** | Viewer 3D nativo do ComfyUI no lightbox, thumbnails 3D capturados |
| 📜 **Workflows** | Lê directamente a pasta nativa de workflows do ComfyUI, previews sidecar, drag-to-load |
| 🪟 **Dois separadores** | `Assets` e `Workflows` com estado **independente** (procura, ordenação, vista, tamanho de preview, largura do painel árvore) |
| 🔍 **Procura apenas por nome** | Rápida, previsível, sem scans full-text surpresa |
| 🚀 **Arrastar e largar** | Directamente para os nós nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminação segura** | Enviado para o lixo do sistema via `send2trash` — nunca eliminado permanentemente |
| 🔄 **Autoscan / Reconstruir cache** | Refresh on-demand ou reconstrução do zero |
| 🏷️ **Etiqueta de versão + chip de actualização** | Versão actual ao lado do título; verifica o GitHub uma vez por dia e mostra `New version available` quando sai uma versão mais recente |
| 🧲 **Arrastar selecção múltipla** | Arraste toda a selecção para o canvas — um nó nativo por asset, dispostos automaticamente em grelha |
| 🔔 **Feedback das acções** | Notificações quando copiar / eliminar / carregar / reanalisar tem sucesso ou falha — sem falhas silenciosas |
| 🌍 **Interface localizada** | Segue o idioma configurado no ComfyUI — inglês, russo, chinês e japonês já incluídos |
| ♿ **Grelha acessível** | Semântica listbox para leitores de ecrã com estado de selecção, e anel de foco de teclado |

### 📁 Formatos suportados

- 🖼️ Imagens: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Áudio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Início rápido

#### Recomendado — via Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…ou procura **Timesaver Artius Browser** no **ComfyUI Manager**.

#### Instalação manual

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Depois **reinicia o ComfyUI** e faz um **hard refresh** no browser com `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) gera os metadados de vídeo/áudio e as formas de onda — opcional (o ComfyUI arranca mesmo sem ele), mas recomendado:
>
> - **Windows:** `winget install ffmpeg` (ou `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Reinicia o ComfyUI após instalar e confirma com `ffmpeg -version`.

### ⌨️ Teclado e botões do card

#### Teclado — grelha de assets

| Tecla | Acção |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover a selecção |
| <kbd>Enter</kbd> | Abrir o lightbox *(no separador `Workflows`, carregar o workflow)* |

#### Teclado — lightbox

| Tecla | Acção |
|:---:|---|
| <kbd>Esc</kbd> | Fechar |
| <kbd>←</kbd> <kbd>→</kbd> | Asset anterior / seguinte *(avança fotogramas no modo de comparação de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avançar um fotograma de vídeo |
| <kbd>Delete</kbd> | Enviar para o lixo do sistema |

#### Botões do card

> São **botões no card** (aparecem ao passar o cursor), não teclas.

| Botão | Acção |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(só quando o PNG realmente contém dados de workflow)* |
| `D` | Transferir |
| `X` | Enviar para o lixo do sistema *(só onde o root permite eliminação)* |
| `S` `R` | Aparecem apenas quando outro pack instalado publica uma ação para o asset (ex.: TS Image Studio: *usar no estúdio* / *restaurar a sessão que o criou*) |

#### Botões do card de workflow

| Botão | Acção |
|:---:|---|
| `L` · duplo clique | Carregar workflow no ComfyUI |
| `D` | Transferir JSON do workflow |
| `X` | Enviar para o lixo o workflow + sidecars de preview correspondentes |

### 🎯 Integração nativa com o ComfyUI

Este pack não reinventa loaders — encaminha drag-and-drop para os nós nativos:

| Tipo de asset | Nó nativo |
|---|---|
| Imagem | `LoadImage` |
| Vídeo | `LoadVideo` |
| Áudio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader nativo do frontend |

Os ficheiros 3D são automaticamente preparados no armazenamento de input do ComfyUI, para que os nós 3D nativos os vejam exactamente como ficheiros seleccionados a partir da UI do nó. O separador `Workflows` lê directamente `user/default/workflows` — sem cache separado, sem índice paralelo.

### 🔬 Tour pelo lightbox

<details>
<summary><strong>🖼️ Imagens</strong></summary>

- Zoom com roda do rato, pan com botão esquerdo/meio
- Comparação **wipe** de 2 imagens com slider esquerda-direita
- Comparação **grelha 2×2** de 4 imagens
- Painéis separados para `Prompt` e `Negative Prompt`
- `Copy Workflow` num clique quando o PNG o contém
- Abrir em novo separador, transferir, eliminar

</details>

<details>
<summary><strong>🎬 Vídeos</strong></summary>

- Reprodução inline com display do frame actual
- ⬅️ / ➡️ navegação frame a frame
- Codec, FPS, duração, bitrate, formato, info da pista de áudio
- Comparação sincronizada de 2, 3 ou 4 vídeos seleccionados com um transport partilhado (botão **Compare**)

</details>

<details>
<summary><strong>🎵 Áudio</strong></summary>

- Pré-visualização de forma de onda
- Controlos de reprodução
- Duração · bitrate · codec · layout de canais

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Viewer 3D nativo do ComfyUI no lightbox
- Informação técnica do modelo na barra lateral
- Sem substitutos de texture-sheet falsos — é o modelo real

</details>

### 🧠 Regras de metadados PNG

- **Prompt** é lido **apenas** do campo `Prompt` do PNG
- **Workflow** é lido **apenas** do campo `Workflow` do PNG
- Prompts positivos e negativos são separados antes de serem mostrados
- Se positivo e negativo forem idênticos, só o positivo é mostrado
- O **seed** é lido do campo `Prompt` do PNG e mostrado no lightbox (copiável)

### 🛡️ Compatibilidade e segurança

- O acesso ao graph para drag-and-drop passa por um adapter fino do Comfy — as APIs actuais do canvas têm prioridade, os caminhos legacy de `LiteGraph` ficam isolados.
- A procura de assets foca-se no nome do ficheiro. Parâmetros de query `metadata` não suportados devolvem `400 Bad Request` em vez de falharem em silêncio.
- A paginação da lista de assets é **keyset-based** (`after_sort` + `after_id`); páginas profundas são O(1) independentemente do tamanho da biblioteca.
- Imagens companion (sidecars PNG cujo stem corresponde a um asset irmão de vídeo / áudio / 3D) são ocultadas via uma flag guardada, não via subquery em query-time.
- Os listeners do frontend são explicitamente desmontados no fecho do stage / paragem do worker.

### ⚡ Notas de performance

- Procura apenas por nome · metadados compactos · cache de previews compacto
- Grelha virtualizada · paginação keyset · cache stale-while-revalidate *(LRU 10, TTL 30 s)* para alternâncias instantâneas de filtro / ordenação
- Navegação de workflows apenas no frontend · thumbnails 3D gerados no frontend e persistidos em disco
- `ffprobe` + `ffmpeg` correm **em paralelo por asset** (um único par de Popen)
- Worker pools por defeito `max(1, min(4, cpu_count() // 2))` — ajustável em `config.json`
- Poster de vídeo: ffmpeg pré-reduz o frame capturado, PIL só finaliza uma imagem pequena com LANCZOS
- Previews WebP escritos com `method=0` (mais rápido, visualmente idêntico no tamanho thumbnail)
- URLs de preview carregam o `mtime` do ficheiro em cache como cache-buster — não é preciso hard refresh após Rebuild Cache
- Aceleradores opcionais:
  - 🚀 `Pillow-SIMD` — substituição drop-in do Pillow, thumbnailing de imagens **4–6×** mais rápido
  - 🚀 `blake3` — já está em `requirements.txt`, evita o fallback mais lento `blake2b`

### 🆘 Resolução de problemas

<details>
<summary><strong>Algumas previews parecem desactualizadas</strong></summary>

Carrega em **Rebuild Cache**. As URLs de preview invalidam a cache do browser automaticamente via token `mtime`, por isso normalmente não é preciso hard refresh. Se continuar desactualizado, reinicia o ComfyUI e `Ctrl+F5`.

</details>

<details>
<summary><strong>Metadados de vídeo ou áudio em falta</strong></summary>

Provavelmente não tens `ffmpeg` / `ffprobe` no `PATH`. Instala-os e reinicia.

</details>

<details>
<summary><strong>Quero um reset completo</strong></summary>

Apaga `ComfyUI/output/.ts_artius_browser/`, reinicia o ComfyUI, scaneia outra vez. Todas as previews e índices vão ser reconstruídos.

</details>

### 🗂️ Layout em runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de assets
├── config.json        # definições de UI + ferramentas
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

Vê [CHANGELOG.md](CHANGELOG.md). Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<div align="center">

Made with ❤️ by [AlexYez](https://github.com/AlexYez) ·
[🐛 Report a bug](https://github.com/AlexYez/comfyui-artius-browser/issues/new?template=bug.yml) ·
[💖 Donate](https://timesavervfx.com/donate/)

</div>
