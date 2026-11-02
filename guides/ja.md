# Artius Browser — 日本語

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

> **Artius Browser** は ComfyUI のサイドバーに常駐し、画像・動画・音声・
> 3D モデル・workflow ファイルといったアセットの検索、プレビュー、
> ドラッグ、読み込みを快適にするツールです。大規模なライブラリでも
> 軽快に動作し、可能な限り ComfyUI のネイティブな挙動を利用します。

### ✨ 主な機能

| | |
|---|---|
| 🖼️ **画像** | キャッシュ済みサムネイル、PNG の `Prompt` + `Workflow` 抽出、ライトボックスでの wipe / 2×2 グリッド比較と同期ズーム |
| 🎬 **動画** | フレーム単位のナビゲーション、コーデック / FPS / 長さ / オーディオ情報、埋め込まれた prompt と workflow、2〜4 クリップの同期比較 |
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
| 📦 **選択項目をダウンロード** | 画像・動画・音声・3D を自由に選んで `Download Selected` を押す — 複数なら 1 つの ZIP、1 つならそのままダウンロード |
| 📝 **プロンプトを書き出し**  [local draft](README.md#local-draft-features) | 画像を選んで `Export Prompts` を押す — 1 枚ならプロンプト入りの `<名前>.txt`、複数なら画像ごとに同名の `.txt` を入れた 1 つの ZIP |
| 📋 **パスをコピー**  [local draft](README.md#local-draft-features) | ライトボックスの `Copy Path`、またはファイルを選んで `Copy Paths` — ComfyUI を動かすマシン上のフルパスを 1 行に 1 つ |
| 🔔 **操作フィードバック** | コピー / 削除 / 読み込み / 再スキャンの成功・失敗をトースト表示 — 無言の失敗をなくします |
| 🌍 **UI ローカライズ** | ComfyUI の言語設定に追従 — 現在は英語・ロシア語・中国語・日本語を同梱 |
| ♿ **アクセシブルなグリッド** | 選択状態を持つスクリーンリーダー向け listbox セマンティクスとキーボードフォーカスリング |

### 📁 対応フォーマット

- 🖼️ 画像: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 動画: `.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 ブラウザが直接表示できない形式(ProRes、HEVC、AVI、MKV、EXR、TIFF)は、ffmpeg が必要時に作るコピーでライトボックスに再生・表示されます。元のファイルは変更されません
- 🎵 音声: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 クイックスタート

#### 推奨 — Comfy Registry 経由

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
| <kbd>Home</kbd> <kbd>End</kbd> | 動画の最初 / 最後のフレーム(比較では各クリップ自身のもの)。ループは既定でオフ |
| <kbd>Delete</kbd> | システムのゴミ箱へ |

#### カードのボタン

> これらは**カード上のボタン**(ホバーで表示)であり、キーボードショートカットではありません。

| ボタン | 動作 |
|:---:|---|
| `P` | プロンプトをコピー |
| `W` | workflow をコピー *(PNG が実際に workflow データを持っている場合のみ)* |
| `D` | ダウンロード |
| `X` | システムのゴミ箱へ *(root が削除を許可している場所のみ)* |

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

3D ファイルは ComfyUI の input ストレージに自動的にステージングされ、ネイティブ 3D ノードからは UI で選択したファイルと全く同じように見えます。`Workflows` タブは `workflows` ([userdata](README.md#released-and-local-changes)) を直接読み込み — 別キャッシュも並列インデックスもありません。

他にインストールされたパックがより良いローダーを提供している場合はそちらが優先されます。キャンバスにドロップした動画は **TS Video Loader** ノード(`comfyui-timesaver`)になり、ファイルを `input/` にコピーせず元の場所から読み込みます。そのパックがなければ、上記のネイティブノードがそのまま作成されます。

### 🔬 ライトボックスツアー

<details>
<summary><strong>🖼️ 画像</strong></summary>

- マウスホイールでズーム、左/中ボタンでパン
- 2 枚の画像の **wipe** 比較、左右スライダー付き
- 4 枚の画像の **2×2 グリッド**比較
- `Prompt` と `Negative Prompt` の独立パネル
- PNG に含まれていれば 1 クリックで `Copy Workflow`
- 新しいタブで開く、フォルダーで表示、ダウンロード、削除

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
- FFmpeg / ffprobe: Worker pool のデフォルトは `max(1, min(4, cpu_count() // 2))` — `config.json` で調整可能
- 動画のポスター: ffmpeg がキャプチャしたフレームを事前にダウンスケールし、PIL は小さな画像を LANCZOS で仕上げるだけ
- WebP プレビューは `method=0` で書き込み(最速、サムネイルサイズでは視覚的に同等)
- プレビュー URL はキャッシュファイルの `mtime` を cache-buster として持つ — Rebuild Cache 後にハードリフレッシュ不要
- オプションのアクセラレータ:
  - `Pillow-SIMD` — Pillow 互換の任意実装。速度は処理内容によって異なります。
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

索引とプレビューの再生成には Rebuild Cache を使います。ディレクトリ全体のリセットによるデータ損失については、以下を参照してください： [reset policy](README.md#сброс-индекса-и-полный-сброс).

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

[CHANGELOG.md](../CHANGELOG.md) を参照してください。フォーマット: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)。
