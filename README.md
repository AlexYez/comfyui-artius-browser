# Artius Browser for ComfyUI

<p align="center">
  <strong>Fast asset browsing, workflow browsing, native drag-and-drop, and clean previews inside ComfyUI.</strong>
</p>

<p align="center">
  <a href="#english">English</a> |
  <a href="#russian">Русский</a> |
  <a href="#spanish">Español</a> |
  <a href="#chinese">中文</a> |
  <a href="#japanese">日本語</a> |
  <a href="#korean">한국어</a> |
  <a href="#german">Deutsch</a> |
  <a href="#italian">Italiano</a> |
  <a href="#french">Français</a> |
  <a href="#portuguese">Português</a>
</p>

![Artius Browser](img/ts-artius-browser.jpg)

---

<a id="english"></a>
## English

### What it is

**Artius Browser** is a sidebar browser for ComfyUI focused on the files you actually use every day:

- images
- videos
- audio
- 3D models
- ComfyUI workflow JSON files

It is designed to stay fast on large libraries, keep previews compact, and use native ComfyUI behavior wherever possible.

### Highlights

- `Assets` and `Workflows` tabs
- `Flat` and `Tree` browsing modes in both tabs
- independent saved state per tab:
  - search
  - sort
  - preview size
  - flat/tree mode
- cached previews for image, video, audio, and 3D assets
- native workflow browsing from `user/default/workflows`
- PNG prompt parsing with separate positive and negative prompt display
- PNG workflow extraction with one-click copy
- lightbox viewer for every supported asset type
- frame stepping for videos in the lightbox
- wipe compare mode for `2` selected images
- grid compare mode for `4` selected images
- synchronized compare mode for `2` or `4` selected videos
- native ComfyUI 3D viewer integration
- drag-and-drop into native ComfyUI nodes
- delete to the system trash instead of hard delete
- `Autoscan`, `Rescan`, and full `Rebuild Cache`

### Supported formats

- Images: `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`
- Videos: `.mp4`, `.mov`, `.webm`, `.prores`
- Audio: `.mp3`, `.wav`, `.flac`, `.opus`, `.ogg`
- 3D: `.glb`, `.obj`
- Workflows: `.json`

### Assets tab

The `Assets` tab works with indexed asset roots such as:

- `ComfyUI/output`
- `ComfyUI/input`
- your configured custom roots

Main tools:

- filename-only search
- asset type filters
- root selector
- sort by date, name, or size
- `Flat / Tree` switch
- preview size slider
- `Autoscan` toggle
- `Rescan`
- `Rebuild Cache`

### Workflows tab

The `Workflows` tab is intentionally separate from the normal asset index.

It:

- reads the native ComfyUI `workflows` library directly
- does not use the asset database
- does not build browser cache records for workflows
- supports `Flat` and `Tree`
- keeps its own search, sort, and preview-size state
- searches by workflow filename only

Workflow previews support:

- image sidecars with the same filename stem
- video sidecars with the same filename stem
- `.webp` preview images
- a clean placeholder with the workflow name when no preview exists

Workflow actions:

- double click or `L` to load the workflow into ComfyUI
- `D` to download the workflow JSON
- `X` to send the workflow and its preview sidecars to the system trash

### Lightbox

#### Images

- zoom with the mouse wheel
- pan with left or middle mouse button when zoomed
- compare `2` selected images with a left-to-right wipe slider
- compare `4` selected images in a clean 2x2 grid
- separate `Prompt` and `Negative Prompt` fields when available
- `Copy Workflow` button when the PNG contains workflow data
- open in new tab, download, delete

#### Videos

- inline playback
- current frame display
- previous / next frame stepping
- codec, FPS, duration, bitrate, format, and audio-track info
- compare mode for `2` or `4` selected videos with one shared transport

#### Audio

- waveform preview
- playback controls
- duration, bitrate, codec, and channel layout

#### 3D

- native ComfyUI 3D viewer in the lightbox
- technical model info in the sidebar
- no fake texture-sheet viewer

### Quick card actions

Asset cards can show compact action buttons:

- `P` = copy prompt
- `W` = copy workflow
- `D` = download
- `X` = delete

Rules:

- `W` appears only for PNG images that definitely contain workflow data
- workflow cards use `L`, `D`, and `X`
- delete is shown only where the root allows deletion

### Metadata rules

For ComfyUI PNG files:

- prompt data is read only from the PNG `Prompt` field
- workflow data is read only from the PNG `Workflow` field
- positive and negative prompt are split before display
- if positive and negative prompt are identical, only the positive prompt is shown
- seed is not stored anymore

### Native ComfyUI integration

The browser is built around native ComfyUI behavior:

- images -> `LoadImage`
- videos -> `LoadVideo`
- audio -> `LoadAudio`
- 3D -> `Load 3D & Animation` / `Load3D`
- workflows -> native frontend workflow loading

For 3D assets, files are staged into ComfyUI input storage so native 3D nodes load them the same way as files selected from the node UI.

### Compatibility notes

- Drag-and-drop graph access is routed through a small Comfy adapter that prefers current canvas APIs and keeps legacy LiteGraph/private graph fallbacks isolated.
- Asset search is filename-focused. Unsupported `metadata` query params return `400 Bad Request` instead of silently doing nothing.
- Asset listing pagination is keyset-based (`after_sort` + `after_id`); deep pages stay O(1) regardless of library size.
- Companion images (PNG sidecars whose stem matches a sibling video / audio / 3D asset) are suppressed via a stored flag computed at index time, not a query-time subquery.
- Frontend viewer and worker listeners are explicitly torn down when stages close or workers stop.

### Performance notes

The project is intentionally conservative about performance:

- filename-only search
- compact metadata storage
- compact preview cache
- virtualized grid rendering
- keyset pagination for asset listing
- stale-while-revalidate response cache on the frontend (LRU 10, 30s TTL) for instant filter / sort re-toggles
- frontend-only workflow browsing
- frontend-generated true 3D thumbnails, persisted into cache
- video and audio indexing runs `ffprobe` and `ffmpeg` in parallel per asset (single Popen pair instead of two sequential calls)
- `ffprobe_workers` and `ffmpeg_workers` default to `min(4, cpu_count() // 2)` — adjust in `config.json` if needed
- video poster extraction asks `ffmpeg` to pre-downscale the captured frame so PIL only has to LANCZOS-finish a small image
- WebP previews are written with `method=0` for fastest encoding (visually identical at thumbnail sizes)
- batch asset upserts share resolved root/folder/type/extension lookups in one transaction
- optional: install `Pillow-SIMD` instead of stock `Pillow` for 4–6× faster image thumbnailing — the backend logs `Pillow-SIMD detected` on startup when it is in use
- optional: keeping `blake3` installed (it is in `requirements.txt`) avoids the slower `blake2b` fallback during hashing — a `WARNING` is logged if it is missing

### Installation

1. Copy this repository into `ComfyUI/custom_nodes/`
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Make sure `ffmpeg` and `ffprobe` are available
4. Restart ComfyUI
5. Hard refresh with `Ctrl+F5`

#### Optional: Pillow-SIMD

For 4–6× faster image thumbnailing on x86_64 systems with SSE/AVX, replace stock Pillow with Pillow-SIMD:

```bash
pip uninstall pillow
pip install pillow-simd
```

The backend will log `Pillow-SIMD detected — accelerated image pipeline enabled` at startup when it is active. Pillow-SIMD is a drop-in API-compatible replacement, no code changes required.

### Release checks

Before publishing a new version, run:

```bash
python scripts/check_release.py
```

It validates Python syntax, JavaScript syntax, JSON files, localization keys, obvious dead top-level helpers, unit tests, and Git whitespace issues.

### Runtime storage

Main runtime directory:

- `ComfyUI/output/.ts_artius_browser/`

Important files:

- `db.sqlite`
- `config.json`
- preview cache files

### Troubleshooting

#### Some previews look stale

- use `Rebuild Cache`
- restart ComfyUI
- hard refresh with `Ctrl+F5`

#### Video or audio metadata is missing

Check:

- `ffmpeg`
- `ffprobe`

#### You want a complete reset

Delete:

- `ComfyUI/output/.ts_artius_browser/`

Then restart ComfyUI and scan again.

---

<a id="russian"></a>
## Русский

### Что это такое

**Artius Browser** — это быстрый браузер ассетов и workflow прямо внутри sidebar ComfyUI.

Он умеет:

- работать с изображениями, видео, аудио и 3D
- открывать отдельную вкладку `Workflows`
- показывать превью и метаданные
- поддерживать `Flat` и `Tree`
- перетаскивать ассеты в нативные ноды ComfyUI

### Главное

- у вкладок `Assets` и `Workflows` независимые настройки
- есть `Autoscan`, `Rescan` и полный `Rebuild Cache`
- PNG-промт разбирается на `Prompt` и `Negative Prompt`
- workflow из PNG можно копировать одной кнопкой
- в лайтбоксе у видео есть покадровая навигация
- для `2` выбранных изображений есть wipe-сравнение с полоской слева направо
- для `4` выбранных изображений есть режим сравнения в сетке 2x2
- для `2` или `4` выбранных видео есть синхронный режим сравнения
- 3D открывается через нативный viewer ComfyUI
- удаление идет в системную корзину, а не навсегда

### Вкладка Assets

- поиск только по имени файла
- фильтры по типам ассетов
- выбор root-папки
- сортировка по дате, имени и размеру
- переключение `Flat / Tree`
- слайдер размера превью

### Вкладка Workflows

- читает нативную папку `workflows`
- не использует asset database
- не создает cache-записи для workflow
- поддерживает image/video sidecar preview с тем же именем
- если превью нет, показывает аккуратный placeholder
- `L` загружает workflow в ComfyUI
- `D` скачивает JSON
- `X` отправляет workflow и его превью в корзину

### Лайтбокс

- изображения: zoom, pan, prompt, negative prompt, `Copy Workflow`, compare mode для `2` или `4` выбранных изображений
- видео: плеер, кадр, FPS, кодек, аудиодорожка, compare mode
- аудио: waveform и техинформация
- 3D: нативный 3D viewer и информация о модели

### Правила совместимости

- доступ к graph/canvas/LiteGraph проходит через adapter, чтобы новые API ComfyUI и legacy fallback не расползались по UI-коду
- поиск ассетов остается поиском по имени файла; неподдерживаемый query param `metadata` возвращает `400 Bad Request`
- пагинация ассетов keyset-based (`after_sort` + `after_id`) — глубокие страницы стоят столько же, сколько первая
- companion-картинки (PNG-сайдкары к видео/аудио/3D с тем же stem) скрываются через сохранённый флаг, посчитанный на индексации — без подзапросов в query-time
- временные frontend listeners у viewer/worker снимаются при закрытии stage или остановке worker
- фронтенд держит небольшой stale-while-revalidate кэш ответов (LRU 10, TTL 30 сек) для мгновенного переключения между уже виденными фильтрами/сортировкой

### Производительность

- индексация видео и аудио запускает `ffprobe` и `ffmpeg` параллельно (один pair Popen вместо двух последовательных вызовов)
- `ffprobe_workers` и `ffmpeg_workers` по умолчанию равны `min(4, cpu_count() // 2)` — старые значения `1` автоматически мигрируют при обновлении
- ffmpeg сразу делает downscale кадра видео до 2× размера превью, PIL только финиширует LANCZOS — экономит decode на 4K-видео
- WebP-превью пишутся с `method=0` (быстрейшее кодирование, визуально идентично на маленьких размерах)
- batch-upsert ассетов внутри одной транзакции переиспользует уже разрешённые root/folder/type/extension lookup'ы
- опционально: установка `Pillow-SIMD` вместо обычного `Pillow` ускоряет генерацию thumbnail в 4–6×; backend пишет `Pillow-SIMD detected` в лог при старте
- опционально: `blake3` (есть в `requirements.txt`) даёт заметное ускорение хеширования — при его отсутствии в логе появится `WARNING` и используется более медленный `blake2b`

### Установка

1. Скопируйте репозиторий в `ComfyUI/custom_nodes/`
2. Установите зависимости:

```bash
pip install -r requirements.txt
```

3. Убедитесь, что доступны `ffmpeg` и `ffprobe`
4. Перезапустите ComfyUI

---

<a id="spanish"></a>
## Español

**Artius Browser** es un navegador lateral rápido para ComfyUI con dos secciones: `Assets` y `Workflows`.

Puntos clave:

- modos `Flat` y `Tree` en ambas pestañas
- estado guardado por pestaña: búsqueda, orden, tamaño de preview y modo de vista
- previews cacheadas para imagen, video, audio y 3D
- workflows leídos directamente desde la carpeta nativa de ComfyUI
- prompts PNG separados en prompt positivo y negativo
- lightbox con comparación de `2` o `4` imágenes y comparación sincronizada de `2` o `4` videos
- integración 3D nativa con `Load 3D & Animation`
- borrado a la papelera del sistema

Instalación rápida:

```bash
pip install -r requirements.txt
```

Reinicia ComfyUI y asegúrate de tener `ffmpeg` y `ffprobe`.

---

<a id="chinese"></a>
## 中文

**Artius Browser** 是一个面向 ComfyUI 的高性能侧边栏浏览器，包含 `Assets` 和 `Workflows` 两个标签页。

主要功能：

- 两个标签页都支持 `Flat` / `Tree`
- 每个标签页分别保存搜索、排序、缩略图大小和视图模式
- 支持图片、视频、音频和 3D 资源预览缓存
- `Workflows` 直接读取 ComfyUI 原生工作流目录
- PNG 元数据会区分正向提示词和负向提示词
- 图片灯箱支持 `2` 张图片的 wipe 对比和 `4` 张图片的网格对比
- 视频灯箱支持逐帧切换，以及 `2` 或 `4` 个视频同步对比
- 3D 使用 ComfyUI 原生查看器
- 删除会进入系统回收站

安装：

```bash
pip install -r requirements.txt
```

然后重启 ComfyUI，并确保系统中可用 `ffmpeg` 与 `ffprobe`。

---

<a id="german"></a>
## Deutsch

**Artius Browser** ist ein schneller Sidebar-Browser für ComfyUI mit einer `Assets`- und einer `Workflows`-Ansicht.

Wichtige Funktionen:

- `Flat`- und `Tree`-Modus in beiden Bereichen
- getrennt gespeicherte Zustände pro Tab
- kompakter Preview-Cache für Bild, Video, Audio und 3D
- native Workflow-Bibliothek mit Bild-, Video- und `.webp`-Sidecars
- getrennte Anzeige von positivem und negativem PNG-Prompt
- Bildvergleich für `2` Bilder per Wipe-Slider und für `4` Bilder im Raster
- Video-Frame-Stepping und synchroner Vergleich für `2` oder `4` Videos
- native 3D-Integration mit ComfyUI
- Löschen in den System-Papierkorb

Installation:

```bash
pip install -r requirements.txt
```

Danach ComfyUI neu starten und `ffmpeg` sowie `ffprobe` bereitstellen.

---

<a id="italian"></a>
## Italiano

**Artius Browser** è un browser laterale per ComfyUI pensato per asset reali e workflow reali, senza appesantire l'interfaccia.

In breve:

- schede `Assets` e `Workflows`
- modalità `Flat` e `Tree`
- impostazioni salvate in modo indipendente per ogni scheda
- preview cache per immagini, video, audio e 3D
- parsing PNG con prompt positivo e negativo separati
- confronto immagini per `2` foto con slider wipe o `4` foto in griglia
- lightbox video con navigazione frame-by-frame e confronto sincronizzato
- viewer 3D nativo di ComfyUI
- eliminazione nel cestino di sistema

Installazione:

```bash
pip install -r requirements.txt
```

Riavvia ComfyUI e verifica che `ffmpeg` e `ffprobe` siano disponibili.

---

<a id="french"></a>
## Français

**Artius Browser** est un navigateur latéral pour ComfyUI conçu pour rester rapide, lisible et pratique même avec de grosses bibliothèques.

Fonctions principales :

- onglets `Assets` et `Workflows`
- modes `Flat` et `Tree`
- état mémorisé indépendamment pour chaque onglet
- cache de previews pour image, vidéo, audio et 3D
- extraction PNG avec `Prompt` et `Negative Prompt` séparés
- comparaison d'images pour `2` images avec un curseur wipe ou `4` images en grille
- navigation vidéo image par image et mode comparaison synchronisé
- intégration 3D native avec ComfyUI
- suppression vers la corbeille système

Installation :

```bash
pip install -r requirements.txt
```

Redémarrez ensuite ComfyUI et assurez-vous que `ffmpeg` et `ffprobe` sont disponibles.

---

<a id="portuguese"></a>
## Português

**Artius Browser** é um navegador lateral para ComfyUI focado em velocidade, estabilidade e integração nativa com o fluxo de trabalho do Comfy.

Resumo:

- abas `Assets` e `Workflows`
- modos `Flat` e `Tree`
- estado salvo por aba
- previews otimizadas para imagem, vídeo, áudio e 3D
- leitura de prompt positivo e negativo em PNG
- comparação de imagens para `2` fotos com slider wipe ou `4` fotos em grade
- lightbox com avanço quadro a quadro e comparação sincronizada de vídeos
- viewer 3D nativo do ComfyUI
- exclusão para a lixeira do sistema

Instalação:

```bash
pip install -r requirements.txt
```

Depois reinicie o ComfyUI e garanta que `ffmpeg` e `ffprobe` estejam disponíveis.

---

<a id="japanese"></a>
## 日本語

**Artius Browser** は、ComfyUI の中でアセットと workflow を素早く扱うためのサイドバーブラウザです。大きなライブラリでも軽く動き、プレビューとメタデータを見やすく整理します。

主な機能:

- `Assets` と `Workflows` の2つのタブ
- 両方のタブで `Flat` / `Tree` 表示
- タブごとに検索、ソート、プレビューサイズ、表示モードを保存
- 画像、動画、音声、3D の軽量プレビューキャッシュ
- ComfyUI 標準の workflow フォルダを直接表示
- PNG の positive prompt と negative prompt を分けて表示
- `2` 枚の画像は wipe スライダーで比較、`4` 枚の画像はグリッドで比較
- 動画はフレーム単位の移動と `2` または `4` 本の同期比較に対応
- ComfyUI ネイティブの 3D viewer と連携
- 削除は完全削除ではなくシステムのゴミ箱へ移動

インストール:

```bash
pip install -r requirements.txt
```

ComfyUI を再起動し、`ffmpeg` と `ffprobe` が利用できることを確認してください。

---

<a id="korean"></a>
## 한국어

**Artius Browser**는 ComfyUI 안에서 에셋과 workflow를 빠르게 탐색하기 위한 사이드바 브라우저입니다. 큰 라이브러리에서도 가볍게 동작하고, 프리뷰와 메타데이터를 깔끔하게 보여줍니다.

주요 기능:

- `Assets`와 `Workflows` 탭
- 두 탭 모두 `Flat` / `Tree` 보기 지원
- 탭별 검색, 정렬, 프리뷰 크기, 보기 모드 저장
- 이미지, 비디오, 오디오, 3D 에셋의 최적화된 프리뷰 캐시
- ComfyUI 기본 workflow 폴더를 직접 탐색
- PNG positive prompt와 negative prompt를 분리해서 표시
- 이미지 `2`장은 wipe 슬라이더로 비교, 이미지 `4`장은 그리드로 비교
- 비디오는 프레임 단위 이동과 `2`개 또는 `4`개 동기 비교 지원
- ComfyUI 네이티브 3D viewer 통합
- 삭제 시 영구 삭제가 아니라 시스템 휴지통으로 이동

설치:

```bash
pip install -r requirements.txt
```

ComfyUI를 다시 시작하고 `ffmpeg`와 `ffprobe`를 사용할 수 있는지 확인하세요.
