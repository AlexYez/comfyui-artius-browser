from __future__ import annotations

try:
    from typing import override
except ImportError:
    from typing_extensions import override

from comfy_api.v0_0_2 import ComfyExtension as TSComfyExtension, IO as TSIO


class TSArtiusBrowserExtension(TSComfyExtension):
    @override
    async def get_node_list(self) -> list[type[TSIO.ComfyNode]]:
        return []
