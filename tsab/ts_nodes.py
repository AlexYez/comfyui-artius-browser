from __future__ import annotations

try:
    from typing import override
except ImportError:
    from typing_extensions import override

from comfy_api.v0_0_2 import ComfyExtension as TSComfyExtension, IO as TSIO

from .ts_runtime import TSGetRuntime


class TSArtiusBrowserExtension(TSComfyExtension):
    @override
    async def on_load(self) -> None:
        # ComfyUI's designated one-time initialization hook, awaited once per
        # process right after comfy_entrypoint() and still before the HTTP
        # server starts serving, so routes register in time. Keeping this out
        # of module import means importing the package never touches the disk.
        # TSBootstrap is idempotent, so a host that calls on_load twice is safe.
        TSGetRuntime().TSBootstrap()

    @override
    async def get_node_list(self) -> list[type[TSIO.ComfyNode]]:
        return []
