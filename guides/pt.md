# Artius Browser — Português

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

> **Artius Browser** vive na barra lateral do ComfyUI e torna indolor
> encontrar, pré-visualizar, arrastar e carregar os teus assets — imagens,
> vídeos, áudios, modelos 3D e ficheiros de workflow. Mantém-se rápido mesmo
> em bibliotecas enormes e usa o comportamento nativo do ComfyUI sempre que
> possível.

### ✨ Destaques

| | |
|---|---|
| 🖼️ **Imagens** | Thumbnails em cache, extracção de `Prompt` + `Workflow` do PNG, lightbox com comparação wipe / 2×2 e zoom sincronizado |
| 🎬 **Vídeos** | Navegação frame a frame, info de codec / FPS / duração / áudio, prompt + workflow embutidos, comparação sincronizada de 2-4 clips |
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
| 📦 **Transferir selecção** | Seleccione qualquer mistura de imagens, vídeos, áudio e 3D e prima `Download Selected` — vários ficheiros chegam num único ZIP, um ficheiro sozinho tal como está |
| 📝 **Exportar prompts**  [local draft](README.md#local-draft-features) | Seleccione imagens e prima `Export Prompts` — uma imagem dá `<nome>.txt` com o seu prompt, várias dão um único ZIP com um `.txt` com o mesmo nome por imagem |
| 📋 **Copiar caminhos**  [local draft](README.md#local-draft-features) | `Copy Path` no visualizador, ou seleccione ficheiros e prima `Copy Paths` — caminhos completos no computador que corre o ComfyUI, um por linha |
| 🔔 **Feedback das acções** | Notificações quando copiar / eliminar / carregar / reanalisar tem sucesso ou falha — sem falhas silenciosas |
| 🌍 **Interface localizada** | Segue o idioma configurado no ComfyUI — inglês, russo, chinês e japonês já incluídos |
| ♿ **Grelha acessível** | Semântica listbox para leitores de ecrã com estado de selecção, e anel de foco de teclado |

### 📁 Formatos suportados

- 🖼️ Imagens: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 Vídeos: `.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 Os formatos que o navegador não consegue mostrar (ProRes, HEVC, AVI, MKV, EXR, TIFF) são reproduzidos e exibidos no visualizador através de uma cópia criada pelo ffmpeg quando necessário; o ficheiro original nunca é alterado
- 🎵 Áudio: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 Início rápido

#### Recomendado — via Comfy Registry

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
| <kbd>Home</kbd> <kbd>End</kbd> | Primeiro / último fotograma do vídeo (na comparação, o de cada clip); a repetição está desligada por omissão |
| <kbd>Delete</kbd> | Enviar para o lixo do sistema |

#### Botões do card

> São **botões no card** (aparecem ao passar o cursor), não teclas.

| Botão | Acção |
|:---:|---|
| `P` | Copiar prompt |
| `W` | Copiar workflow *(só quando o PNG realmente contém dados de workflow)* |
| `D` | Transferir |
| `X` | Enviar para o lixo do sistema *(só onde o root permite eliminação)* |

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

Os ficheiros 3D são automaticamente preparados no armazenamento de input do ComfyUI, para que os nós 3D nativos os vejam exactamente como ficheiros seleccionados a partir da UI do nó. O separador `Workflows` lê directamente `workflows` ([userdata](README.md#released-and-local-changes)) — sem cache separado, sem índice paralelo.

Se outro pack instalado publicar um loader melhor, é esse que ganha: um vídeo largado no canvas passa a ser um nó **TS Video Loader** (de `comfyui-timesaver`) que lê o ficheiro onde já está, em vez de copiá-lo para `input/`. Sem esse pack, o nó nativo é criado exactamente como acima.

### 🔬 Tour pelo lightbox

<details>
<summary><strong>🖼️ Imagens</strong></summary>

- Zoom com roda do rato, pan com botão esquerdo/meio
- Comparação **wipe** de 2 imagens com slider esquerda-direita
- Comparação **grelha 2×2** de 4 imagens
- Painéis separados para `Prompt` e `Negative Prompt`
- `Copy Workflow` num clique quando o PNG o contém
- Abrir em novo separador, mostrar na pasta, transferir, eliminar

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
- FFmpeg / ffprobe: Worker pools por defeito `max(1, min(4, cpu_count() // 2))` — ajustável em `config.json`
- Poster de vídeo: ffmpeg pré-reduz o frame capturado, PIL só finaliza uma imagem pequena com LANCZOS
- Previews WebP escritos com `method=0` (mais rápido, visualmente idêntico no tamanho thumbnail)
- URLs de preview carregam o `mtime` do ficheiro em cache como cache-buster — não é preciso hard refresh após Rebuild Cache
- Aceleradores opcionais:
  - `Pillow-SIMD` — implementação opcional compatível com Pillow; a velocidade depende do trabalho.
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

Usa Rebuild Cache para regenerar o índice e as previews. Para a reposição completa da pasta e a perda de dados, consulta [reset policy](README.md#сброс-индекса-и-полный-сброс).

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

Vê [CHANGELOG.md](../CHANGELOG.md). Formato: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

<div align="center">

Made with ❤️ by [AlexYez](https://github.com/AlexYez) ·
[🐛 Report a bug](https://github.com/AlexYez/comfyui-artius-browser/issues/new?template=bug.yml) ·
[💖 Donate](https://timesavervfx.com/donate/)

</div>
