<div align="center">

# 🎨 Artius Browser for ComfyUI

**A fast, friendly sidebar for the files you actually use every day.**

![Version](https://img.shields.io/github/v/release/AlexYez/comfyui-artius-browser?style=flat-square&label=version&color=5fa14f)
![License](https://img.shields.io/github/license/AlexYez/comfyui-artius-browser?style=flat-square&color=8a7fc8)
![ComfyUI](https://img.shields.io/badge/ComfyUI-%E2%89%A50.19.0-blue?style=flat-square)
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
| 🖼️ **Images** | Cached thumbnails, PNG prompt + workflow extraction, lightbox with wipe / 2×2 grid compare |
| 🎬 **Videos** | Frame-stepping, codec / FPS / duration / audio info, sync compare for 2 or 4 clips |
| 🎵 **Audio** | Waveform preview, transport controls, channel layout |
| 🎲 **3D** | Native ComfyUI 3D viewer in the lightbox, captured 3D thumbnails |
| 📜 **Workflows** | Reads ComfyUI's native workflow folder, sidecar previews, drag-to-load |
| 🪟 **Two tabs** | `Assets` and `Workflows` with **independent** state (search, sort, view, preview size, tree-panel width) |
| 🔍 **Filename-only search** | Fast, predictable, no surprise full-text scans |
| 🚀 **Drag-and-drop** | Direct into native `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` nodes |
| 🗑️ **Safe delete** | Sends to system trash via `send2trash` — never hard-delete |
| 🔄 **Autoscan / Rebuild Cache** | Refresh on demand, or rebuild from scratch |
| 🏷️ **Version label + update badge** | Current version next to the title; checks GitHub once a day, surfaces a `New version available` chip when a newer release ships |

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

> 💡 Make sure `ffmpeg` and `ffprobe` are on your `PATH` — videos and audio need them for full metadata and waveforms.

### ⌨️ Keyboard shortcuts

#### On asset cards

| Key | Action |
|:---:|---|
| <kbd>P</kbd> | Copy prompt |
| <kbd>W</kbd> | Copy workflow *(only when the PNG actually has workflow data)* |
| <kbd>D</kbd> | Download |
| <kbd>X</kbd> | Send to system trash *(only where the root allows deletion)* |

#### On workflow cards

| Key | Action |
|:---:|---|
| <kbd>L</kbd> · double-click | Load workflow into ComfyUI |
| <kbd>D</kbd> | Download workflow JSON |
| <kbd>X</kbd> | Trash workflow + matching preview sidecars |

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
- Sync compare for 2 or 4 selected videos with one shared transport

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
- *Seed is no longer stored*

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
├── config.json        # UI + tools settings (schema v16)
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 🧪 Release checks

```bash
python scripts/check_release.py
```

Validates Python syntax · JS syntax · JSON · localization keys · dead helpers · 179 unit tests · git whitespace.

Optional, against a running ComfyUI:

```bash
pytest tests/integration -v             # 18 HTTP route tests
cd tests/e2e && npx playwright test     # 5 native node ID + version smoke tests
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
| 🖼️ **Картинки** | Кэш-превью, чтение PNG `Prompt` + `Workflow`, лайтбокс с wipe / 2×2 grid сравнением |
| 🎬 **Видео** | Покадровая навигация, кодек / FPS / длительность / инфо аудиодорожки, синхронное сравнение 2 или 4 клипов |
| 🎵 **Аудио** | Waveform-превью, плеер, channel layout |
| 🎲 **3D** | Нативный 3D viewer в лайтбоксе, фронтенд-сгенерированные 3D-thumbnail'ы |
| 📜 **Workflows** | Читает нативную папку workflow, sidecar-превью, drag-to-load |
| 🪟 **Две вкладки** | `Assets` и `Workflows` с **независимыми** настройками |
| 🔍 **Поиск по имени** | Быстро и предсказуемо, без сюрпризов |
| 🚀 **Drag-and-drop** | Прямо в нативные `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Безопасное удаление** | В системную корзину через `send2trash`, не навсегда |
| 🔄 **Autoscan / Rebuild Cache** | Обновление по запросу или полная пересборка |
| 🏷️ **Версия + бейдж обновления** | Текущая версия рядом с заголовком; раз в сутки проверяется GitHub, появляется чип `New version available` при выходе нового релиза |

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

> 💡 Убедитесь, что `ffmpeg` и `ffprobe` доступны в `PATH` — без них видео и аудио не получат полные метаданные.

### ⌨️ Горячие клавиши

#### На карточке ассета

| Клавиша | Действие |
|:---:|---|
| <kbd>P</kbd> | Скопировать `Prompt` |
| <kbd>W</kbd> | Скопировать workflow *(только если PNG реально содержит workflow)* |
| <kbd>D</kbd> | Скачать |
| <kbd>X</kbd> | В системную корзину *(только там, где root разрешает удаление)* |

#### На карточке workflow

| Клавиша | Действие |
|:---:|---|
| <kbd>L</kbd> · двойной клик | Загрузить в ComfyUI |
| <kbd>D</kbd> | Скачать JSON |
| <kbd>X</kbd> | В корзину workflow + sidecar-превью |

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

**Artius Browser** es un navegador lateral rápido para ComfyUI con dos pestañas (`Assets` y `Workflows`) y estado guardado por pestaña.

✨ **Lo esencial:** modos `Flat` / `Tree`, previews cacheadas para imagen / video / audio / 3D, workflows nativos, prompts PNG separados (positivo / negativo), comparación 2 / 4 imágenes y videos, viewer 3D nativo, borrado a la papelera.

🚀 **Instalación recomendada** (Comfy Registry):

```bash
comfy node install timesaver-artius-browser
```

…o manualmente con `pip install -r requirements.txt`. Reinicia ComfyUI y asegúrate de tener `ffmpeg` y `ffprobe`.

📋 Historial: [CHANGELOG.md](CHANGELOG.md).

---

<a id="chinese"></a>

## 🇨🇳 中文

**Artius Browser** 是面向 ComfyUI 的高性能侧边栏浏览器，包含 `Assets` 和 `Workflows` 两个标签页，每个标签页独立保存设置。

✨ **主要功能：** `Flat` / `Tree` 视图、图片 / 视频 / 音频 / 3D 预览缓存、原生工作流目录、PNG 正负向 prompt 分离、2 / 4 张图片或视频对比、原生 3D 查看器、删除到回收站。

🚀 **推荐安装**（Comfy Registry）:

```bash
comfy node install timesaver-artius-browser
```

或手动 `pip install -r requirements.txt`。重启 ComfyUI，确保 `ffmpeg` 与 `ffprobe` 可用。

📋 版本历史：[CHANGELOG.md](CHANGELOG.md)。

---

<a id="japanese"></a>

## 🇯🇵 日本語

**Artius Browser** は ComfyUI のサイドバー型ブラウザで、`Assets` と `Workflows` の2つのタブを独立した状態で保存します。

✨ **主な機能:** `Flat` / `Tree` 表示、画像 / 動画 / 音声 / 3D の軽量プレビューキャッシュ、ネイティブ workflow フォルダ、PNG の positive / negative prompt 分離表示、2 / 4 件の画像または動画の比較、ComfyUI ネイティブ 3D viewer、ゴミ箱への削除。

🚀 **推奨インストール**（Comfy Registry）:

```bash
comfy node install timesaver-artius-browser
```

または手動で `pip install -r requirements.txt`。ComfyUI を再起動し、`ffmpeg` と `ffprobe` が利用できることを確認してください。

📋 リリース履歴: [CHANGELOG.md](CHANGELOG.md)。

---

<a id="korean"></a>

## 🇰🇷 한국어

**Artius Browser**는 ComfyUI 사이드바 브라우저로, `Assets`와 `Workflows` 탭에 독립된 상태가 저장됩니다.

✨ **주요 기능:** `Flat` / `Tree` 보기, 이미지 / 비디오 / 오디오 / 3D 프리뷰 캐시, 기본 workflow 폴더, PNG positive / negative prompt 분리, 2 / 4장의 이미지·비디오 비교, ComfyUI 네이티브 3D viewer, 휴지통 삭제.

🚀 **권장 설치** (Comfy Registry):

```bash
comfy node install timesaver-artius-browser
```

또는 수동으로 `pip install -r requirements.txt`. ComfyUI를 다시 시작하고 `ffmpeg`와 `ffprobe`를 사용할 수 있는지 확인하세요.

📋 릴리스 기록: [CHANGELOG.md](CHANGELOG.md).

---

<a id="german"></a>

## 🇩🇪 Deutsch

**Artius Browser** ist ein schneller Sidebar-Browser für ComfyUI mit `Assets`- und `Workflows`-Ansichten und getrennt gespeichertem Zustand pro Tab.

✨ **Auf einen Blick:** `Flat` / `Tree`-Modus, Preview-Cache für Bild / Video / Audio / 3D, native Workflow-Bibliothek, getrennte PNG-Prompt-Anzeige (positiv / negativ), Bild- und Videovergleich für 2 oder 4 Elemente, nativer 3D-Viewer, Löschen in den Papierkorb.

🚀 **Empfohlene Installation** (Comfy Registry):

```bash
comfy node install timesaver-artius-browser
```

Alternativ manuell mit `pip install -r requirements.txt`. ComfyUI neu starten und `ffmpeg` sowie `ffprobe` bereitstellen.

📋 Versionshistorie: [CHANGELOG.md](CHANGELOG.md).

---

<a id="italian"></a>

## 🇮🇹 Italiano

**Artius Browser** è un browser laterale rapido per ComfyUI con schede `Assets` e `Workflows` che mantengono uno stato indipendente.

✨ **In sintesi:** modalità `Flat` / `Tree`, preview cache per immagini / video / audio / 3D, libreria workflow nativa, prompt PNG positivo / negativo separati, confronto 2 / 4 immagini o video, viewer 3D nativo, eliminazione nel cestino.

🚀 **Installazione consigliata** (Comfy Registry):

```bash
comfy node install timesaver-artius-browser
```

In alternativa manualmente con `pip install -r requirements.txt`. Riavvia ComfyUI e verifica che `ffmpeg` e `ffprobe` siano disponibili.

📋 Storico versioni: [CHANGELOG.md](CHANGELOG.md).

---

<a id="french"></a>

## 🇫🇷 Français

**Artius Browser** est un navigateur latéral rapide pour ComfyUI avec onglets `Assets` et `Workflows` à état indépendant.

✨ **L'essentiel :** modes `Flat` / `Tree`, cache de previews pour image / vidéo / audio / 3D, bibliothèque workflow native, prompts PNG positifs / négatifs séparés, comparaison de 2 / 4 images ou vidéos, viewer 3D natif, suppression vers la corbeille.

🚀 **Installation recommandée** (Comfy Registry) :

```bash
comfy node install timesaver-artius-browser
```

Ou manuellement avec `pip install -r requirements.txt`. Redémarrez ComfyUI et assurez-vous que `ffmpeg` et `ffprobe` sont disponibles.

📋 Historique : [CHANGELOG.md](CHANGELOG.md).

---

<a id="portuguese"></a>

## 🇵🇹 Português

**Artius Browser** é um navegador lateral rápido para ComfyUI com abas `Assets` e `Workflows` que mantêm estado independente.

✨ **Resumo:** modos `Flat` / `Tree`, previews otimizadas para imagem / vídeo / áudio / 3D, biblioteca workflow nativa, prompts PNG positivos / negativos separados, comparação 2 / 4 imagens ou vídeos, viewer 3D nativo, exclusão para a lixeira.

🚀 **Instalação recomendada** (Comfy Registry):

```bash
comfy node install timesaver-artius-browser
```

Ou manualmente com `pip install -r requirements.txt`. Reinicie o ComfyUI e garanta que `ffmpeg` e `ffprobe` estejam disponíveis.

📋 Histórico: [CHANGELOG.md](CHANGELOG.md).

---

<div align="center">

Made with ❤️ by [AlexYez](https://github.com/AlexYez) ·
[🐛 Report a bug](https://github.com/AlexYez/comfyui-artius-browser/issues/new?template=bug.yml) ·
[💖 Donate](https://timesavervfx.com/donate/)

</div>
