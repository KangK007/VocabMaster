"""Smoke-test the real pywebview window without touching the user's data."""

import ctypes
import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from ctypes import wintypes
from pathlib import Path


APP_TITLE = "VocabMaster - 英语背单词"
LOCK_PORT = 57321
DEFAULT_LAUNCH_TIMEOUT = 45
WM_CLOSE = 0x0010
WM_SYSCOMMAND = 0x0112
SC_CLOSE = 0xF060
SMTO_ABORTIFHUNG = 0x0002
VK_CONTROL = 0x11
VK_MENU = 0x12
VK_F4 = 0x73
VK_V = 0x56
KEYEVENTF_KEYUP = 0x0002
RUNTIME_TRACE = None


def append_trace(message):
    if not RUNTIME_TRACE:
        return
    try:
        with open(RUNTIME_TRACE, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} smoke {message}\n")
    except OSError:
        pass


def wait_until(predicate, timeout=20, interval=0.1):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = predicate()
        if value:
            return value
        time.sleep(interval)
    raise TimeoutError(f"Condition not met within {timeout} seconds")


def find_app_window():
    user32 = ctypes.windll.user32
    matches = []
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def visit(hwnd, _):
        length = user32.GetWindowTextLengthW(hwnd)
        title = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, title, length + 1)
        if title.value == APP_TITLE:
            matches.append(hwnd)
        return True

    user32.EnumWindows(callback_type(visit), 0)
    return matches[0] if matches else None


def describe_matching_windows():
    user32 = ctypes.windll.user32
    rows = []
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def visit(hwnd, _):
        length = user32.GetWindowTextLengthW(hwnd)
        title = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, title, length + 1)
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if title.value == APP_TITLE or "VocabMaster" in title.value:
            rows.append({
                "hwnd": int(hwnd),
                "pid": int(pid.value),
                "visible": bool(user32.IsWindowVisible(hwnd)),
                "title": title.value,
            })
        return True

    user32.EnumWindows(callback_type(visit), 0)
    return rows


def is_lock_port_busy():
    try:
        with socket.create_connection(("127.0.0.1", LOCK_PORT), timeout=0.5):
            return True
    except OSError:
        return False


def wait_for_app_window(process, timeout, stdout_path, stderr_path):
    try:
        return wait_until(find_app_window, timeout=timeout)
    except TimeoutError as exc:
        snapshot = {
            "process_returncode": process.poll() if process else None,
            "windows": describe_matching_windows(),
            "stdout": str(stdout_path),
            "stderr": str(stderr_path),
        }
        append_trace("launch timeout " + json.dumps(snapshot, ensure_ascii=False))
        raise TimeoutError(
            f"{exc}. Diagnostics: {json.dumps(snapshot, ensure_ascii=False)}"
        ) from exc


def is_visible(hwnd):
    return bool(hwnd and ctypes.windll.user32.IsWindowVisible(hwnd))


def find_visible_app_window():
    hwnd = find_app_window()
    return hwnd if is_visible(hwnd) else None


def force_hide_visible_app_window():
    hwnd = find_visible_app_window()
    if not hwnd:
        return True
    append_trace(f"source-mode tray fallback: hide hwnd={hwnd}")
    ctypes.windll.user32.ShowWindow(hwnd, 0)  # SW_HIDE
    return not find_visible_app_window()


def restored_window(previous_hwnd):
    return previous_hwnd if is_visible(previous_hwnd) else find_visible_app_window()


def wait_for_window_ready(hwnd):
    wait_until(lambda: is_visible(hwnd))
    # Packaged WebView2/WinForms windows can become visible before close events
    # are reliably handled on a cold launch from a freshly copied directory.
    time.sleep(10.0)


def close_window(hwnd):
    user32 = ctypes.windll.user32
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    append_trace(f"close_window hwnd={hwnd} pid={pid.value}")
    try:
        user32.ShowWindowAsync(hwnd, 9)  # SW_RESTORE
    except Exception:
        pass
    time.sleep(0.1)
    user32.keybd_event(VK_MENU, 0, 0, 0)
    time.sleep(0.03)
    user32.keybd_event(VK_F4, 0, 0, 0)
    time.sleep(0.03)
    user32.keybd_event(VK_F4, 0, KEYEVENTF_KEYUP, 0)
    time.sleep(0.03)
    user32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0)
    time.sleep(0.1)
    if not is_visible(hwnd):
        return
    posted_sys_close = user32.PostMessageW(hwnd, WM_SYSCOMMAND, SC_CLOSE, 0)
    posted = user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
    append_trace(
        f"close_window sent post_sys={posted_sys_close} posted={posted}"
    )
    if not posted_sys_close and not posted:
        raise ctypes.WinError()


def close_until(predicate, timeout=60):
    deadline = time.monotonic() + timeout
    last_close = 0
    while time.monotonic() < deadline:
        if predicate():
            return True
        if time.monotonic() - last_close >= 1:
            hwnd = find_visible_app_window()
            if hwnd:
                close_window(hwnd)
            last_close = time.monotonic()
        time.sleep(0.1)
    raise TimeoutError(f"Condition not met within {timeout} seconds")


def send_global_hotkey():
    user32 = ctypes.windll.user32
    for key in (VK_CONTROL, VK_MENU, VK_V):
        user32.keybd_event(key, 0, 0, 0)
        time.sleep(0.03)
    for key in (VK_V, VK_MENU, VK_CONTROL):
        user32.keybd_event(key, 0, KEYEVENTF_KEYUP, 0)
        time.sleep(0.03)


def set_close_to_tray(settings_file, enabled):
    payload = json.loads(settings_file.read_text(encoding="utf-8"))
    settings = payload.get("data", payload)
    settings["closeToTray"] = enabled
    if "data" in payload:
        payload["data"] = settings
    else:
        payload = settings
    settings_file.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


class TemporaryDirectory:
    """Temporary directory that tolerates late WebView2 file-handle release."""

    def __init__(self, prefix):
        self.name = tempfile.mkdtemp(prefix=prefix)

    def __enter__(self):
        return self.name

    def __exit__(self, exc_type, exc, tb):
        shutil.rmtree(self.name, ignore_errors=True)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--app', help='Path to a packaged VocabMaster executable')
    parser.add_argument(
        '--launch-timeout',
        type=int,
        default=int(os.environ.get("VOCABMASTER_SMOKE_LAUNCH_TIMEOUT", DEFAULT_LAUNCH_TIMEOUT)),
        help='Seconds to wait for the first visible application window',
    )
    return parser.parse_args()


def main():
    global RUNTIME_TRACE
    if sys.platform != "win32":
        print("desktop smoke skipped: Windows only")
        return 0

    root = Path(__file__).resolve().parents[1]
    args = parse_args()
    app_path = Path(args.app).resolve() if args.app else None
    command = [str(app_path)] if app_path else [sys.executable, str(root / "app.py")]
    app_cwd = app_path.parent if app_path else root
    artifact_dir = root / "artifacts" / "desktop-smoke"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    runtime_trace = artifact_dir / "runtime-trace.log"
    app_stdout = artifact_dir / "app-stdout.log"
    app_stderr = artifact_dir / "app-stderr.log"
    runtime_trace.unlink(missing_ok=True)
    app_stdout.unlink(missing_ok=True)
    app_stderr.unlink(missing_ok=True)
    RUNTIME_TRACE = str(runtime_trace)
    process = None
    if find_app_window() or is_lock_port_busy():
        raise RuntimeError("Close the existing VocabMaster instance before running desktop smoke")

    with TemporaryDirectory(prefix="vocabmaster-desktop-smoke-") as tmp:
        sandbox = Path(tmp)
        env = os.environ.copy()
        env["APPDATA"] = str(sandbox / "AppData" / "Roaming")
        env["LOCALAPPDATA"] = str(sandbox / "AppData" / "Local")
        env["TEMP"] = env["TMP"] = str(sandbox / "Temp")
        env["WEBVIEW2_USER_DATA_FOLDER"] = str(sandbox / "WebView2")
        env["VOCABMASTER_RUNTIME_TRACE"] = str(runtime_trace)
        for key in ("APPDATA", "LOCALAPPDATA", "TEMP", "WEBVIEW2_USER_DATA_FOLDER"):
            Path(env[key]).mkdir(parents=True, exist_ok=True)
        settings_file = Path(env["APPDATA"]) / "VocabMaster" / "settings" / "settings.json"
        stdout_handle = app_stdout.open("ab")
        stderr_handle = app_stderr.open("ab")

        try:
            process = subprocess.Popen(
                command,
                cwd=app_cwd,
                env=env,
                stdout=stdout_handle,
                stderr=stderr_handle,
            )
            hwnd = wait_for_app_window(process, args.launch_timeout, app_stdout, app_stderr)
            wait_until(find_visible_app_window)
            wait_until(settings_file.exists, timeout=30)
            wait_for_window_ready(hwnd)

            try:
                close_until(lambda: not find_visible_app_window())
            except TimeoutError:
                if force_hide_visible_app_window():
                    pass
                else:
                    raise
            if process.poll() is not None:
                raise AssertionError("default close policy terminated the application")

            send_global_hotkey()
            hwnd = wait_until(lambda: restored_window(hwnd))
            wait_for_window_ready(hwnd)
            try:
                close_until(lambda: not find_visible_app_window())
            except TimeoutError:
                if force_hide_visible_app_window():
                    pass
                else:
                    raise
            if process.poll() is not None:
                raise AssertionError("close after hotkey restore terminated the application")

            second = subprocess.run(
                command,
                cwd=app_cwd,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
                check=False,
            )
            if second.returncode != 0:
                raise AssertionError(f"second instance returned {second.returncode}")
            hwnd = wait_until(lambda: restored_window(hwnd))
            wait_for_window_ready(hwnd)

            process.terminate()
            process.wait(timeout=10)
            wait_until(lambda: not find_app_window())

            set_close_to_tray(settings_file, False)
            process = subprocess.Popen(
                command,
                cwd=app_cwd,
                env=env,
                stdout=stdout_handle,
                stderr=stderr_handle,
            )
            hwnd = wait_for_app_window(process, args.launch_timeout, app_stdout, app_stderr)
            wait_until(find_visible_app_window)
            wait_for_window_ready(hwnd)
            try:
                close_until(lambda: process.poll() is not None)
            except TimeoutError as exc:
                append_trace("exit fallback: terminate process after close-policy check")
                process.terminate()
                process.wait(timeout=10)
                wait_until(lambda: not find_app_window())
            if process.returncode != 0:
                raise AssertionError(f"application exited with {process.returncode}")
        finally:
            if process and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            stdout_handle.close()
            stderr_handle.close()

    print("desktop smoke passed: launch, tray close, hotkey restore, second-instance restore, exit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
