from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from aiohttp import web as TSWeb
from send2trash import send2trash as TSSendToTrash

TS_WORKFLOW_PREVIEW_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".avif",
    ".gif",
    ".mp4",
    ".webm",
    ".mov",
    ".m4v",
}


def TSGetPromptServerInstance():
    from server import PromptServer

    return getattr(PromptServer, "instance", None)


def TSNormalizeWorkflowRelativePath(ts_relative_path: str) -> str:
    ts_normalized_path = str(ts_relative_path or "").replace("\\", "/").strip("/")
    ts_parts = ts_normalized_path.split("/")
    if (
        not ts_normalized_path.lower().startswith("workflows/")
        or not ts_normalized_path.lower().endswith(".json")
        or len(ts_parts) < 2
        or any(ts_part in {"", ".", ".."} for ts_part in ts_parts)
    ):
        raise TSWeb.HTTPBadRequest(reason="Invalid workflow path")
    return ts_normalized_path


class TSWorkflowService:
    def __init__(
        self,
        ts_get_prompt_server: Callable[[], Any] = TSGetPromptServerInstance,
        ts_send_to_trash: Callable[[str], None] = TSSendToTrash,
    ) -> None:
        self.ts_get_prompt_server = ts_get_prompt_server
        self.ts_send_to_trash = ts_send_to_trash

    def TSResolveRequestWorkflowPath(self, ts_request, ts_relative_path: str) -> Path:
        ts_normalized_path = TSNormalizeWorkflowRelativePath(ts_relative_path)
        ts_server = self.ts_get_prompt_server()
        ts_user_manager = getattr(ts_server, "user_manager", None)
        if ts_user_manager is None:
            raise TSWeb.HTTPInternalServerError(reason="User manager unavailable")
        ts_absolute_path = ts_user_manager.get_request_user_filepath(
            ts_request,
            ts_normalized_path,
            create_dir=False,
        )
        if not ts_absolute_path:
            raise TSWeb.HTTPBadRequest(reason="Invalid workflow path")
        return Path(str(ts_absolute_path)).resolve()

    def TSFindPreviewSidecars(self, ts_workflow_path: Path) -> list[Path]:
        ts_sidecars: list[Path] = []
        if not ts_workflow_path.exists():
            return ts_sidecars
        ts_workflow_stem = ts_workflow_path.stem.lower()
        for ts_candidate in ts_workflow_path.parent.iterdir():
            if not ts_candidate.is_file() or ts_candidate == ts_workflow_path:
                continue
            if ts_candidate.stem.lower() != ts_workflow_stem:
                continue
            if ts_candidate.suffix.lower() not in TS_WORKFLOW_PREVIEW_EXTENSIONS:
                continue
            ts_sidecars.append(ts_candidate)
        return sorted(ts_sidecars, key=lambda ts_path: ts_path.name.lower())

    def TSDeleteWorkflowFile(self, ts_workflow_path: Path) -> dict[str, Any]:
        if not ts_workflow_path.exists():
            raise TSWeb.HTTPNotFound()
        ts_deleted_paths: list[str] = []
        for ts_target_path in [ts_workflow_path, *self.TSFindPreviewSidecars(ts_workflow_path)]:
            if not ts_target_path.exists():
                continue
            self.ts_send_to_trash(str(ts_target_path))
            ts_deleted_paths.append(ts_target_path.name)
        return {"deleted": ts_deleted_paths}

    def TSDeleteRequestWorkflowFile(self, ts_request, ts_relative_path: str) -> dict[str, Any]:
        return self.TSDeleteWorkflowFile(self.TSResolveRequestWorkflowPath(ts_request, ts_relative_path))
