# Artius Browser — 中文

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

> **Artius Browser** 驻留在 ComfyUI 的侧边栏中，让你轻松查找、预览、拖拽
> 和加载各种素材 — 图片、视频、音频、3D 模型和 workflow 文件。即使面对超大
> 规模的资产库也能保持流畅，并尽可能使用 ComfyUI 的原生行为。

### ✨ 主要特性

| | |
|---|---|
| 🖼️ **图片** | 缩略图缓存、提取 PNG 中的 `Prompt` 与 `Workflow`、灯箱支持 wipe / 2×2 网格对比与同步缩放 |
| 🎬 **视频** | 逐帧导航、显示编码器 / FPS / 时长 / 音频信息、内嵌的 prompt 与 workflow、2-4 个剪辑的同步对比 |
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
| 📦 **下载所选** | 任意选择图片、视频、音频和 3D,点击 `Download Selected` — 多个文件打包为一个 ZIP,单个文件直接下载 |
| 📝 **导出提示词**  [local draft](README.md#local-draft-features) | 选择图片后点击 `Export Prompts` — 单张图片得到带提示词的 `<名称>.txt`,多张图片得到一个 ZIP,每张图片一个同名 `.txt` |
| 📋 **复制路径**  [local draft](README.md#local-draft-features) | 在灯箱中点击 `Copy Path`,或选择文件后点击 `Copy Paths` — 运行 ComfyUI 的电脑上的完整路径,每行一个 |
| 🔔 **操作反馈** | 复制 / 删除 / 加载 / 扫描成功或失败时弹出提示 — 不再有静默失败 |
| 🌍 **界面本地化** | 跟随 ComfyUI 的语言设置 — 目前提供英文、俄文、中文与日文 |
| ♿ **无障碍网格** | 面向屏幕阅读器的 listbox 语义(含选中状态),以及键盘焦点环 |

### 📁 支持的格式

- 🖼️ 图片:`.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 视频:`.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 浏览器无法直接显示的格式(ProRes、HEVC、AVI、MKV、EXR、TIFF)在灯箱中通过 ffmpeg 按需生成的副本播放和显示,原文件不会被改动
- 🎵 音频:`.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D:`.glb` · `.obj`
- 📜 Workflow:`.json`

### 🚀 快速开始

#### 推荐 — 通过 Comfy Registry

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
| <kbd>Home</kbd> <kbd>End</kbd> | 视频第一帧 / 最后一帧(对比模式下为各片段自己的);循环默认关闭,播放结束停在最后一帧 |
| <kbd>Delete</kbd> | 移至系统回收站 |

#### 卡片按钮

> 这些是**卡片上的按钮**(悬停显示),不是键盘快捷键。

| 按钮 | 操作 |
|:---:|---|
| `P` | 复制 prompt |
| `W` | 复制 workflow *(仅当 PNG 真正包含 workflow 数据时)* |
| `D` | 下载 |
| `X` | 移至系统回收站 *(仅在 root 允许删除的位置)* |

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

3D 文件会自动暂存到 ComfyUI 的 input 存储中,这样原生 3D 节点看到它们的方式就和从节点 UI 中选择的文件完全一样。`Workflows` 标签页直接读取 `workflows` ([userdata](README.md#released-and-local-changes)) — 没有独立缓存,没有并行索引。

如果安装的其他节点包提供了更好的加载器,则优先使用它:拖到画布上的视频会创建 **TS Video Loader** 节点(来自 `comfyui-timesaver`),直接读取文件原位置,而不是复制到 `input/`。没有该节点包时,仍然创建上表中的原生节点。

### 🔬 灯箱概览

<details>
<summary><strong>🖼️ 图片</strong></summary>

- 鼠标滚轮缩放、左/中键平移
- 2 张图片的 **wipe** 对比,带左右滑块
- 4 张图片的 **2×2 网格**对比
- `Prompt` 与 `Negative Prompt` 独立面板
- 当 PNG 包含 workflow 时,一键 `Copy Workflow`
- 在新标签页打开、在文件夹中显示、下载、删除

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
- FFmpeg / ffprobe: Worker pool 默认 `max(1, min(4, cpu_count() // 2))` — 可在 `config.json` 中调整
- 视频海报:ffmpeg 预先缩小捕获的帧,PIL 只用 LANCZOS 完成一张小图
- WebP 预览以 `method=0` 写入(最快,在缩略图尺寸下视觉上无差异)
- 预览 URL 携带缓存文件的 `mtime` 作为 cache-buster — 重建缓存后无需 hard refresh
- 可选加速器:
  - `Pillow-SIMD` — 可选的 Pillow 兼容实现；实际速度取决于工作负载。
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

重建索引和预览请使用 Rebuild Cache。完整目录重置会丢失其他数据，参见 [reset policy](README.md#сброс-индекса-и-полный-сброс).

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

参见 [CHANGELOG.md](../CHANGELOG.md)。格式:[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)。
