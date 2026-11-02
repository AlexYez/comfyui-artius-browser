# Artius Browser — Español

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

> **Artius Browser** vive en la barra lateral de ComfyUI y hace que encontrar,
> previsualizar, arrastrar y cargar tus assets — imágenes, vídeos, audios,
> modelos 3D y workflows — sea rápido e indoloro. Se mantiene ágil incluso
> con bibliotecas enormes y usa el comportamiento nativo de ComfyUI siempre
> que puede.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas cacheadas, extracción de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 y zoom sincronizado |
| 🎬 **Vídeos** | Navegación cuadro a cuadro, info de códec / FPS / duración / audio, prompt + workflow incrustados, comparación sincronizada de 2-4 clips |
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
| 📦 **Descargar selección** | Selecciona cualquier mezcla de imágenes, vídeos, audio y 3D y pulsa `Download Selected` — varios archivos llegan en un único ZIP, uno solo se descarga tal cual |
| 📝 **Exportar prompts**  [local draft](README.md#local-draft-features) | Selecciona imágenes y pulsa `Export Prompts` — una imagen da `<nombre>.txt` con su prompt, varias dan un ZIP con un `.txt` por imagen, con su mismo nombre |
| 📋 **Copiar rutas**  [local draft](README.md#local-draft-features) | `Copy Path` en el visor, o selecciona archivos y pulsa `Copy Paths` — rutas completas en el equipo con ComfyUI, una por línea |
| 🔔 **Feedback de acciones** | Notificaciones cuando copiar / borrar / cargar / reescanear tiene éxito o falla — se acabaron los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue el idioma configurado en ComfyUI — inglés, ruso, chino y japonés disponibles |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 Los formatos que el navegador no puede mostrar (ProRes, HEVC, AVI, MKV, EXR, TIFF) se ven en el visor mediante una copia que ffmpeg crea bajo demanda; el archivo original no se modifica
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Instalación

#### Recomendado — vía Comfy Registry

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
| <kbd>Home</kbd> <kbd>End</kbd> | Primer / último fotograma del vídeo (en comparación, el de cada clip); el bucle está desactivado por defecto |
| <kbd>Delete</kbd> | Enviar a la papelera |

#### Botones de la tarjeta

> Son **botones en la tarjeta** (aparecen al pasar el cursor), no teclas.

| Botón | Acción |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(solo cuando el PNG realmente contiene datos de workflow)* |
| `D` | Descargar |
| `X` | Enviar a la papelera *(solo donde el root permite borrado)* |

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

Los archivos 3D se preparan automáticamente en el almacenamiento de input de ComfyUI para que los nodos 3D nativos los vean exactamente como archivos seleccionados desde la UI del nodo. La pestaña `Workflows` lee `workflows` ([userdata](README.md#released-and-local-changes)) directamente — sin caché separado, sin índice paralelo.

Si otro pack instalado publica un loader mejor, éste gana: un vídeo soltado en el canvas se convierte en un nodo **TS Video Loader** (de `comfyui-timesaver`) que lee el archivo donde ya está, en lugar de copiarlo a `input/`. Sin ese pack, se crea el nodo nativo exactamente como arriba.

### 🔬 Recorrido por el lightbox

<details>
<summary><strong>🖼️ Imágenes</strong></summary>

- Zoom con rueda del ratón, paneo con botón izquierdo/medio
- Comparación **wipe** de 2 imágenes con slider izquierda-derecha
- Comparación **grid 2×2** de 4 imágenes
- Paneles separados para `Prompt` y `Negative Prompt`
- `Copy Workflow` en un clic cuando el PNG lo lleva
- Abrir en nueva pestaña, mostrar en la carpeta, descargar, borrar

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
- FFmpeg / ffprobe: Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-downscale el cuadro capturado para que PIL solo termine con LANCZOS una imagen pequeña
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo cacheado como cache-buster — no hace falta hard refresh tras Rebuild Cache
- Aceleradores opcionales:
  - `Pillow-SIMD` — implementación opcional compatible con Pillow; la velocidad depende del trabajo.
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

Usa Rebuild Cache para regenerar el índice y las vistas previas. Para un reinicio completo y sus pérdidas de datos, consulta [reset policy](README.md#сброс-индекса-и-полный-сброс).

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

Consulta [CHANGELOG.md](../CHANGELOG.md). Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
