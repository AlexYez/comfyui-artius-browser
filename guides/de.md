# Artius Browser — Deutsch

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

> **Artius Browser** lebt in der Seitenleiste von ComfyUI und macht das Finden,
> Voranzeigen, Ziehen und Laden deiner Assets — Bilder, Videos, Audio,
> 3D-Modelle und Workflow-Dateien — schmerzfrei. Bleibt auch bei riesigen
> Bibliotheken schnell und nutzt wo immer möglich das native Verhalten von ComfyUI.

### ✨ Highlights

| | |
|---|---|
| 🖼️ **Bilder** | Gecachte Thumbnails, Extraktion von PNG `Prompt` + `Workflow`, Lightbox mit Wipe / 2×2-Grid-Vergleich und synchronem Zoom |
| 🎬 **Videos** | Frame-genaue Navigation, Codec- / FPS- / Dauer- / Audio-Infos, eingebettete Prompt + Workflow, synchroner Vergleich von 2-4 Clips |
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
| 📦 **Auswahl herunterladen** | Beliebige Bilder, Videos, Audio- und 3D-Dateien auswählen, `Download Selected` drücken — mehrere Dateien kommen als ein ZIP, eine einzelne Datei unverändert |
| 📝 **Prompts exportieren**  [local draft](README.md#local-draft-features) | Bilder auswählen und `Export Prompts` drücken — ein Bild ergibt `<Name>.txt` mit seinem Prompt, mehrere ein ZIP mit einer gleichnamigen `.txt` pro Bild |
| 📋 **Pfade kopieren**  [local draft](README.md#local-draft-features) | `Copy Path` in der Lightbox, oder Dateien auswählen und `Copy Paths` drücken — vollständige Pfade auf dem ComfyUI-Rechner, einer pro Zeile |
| 🔔 **Aktions-Feedback** | Toast-Meldungen, wenn Kopieren / Löschen / Laden / Rescan gelingt oder fehlschlägt — keine stillen Fehler mehr |
| 🌍 **Lokalisierte Oberfläche** | Folgt der Spracheinstellung von ComfyUI — Englisch, Russisch, Chinesisch und Japanisch sind enthalten |
| ♿ **Barrierefreies Raster** | Listbox-Semantik für Screenreader inkl. Auswahlstatus, plus Tastatur-Fokusring |

### 📁 Unterstützte Formate

- 🖼️ Bilder: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 Videos: `.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 Formate, die der Browser nicht selbst zeigen kann (ProRes, HEVC, AVI, MKV, EXR, TIFF), werden im Lightbox über eine Kopie abgespielt und angezeigt, die ffmpeg bei Bedarf erstellt; die Originaldatei bleibt unverändert
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Schnellstart

#### Empfohlen — via Comfy Registry

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
| <kbd>Home</kbd> <kbd>End</kbd> | Erstes / letztes Bild eines Videos (im Vergleich das jedes Clips); Wiederholen ist standardmäßig aus |
| <kbd>Delete</kbd> | In den Systempapierkorb |

#### Karten-Buttons

> Das sind **Buttons auf der Karte** (erscheinen beim Hovern), keine Tastaturkürzel.

| Button | Aktion |
|:---:|---|
| `P` | Prompt kopieren |
| `W` | Workflow kopieren *(nur wenn das PNG tatsächlich Workflow-Daten enthält)* |
| `D` | Herunterladen |
| `X` | In den Systempapierkorb *(nur dort, wo das Root das Löschen erlaubt)* |

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

3D-Dateien werden automatisch in den ComfyUI-Input-Speicher gestaged, sodass native 3D-Nodes sie genauso sehen wie Dateien, die aus der Node-UI ausgewählt wurden. Der `Workflows`-Tab liest direkt `workflows` ([userdata](README.md#released-and-local-changes)) — kein separater Cache, kein paralleler Index.

Wenn ein anderes installiertes Pack einen besseren Loader bereitstellt, gewinnt dieser: ein auf das Canvas gezogenes Video wird zu einer **TS Video Loader**-Node (aus `comfyui-timesaver`), die die Datei dort liest, wo sie bereits liegt, statt eine Kopie in `input/` abzulegen. Ohne dieses Pack wird die native Node genau wie oben erstellt.

### 🔬 Lightbox-Tour

<details>
<summary><strong>🖼️ Bilder</strong></summary>

- Mausrad-Zoom, Pan mit linker/mittlerer Maustaste
- **Wipe**-Vergleich von 2 Bildern mit links-rechts-Slider
- **2×2-Grid**-Vergleich von 4 Bildern
- Separate `Prompt`- und `Negative Prompt`-Panels
- Ein-Klick-`Copy Workflow`, wenn das PNG ihn mitbringt
- In neuem Tab öffnen, im Ordner anzeigen, herunterladen, löschen

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
- FFmpeg / ffprobe: Worker-Pools standardmäßig `max(1, min(4, cpu_count() // 2))` — in `config.json` anpassbar
- Video-Poster: ffmpeg skaliert den eingefangenen Frame schon vor, sodass PIL nur ein kleines Bild per LANCZOS finalisiert
- WebP-Previews werden mit `method=0` geschrieben (schnellste Einstellung, visuell identisch bei Thumbnail-Größen)
- Vorschau-URLs tragen den `mtime` der Cache-Datei als Cache-Buster — nach Rebuild Cache ist kein Hard Refresh nötig
- Optionale Beschleuniger:
  - `Pillow-SIMD` — optionale Pillow-kompatible Implementierung; die Geschwindigkeit hängt von der Arbeitslast ab.
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

Für Index und Vorschauen Rebuild Cache verwenden. Zu einem vollständigen Verzeichnis-Reset und dessen Datenverlust siehe [reset policy](README.md#сброс-индекса-и-полный-сброс).

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

Siehe [CHANGELOG.md](../CHANGELOG.md). Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
