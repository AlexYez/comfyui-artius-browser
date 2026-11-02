# Artius Browser — Italiano

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

> **Artius Browser** vive nella barra laterale di ComfyUI e rende indolore
> trovare, anteprimare, trascinare e caricare i tuoi asset — immagini, video,
> audio, modelli 3D e file di workflow. Rimane reattivo anche con librerie
> enormi e usa il comportamento nativo di ComfyUI ovunque possibile.

### ✨ Caratteristiche principali

| | |
|---|---|
| 🖼️ **Immagini** | Miniature in cache, estrazione di `Prompt` + `Workflow` dal PNG, lightbox con confronto wipe / 2×2 e zoom sincronizzato |
| 🎬 **Video** | Navigazione frame per frame, info su codec / FPS / durata / audio, prompt + workflow incorporati, confronto sincronizzato di 2-4 clip |
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
| 📦 **Scarica selezionati** | Seleziona qualsiasi mix di immagini, video, audio e 3D e premi `Download Selected` — più file arrivano in un unico ZIP, un file singolo così com'è |
| 📝 **Esporta prompt**  [local draft](README.md#local-draft-features) | Seleziona le immagini e premi `Export Prompts` — un'immagine dà `<nome>.txt` con il suo prompt, più immagini un unico ZIP con un `.txt` omonimo per ciascuna |
| 📋 **Copia percorsi**  [local draft](README.md#local-draft-features) | `Copy Path` nella lightbox, oppure seleziona i file e premi `Copy Paths` — percorsi completi sul computer con ComfyUI, uno per riga |
| 🔔 **Feedback delle azioni** | Notifiche quando copia / elimina / carica / riscansione riesce o fallisce — niente più errori silenziosi |
| 🌍 **Interfaccia localizzata** | Segue la lingua impostata in ComfyUI — inglese, russo, cinese e giapponese già inclusi |
| ♿ **Griglia accessibile** | Semantica listbox per screen reader con stato di selezione, più anello di focus da tastiera |

### 📁 Formati supportati

- 🖼️ Immagini: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 Video: `.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 I formati che il browser non sa mostrare (ProRes, HEVC, AVI, MKV, EXR, TIFF) si vedono nel lightbox tramite una copia creata da ffmpeg al bisogno; il file originale non viene toccato
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Avvio rapido

#### Consigliato — via Comfy Registry

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
| <kbd>Home</kbd> <kbd>End</kbd> | Primo / ultimo fotogramma del video (nel confronto, quello di ogni clip); la ripetizione è disattivata per impostazione predefinita |
| <kbd>Delete</kbd> | Invia al cestino di sistema |

#### Pulsanti della card

> Sono **pulsanti sulla card** (compaiono al passaggio del mouse), non tasti.

| Pulsante | Azione |
|:---:|---|
| `P` | Copia prompt |
| `W` | Copia workflow *(solo quando il PNG contiene davvero dati di workflow)* |
| `D` | Scarica |
| `X` | Invia al cestino di sistema *(solo dove il root permette l'eliminazione)* |

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

I file 3D vengono automaticamente messi in staging nello storage di input di ComfyUI, così i nodi 3D nativi li vedono esattamente come file selezionati dall'UI del nodo. Il tab `Workflows` legge direttamente `workflows` ([userdata](README.md#released-and-local-changes)) — nessuna cache separata, nessun indice parallelo.

Se un altro pack installato pubblica un loader migliore, vince quello: un video trascinato sul canvas diventa un nodo **TS Video Loader** (da `comfyui-timesaver`) che legge il file dove si trova già, invece di copiarlo in `input/`. Senza quel pack viene creato il nodo nativo esattamente come sopra.

### 🔬 Tour del lightbox

<details>
<summary><strong>🖼️ Immagini</strong></summary>

- Zoom con rotella del mouse, pan con pulsante sinistro/centrale
- Confronto **wipe** di 2 immagini con slider sinistra-destra
- Confronto **grid 2×2** di 4 immagini
- Pannelli separati per `Prompt` e `Negative Prompt`
- `Copy Workflow` in un click quando il PNG lo contiene
- Apri in una nuova tab, mostra nella cartella, scarica, elimina

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
- FFmpeg / ffprobe: Worker pool di default `max(1, min(4, cpu_count() // 2))` — modificabile in `config.json`
- Poster video: ffmpeg riduce in anticipo la dimensione del frame catturato, PIL si limita a finire una piccola immagine con LANCZOS
- Anteprime WebP scritte con `method=0` (più veloce, visivamente identico a dimensioni thumbnail)
- Le URL delle anteprime portano l'`mtime` del file in cache come cache-buster — nessun hard refresh necessario dopo Rebuild Cache
- Acceleratori opzionali:
  - `Pillow-SIMD` — implementazione opzionale compatibile con Pillow; la velocità dipende dal lavoro.
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

Usa Rebuild Cache per rigenerare indice e anteprime. Per il reset completo della cartella e la perdita di dati, vedi [reset policy](README.md#сброс-индекса-и-полный-сброс).

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

Vedi [CHANGELOG.md](../CHANGELOG.md). Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
