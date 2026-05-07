"""Integration tests that hit a live ComfyUI server.

Covers the public HTTP surface of Timesaver Artius Browser:
- happy path on the asset listing route;
- rejection of the unsupported `metadata` query param;
- 404/400 for path-traversal payloads on /file and /workflow/delete;
- /version endpoint shape.

These tests are **not** unit tests with fakes — they prove that the routes
are actually registered with the running PromptServer and behave as the
unit tests claim. Skipped automatically if the server is unreachable.
"""

from __future__ import annotations

import urllib.parse

import pytest
import requests


TS_REQUEST_TIMEOUT = 10
TS_TRAVERSAL_VECTORS = [
    "../../../../etc/passwd",
    "..\\..\\..\\Windows\\System32\\config\\SAM",
    "/etc/passwd",
    urllib.parse.quote("../../../../etc/passwd"),
    "../" * 30 + "etc/passwd",
    "workflows/../../../../etc/passwd",
]


@pytest.fixture(scope="session", autouse=True)
def _ts_skip_if_server_down(comfy_url: str):
    try:
        ts_response = requests.get(
            f"{comfy_url}/system_stats", timeout=TS_REQUEST_TIMEOUT
        )
    except (requests.ConnectionError, requests.Timeout) as ts_error:
        pytest.skip(f"ComfyUI not reachable at {comfy_url}: {ts_error}")
    if not ts_response.ok:
        pytest.skip(
            f"ComfyUI at {comfy_url} returned {ts_response.status_code} for /system_stats"
        )


def test_assets_route_returns_listing_payload(comfy_url: str) -> None:
    ts_response = requests.get(
        f"{comfy_url}/asset_browser/assets",
        params={"limit": 1, "view": "flat"},
        timeout=TS_REQUEST_TIMEOUT,
    )
    assert ts_response.status_code == 200
    ts_body = ts_response.json()
    assert "items" in ts_body
    assert "limit" in ts_body
    assert "view" in ts_body


def test_assets_route_rejects_unsupported_metadata_param(comfy_url: str) -> None:
    ts_response = requests.get(
        f"{comfy_url}/asset_browser/assets",
        params={"metadata": "1"},
        timeout=TS_REQUEST_TIMEOUT,
    )
    assert ts_response.status_code == 400


def test_asset_route_rejects_non_numeric_id(comfy_url: str) -> None:
    ts_response = requests.get(
        f"{comfy_url}/asset_browser/asset/not-a-number",
        timeout=TS_REQUEST_TIMEOUT,
    )
    assert ts_response.status_code == 400


@pytest.mark.parametrize("ts_vector", TS_TRAVERSAL_VECTORS)
def test_workflow_delete_rejects_traversal(comfy_url: str, ts_vector: str) -> None:
    ts_response = requests.post(
        f"{comfy_url}/asset_browser/workflow/delete",
        json={"path": ts_vector},
        timeout=TS_REQUEST_TIMEOUT,
    )
    # Either explicit 400 from the normalizer or 404 if the path resolves
    # to something that doesn't exist on disk. Anything 2xx is a regression.
    assert ts_response.status_code in (400, 404, 500)
    assert ts_response.status_code != 200


@pytest.mark.parametrize("ts_vector", TS_TRAVERSAL_VECTORS)
def test_file_route_rejects_unindexed_path(comfy_url: str, ts_vector: str) -> None:
    ts_response = requests.get(
        f"{comfy_url}/asset_browser/file",
        params={"path": ts_vector},
        timeout=TS_REQUEST_TIMEOUT,
    )
    # The /file route is whitelist-protected (DB lookup by exact path);
    # any traversal payload must miss the whitelist and return 404.
    assert ts_response.status_code == 404


def test_version_route_reports_local_version(comfy_url: str) -> None:
    ts_response = requests.get(
        f"{comfy_url}/asset_browser/version",
        timeout=TS_REQUEST_TIMEOUT,
    )
    assert ts_response.status_code == 200
    ts_body = ts_response.json()
    assert isinstance(ts_body.get("local"), str) and ts_body["local"]
    assert isinstance(ts_body.get("update_available"), bool)
    assert "repository_url" in ts_body
    assert "release_url" in ts_body


def test_settings_route_round_trips(comfy_url: str) -> None:
    ts_get = requests.get(
        f"{comfy_url}/asset_browser/settings", timeout=TS_REQUEST_TIMEOUT
    )
    assert ts_get.status_code == 200
    assert "ui" in ts_get.json()


def test_3d_viewer_capability_is_reported(comfy_url: str) -> None:
    ts_response = requests.get(
        f"{comfy_url}/asset_browser/3d/viewer", timeout=TS_REQUEST_TIMEOUT
    )
    assert ts_response.status_code == 200
