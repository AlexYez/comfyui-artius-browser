from __future__ import annotations

import copy
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
        "image_quality": 82,
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

TS_PROJECT_NAME = TS_BACKEND_SETTINGS["project"]["name"]
TS_PROJECT_TOOLTIP = TS_BACKEND_SETTINGS["project"]["tooltip"]
TS_PLUGIN_ID = TS_BACKEND_SETTINGS["project"]["plugin_id"]
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

TS_DEFAULT_CONFIG = {
    "version": 17,
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
        "workflow_sort_key": "created_at",
        "workflow_sort_direction": "desc",
        "workflow_preview_size": TS_DEFAULT_PREVIEW_SIZE,
        "workflow_search": "",
        "asset_types": [],
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

TS_DEFAULT_CONFIG_TEMPLATE = copy.deepcopy(TS_DEFAULT_CONFIG)
