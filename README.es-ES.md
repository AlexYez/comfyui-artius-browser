

<div align="center">

# 🎨 Artius Browser para ComfyUI

**Una barra lateral rápida y amigable para los archivos que realmente usas a diario.**

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

## 🇬🇧 Inglés

> **Artius Browser** reside en la barra lateral de ComfyUI y facilita encontrar,
> previsualizar, arrastrar y cargar tus activos: imágenes, vídeos, audio,
> modelos 3D y archivos de workflow. Se mantiene ágil incluso con bibliotecas
> enormes y utiliza el comportamiento nativo de ComfyUI siempre que es posible.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas en caché, extracción de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 |
| 🎬 **Vídeos** | Navegación cuadro a cuadro, info de códec / FPS / duración / audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de transporte, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI dentro del lightbox, miniaturas 3D capturadas |
| 📜 **Workflows** | Lee la carpeta de workflows nativa de ComfyUI, previews sidecar, arrastrar para cargar |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` con estado **independiente** (búsqueda, orden, vista, tamaño de preview, ancho del panel árbol) |
| 🔍 **Búsqueda solo por nombre** | Rápida y predecible por defecto; un interruptor dentro del campo de búsqueda la extiende a prompts y nombres de modelos |
| ⭐ **Favoritos** | Marca los que más te gusten con una estrella y filtra la cuadrícula por ellos — sobrevive a un `Rebuild Cache` completo |
| 🧬 **Info de modelos** | Checkpoints, LoRAs y VAEs leídos del prompt PNG, mostrados en el lightbox y buscables |
| 🔎 **Clic al 100%** | Un clic en el lightbox salta a la escala de píxeles real, con un minimapa de navegación para desplazar |
| 🚀 **Arrastrar y soltar** | Directamente a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminación segura** | Envía a la papelera del sistema vía `send2trash` — nunca elimina definitivamente |
| 🔄 **Autoscan / Rebuild Cache** | Actualización bajo demanda, o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + chip de actualización** | Versión actual junto al título; verifica GitHub una vez al día y muestra un chip de `New version available` cuando sale un nuevo lanzamiento |
| 🧲 **Arrastrar selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Retroalimentación de acciones** | Notificaciones emergentes cuando copiar / eliminar / cargar / reescanear tiene éxito o falla — adiós a los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue la configuración de idioma de ComfyUI — inglés y ruso disponibles |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, más un anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Inicio rápido

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

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(o cargar el workflow en la pestaña `Workflows`)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(avanza fotogramas en modo comparación de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanzar un fotograma de vídeo |
| <kbd>Delete</kbd> | Enviar a la papelera del sistema |

#### Botones de la tarjeta

> Estos son **botones en la tarjeta** (aparecen al pasar el cursor), no teclas.

| Botón | Acción |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(solo cuando el PNG realmente contiene datos de workflow)* |
| `D` | Descargar |
| `X` | Enviar a la papelera del sistema *(solo donde el root permite eliminación)* |

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar workflow en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | Enviar a la papelera el workflow + previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — redirige el arrastrar y soltar a los nodos nativos:

| Tipo de activo | Nodo nativo |
|---|---|
| Imagen | `LoadImage` |
| Vídeo | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader nativo de workflows del frontend |

Los archivos 3D se preparan automáticamente en el almacenamiento de entrada de ComfyUI para que los nodos 3D nativos los vean exactamente como archivos seleccionados desde la UI del nodo. La pestaña `Workflows` lee `user/default/workflows` directamente — sin caché separado, sin índice paralelo.

### 🔬 Recorrido por el lightbox

<details>
<summary><strong>🖼️ Imágenes</strong></summary>

- Zoom con rueda del ratón, paneo con botón izquierdo/medio
- Comparación **wipe** de 2 imágenes con slider izquierda-derecha
- Comparación **grid 2×2** de 4 imágenes
- Paneles separados para `Prompt` y `Negative Prompt`
- `Copy Workflow` en un clic cuando el PNG lo lleva
- Abrir en nueva pestaña, descargar, eliminar

</details>

<details>
<summary><strong>🎬 Vídeos</strong></summary>

- Reproducción inline con visualización del cuadro actual
- ⬅️ / ➡️ navegación cuadro a cuadro
- Códec, FPS, duración, bitrate, formato, info de pista de audio
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI dentro del lightbox
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

- El acceso al graph para arrastrar y soltar pasa por un adaptador delgado de Comfy — se prefieren las APIs actuales del canvas, los caminos legacy de `LiteGraph` quedan aislados.
- La búsqueda de activos se centra en el nombre del archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en vez de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) sin importar el tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché stale-while-revalidate *(LRU 10, TTL 30 s)* para re-activaciones instantáneas de filtro / orden
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el cuadro capturado para que PIL solo termine con LANCZOS una imagen pequeña
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
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

### 🗂️ Estructura en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

<a id="russian"></a>

## 🇷🇺 Español (sección original en ruso)

> **Artius Browser** vive en la barra lateral de ComfyUI y hace que trabajar con
> activos — imágenes, vídeo, audio, 3D y workflows — sea simple y rápido.
> Se comporta bien en bibliotecas grandes y usa el comportamiento nativo de ComfyUI siempre que puede.

### ✨ Lo principal

| | |
|---|---|
| 🖼️ **Imágenes** | Caché de previews, lectura de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 grid |
| 🎬 **Vídeo** | Navegación fotograma a fotograma, códec / FPS / duración / info de pista de audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Preview de forma de onda, reproductor, layout de canales |
| 🎲 **3D** | Visor 3D nativo en el lightbox, thumbnails 3D generados en frontend |
| 📜 **Workflows** | Lee la carpeta nativa de workflows, previews sidecar, arrastrar para cargar |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` con configuraciones **independientes** |
| 🔍 **Búsqueda por nombre** | Rápida y predecible por defecto; un interruptor en el campo de búsqueda la extiende a prompts y nombres de modelos |
| ⭐ **Favoritos** | Marca los acertados con una estrella y filtra la cuadrícula por ellos — sobrevive a una reconstrucción completa de caché |
| 🧬 **Modelos** | Checkpoints, LoRA y VAE leídos del prompt PNG, mostrados en el lightbox y participando en la búsqueda |
| 🔎 **Clic = 100%** | Clic en la imagen del lightbox muestra píxeles reales, el minimapa ayuda a no perderse |
| 🚀 **Arrastrar y soltar** | Directo a `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` nativos |
| 🗑️ **Eliminación segura** | A la papelera del sistema vía `send2trash`, no definitivo |
| 🔄 **Autoscan / Rebuild Cache** | Actualización bajo demanda o reconstrucción completa |
| 🏷️ **Versión + badge de actualización** | Versión actual junto al título; verifica GitHub una vez al día, aparece el chip `New version available` al salir un nuevo release |
| 🧲 **Arrastrar selección** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Retroalimentación** | Notificaciones emergentes al copiar / eliminar / cargar / escanear — adiós a los errores «silenciosos» |
| 🌍 **Localización** | Sigue el idioma elegido en ComfyUI — ya disponible inglés y ruso |
| ♿ **Accesibilidad** | Semántica de listbox para lectores de pantalla con estado de selección y anillo de foco para teclado |

### 🚀 Instalación

#### Recomendado — vía Comfy Registry

```bash
comfy node install timesaver-artius-browser
```

…o busca **Timesaver Artius Browser** en **ComfyUI Manager**.

#### Manual

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Reinicia ComfyUI y haz un hard refresh `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) es necesario para metadatos de vídeo/audio y formas de onda de audio — opcional (ComfyUI arranca sin él), pero recomendado:
>
> - **Windows:** `winget install ffmpeg` (o `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Tras instalarlo, reinicia ComfyUI y verifica: `ffmpeg -version`.

### ⌨️ Teclado y botones de tarjeta

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(o cargar el workflow en la pestaña `Workflows`)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(fotograma a fotograma en modo comparación de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanzar un fotograma de vídeo |
| <kbd>Delete</kbd> | A la papelera del sistema |

#### Botones en la tarjeta

> Son **botones en la tarjeta** (aparecen al pasar el cursor), no atajos de teclado.

| Botón | Acción |
|:---:|---|
| `P` | Copiar `Prompt` |
| `W` | Copiar workflow *(solo si el PNG realmente contiene workflow)* |
| `D` | Descargar |
| `X` | A la papelera del sistema *(solo donde el root permite eliminación)* |

#### Botones en la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar en ComfyUI |
| `D` | Descargar JSON |
| `X` | A la papelera workflow + previews sidecar |

### 🛡️ Compatibilidad

- El acceso a graph / canvas / LiteGraph pasa por un adaptador — APIs actuales de ComfyUI y fallback legacy no se dispersan por el código UI
- Búsqueda de activos por nombre de archivo; parámetro de query `metadata` no soportado devuelve `400 Bad Request`
- Paginación keyset-based (`after_sort` + `after_id`) — las páginas profundas cuestan lo mismo que la primera
- Imágenes companion (sidecars PNG a vídeo / audio / 3D con el mismo stem) se ocultan mediante un flag guardado, sin subqueries en query-time
- Los listeners del frontend se desmontan al cerrar el stage / detener el worker

### ⚡ Rendimiento

- Búsqueda por nombre · metadatos compactos · caché de preview compacto
- Grid virtualizado · paginación keyset · caché stale-while-revalidate *(LRU 10, TTL 30 seg)*
- `ffprobe` + `ffmpeg` en paralelo por activo (un par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- ffmpeg reduce inmediatamente el fotograma de vídeo al 2× del preview, PIL solo finaliza con LANCZOS
- Previews WebP se escriben con `method=0` (codificación más rápida, visualmente idéntico en preview)
- URL de preview contiene `mtime` como token de cache-busting — tras Rebuild Cache no hace falta hard refresh
- Opcional:
  - 🚀 `Pillow-SIMD` — reemplazo drop-in de Pillow, thumbnail **4–6×** más rápido
  - 🚀 `blake3` — ya en `requirements.txt`, evita el fallback más lento `blake2b`

### 🆘 Solución de problemas

<details>
<summary><strong>Los previews parecen desactualizados</strong></summary>

Pulsa **Rebuild Cache**. Las URLs de preview invalidan automáticamente la caché HTTP del navegador vía token `mtime`. Si sigue desactualizado, reinicia ComfyUI + `Ctrl+F5`.

</details>

<details>
<summary><strong>No se muestran metadatos de vídeo / audio</strong></summary>

Verifica que `ffmpeg` y `ffprobe` están en `PATH`. Instálalos y reinicia.

</details>

<details>
<summary><strong>Reset completo</strong></summary>

Borra `ComfyUI/output/.ts_artius_browser/`, reinicia ComfyUI y escanea de nuevo.

</details>

### 📋 Changelog

Historial de releases en [CHANGELOG.md](CHANGELOG.md). Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<a id="spanish"></a>

## 🇪🇸 Español

> **Artius Browser** vive en la barra lateral de ComfyUI y hace que encontrar,
> previsualizar, arrastrar y cargar tus activos — imágenes, vídeos, audios,
> modelos 3D y workflows — sea rápido e indoloro. Se mantiene ágil incluso
> con bibliotecas enormes y usa el comportamiento nativo de ComfyUI siempre
> que puede.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas cacheadas, extracción de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 |
| 🎬 **Vídeos** | Navegación cuadro a cuadro, info de códec / FPS / duración / audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de transporte, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI dentro del lightbox, miniaturas 3D capturadas |
| 📜 **Workflows** | Lee la carpeta de workflows nativa de ComfyUI, previews sidecar, drag-to-load |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` con estado **independiente** (búsqueda, orden, vista, tamaño de preview, ancho del panel árbol) |
| 🔍 **Búsqueda solo por nombre** | Rápida, predecible, sin escaneos full-text sorpresivos |
| 🚀 **Drag-and-drop** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Borrado seguro** | A la papelera del sistema vía `send2trash` — nunca borrado definitivo |
| 🔄 **Autoscan / Rebuild Cache** | Refresco bajo demanda, o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + chip de actualización** | Versión actual junto al título; comprueba GitHub una vez al día y muestra `New version available` cuando hay una nueva |
| 🧲 **Arrastre de selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, colocados automáticamente en cuadrícula |
| 🔔 **Feedback de acciones** | Notificaciones cuando copiar / borrar / cargar / reescanear tiene éxito o falla — se acabaron los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue el idioma configurado en ComfyUI — inglés y ruso disponibles |
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

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(o cargar el workflow en la pestaña `Workflows`)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(avanza fotogramas en modo comparación de vídeo)* |
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

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar workflow en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | Enviar a la papelera workflow + previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — redirige el drag-and-drop a los nodos nativos:

| Tipo de activo | Nodo nativo |
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
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI dentro del lightbox
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
- La búsqueda de activos se centra en el nombre del archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en vez de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) sin importar el tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché stale-while-revalidate *(LRU 10, TTL 30 s)* para re-activaciones instantáneas de filtro / orden
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el cuadro capturado para que PIL solo termine con LANCZOS una imagen pequeña
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
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

### 🗂️ Estructura en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

## 🇨🇳 Español (sección original en chino)

> **Artius Browser** reside en la barra lateral de ComfyUI, permitiéndote encontrar fácilmente, previsualizar, arrastrar y cargar varios activos: imágenes, vídeos, audio, modelos 3D y archivos de workflow. Mantiene la fluidez incluso frente a bibliotecas de activos de gran escala y utiliza el comportamiento nativo de ComfyUI siempre que es posible.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Caché de miniaturas, extracción de `Prompt` y `Workflow` del PNG, lightbox con soporte para comparación wipe / 2×2 grid |
| 🎬 **Vídeos** | Navegación fotograma a fotograma, muestra códec / FPS / duración / info de audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de reproducción, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI embebido en el lightbox, captura automática de miniaturas 3D |
| 📜 **Workflows** | Lee directamente la carpeta de workflows nativa de ComfyUI, previews sidecar, arrastrar para cargar |
| 🪟 **Doble pestaña** | `Assets` y `Workflows` tienen estados **independientes** (búsqueda, ordenación, vista, tamaño de preview, ancho del panel de árbol) |
| 🔍 **Búsqueda solo por nombre de archivo** | Rápida, predecible, sin escaneos de texto completo sorpresa |
| 🚀 **Arrastrar y soltar** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminación segura** | Se mueve a la papelera del sistema vía `send2trash` — nunca eliminación definitiva |
| 🔄 **Escaneo automático / Reconstruir caché** | Actualización bajo demanda o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + notificación de actualización** | Muestra la versión actual junto al título; verifica GitHub una vez al día y muestra `New version available` al publicar una nueva versión |
| 🧲 **Arrastrar selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Retroalimentación de acciones** | Notificaciones emergentes al copiar / eliminar / cargar / escanear con éxito o fallo — adiós a los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue la configuración de idioma de ComfyUI — actualmente disponible en inglés y ruso |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla (con estado de selección), y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Inicio rápido

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

Luego **reinicia ComfyUI** y haz un **hard refresh** con `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) se usa para generar metadatos de vídeo/audio y formas de onda de audio — opcional (ComfyUI arranca sin él), pero recomendado:
>
> - **Windows:** `winget install ffmpeg` (o `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Reinicia ComfyUI tras instalarlo y verifica con `ffmpeg -version`.

### ⌨️ Teclado y botones de tarjeta

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(en la pestaña `Workflows` carga el workflow)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(fotograma a fotograma en modo comparación de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanzar un fotograma de vídeo |
| <kbd>Delete</kbd> | Mover a la papelera del sistema |

#### Botones de la tarjeta

> Son **botones en la tarjeta** (aparecen al pasar el cursor), no atajos de teclado.

| Botón | Acción |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(solo cuando el PNG realmente contiene datos de workflow)* |
| `D` | Descargar |
| `X` | Mover a la papelera del sistema *(solo donde el root permite eliminación)* |

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | Mover a la papelera el workflow y los previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — encamina el arrastrar y soltar a los nodos nativos:

| Tipo de activo | Nodo nativo |
|---|---|
| Imagen | `LoadImage` |
| Vídeo | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader nativo de workflows del frontend |

Los archivos 3D se preparan automáticamente en el almacenamiento de input de ComfyUI, para que los nodos 3D nativos los vean exactamente como archivos seleccionados desde la UI del nodo. La pestaña `Workflows` lee `user/default/workflows` directamente — sin caché separado, sin índice paralelo.

### 🔬 Vista general del lightbox

<details>
<summary><strong>🖼️ Imágenes</strong></summary>

- Zoom con rueda del ratón, paneo con botón izquierdo/medio
- Comparación **wipe** de 2 imágenes con slider izquierda-derecha
- Comparación **grid 2×2** de 4 imágenes
- Paneles independientes para `Prompt` y `Negative Prompt`
- `Copy Workflow` en un clic cuando el PNG lo contiene
- Abrir en nueva pestaña, descargar, eliminar

</details>

<details>
<summary><strong>🎬 Vídeos</strong></summary>

- Reproducción inline con visualización del fotograma actual
- ⬅️ / ➡️ navegación fotograma a fotograma
- Códec, FPS, duración, bitrate, formato, info de pista de audio
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI embebido en el lightbox
- Información técnica del modelo en la barra lateral
- Sin sustitutos de texturas falsas — es el modelo 3D real

</details>

### 🧠 Reglas de metadatos PNG

- **Prompt** se lee **solo** del campo `Prompt` del PNG
- **Workflow** se lee **solo** del campo `Workflow` del PNG
- Los prompts positivo y negativo se separan antes de mostrarse
- Si positivo y negativo son idénticos, solo se muestra el positivo
- El **seed** se lee del campo `Prompt` del PNG y se muestra en el lightbox (copiable)

### 🛡️ Compatibilidad y seguridad

- El acceso al graph para arrastrar y soltar pasa por un adaptador ligero de Comfy — se priorizan las APIs actuales del canvas, los caminos legacy de `LiteGraph` quedan aislados.
- La búsqueda de activos se centra en el nombre de archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en lugar de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) independientemente del tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre de archivo · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché de respuesta stale-while-revalidate *(LRU 10, TTL 30 s)* para alternancias instantáneas de filtro / ordenación
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el fotograma capturado para que PIL solo finalice una imagen pequeña con LANCZOS
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
- Aceleradores opcionales:
  - 🚀 `Pillow-SIMD` — reemplazo drop-in de Pillow, thumbnailing de imágenes **4–6×** más rápido
  - 🚀 `blake3` — ya en `requirements.txt`, evita el fallback más lento `blake2b`

### 🆘 Solución de problemas

<details>
<summary><strong>Algunas previews parecen desactualizadas</strong></summary>

Pulsa **Rebuild Cache**. Las URLs de preview invalidan automáticamente la caché del navegador vía un token `mtime`, así que normalmente no hace falta hard refresh. Si sigue desactualizado, reinicia ComfyUI y `Ctrl+F5`.

</details>

<details>
<summary><strong>Faltan metadatos de vídeo o audio</strong></summary>

Probablemente `ffmpeg` / `ffprobe` no están en `PATH`. Instálalos y reinicia.

</details>

<details>
<summary><strong>Quiero un reset completo</strong></summary>

Borra `ComfyUI/output/.ts_artius_browser/`, reinicia ComfyUI y escanea de nuevo. Todas las previews e índices se reconstruirán.

</details>

### 🗂️ Estructura de directorios en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

<a id="japanese"></a>

## 🇯🇵 Español (sección original en japonés)

> **Artius Browser** reside en la barra lateral de ComfyUI y hace cómoda la búsqueda, previsualización, arrastre y carga de activos como imágenes, vídeos, audio, modelos 3D y archivos de workflow. Funciona ágilmente incluso con bibliotecas a gran escala y utiliza el comportamiento nativo de ComfyUI siempre que es posible.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas en caché, extracción de `Prompt` + `Workflow` del PNG, comparación wipe / 2×2 grid en lightbox |
| 🎬 **Vídeos** | Navegación por fotogramas, info de códec / FPS / duración / audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de reproducción, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI en el lightbox, miniaturas 3D capturadas |
| 📜 **Workflows** | Lee directamente la carpeta de workflows nativa de ComfyUI, previews sidecar, cargar con arrastre |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` mantienen estados **independientes** (búsqueda, ordenación, vista, tamaño de preview, ancho del panel de árbol) |
| 🔍 **Búsqueda solo por nombre de archivo** | Rápida y predecible, sin escaneos de texto completo sorpresa |
| 🚀 **Arrastrar y soltar** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminación segura** | A la papelera del sistema vía `send2trash` — nunca eliminación definitiva |
| 🔄 **Escaneo automático / Reconstruir caché** | Actualización bajo demanda, o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + notificación de actualización** | Versión actual junto al título; verifica GitHub una vez al día y muestra el chip `New version available` si hay un nuevo lanzamiento |
| 🧲 **Arrastrar selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Retroalimentación de acciones** | Notificaciones toast al copiar / eliminar / cargar / reescanear con éxito o fallo — adiós a los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue la configuración de idioma de ComfyUI — inglés y ruso incluidos |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Inicio rápido

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

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) se usa para generar metadatos de vídeo/audio y formas de onda de audio — opcional (ComfyUI arranca sin él), pero recomendado:
>
> - **Windows:** `winget install ffmpeg` (o `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Reinicia ComfyUI tras instalarlo y verifica con `ffmpeg -version`.

### ⌨️ Teclado y botones de tarjeta

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(en la pestaña `Workflows` carga el workflow)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(avanza fotogramas en modo comparación de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanzar un fotograma de vídeo |
| <kbd>Delete</kbd> | A la papelera del sistema |

#### Botones de la tarjeta

> Son **botones en la tarjeta** (aparecen al pasar el cursor), no atajos de teclado.

| Botón | Acción |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(solo cuando el PNG realmente contiene datos de workflow)* |
| `D` | Descargar |
| `X` | A la papelera del sistema *(solo donde el root permite eliminación)* |

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | A la papelera workflow + previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — encamina el arrastrar y soltar a los nodos nativos:

| Tipo de activo | Nodo nativo |
|---|---|
| Imagen | `LoadImage` |
| Vídeo | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader nativo de workflows del frontend |

Los archivos 3D se preparan automáticamente en el almacenamiento de input de ComfyUI, para que los nodos 3D nativos los vean exactamente como archivos seleccionados desde la UI del nodo. La pestaña `Workflows` lee `user/default/workflows` directamente — sin caché separado, sin índice paralelo.

### 🔬 Recorrido por el lightbox

<details>
<summary><strong>🖼️ Imágenes</strong></summary>

- Zoom con rueda del ratón, paneo con botón izquierdo/medio
- Comparación **wipe** de 2 imágenes con slider izquierda-derecha
- Comparación **grid 2×2** de 4 imágenes
- Paneles independientes para `Prompt` y `Negative Prompt`
- `Copy Workflow` en un clic cuando el PNG lo contiene
- Abrir en nueva pestaña, descargar, eliminar

</details>

<details>
<summary><strong>🎬 Vídeos</strong></summary>

- Reproducción inline con visualización del fotograma actual
- ⬅️ / ➡️ navegación por fotogramas
- Códec, FPS, duración, bitrate, formato, info de pista de audio
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI en el lightbox
- Información técnica del modelo en la barra lateral
- Sin sustitutos de hojas de textura falsas — es el modelo real

</details>

### 🧠 Reglas de metadatos PNG

- **Prompt** se lee **solo** del campo `Prompt` del PNG
- **Workflow** se lee **solo** del campo `Workflow` del PNG
- Los prompts positivo y negativo se separan antes de mostrarse
- Si positivo y negativo son idénticos, solo se muestra el positivo
- El **seed** se lee del campo `Prompt` del PNG y se muestra en el lightbox (copiable)

### 🛡️ Compatibilidad y seguridad

- El acceso al graph para arrastrar y soltar pasa por un adaptador ligero de Comfy — se priorizan las APIs actuales del canvas, los caminos legacy de `LiteGraph` quedan aislados.
- La búsqueda de activos se centra en el nombre de archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en lugar de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) independientemente del tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre de archivo · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché de respuesta stale-while-revalidate *(LRU 10, TTL 30 s)* para alternancias instantáneas de filtro / ordenación
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el fotograma capturado para que PIL solo finalice una imagen pequeña con LANCZOS
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
- Aceleradores opcionales:
  - 🚀 `Pillow-SIMD` — reemplazo drop-in de Pillow, thumbnailing de imágenes **4–6×** más rápido
  - 🚀 `blake3` — ya en `requirements.txt`, evita el fallback más lento `blake2b`

### 🆘 Solución de problemas

<details>
<summary><strong>Algunas previews parecen desactualizadas</strong></summary>

Pulsa **Rebuild Cache**. Las URLs de preview invalidan automáticamente la caché del navegador vía un token `mtime`, así que normalmente no hace falta hard refresh. Si sigue desactualizado, reinicia ComfyUI y `Ctrl+F5`.

</details>

<details>
<summary><strong>Faltan metadatos de vídeo o audio</strong></summary>

Probablemente `ffmpeg` / `ffprobe` no están en `PATH`. Instálalos y reinicia.

</details>

<details>
<summary><strong>Quiero un reset completo</strong></summary>

Borra `ComfyUI/output/.ts_artius_browser/`, reinicia ComfyUI y escanea de nuevo. Todas las previews e índices se reconstruirán.

</details>

### 🗂️ Estructura en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

<a id="korean"></a>

## 🇰🇷 Español (sección original en coreano)

> **Artius Browser** reside en la barra lateral de ComfyUI y facilita encontrar rápidamente, previsualizar, arrastrar y cargar activos como imágenes, vídeos, audio, modelos 3D y archivos de workflow. Funciona de forma ligera incluso en bibliotecas de gran tamaño y utiliza el comportamiento nativo de ComfyUI siempre que es posible.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas en caché, extracción de `Prompt` + `Workflow` del PNG, comparación wipe / 2×2 grid en lightbox |
| 🎬 **Vídeos** | Navegación por fotogramas, info de códec / FPS / duración / audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de reproducción, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI en el lightbox, miniaturas 3D capturadas |
| 📜 **Workflows** | Lee directamente la carpeta de workflows nativa de ComfyUI, previews sidecar, cargar con arrastre |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` tienen estados **independientes** (búsqueda, ordenación, vista, tamaño de preview, ancho del panel de árbol) |
| 🔍 **Búsqueda solo por nombre de archivo** | Rápida y predecible, sin escaneos de texto completo sorpresa |
| 🚀 **Arrastrar y soltar** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminación segura** | A la papelera del sistema vía `send2trash` — nunca eliminación definitiva |
| 🔄 **Escaneo automático / Reconstruir caché** | Actualización bajo demanda, o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + chip de actualización** | Versión actual junto al título; verifica GitHub una vez al día y muestra el chip `New version available` si hay un nuevo lanzamiento |
| 🧲 **Arrastrar selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Retroalimentación de acciones** | Notificaciones toast al copiar / eliminar / cargar / reescanear con éxito o fallo — adiós a los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue la configuración de idioma de ComfyUI — inglés y ruso disponibles |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Inicio rápido

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

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) se usa para generar metadatos de vídeo/audio y formas de onda de audio — opcional (ComfyUI arranca sin él), pero recomendado:
>
> - **Windows:** `winget install ffmpeg` (o `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Reinicia ComfyUI tras instalarlo y verifica con `ffmpeg -version`.

### ⌨️ Teclado y botones de tarjeta

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(en la pestaña `Workflows` carga el workflow)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(avanza fotogramas en modo comparación de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanzar un fotograma de vídeo |
| <kbd>Delete</kbd> | A la papelera del sistema |

#### Botones de la tarjeta

> Son **botones en la tarjeta** (aparecen al pasar el cursor), no atajos de teclado.

| Botón | Acción |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(solo cuando el PNG realmente contiene datos de workflow)* |
| `D` | Descargar |
| `X` | A la papelera del sistema *(solo donde el root permite eliminación)* |

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | A la papelera workflow + previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — encamina el arrastrar y soltar a los nodos nativos:

| Tipo de activo | Nodo nativo |
|---|---|
| Imagen | `LoadImage` |
| Vídeo | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader nativo de workflows del frontend |

Los archivos 3D se preparan automáticamente en el almacenamiento de input de ComfyUI, para que los nodos 3D nativos los vean exactamente como archivos seleccionados desde la UI del nodo. La pestaña `Workflows` lee `user/default/workflows` directamente — sin caché separado, sin índice paralelo.

### 🔬 Recorrido por el lightbox

<details>
<summary><strong>🖼️ Imágenes</strong></summary>

- Zoom con rueda del ratón, paneo con botón izquierdo/medio
- Comparación **wipe** de 2 imágenes con slider izquierda-derecha
- Comparación **grid 2×2** de 4 imágenes
- Paneles independientes para `Prompt` y `Negative Prompt`
- `Copy Workflow` en un clic cuando el PNG lo contiene
- Abrir en nueva pestaña, descargar, eliminar

</details>

<details>
<summary><strong>🎬 Vídeos</strong></summary>

- Reproducción inline con visualización del fotograma actual
- ⬅️ / ➡️ navegación por fotogramas
- Códec, FPS, duración, bitrate, formato, info de pista de audio
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI en el lightbox
- Información técnica del modelo en la barra lateral
- Sin sustitutos de hojas de textura falsas — es el modelo 3D real

</details>

### 🧠 Reglas de metadatos PNG

- **Prompt** se lee **solo** del campo `Prompt` del PNG
- **Workflow** se lee **solo** del campo `Workflow` del PNG
- Los prompts positivo y negativo se separan antes de mostrarse
- Si positivo y negativo son idénticos, solo se muestra el positivo
- El **seed** se lee del campo `Prompt` del PNG y se muestra en el lightbox (copiable)

### 🛡️ Compatibilidad y seguridad

- El acceso al graph para arrastrar y soltar pasa por un adaptador ligero de Comfy — se priorizan las APIs actuales del canvas, los caminos legacy de `LiteGraph` quedan aislados.
- La búsqueda de activos se centra en el nombre de archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en lugar de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) independientemente del tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre de archivo · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché de respuesta stale-while-revalidate *(LRU 10, TTL 30 s)* para alternancias instantáneas de filtro / ordenación
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el fotograma capturado para que PIL solo finalice una imagen pequeña con LANCZOS
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
- Aceleradores opcionales:
  - 🚀 `Pillow-SIMD` — reemplazo drop-in de Pillow, thumbnailing de imágenes **4–6×** más rápido
  - 🚀 `blake3` — ya en `requirements.txt`, evita el fallback más lento `blake2b`

### 🆘 Solución de problemas

<details>
<summary><strong>Algunas previews parecen desactualizadas</strong></summary>

Pulsa **Rebuild Cache**. Las URLs de preview invalidan automáticamente la caché del navegador vía un token `mtime`, así que normalmente no hace falta hard refresh. Si sigue desactualizado, reinicia ComfyUI y `Ctrl+F5`.

</details>

<details>
<summary><strong>Faltan metadatos de vídeo o audio</strong></summary>

Probablemente `ffmpeg` / `ffprobe` no están en `PATH`. Instálalos y reinicia.

</details>

<details>
<summary><strong>Quiero un reset completo</strong></summary>

Borra `ComfyUI/output/.ts_artius_browser/`, reinicia ComfyUI y escanea de nuevo. Todas las previews e índices se reconstruirán.

</details>

### 🗂️ Estructura en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

<a id="german"></a>

## 🇩🇪 Español (sección original en alemán)

> **Artius Browser** reside en la barra lateral de ComfyUI y facilita encontrar,
> previsualizar, arrastrar y cargar tus activos — imágenes, vídeos, audio,
> modelos 3D y archivos de workflow — sin complicaciones. Se mantiene rápido
> incluso con bibliotecas enormes y utiliza el comportamiento nativo de ComfyUI siempre que es posible.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas en caché, extracción de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 grid |
| 🎬 **Vídeos** | Navegación exacta por fotogramas, info de códec / FPS / duración / audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de transporte, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI en el lightbox, miniaturas 3D capturadas automáticamente |
| 📜 **Workflows** | Lee directamente la carpeta de workflows nativa de ComfyUI, previews sidecar, cargar con arrastre |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` con estado **independiente** (búsqueda, ordenación, vista, tamaño de preview, ancho del panel de árbol) |
| 🔍 **Búsqueda solo por nombre de archivo** | Rápida, predecible, sin escaneos de texto completo sorpresa |
| 🚀 **Arrastrar y soltar** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminación segura** | A la papelera del sistema vía `send2trash` — nunca definitiva |
| 🔄 **Escaneo automático / Reconstruir caché** | Actualización bajo demanda o reconstrucción completa |
| 🏷️ **Etiqueta de versión + chip de actualización** | Versión actual junto al título; verifica GitHub una vez al día y muestra `New version available` cuando hay una nueva versión |
| 🧲 **Arrastrar selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Retroalimentación de acciones** | Notificaciones toast al copiar / eliminar / cargar / reescanear con éxito o fallo — adiós a los errores silenciosos |
| 🌍 **Interfaz localizada** | Sigue la configuración de idioma de ComfyUI — inglés y ruso incluidos |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Inicio rápido

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

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) genera metadatos de vídeo/audio y formas de onda de audio — opcional (ComfyUI arranca sin él), pero recomendado:
>
> - **Windows:** `winget install ffmpeg` (o `choco install ffmpeg`)
> - **macOS:** `brew install ffmpeg`
> - **Linux:** `sudo apt install ffmpeg`
>
> Reinicia ComfyUI tras instalarlo y verifica con `ffmpeg -version`.

### ⌨️ Teclado y botones de tarjeta

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(en la pestaña `Workflows` carga el workflow)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(fotograma a fotograma en modo comparación de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanzar un fotograma de vídeo |
| <kbd>Delete</kbd> | A la papelera del sistema |

#### Botones de la tarjeta

> Son **botones en la tarjeta** (aparecen al pasar el cursor), no atajos de teclado.

| Botón | Acción |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(solo cuando el PNG realmente contiene datos de workflow)* |
| `D` | Descargar |
| `X` | A la papelera del sistema *(solo donde el root permite eliminación)* |

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar workflow en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | A la papelera workflow + previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — encamina el arrastrar y soltar a los nodos nativos:

| Tipo de activo | Nodo nativo |
|---|---|
| Imagen | `LoadImage` |
| Vídeo | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader nativo de workflows del frontend |

Los archivos 3D se preparan automáticamente en el almacenamiento de input de ComfyUI, para que los nodos 3D nativos los vean exactamente como archivos seleccionados desde la UI del nodo. La pestaña `Workflows` lee `user/default/workflows` directamente — sin caché separado, sin índice paralelo.

### 🔬 Recorrido por el lightbox

<details>
<summary><strong>🖼️ Imágenes</strong></summary>

- Zoom con rueda del ratón, paneo con botón izquierdo/medio
- Comparación **wipe** de 2 imágenes con slider izquierda-derecha
- Comparación **grid 2×2** de 4 imágenes
- Paneles separados para `Prompt` y `Negative Prompt`
- `Copy Workflow` en un clic cuando el PNG lo lleva
- Abrir en nueva pestaña, descargar, eliminar

</details>

<details>
<summary><strong>🎬 Vídeos</strong></summary>

- Reproducción inline con visualización del fotograma actual
- ⬅️ / ➡️ navegación fotograma a fotograma
- Códec, FPS, duración, bitrate, formato, info de pista de audio
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI en el lightbox
- Información técnica del modelo en la barra lateral
- Sin sustitutos de hojas de textura falsas — es el modelo real

</details>

### 🧠 Reglas de metadatos PNG

- **Prompt** se lee **exclusivamente** del campo `Prompt` del PNG
- **Workflow** se lee **exclusivamente** del campo `Workflow` del PNG
- Los prompts positivo y negativo se separan antes de mostrarse
- Si positivo y negativo son idénticos, solo se muestra el positivo
- El **seed** se lee del campo `Prompt` del PNG y se muestra en el lightbox (copiable)

### 🛡️ Compatibilidad y seguridad

- El acceso al graph para arrastrar y soltar pasa por un adaptador delgado de Comfy — se prefieren las APIs actuales del canvas, los caminos legacy de `LiteGraph` quedan aislados.
- La búsqueda de activos se centra en el nombre de archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en lugar de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) independientemente del tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre de archivo · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché de respuesta stale-while-revalidate *(LRU 10, TTL 30 s)* para alternancias instantáneas de filtro / ordenación
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el fotograma capturado para que PIL solo finalice una imagen pequeña con LANCZOS
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
- Aceleradores opcionales:
  - 🚀 `Pillow-SIMD` — reemplazo drop-in de Pillow, thumbnailing de imágenes **4–6×** más rápido
  - 🚀 `blake3` — ya en `requirements.txt`, evita el fallback más lento `blake2b`

### 🆘 Solución de problemas

<details>
<summary><strong>Algunas previews parecen desactualizadas</strong></summary>

Pulsa **Rebuild Cache**. Las URLs de preview invalidan automáticamente la caché del navegador vía un token `mtime`, así que normalmente no hace falta hard refresh. Si sigue desactualizado, reinicia ComfyUI y `Ctrl+F5`.

</details>

<details>
<summary><strong>Faltan metadatos de vídeo o audio</strong></summary>

Probablemente `ffmpeg` / `ffprobe` no están en `PATH`. Instálalos y reinicia.

</details>

<details>
<summary><strong>Quiero un reset completo</strong></summary>

Borra `ComfyUI/output/.ts_artius_browser/`, reinicia ComfyUI y escanea de nuevo. Todas las previews e índices se reconstruirán.

</details>

### 🗂️ Estructura en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

<a id="italian"></a>

## 🇮🇹 Español (sección original en italiano)

> **Artius Browser** vive en la barra lateral de ComfyUI y facilita encontrar, previsualizar, arrastrar y cargar tus activos — imágenes, vídeos, audio, modelos 3D y archivos de workflow. Se mantiene ágil incluso con bibliotecas enormes y usa el comportamiento nativo de ComfyUI siempre que es posible.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas en caché, extracción de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 |
| 🎬 **Vídeos** | Navegación fotograma a fotograma, info de códec / FPS / duración / audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de reproducción, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI en el lightbox, miniaturas 3D capturadas |
| 📜 **Workflows** | Lee la carpeta de workflows nativa de ComfyUI, previews sidecar, drag-to-load |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` con estado **independiente** (búsqueda, ordenación, vista, tamaño de preview, ancho del panel de árbol) |
| 🔍 **Búsqueda solo por nombre** | Rápida, predecible, sin escaneos full-text sorpresa |
| 🚀 **Drag-and-drop** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminación segura** | A la papelera del sistema vía `send2trash` — nunca eliminación definitiva |
| 🔄 **Autoscan / Rebuild Cache** | Actualización bajo demanda, o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + chip de actualización** | Versión actual junto al título; verifica GitHub una vez al día y muestra `New version available` cuando hay una nueva |
| 🧲 **Arrastrar selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Feedback de acciones** | Notificaciones cuando copiar / eliminar / cargar / reescanear tiene éxito o falla — adiós a los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue el idioma configurado en ComfyUI — inglés y ruso disponibles |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Inicio rápido

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

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(o cargar el workflow en la pestaña `Workflows`)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(avanza fotogramas en modo comparación de vídeo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avanzar un fotograma de vídeo |
| <kbd>Delete</kbd> | Enviar a la papelera del sistema |

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

| Tipo de activo | Nodo nativo |
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
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI dentro del lightbox
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
- La búsqueda de activos se centra en el nombre del archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en vez de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) sin importar el tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché stale-while-revalidate *(LRU 10, TTL 30 s)* para re-activaciones instantáneas de filtro / orden
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el cuadro capturado para que PIL solo termine con LANCZOS una imagen pequeña
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
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

### 🗂️ Estructura en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

<a id="french"></a>

## 🇫🇷 Español (sección original en francés)

> **Artius Browser** reside en la barra lateral de ComfyUI y hace agradable
> buscar, previsualizar, arrastrar y cargar tus activos — imágenes, vídeos, audios,
> modelos 3D y archivos de workflow. Se mantiene rápido incluso con
> bibliotecas enormes y usa el comportamiento nativo de ComfyUI siempre que
> es posible.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas en caché, extracción de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 |
| 🎬 **Vídeos** | Navegación cuadro a cuadro, info de códec / FPS / duración / audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de transporte, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI en el lightbox, miniaturas 3D capturadas |
| 📜 **Workflows** | Lee la carpeta de workflows nativa de ComfyUI, previews sidecar, drag-to-load |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` con estado **independiente** (búsqueda, orden, vista, tamaño de preview, ancho del panel árbol) |
| 🔍 **Búsqueda solo por nombre** | Rápida, predecible, sin escaneos full-text sorpresa |
| 🚀 **Drag-and-drop** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminación segura** | A la papelera del sistema vía `send2trash` — nunca eliminación definitiva |
| 🔄 **Autoscan / Rebuild Cache** | Refresco bajo demanda, o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + chip de actualización** | Versión actual junto al título; comprueba GitHub una vez al día y muestra `New version available` cuando hay una nueva |
| 🧲 **Arrastre de selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Feedback de acciones** | Notificaciones cuando copiar / borrar / cargar / reescanear tiene éxito o falla — adiós a los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue el idioma configurado en ComfyUI — inglés y ruso disponibles |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Inicio rápido

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

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(o cargar el workflow en la pestaña `Workflows`)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(avanza fotogramas en modo comparación de vídeo)* |
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

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar workflow en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | Enviar a la papelera workflow + previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — redirige el drag-and-drop a los nodos nativos:

| Tipo de activo | Nodo nativo |
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
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI dentro del lightbox
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
- La búsqueda de activos se centra en el nombre del archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en vez de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) sin importar el tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché stale-while-revalidate *(LRU 10, TTL 30 s)* para re-activaciones instantáneas de filtro / orden
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el cuadro capturado para que PIL solo termine con LANCZOS una imagen pequeña
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
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

### 🗂️ Estructura en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

<a id="portuguese"></a>

## 🇵🇹 Español (sección original en portugués)

> **Artius Browser** vive en la barra lateral de ComfyUI y hace que encontrar, previsualizar, arrastrar y cargar tus activos — imágenes, vídeos, audios, modelos 3D y archivos de workflow — sea rápido e indoloro. Se mantiene ágil incluso con bibliotecas enormes y usa el comportamiento nativo de ComfyUI siempre que puede.

### ✨ Características principales

| | |
|---|---|
| 🖼️ **Imágenes** | Miniaturas en caché, extracción de `Prompt` + `Workflow` del PNG, lightbox con comparación wipe / 2×2 |
| 🎬 **Vídeos** | Navegación cuadro a cuadro, info de códec / FPS / duración / audio, comparación sincronizada de 2 o 4 clips |
| 🎵 **Audio** | Previsualización de forma de onda, controles de reproducción, layout de canales |
| 🎲 **3D** | Visor 3D nativo de ComfyUI en el lightbox, miniaturas 3D capturadas |
| 📜 **Workflows** | Lee la carpeta de workflows nativa de ComfyUI, previews sidecar, drag-to-load |
| 🪟 **Dos pestañas** | `Assets` y `Workflows` con estado **independiente** (búsqueda, ordenación, vista, tamaño de preview, ancho del panel de árbol) |
| 🔍 **Búsqueda solo por nombre** | Rápida, predecible, sin escaneos full-text sorpresa |
| 🚀 **Drag-and-drop** | Directo a los nodos nativos `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Eliminación segura** | A la papelera del sistema vía `send2trash` — nunca eliminación definitiva |
| 🔄 **Autoscan / Rebuild Cache** | Refresco bajo demanda, o reconstrucción desde cero |
| 🏷️ **Etiqueta de versión + chip de actualización** | Versión actual junto al título; comprueba GitHub una vez al día y muestra `New version available` cuando hay una nueva |
| 🧲 **Arrastrar selección múltiple** | Arrastra toda la selección al canvas — un nodo nativo por activo, organizados automáticamente en cuadrícula |
| 🔔 **Feedback de acciones** | Notificaciones cuando copiar / eliminar / cargar / reescanear tiene éxito o falla — adiós a los fallos silenciosos |
| 🌍 **Interfaz localizada** | Sigue el idioma configurado en ComfyUI — inglés y ruso disponibles |
| ♿ **Cuadrícula accesible** | Semántica de listbox para lectores de pantalla con estado de selección, y anillo de foco de teclado |

### 📁 Formatos soportados

- 🖼️ Imágenes: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores`
- 🎵 Audio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Inicio rápido

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

#### Teclado — cuadrícula de activos

| Tecla | Acción |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Mover la selección |
| <kbd>Enter</kbd> | Abrir el lightbox *(o cargar el workflow en la pestaña `Workflows`)* |

#### Teclado — lightbox

| Tecla | Acción |
|:---:|---|
| <kbd>Esc</kbd> | Cerrar |
| <kbd>←</kbd> <kbd>→</kbd> | Activo anterior / siguiente *(avanza fotogramas en modo comparación de vídeo)* |
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

#### Botones de la tarjeta de workflow

| Botón | Acción |
|:---:|---|
| `L` · doble clic | Cargar workflow en ComfyUI |
| `D` | Descargar JSON del workflow |
| `X` | Enviar a la papelera workflow + previews sidecar coincidentes |

### 🎯 Integración nativa con ComfyUI

Este pack no reinventa los loaders — redirige el drag-and-drop a los nodos nativos:

| Tipo de activo | Nodo nativo |
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
- Comparación sincronizada de 2 o 4 vídeos seleccionados con un transporte compartido

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Previsualización de forma de onda
- Controles de reproducción
- Duración · bitrate · códec · layout de canales

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Visor 3D nativo de ComfyUI dentro del lightbox
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
- La búsqueda de activos se centra en el nombre del archivo. Parámetros de query `metadata` no soportados devuelven `400 Bad Request` en vez de fallar silenciosamente.
- La paginación del listado de activos es **keyset-based** (`after_sort` + `after_id`); las páginas profundas son O(1) sin importar el tamaño de la biblioteca.
- Las imágenes companion (sidecars PNG cuyo stem coincide con un activo hermano de vídeo / audio / 3D) se ocultan mediante un flag almacenado, no mediante subquery en tiempo de consulta.
- Los listeners del frontend se desmontan explícitamente al cerrar el stage / detener el worker.

### ⚡ Notas de rendimiento

- Búsqueda solo por nombre · metadatos compactos · caché de previews compacto
- Grid virtualizado · paginación keyset · caché stale-while-revalidate *(LRU 10, TTL 30 s)* para re-activaciones instantáneas de filtro / orden
- Navegación de workflows solo en frontend · miniaturas 3D generadas en frontend y persistidas en disco
- `ffprobe` + `ffmpeg` corren **en paralelo por activo** (un único par Popen)
- Worker pools por defecto `max(1, min(4, cpu_count() // 2))` — ajustable en `config.json`
- Póster de vídeo: ffmpeg pre-reduce el cuadro capturado para que PIL solo termine con LANCZOS una imagen pequeña
- Previews WebP se escriben con `method=0` (más rápido, visualmente idéntico en tamaño thumbnail)
- Las URLs de preview llevan el `mtime` del archivo en caché como cache-buster — no hace falta hard refresh tras Rebuild Cache
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

### 🗂️ Estructura en runtime

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # índice de activos
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

<div align="center">

Hecho con ❤️ por [AlexYez](https://github.com/AlexYez) ·
[🐛 Reportar un error](https://github.com/AlexYez/comfyui-artius-browser/issues/new?template=bug.yml) ·
[💖 Donar](https://timesavervfx.com/donate/)

</div>
