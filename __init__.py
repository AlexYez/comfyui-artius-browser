from __future__ import annotations

from .tsab.ts_nodes import TSArtiusBrowserExtension
from .tsab.ts_runtime import TSGetRuntime

WEB_DIRECTORY = "./js"

TSRuntime = TSGetRuntime()
TSRuntime.TSBootstrap()


async def comfy_entrypoint():
    TSRuntime.TSStart()
    return TSArtiusBrowserExtension()


__all__ = ["WEB_DIRECTORY", "comfy_entrypoint"]