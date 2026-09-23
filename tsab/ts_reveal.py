from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path

from .ts_logging import TSLogVerbose

TSLogger = logging.getLogger(__name__)

# How long we wait for the launcher to hand off to the file manager. The
# launchers (explorer.exe, open, dbus-send, xdg-open) return as soon as the
# request is delivered; the file manager itself keeps running, and a launcher
# that outlives this is left alone rather than killed with it.
TS_REVEAL_LAUNCH_TIMEOUT_SECONDS = 10

TS_MACOS_OPEN = "/usr/bin/open"


def _TSWindowsExplorerPath() -> str:
    # Full path, not PATH lookup: what is on the user's PATH is not ours to
    # depend on.
    ts_system_root = os.environ.get("SystemRoot") or os.environ.get("windir") or r"C:\Windows"
    return str(Path(ts_system_root) / "explorer.exe")


def TSBuildRevealCommands(ts_file_path: Path, ts_platform: str | None = None) -> list[list[str]]:
    """The commands to try, in order, to show ``ts_file_path`` selected in the
    system file manager. Argument lists only - never a shell string."""
    ts_platform = ts_platform or sys.platform
    ts_path_text = str(ts_file_path)
    if ts_platform.startswith("win"):
        # "/select," and the path as SEPARATE arguments: joined into one they
        # get quoted as a single token, which explorer does not parse for a
        # path with spaces and silently opens "Documents" instead.
        return [[_TSWindowsExplorerPath(), "/select,", ts_path_text]]
    if ts_platform == "darwin":
        return [[TS_MACOS_OPEN, "-R", ts_path_text]]
    ts_commands: list[list[str]] = []
    ts_dbus_send = shutil.which("dbus-send")
    if ts_dbus_send:
        # The freedesktop FileManager1 interface is the only portable way to
        # get the file SELECTED (Nautilus, Dolphin, Nemo, Thunar, Caja...).
        ts_commands.append([
            ts_dbus_send,
            "--session",
            "--print-reply",
            "--dest=org.freedesktop.FileManager1",
            "--type=method_call",
            "/org/freedesktop/FileManager1",
            "org.freedesktop.FileManager1.ShowItems",
            f"array:string:{ts_file_path.as_uri()}",
            "string:",
        ])
    ts_xdg_open = shutil.which("xdg-open")
    if ts_xdg_open:
        # Fallback: the folder opens, without the selection.
        ts_commands.append([ts_xdg_open, str(ts_file_path.parent)])
    return ts_commands


def _TSRunLauncher(ts_command: list[str], ts_check_exit_code: bool) -> bool:
    try:
        ts_process = subprocess.Popen(
            ts_command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False,
        )
    except OSError:
        TSLogger.warning("TS reveal launcher could not start: %s", ts_command[0], exc_info=True)
        return False
    try:
        ts_return_code = ts_process.wait(timeout=TS_REVEAL_LAUNCH_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        # Still running means it got as far as starting something.
        return True
    return ts_return_code == 0 or not ts_check_exit_code


def TSRevealInFileManager(ts_file_path: Path, ts_platform: str | None = None) -> bool:
    ts_platform = ts_platform or sys.platform
    ts_commands = TSBuildRevealCommands(ts_file_path, ts_platform)
    # explorer.exe answers 1 even when the window opened, so its exit code
    # carries no information; everywhere else a non-zero code means the next
    # launcher should get a turn.
    ts_check_exit_code = not ts_platform.startswith("win")
    for ts_command in ts_commands:
        if _TSRunLauncher(ts_command, ts_check_exit_code):
            TSLogVerbose("reveal.launched", launcher=Path(ts_command[0]).name)
            return True
    TSLogVerbose("reveal.failed", platform=ts_platform, launchers=len(ts_commands))
    return False
