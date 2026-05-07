"""pytest fixtures for integration tests against a live ComfyUI server.

The tests assume ComfyUI is already running with this pack installed.
The default URL is `http://127.0.0.1:8188` and can be overridden via the
`TS_COMFY_URL` environment variable.

In CI, `.github/workflows/e2e.yml` starts ComfyUI in CPU mode before
running pytest.
"""

from __future__ import annotations

import os

import pytest


@pytest.fixture(scope="session")
def comfy_url() -> str:
    return os.environ.get("TS_COMFY_URL", "http://127.0.0.1:8188").rstrip("/")
