# Artius Browser — 한국어

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

> **Artius Browser**는 ComfyUI 사이드바에 자리잡아 이미지, 비디오, 오디오,
> 3D 모델, workflow 파일 같은 에셋을 빠르게 찾고, 미리보고, 드래그하고,
> 불러올 수 있도록 도와줍니다. 대용량 라이브러리에서도 가볍게 동작하며,
> 가능한 한 ComfyUI 의 네이티브 동작을 사용합니다.

### ✨ 주요 특징

| | |
|---|---|
| 🖼️ **이미지** | 캐시된 썸네일, PNG `Prompt` + `Workflow` 추출, 라이트박스의 wipe / 2×2 그리드 비교와 동기 확대 |
| 🎬 **비디오** | 프레임 단위 탐색, 코덱 / FPS / 길이 / 오디오 정보, 내장된 prompt + workflow, 2-4 개 클립의 동기화 비교 |
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
| 📦 **선택 항목 다운로드** | 이미지·비디오·오디오·3D를 자유롭게 선택하고 `Download Selected` 클릭 — 여러 파일은 ZIP 하나로, 파일 하나는 그대로 다운로드 |
| 📝 **프롬프트 내보내기**  [local draft](README.md#local-draft-features) | 이미지를 선택하고 `Export Prompts` 클릭 — 이미지 하나는 프롬프트가 담긴 `<이름>.txt`, 여러 개는 이미지마다 같은 이름의 `.txt`가 든 ZIP 하나 |
| 📋 **경로 복사**  [local draft](README.md#local-draft-features) | 라이트박스의 `Copy Path`, 또는 파일을 선택하고 `Copy Paths` — ComfyUI가 실행되는 컴퓨터의 전체 경로를 한 줄에 하나씩 |
| 🔔 **동작 피드백** | 복사 / 삭제 / 불러오기 / 재스캔의 성공·실패를 토스트로 알림 — 조용한 실패 없음 |
| 🌍 **UI 현지화** | ComfyUI 의 언어 설정을 따름 — 현재 영어, 러시아어, 중국어, 일본어 제공 |
| ♿ **접근성 그리드** | 선택 상태를 포함한 스크린 리더용 listbox 시맨틱과 키보드 포커스 링 |

### 📁 지원 형식

- 🖼️ 이미지: `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 비디오: `.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 브라우저가 직접 표시하지 못하는 형식(ProRes, HEVC, AVI, MKV, EXR, TIFF)은 ffmpeg가 필요할 때 만드는 사본으로 라이트박스에서 재생·표시됩니다. 원본 파일은 건드리지 않습니다
- 🎵 오디오: `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D: `.glb` · `.obj`
- 📜 Workflows: `.json`

### 🚀 빠른 시작

#### 권장 — Comfy Registry 사용

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
| <kbd>Home</kbd> <kbd>End</kbd> | 영상의 첫 / 마지막 프레임 (비교 모드에서는 각 클립 자신의 것); 반복은 기본적으로 꺼져 있음 |
| <kbd>Delete</kbd> | 시스템 휴지통으로 |

#### 카드 버튼

> 이는 **카드 위의 버튼**(마우스를 올리면 표시)이며 키보드 단축키가 아닙니다.

| 버튼 | 동작 |
|:---:|---|
| `P` | 프롬프트 복사 |
| `W` | workflow 복사 *(PNG 에 실제로 workflow 데이터가 있을 때만)* |
| `D` | 다운로드 |
| `X` | 시스템 휴지통으로 *(root 가 삭제를 허용하는 경우에만)* |

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

3D 파일은 ComfyUI 의 input 저장소에 자동으로 스테이징되어, 네이티브 3D 노드에서는 노드 UI 에서 선택한 파일과 정확히 같은 방식으로 보입니다. `Workflows` 탭은 `workflows` ([userdata](README.md#released-and-local-changes)) 를 직접 읽습니다 — 별도 캐시도 병렬 인덱스도 없습니다.

설치된 다른 팩이 더 나은 로더를 제공하면 그쪽이 우선합니다. 캔버스에 드롭한 비디오는 **TS Video Loader** 노드(`comfyui-timesaver`)가 되어 파일을 `input/` 으로 복사하지 않고 원래 위치에서 읽습니다. 해당 팩이 없으면 위의 네이티브 노드가 그대로 생성됩니다.

### 🔬 라이트박스 둘러보기

<details>
<summary><strong>🖼️ 이미지</strong></summary>

- 마우스 휠 줌, 왼쪽/가운데 버튼 팬
- 2 장 이미지의 **wipe** 비교, 좌우 슬라이더
- 4 장 이미지의 **2×2 그리드** 비교
- `Prompt` 와 `Negative Prompt` 분리 패널
- PNG 가 가지고 있을 때 원클릭 `Copy Workflow`
- 새 탭에서 열기, 폴더에서 보기, 다운로드, 삭제

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
- FFmpeg / ffprobe: Worker pool 기본값은 `max(1, min(4, cpu_count() // 2))` — `config.json` 에서 조정 가능
- 비디오 포스터: ffmpeg 가 캡처한 프레임을 사전에 다운스케일하고, PIL 은 작은 이미지만 LANCZOS 로 마무리
- WebP 미리보기는 `method=0` 으로 작성됨(가장 빠름, 썸네일 크기에서는 시각적으로 동일)
- 미리보기 URL 은 캐시 파일의 `mtime` 을 cache-buster 로 포함 — Rebuild Cache 후 하드 새로고침 불필요
- 선택적 가속기:
  - `Pillow-SIMD` — 선택적으로 사용할 수 있는 Pillow 호환 구현입니다. 실제 속도는 작업에 따라 다릅니다.
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

인덱스와 미리보기 재생성에는 Rebuild Cache를 사용하세요. 전체 디렉터리 초기화의 데이터 손실에 대해서는 다음을 참조하세요: [reset policy](README.md#сброс-индекса-и-полный-сброс).

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

[CHANGELOG.md](../CHANGELOG.md) 를 참조하세요. 형식: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
