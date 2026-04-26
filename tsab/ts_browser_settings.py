from __future__ import annotations

from typing import Any

from .ts_ui_settings import TSApplyUISettingsUpdates, TSNormalizeUISettings


class TSBrowserSettingsService:
    def __init__(self, ts_config_store) -> None:
        self.ts_config_store = ts_config_store

    def TSIsAutoscanEnabled(self) -> bool:
        ts_config = self.ts_config_store.TSLoadConfig()
        return bool(ts_config.get("ui", {}).get("autoscan", True))

    def TSGetUISettings(self) -> dict[str, Any]:
        ts_config = self.ts_config_store.TSLoadConfig()
        return TSNormalizeUISettings(ts_config.get("ui", {}))

    def TSSaveUISettings(self, ts_ui_updates: dict[str, Any] | None) -> dict[str, Any]:
        ts_config = self.ts_config_store.TSLoadConfig()
        ts_ui = ts_config.setdefault("ui", {})
        TSApplyUISettingsUpdates(ts_ui, ts_ui_updates)
        ts_saved_config = self.ts_config_store.TSSaveConfig(ts_config)
        return TSNormalizeUISettings(ts_saved_config.get("ui", {}))
