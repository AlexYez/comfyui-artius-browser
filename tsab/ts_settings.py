from __future__ import annotations

import os

_TS_AUTO_MEDIA_WORKERS = max(1, min(4, (os.cpu_count() or 4) // 2))

TS_BACKEND_SETTINGS = {
    "project": {
        "name": "Timesaver Artius Browser",
        "tooltip": "Timesaver Artius Browser",
        "plugin_id": "timesaver.artius.browser",
        "event_prefix": "tsab",
    },
    "logging": {
        "enable_verbose": False,
        "enable_progress_console": True,
    },
    "api": {
        "default_page_size": 60,
    },
    "indexing": {
        "default_scan_batch": 128,
        "default_hash_workers": 8,
        "progress_log_percent_step": 5,
        "progress_event_file_step": 300,
        "progress_event_candidate_step": 120,
        "companion_suffixes": (
            "-preview",
            "_preview",
            ".preview",
            "-thumb",
            "_thumb",
            ".thumb",
            "-thumbnail",
            "_thumbnail",
            ".thumbnail",
            "-poster",
            "_poster",
            ".poster",
            "-frame",
            "_frame",
            ".frame",
            "-still",
            "_still",
            ".still",
        ),
    },
    "tools": {
        "ffprobe_workers": _TS_AUTO_MEDIA_WORKERS,
        "ffmpeg_workers": _TS_AUTO_MEDIA_WORKERS,
    },
    "preview": {
        "thumbnail_size": 256,
        "default_preview_size": 120,
        "max_3d_capture_data_url_length": 8 * 1024 * 1024,
        "max_3d_capture_decoded_bytes": 6 * 1024 * 1024,
        "max_3d_capture_pixels": 4096 * 4096,
        "allowed_3d_capture_mime_types": {"image/png", "image/jpeg", "image/webp"},
        "video_frame_time": 0.5,
        "waveform_width": 768,
        "waveform_height": 320,
        "image_format": "webp",
        "image_quality": 60,
        "placeholder_width": 384,
        "placeholder_height": 240,
    },
    "storage": {
        "directory_name": ".ts_artius_browser",
        "legacy_directory_names": (".asset_browser",),
    },
    "media": {
        "image_extensions": {".png", ".jpg", ".jpeg", ".webp", ".avif"},
        "video_extensions": {".mp4", ".mov", ".webm", ".prores"},
        "audio_extensions": {".mp3", ".wav", ".flac", ".opus", ".ogg"},
        "3d_extensions": {".glb", ".obj"},
    },
}

TS_EVENT_PREFIX = TS_BACKEND_SETTINGS["project"]["event_prefix"]
TS_ENABLE_VERBOSE_LOGGING = TS_BACKEND_SETTINGS["logging"]["enable_verbose"]
TS_ENABLE_PROGRESS_CONSOLE = TS_BACKEND_SETTINGS["logging"]["enable_progress_console"]
TS_DEFAULT_PAGE_SIZE = TS_BACKEND_SETTINGS["api"]["default_page_size"]
TS_DEFAULT_SCAN_BATCH = TS_BACKEND_SETTINGS["indexing"]["default_scan_batch"]
TS_DEFAULT_HASH_WORKERS = TS_BACKEND_SETTINGS["indexing"]["default_hash_workers"]
TS_PROGRESS_LOG_PERCENT_STEP = TS_BACKEND_SETTINGS["indexing"]["progress_log_percent_step"]
TS_PROGRESS_EVENT_FILE_STEP = TS_BACKEND_SETTINGS["indexing"]["progress_event_file_step"]
TS_PROGRESS_EVENT_CANDIDATE_STEP = TS_BACKEND_SETTINGS["indexing"]["progress_event_candidate_step"]
TS_COMPANION_SUFFIXES = TS_BACKEND_SETTINGS["indexing"]["companion_suffixes"]
TS_DEFAULT_FFPROBE_WORKERS = TS_BACKEND_SETTINGS["tools"]["ffprobe_workers"]
TS_DEFAULT_FFMPEG_WORKERS = TS_BACKEND_SETTINGS["tools"]["ffmpeg_workers"]
TS_DEFAULT_THUMBNAIL_SIZE = TS_BACKEND_SETTINGS["preview"]["thumbnail_size"]
TS_DEFAULT_PREVIEW_SIZE = TS_BACKEND_SETTINGS["preview"]["default_preview_size"]
TS_MAX_3D_CAPTURE_DATA_URL_LENGTH = TS_BACKEND_SETTINGS["preview"]["max_3d_capture_data_url_length"]
TS_MAX_3D_CAPTURE_DECODED_BYTES = TS_BACKEND_SETTINGS["preview"]["max_3d_capture_decoded_bytes"]
TS_MAX_3D_CAPTURE_PIXELS = TS_BACKEND_SETTINGS["preview"]["max_3d_capture_pixels"]
TS_ALLOWED_3D_CAPTURE_MIME_TYPES = TS_BACKEND_SETTINGS["preview"]["allowed_3d_capture_mime_types"]
TS_DEFAULT_VIDEO_FRAME_TIME = TS_BACKEND_SETTINGS["preview"]["video_frame_time"]
TS_DEFAULT_WAVEFORM_WIDTH = TS_BACKEND_SETTINGS["preview"]["waveform_width"]
TS_DEFAULT_WAVEFORM_HEIGHT = TS_BACKEND_SETTINGS["preview"]["waveform_height"]
TS_DEFAULT_PREVIEW_FORMAT = TS_BACKEND_SETTINGS["preview"]["image_format"]
TS_DEFAULT_PREVIEW_QUALITY = TS_BACKEND_SETTINGS["preview"]["image_quality"]
TS_DEFAULT_PLACEHOLDER_WIDTH = TS_BACKEND_SETTINGS["preview"]["placeholder_width"]
TS_DEFAULT_PLACEHOLDER_HEIGHT = TS_BACKEND_SETTINGS["preview"]["placeholder_height"]
# Characters that make a workflow path unsafe or unusable. ":" is rejected only
# on Windows: there it opens an NTFS alternate data stream
# ("foo.json:alt.json" would otherwise pass the ".json" check), while on macOS
# and Linux it is an ordinary, legal filename character - refusing it there
# would block deleting a workflow the user can legitimately create. Lives here
# rather than in ts_workflows so the policy is testable without aiohttp.
TS_WORKFLOW_PATH_FORBIDDEN_CHARACTERS = frozenset('<>|"?*') | (frozenset(":") if os.name == "nt" else frozenset())

# Version stamp of the stored image prompt-metadata blob. Bumping it makes
# TSEnsureMetadata re-extract older blobs once, on the next detail view.
# 5 added seed + split positive/negative, 6 added the model/LoRA list,
# 7 added the TS Image Studio session tag. [AI agent]
TS_PROMPT_PARTS_VERSION = 7

# Decompression-bomb guard for the image thumbnail path: images above this
# pixel count get a placeholder instead of a full decode. PIL's own default
# only errors at ~178 Mpx, and one full decode of such an image costs
# hundreds of MB across up to 8 concurrent hash workers. 120 Mpx clears every
# consumer/prosumer camera (GFX100 is ~102 Mpx) with headroom.
TS_MAX_IMAGE_PREVIEW_PIXELS = 120_000_000

# Clamp bounds for preview-size persistence (UI) and preview-render dimensions.
TS_PREVIEW_SIZE_MIN = 48
TS_PREVIEW_SIZE_MAX = 512
TS_THUMBNAIL_SIZE_MIN = 96
TS_THUMBNAIL_SIZE_MAX = 1024
TS_WAVEFORM_WIDTH_MIN = 320
TS_WAVEFORM_WIDTH_MAX = 2048
TS_WAVEFORM_HEIGHT_MIN = 96
TS_WAVEFORM_HEIGHT_MAX = 1024
TS_PLACEHOLDER_WIDTH_MIN = 160
TS_PLACEHOLDER_WIDTH_MAX = 1024
TS_PLACEHOLDER_HEIGHT_MIN = 120
TS_PLACEHOLDER_HEIGHT_MAX = 768
TS_STORAGE_DIRECTORY_NAME = TS_BACKEND_SETTINGS["storage"]["directory_name"]
TS_LEGACY_STORAGE_DIRECTORY_NAMES = TS_BACKEND_SETTINGS["storage"]["legacy_directory_names"]
TS_IMAGE_EXTENSIONS = TS_BACKEND_SETTINGS["media"]["image_extensions"]
TS_VIDEO_EXTENSIONS = TS_BACKEND_SETTINGS["media"]["video_extensions"]
TS_AUDIO_EXTENSIONS = TS_BACKEND_SETTINGS["media"]["audio_extensions"]
TS_3D_EXTENSIONS = TS_BACKEND_SETTINGS["media"]["3d_extensions"]
TS_SUPPORTED_EXTENSIONS = (
    TS_IMAGE_EXTENSIONS
    | TS_VIDEO_EXTENSIONS
    | TS_AUDIO_EXTENSIONS
    | TS_3D_EXTENSIONS
)

TS_EVENT_INDEX_START = f"{TS_EVENT_PREFIX}:index-start"
TS_EVENT_INDEX_PROGRESS = f"{TS_EVENT_PREFIX}:index-progress"
TS_EVENT_INDEX_COMPLETE = f"{TS_EVENT_PREFIX}:index-complete"
TS_EVENT_ASSET_UPSERT = f"{TS_EVENT_PREFIX}:asset-upsert"
TS_EVENT_ASSET_REMOVE = f"{TS_EVENT_PREFIX}:asset-remove"
TS_EVENT_HEALTH = f"{TS_EVENT_PREFIX}:health"

# Bounds for every RUNTIME numeric in config.json. The config is a file the
# user can hand-edit, and a valid-JSON-but-wrong-type value used to reach
# int() unguarded: "ffprobe_workers": "fast" raised at TSToolLocator
# construction, which is inside the runtime constructor, so the whole
# extension failed to load with a ValueError and no hint of the cause. A huge
# hash_workers was worse - it loaded fine and then spawned that many threads.
# The ui section is deliberately absent: it has its own normalizer in
# ts_ui_settings.py.
# Upper bound on distinct queued rescan requests. The queue drains one scan at
# a time, so an unbounded list of unique {scope, root_id} pairs is both memory
# growth and a long tail of scans nobody is waiting for; past this many, the
# indexer collapses the queue into a single full scan.
TS_MAX_PENDING_SCAN_REQUESTS = 16

TS_CONFIG_NUMERIC_BOUNDS = {
    ("tools", "ffprobe_workers"): (1, 32),
    ("tools", "ffmpeg_workers"): (1, 32),
    ("indexing", "hash_workers"): (1, 64),
    ("indexing", "batch_size"): (1, 20000),
    ("preview", "thumbnail_size"): (TS_THUMBNAIL_SIZE_MIN, TS_THUMBNAIL_SIZE_MAX),
    ("preview", "image_quality"): (1, 100),
    ("preview", "waveform_width"): (TS_WAVEFORM_WIDTH_MIN, TS_WAVEFORM_WIDTH_MAX),
    ("preview", "waveform_height"): (TS_WAVEFORM_HEIGHT_MIN, TS_WAVEFORM_HEIGHT_MAX),
    ("preview", "placeholder_width"): (TS_PLACEHOLDER_WIDTH_MIN, TS_PLACEHOLDER_WIDTH_MAX),
    ("preview", "placeholder_height"): (TS_PLACEHOLDER_HEIGHT_MIN, TS_PLACEHOLDER_HEIGHT_MAX),
}

# Same story for floats and booleans that runtime code consumes directly.
TS_CONFIG_FLOAT_BOUNDS = {
    ("preview", "video_frame_time"): (0.0, 3600.0),
}

TS_CONFIG_BOOLEAN_KEYS = (
    ("logging", "enable_verbose"),
    ("logging", "enable_progress_console"),
)

TS_DEFAULT_CONFIG = {
    "version": 20,
    "logging": {
        "enable_verbose": False,
        "enable_progress_console": True,
    },
    "roots": {
        "output": {"enabled": True, "allow_delete": True},
        "input": {"enabled": True, "allow_delete": True},
    },
    "custom_roots": [],
    "tools": {
        "ffmpeg": "",
        "ffprobe": "",
        "ffprobe_workers": TS_DEFAULT_FFPROBE_WORKERS,
        "ffmpeg_workers": TS_DEFAULT_FFMPEG_WORKERS,
    },
    "ui": {
        "language": "en",
        "autoscan": True,
        "browser_section": "assets",
        "asset_view_mode": "flat",
        "workflow_view_mode": "flat",
        "asset_sort_key": "created_at",
        "asset_sort_direction": "desc",
        "asset_preview_size": TS_DEFAULT_PREVIEW_SIZE,
        "asset_search": "",
        "asset_search_scope": "filename",
        "asset_favorites_only": False,
        "workflow_sort_key": "created_at",
        "workflow_sort_direction": "desc",
        "workflow_preview_size": TS_DEFAULT_PREVIEW_SIZE,
        "workflow_search": "",
        "asset_types": [],
        "asset_date_from": "",
        "asset_date_to": "",
        "asset_min_width": 0,
        "asset_max_width": 0,
        "asset_min_height": 0,
        "asset_max_height": 0,
        "selected_root_id": "all",
        "selected_folder_path": "",
        "workflow_selected_folder_path": "",
        "expanded_folders": [],
        "browser_width": 0,
        "asset_tree_panel_width": 220,
        "workflow_tree_panel_width": 220,
        "toolbar_scale": 1.0,
    },
    "indexing": {
        "batch_size": TS_DEFAULT_SCAN_BATCH,
        "hash_workers": TS_DEFAULT_HASH_WORKERS,
    },
    "preview": {
        "thumbnail_size": TS_DEFAULT_THUMBNAIL_SIZE,
        "image_format": TS_DEFAULT_PREVIEW_FORMAT,
        "image_quality": TS_DEFAULT_PREVIEW_QUALITY,
        "video_frame_time": TS_DEFAULT_VIDEO_FRAME_TIME,
        "waveform_width": TS_DEFAULT_WAVEFORM_WIDTH,
        "waveform_height": TS_DEFAULT_WAVEFORM_HEIGHT,
        "placeholder_width": TS_DEFAULT_PLACEHOLDER_WIDTH,
        "placeholder_height": TS_DEFAULT_PLACEHOLDER_HEIGHT,
    },
}
