from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from aiohttp import web as TSWeb
from send2trash import send2trash as TSSendToTrash

from .ts_logging import TSLogVerbose
from .ts_settings import TS_WORKFLOW_PATH_FORBIDDEN_CHARACTERS

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


# TS_WORKFLOW_PATH_FORBIDDEN_CHARACTERS is imported from ts_settings: the set
# is platform-dependent (":" only bites on Windows) and lives there so it can be
# tested without pulling in aiohttp.


def TSNormalizeWorkflowRelativePath(ts_relative_path: str) -> str:
    ts_normalized_path = str(ts_relative_path or "").replace("\\", "/").strip("/")
    ts_parts = ts_normalized_path.split("/")
    if (
        not ts_normalized_path.lower().startswith("workflows/")
        or not ts_normalized_path.lower().endswith(".json")
        or len(ts_parts) < 2
        or any(ts_part in {"", ".", ".."} for ts_part in ts_parts)
        or any(ts_character in TS_WORKFLOW_PATH_FORBIDDEN_CHARACTERS for ts_character in ts_normalized_path)
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
        ts_resolved_path = Path(str(ts_absolute_path)).resolve()
        # resolve() follows symlinks/junctions: a link planted inside the
        # workflows folder could otherwise redirect the delete (including its
        # same-stem sidecar sweep) into an unrelated directory.
        ts_workflows_root = ts_user_manager.get_request_user_filepath(
            ts_request,
            "workflows",
            create_dir=False,
        )
        if ts_workflows_root:
            try:
                ts_resolved_path.relative_to(Path(str(ts_workflows_root)).resolve())
            except ValueError:
                raise TSWeb.HTTPBadRequest(reason="Invalid workflow path") from None
        return ts_resolved_path

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
        ts_failed_paths: list[dict[str, str]] = []
        ts_sidecars = self.TSFindPreviewSidecars(ts_workflow_path)
        # The workflow JSON goes first and its failure ABORTS the operation.
        # Treating it as just another entry in one best-effort loop meant a
        # workflow that could not be trashed still lost its preview sidecars -
        # the user kept the file they wanted gone and lost the pictures they
        # did not, recoverable only by hand from the trash.
        try:
            self.ts_send_to_trash(str(ts_workflow_path))
        except Exception as ts_error:
            TSLogVerbose("workflow.delete.aborted", path=str(ts_workflow_path), error=str(ts_error))
            return {
                "deleted": [],
                "failed": [{"name": ts_workflow_path.name, "error": str(ts_error)}],
            }
        ts_deleted_paths.append(ts_workflow_path.name)
        # Sidecars stay best-effort: the workflow itself is already gone, so a
        # stubborn preview must not turn the whole call into a failure.
        for ts_target_path in ts_sidecars:
            if not ts_target_path.exists():
                continue
            try:
                self.ts_send_to_trash(str(ts_target_path))
            except Exception as ts_error:
                ts_failed_paths.append({"name": ts_target_path.name, "error": str(ts_error)})
                continue
            ts_deleted_paths.append(ts_target_path.name)
        return {"deleted": ts_deleted_paths, "failed": ts_failed_paths}

    def TSDeleteRequestWorkflowFile(self, ts_request, ts_relative_path: str) -> dict[str, Any]:
        return self.TSDeleteWorkflowFile(self.TSResolveRequestWorkflowPath(ts_request, ts_relative_path))
