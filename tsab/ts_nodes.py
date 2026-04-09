from __future__ import annotations

from typing_extensions import override

from comfy_api.latest import ComfyExtension as TSComfyExtension, IO as TSIO


class TSArtiusBrowserExtension(TSComfyExtension):
    @override
    async def get_node_list(self) -> list[type[TSIO.ComfyNode]]:
        return []
