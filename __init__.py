from __future__ import annotations

from .tsab.ts_nodes import TSArtiusBrowserExtension

WEB_DIRECTORY = "./js"


async def comfy_entrypoint():
    # Importing this package must stay side-effect free: the runtime (storage
    # directories, SQLite connection, route table, scan service) is built in
    # TSArtiusBrowserExtension.on_load(), which ComfyUI awaits right after this
    # function returns.
    return TSArtiusBrowserExtension()


__all__ = ["WEB_DIRECTORY", "comfy_entrypoint"]
