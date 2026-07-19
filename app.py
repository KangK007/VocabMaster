"""
VocabMaster - 英语背单词桌面应用
使用 pywebview + HTML/CSS/JS 构建
"""
import webview
import json
import os
import sys
import socket
import ctypes
from ctypes import wintypes
import tempfile
import shutil
import subprocess
import threading
import queue
from datetime import datetime
from pathlib import Path

import pystray
from PIL import Image, ImageDraw

# Hide console window when running via python.exe (not pythonw.exe)
if sys.platform == 'win32' and sys.executable.lower().endswith('python.exe'):
    try:
        ctypes.windll.kernel32.FreeConsole()
    except Exception:
        pass


class GlobalHotkey:
    """Windows global hotkey via RegisterHotKey + message pump."""

    MOD_MAP = {'Alt': 0x0001, 'Ctrl': 0x0002, 'Shift': 0x0004, 'Win': 0x0008}
    WM_HOTKEY = 0x0312

    PM_REMOVE = 0x0001

    def __init__(self, user32=None, poll_interval=0.05):
        self._id = 1
        self._user32 = user32 or ctypes.windll.user32
        self._poll_interval = poll_interval
        self._registered = False
        self._modifiers = 0
        self._key = 0
        self._callback = None
        self._running = False
        self._thread = None
        self._ready = threading.Event()
        self._commands = queue.Queue()

    def _parse_hotkey(self, modifiers, key):
        mod = 0
        for m in modifiers:
            mod |= self.MOD_MAP.get(m, 0)
        vk = ord(key.upper()) if len(key) == 1 and key.isalpha() else 0
        return mod, vk

    def _register_on_worker(self, modifiers, key, callback):
        mod, vk = self._parse_hotkey(modifiers, key)
        if vk == 0:
            return False

        previous = (self._modifiers, self._key, self._callback) if self._registered else None
        if self._registered:
            self._user32.UnregisterHotKey(None, self._id)
            self._registered = False

        if self._user32.RegisterHotKey(None, self._id, mod, vk):
            self._modifiers = mod
            self._key = vk
            self._callback = callback
            self._registered = True
            return True

        if previous and self._user32.RegisterHotKey(None, self._id, previous[0], previous[1]):
            self._modifiers, self._key, self._callback = previous
            self._registered = True
        return False

    def start(self, modifiers, key, callback):
        """Start the worker that both registers and processes this hotkey."""
        if self._thread and self._thread.is_alive():
            return self.update(modifiers, key, callback)

        self._commands = queue.Queue()
        self._ready.clear()
        self._running = True
        self._initial_config = (list(modifiers), key, callback)
        self._thread = threading.Thread(target=self._message_loop, daemon=True)
        self._thread.start()
        self._ready.wait(timeout=2)
        return self._registered

    def update(self, modifiers, key, callback):
        if not self._thread or not self._thread.is_alive():
            return self.start(modifiers, key, callback)
        completed = threading.Event()
        result = {}
        self._commands.put(('update', list(modifiers), key, callback, completed, result))
        completed.wait(timeout=2)
        return result.get('success', False)

    def _message_loop(self):
        modifiers, key, callback = self._initial_config
        self._register_on_worker(modifiers, key, callback)
        self._ready.set()
        msg = wintypes.MSG()

        while self._running:
            while self._user32.PeekMessageW(
                ctypes.byref(msg), None, 0, 0, self.PM_REMOVE
            ):
                if msg.message == self.WM_HOTKEY and msg.wParam == self._id and self._callback:
                    try:
                        self._callback()
                    except Exception:
                        pass
                self._user32.TranslateMessage(ctypes.byref(msg))
                self._user32.DispatchMessageW(ctypes.byref(msg))

            try:
                command = self._commands.get(timeout=self._poll_interval)
            except queue.Empty:
                continue

            if command[0] == 'stop':
                self._running = False
                command[1].set()
                continue
            _, modifiers, key, callback, completed, result = command
            result['success'] = self._register_on_worker(modifiers, key, callback)
            completed.set()

        if self._registered:
            self._user32.UnregisterHotKey(None, self._id)
        self._registered = False

    def is_registered(self):
        return self._registered

    def stop(self):
        if not self._thread or not self._thread.is_alive():
            self._running = False
            self._registered = False
            return
        completed = threading.Event()
        self._commands.put(('stop', completed))
        completed.wait(timeout=2)
        self._thread.join(timeout=2)


class ReminderScheduler:
    """Check every 30s whether to fire a reminder toast."""

    def __init__(self):
        self._enabled = False
        self._reminder_time = '20:00'
        self._running = False
        self._app_in_use = False
        self._fired_today = False
        self._last_fire_date = None
        self._stop_event = threading.Event()

    def configure(self, enabled, reminder_time):
        self._enabled = enabled
        self._reminder_time = reminder_time
        self._fired_today = False

    def set_in_use(self, in_use):
        self._app_in_use = in_use

    def start(self):
        self._stop_event.clear()
        self._running = True

    def stop(self):
        self._running = False
        self._stop_event.set()

    def _is_goal_completed(self, api, today=None):
        try:
            stats = api.get_stats()
            settings = api.get_settings()
            today = today or datetime.now().strftime('%Y-%m-%d')
            studied = (stats.get('daily', {}).get(today, {}) or {}).get('studied', 0)
            goal = settings.get('dailyGoal', 30)
            return studied >= goal
        except Exception:
            return False

    def check_once(self, api, show_window, now=None):
        """Evaluate one reminder interval; ``now`` is injectable for tests."""
        now = now or datetime.now()
        today_str = now.strftime('%Y-%m-%d')

        if self._last_fire_date != today_str:
            self._fired_today = False
            self._last_fire_date = today_str

        if not self._enabled or self._fired_today or self._app_in_use:
            return

        target_h, target_m = map(int, self._reminder_time.split(':'))
        current_minutes = now.hour * 60 + now.minute
        target_minutes = target_h * 60 + target_m
        if target_minutes <= current_minutes < target_minutes + 30:
            if not self._is_goal_completed(api, today=today_str):
                self._send_notification(api, show_window)
            self._fired_today = True

    def run(self, api, show_window):
        """Run in daemon thread. Sleep 30s between checks."""
        while self._running:
            try:
                self.check_once(api, show_window)
            except Exception:
                pass
            self._stop_event.wait(30)

    def _send_notification(self, api, show_window):
        try:
            from windows_toasts import WindowsToaster, Toast
            toaster = WindowsToaster('VocabMaster')
            toast = Toast()
            toast.text_fields = ['📚 学习提醒', '该背单词了！今天的目标还没完成，打开 VocabMaster 继续学习吧。']
            toast.on_click = show_window
            toaster.show_toast(toast)
        except Exception:
            pass


__version__ = '2.0.0'

BASE_DIR = Path(__file__).parent
SRC_DIR = BASE_DIR / 'src'
WORDS_DIR = SRC_DIR / 'words'
LEGACY_DATA_DIR = BASE_DIR / 'data'


def get_default_data_dir():
    """Return per-user data storage, with opt-in portable mode for local copies."""
    if os.environ.get('VOCABMASTER_PORTABLE') == '1':
        return LEGACY_DATA_DIR
    if sys.platform == 'win32':
        return Path(os.environ.get('APPDATA', str(Path.home()))) / 'VocabMaster'
    if sys.platform == 'darwin':
        return Path.home() / 'Library' / 'Application Support' / 'VocabMaster'
    return Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local' / 'share')) / 'VocabMaster'


DATA_DIR = get_default_data_dir()
WORDS_DATA_DIR = DATA_DIR / 'words'
PROGRESS_DIR = DATA_DIR / 'progress'
STATS_DIR = DATA_DIR / 'stats'
SETTINGS_DIR = DATA_DIR / 'settings'
FAVORITES_DIR = DATA_DIR / 'favorites'
BACKUPS_DIR = DATA_DIR / 'backups'
VALID_CATEGORIES = {'cet4', 'cet6', 'postgraduate', 'ielts', 'toefl', 'custom'}
DATA_SCHEMA_VERSION = 1
BACKUP_RETENTION = 20

# Single-instance lock
LOCK_PORT = 57321  # Unique port for VocabMaster
INSTANCE_SHOW_COMMAND = b'show'
INSTANCE_ACK = b'ok'
APP_TITLE = 'VocabMaster - 英语背单词'
APP_NAME = 'VocabMaster'


def _startup_shortcut_path():
    if sys.platform != 'win32':
        return None
    appdata = os.environ.get('APPDATA')
    if not appdata:
        return None
    return Path(appdata) / 'Microsoft' / 'Windows' / 'Start Menu' / 'Programs' / 'Startup' / f'{APP_NAME}.lnk'


def _ps_quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def _startup_launch_config():
    if getattr(sys, 'frozen', False):
        target = Path(sys.executable)
        return {
            'target': target,
            'arguments': '--minimized',
            'working_dir': target.parent,
            'icon': target,
        }
    launcher = BASE_DIR / 'launch_startup.bat'
    return {
        'target': launcher,
        'arguments': '',
        'working_dir': BASE_DIR,
        'icon': BASE_DIR / 'assets' / 'icon.ico',
    }


def get_startup_status():
    shortcut = _startup_shortcut_path()
    if not shortcut:
        return {'available': False, 'enabled': False, 'path': None}
    return {'available': True, 'enabled': shortcut.exists(), 'path': str(shortcut)}


def set_startup_enabled(enabled):
    shortcut = _startup_shortcut_path()
    if not shortcut:
        return {
            'success': False,
            'available': False,
            'enabled': False,
            'message': '开机自启仅支持 Windows 当前用户环境',
        }

    if not enabled:
        try:
            if shortcut.exists():
                shortcut.unlink()
            return {'success': True, 'available': True, 'enabled': False, 'path': str(shortcut)}
        except Exception as exc:
            return {'success': False, 'available': True, 'enabled': shortcut.exists(), 'message': str(exc)}

    config = _startup_launch_config()
    target = config['target']
    if not target.exists():
        return {
            'success': False,
            'available': True,
            'enabled': shortcut.exists(),
            'message': f'启动入口不存在：{target}',
        }

    try:
        shortcut.parent.mkdir(parents=True, exist_ok=True)
        ps_script = f"""
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut({_ps_quote(shortcut)})
$Shortcut.TargetPath = {_ps_quote(target)}
$Shortcut.Arguments = {_ps_quote(config['arguments'])}
$Shortcut.WorkingDirectory = {_ps_quote(config['working_dir'])}
$Shortcut.IconLocation = {_ps_quote(config['icon'])}
$Shortcut.WindowStyle = 7
$Shortcut.Description = 'VocabMaster - 开机自启'
$Shortcut.Save()
Write-Output 'OK'
"""
        result = subprocess.run(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps_script],
            capture_output=True,
            text=True,
            timeout=30,
        )
        success = result.returncode == 0 and shortcut.exists()
        return {
            'success': success,
            'available': True,
            'enabled': shortcut.exists(),
            'path': str(shortcut),
            'message': '开机自启已开启' if success else (result.stderr.strip() or '创建开机自启快捷方式失败'),
        }
    except Exception as exc:
        return {'success': False, 'available': True, 'enabled': shortcut.exists(), 'message': str(exc)}


def acquire_single_instance_lock():
    """Try to acquire a socket-based lock. Returns True if this is the first instance."""
    global _lock_socket
    try:
        _lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _lock_socket.bind(('127.0.0.1', LOCK_PORT))
        _lock_socket.listen(1)
        return True
    except socket.error:
        # Port is already in use - another instance is running
        # Try to notify the existing instance to show its window.
        try:
            with socket.create_connection(('127.0.0.1', LOCK_PORT), timeout=2) as sock:
                sock.sendall(INSTANCE_SHOW_COMMAND)
                ack = sock.recv(len(INSTANCE_ACK))
                if ack == INSTANCE_ACK:
                    activate_window_by_title()
        except Exception:
            pass
        return False


def start_single_instance_listener(show_window):
    """Accept notifications from later launches and bring this window forward."""
    def listen():
        while True:
            try:
                conn, _ = _lock_socket.accept()
            except OSError:
                break
            with conn:
                try:
                    conn.settimeout(2)
                    command = b''
                    while len(command) < len(INSTANCE_SHOW_COMMAND):
                        chunk = conn.recv(len(INSTANCE_SHOW_COMMAND) - len(command))
                        if not chunk:
                            break
                        command += chunk
                    if command != INSTANCE_SHOW_COMMAND:
                        continue
                    activate_window_by_title()
                    threading.Thread(target=show_window, daemon=True).start()
                    conn.sendall(INSTANCE_ACK)
                except OSError:
                    continue

    threading.Thread(target=listen, daemon=True).start()


def find_window_handle_by_title(title=APP_TITLE):
    if sys.platform != 'win32':
        return None
    try:
        user32 = ctypes.windll.user32
        matches = []
        callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

        def visit(hwnd, _):
            length = user32.GetWindowTextLengthW(hwnd)
            if length <= 0:
                return True
            buffer = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buffer, length + 1)
            if buffer.value == title:
                matches.append(hwnd)
                return False
            return True

        user32.EnumWindows(callback_type(visit), 0)
        return matches[0] if matches else None
    except Exception:
        return None


def activate_window_handle(hwnd):
    """Best-effort Win32 fallback for restoring the existing desktop window."""
    if sys.platform != 'win32' or not hwnd:
        return False
    try:
        user32 = ctypes.windll.user32
        if not user32.IsWindow(hwnd):
            return False
        user32.ShowWindow(hwnd, 5)  # SW_SHOW
        user32.ShowWindow(hwnd, 9)  # SW_RESTORE
        user32.BringWindowToTop(hwnd)
        user32.SetForegroundWindow(hwnd)
        return True
    except Exception:
        return False


def activate_window_by_title(title=APP_TITLE):
    return activate_window_handle(find_window_handle_by_title(title))


def hide_window_handle(hwnd):
    if sys.platform != 'win32' or not hwnd:
        return False
    try:
        user32 = ctypes.windll.user32
        if not user32.IsWindow(hwnd):
            return False
        user32.ShowWindow(hwnd, 0)  # SW_HIDE
        return True
    except Exception:
        return False


def hide_window_by_title(title=APP_TITLE):
    """Best-effort Win32 hide that keeps tray-close behavior consistent."""
    return hide_window_handle(find_window_handle_by_title(title))


def write_runtime_trace(message):
    trace_path = os.environ.get('VOCABMASTER_RUNTIME_TRACE')
    if not trace_path:
        return
    try:
        with open(trace_path, 'a', encoding='utf-8') as f:
            f.write(f"{datetime.now().isoformat()} {message}\n")
    except Exception:
        pass


def ensure_dirs():
    for d in [DATA_DIR, WORDS_DATA_DIR, PROGRESS_DIR, STATS_DIR, SETTINGS_DIR, FAVORITES_DIR, BACKUPS_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def migrate_legacy_data():
    """Copy repository-local data to the user data directory on first run."""
    if DATA_DIR == LEGACY_DATA_DIR or not LEGACY_DATA_DIR.exists() or DATA_DIR.exists():
        return
    try:
        shutil.copytree(str(LEGACY_DATA_DIR), str(DATA_DIR))
    except Exception as e:
        print(f"Error migrating data: {e}")


def _read_json_raw(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def read_json(filepath, fallback=None):
    try:
        if os.path.exists(filepath):
            return _read_json_raw(filepath)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
    return fallback if fallback is not None else {}


def write_json(filepath, data):
    """Atomically write JSON data to file (write to temp, then rename)."""
    try:
        dirpath = os.path.dirname(filepath)
        os.makedirs(dirpath, exist_ok=True)
        fd, tmppath = tempfile.mkstemp(dir=dirpath, suffix='.json')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmppath, filepath)  # Atomic on Windows
        return True
    except Exception as e:
        print(f"Error writing {filepath}: {e}")
        return False


def _wrap_data(data):
    return {
        'schemaVersion': DATA_SCHEMA_VERSION,
        'data': data
    }


def _unwrap_data(raw, fallback):
    if isinstance(raw, dict) and 'schemaVersion' in raw and 'data' in raw:
        return raw.get('data', fallback)
    return raw


def _iter_backup_files():
    if not BACKUPS_DIR.exists():
        return []
    return sorted(
        (p for p in BACKUPS_DIR.glob('*.json') if p.is_file()),
        key=lambda p: (p.stat().st_mtime, p.name),
        reverse=True
    )


def _recover_from_latest_backup(snapshot_key):
    if not snapshot_key:
        return None
    for path in _iter_backup_files():
        try:
            snapshot = _read_json_raw(str(path))
        except Exception:
            continue
        if isinstance(snapshot, dict) and snapshot_key in snapshot:
            return snapshot[snapshot_key]
    return None


def read_data_json(filepath, fallback=None, backup_key=None):
    try:
        if os.path.exists(filepath):
            return _unwrap_data(_read_json_raw(filepath), fallback)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        recovered = _recover_from_latest_backup(backup_key)
        if recovered is not None:
            write_data_json(filepath, recovered)
            return recovered
    return fallback if fallback is not None else {}


def write_data_json(filepath, data):
    return write_json(filepath, _wrap_data(data))


def _stage_json_file(target, data, prefix):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(
        dir=str(target.parent),
        prefix=prefix,
        suffix='.json'
    )
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        return Path(temp_path)
    except Exception:
        try:
            os.close(fd)
        except OSError:
            pass
        Path(temp_path).unlink(missing_ok=True)
        raise


def write_data_transaction(payloads):
    """Atomically commit a group of schema-wrapped JSON files with rollback."""
    items = [(Path(target), data) for target, data in payloads.items()]
    staged = {}
    backups = {}
    committed = []

    try:
        for target, data in items:
            staged[target] = _stage_json_file(
                target,
                _wrap_data(data),
                '.vocabmaster-transaction-'
            )

        for target, _ in items:
            if target.exists():
                fd, backup_path = tempfile.mkstemp(
                    dir=str(target.parent),
                    prefix='.vocabmaster-rollback-',
                    suffix='.json'
                )
                os.close(fd)
                shutil.copy2(str(target), backup_path)
                backups[target] = Path(backup_path)
            else:
                backups[target] = None

        for target, _ in items:
            os.replace(str(staged[target]), str(target))
            committed.append(target)
    except Exception as e:
        for target in reversed(committed):
            backup = backups.get(target)
            try:
                if backup and backup.exists():
                    os.replace(str(backup), str(target))
                elif target.exists():
                    target.unlink()
            except Exception as rollback_error:
                print(f"Error rolling back {target}: {rollback_error}")
        print(f"Error writing data transaction: {e}")
        return False
    finally:
        for path in list(staged.values()) + [p for p in backups.values() if p]:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass

    return True


def load_builtin_words(category):
    if category not in VALID_CATEGORIES:
        return []
    filepath = WORDS_DIR / f"{category}.json"
    if filepath.exists():
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []
    return []


def validate_and_migrate():
    """Ensure all data files have valid schema and migrate if needed."""
    # Progress validation
    progress_file = str(PROGRESS_DIR / 'progress.json')
    progress_raw = read_json(progress_file, {})
    progress = _unwrap_data(progress_raw, {})
    cleaned = {}
    for key, card in (progress if isinstance(progress, dict) else {}).items():
        if not isinstance(card, dict):
            continue
        cleaned[key] = {
            'interval': card.get('interval', 0),
            'repetitions': card.get('repetitions', 0),
            'ef': card.get('ef', 2.5),
            'nextReview': card.get('nextReview', None)
        }
    if cleaned != progress or progress_raw != _wrap_data(cleaned):
        write_data_json(progress_file, cleaned)

    # Stats validation
    stats_file = str(STATS_DIR / 'stats.json')
    stats_raw = read_json(stats_file, {'daily': {}, 'streak': 0, 'lastStudyDate': None})
    stats = _unwrap_data(stats_raw, {'daily': {}, 'streak': 0, 'lastStudyDate': None})
    if not isinstance(stats, dict):
        stats = {'daily': {}, 'streak': 0, 'lastStudyDate': None}
    orig_stats = dict(stats)
    stats.setdefault('daily', {})
    stats.setdefault('streak', 0)
    stats.setdefault('lastStudyDate', None)
    # errorBook migration (P2)
    stats.setdefault('errorBook', {})
    if not isinstance(stats.get('errorBook'), dict):
        stats['errorBook'] = {}
    # testHistory migration (P2)
    stats.setdefault('testHistory', [])
    if not isinstance(stats.get('testHistory'), list):
        stats['testHistory'] = []
    if stats != orig_stats or stats_raw != _wrap_data(stats):
        write_data_json(stats_file, stats)

    # Settings validation
    settings_file = str(SETTINGS_DIR / 'settings.json')
    settings_raw = read_json(settings_file, {'fontSize': 18, 'dailyGoal': 30, 'darkMode': False})
    settings = _unwrap_data(settings_raw, {'fontSize': 18, 'dailyGoal': 30, 'darkMode': False})
    if not isinstance(settings, dict):
        settings = {'fontSize': 18, 'dailyGoal': 30, 'darkMode': False}
    orig = dict(settings)
    settings['fontSize'] = max(14, min(28, settings.get('fontSize', 18)))
    settings['dailyGoal'] = max(5, min(200, settings.get('dailyGoal', 30)))
    settings.setdefault('darkMode', False)
    # Migrate old settings: remove legacy reviewCount/newWordCount fields
    settings.pop('reviewCount', None)
    settings.pop('newWordCount', None)
    # P3 settings migration
    settings.setdefault('hotkeyModifiers', ['Ctrl', 'Alt'])
    settings.setdefault('hotkeyKey', 'V')
    settings.setdefault('reminderEnabled', False)
    settings.setdefault('reminderTime', '20:00')
    settings.setdefault('closeToTray', True)
    settings.setdefault('startupEnabled', get_startup_status().get('enabled', False))
    # Validate P3 settings types
    if not isinstance(settings.get('hotkeyModifiers'), list):
        settings['hotkeyModifiers'] = ['Ctrl', 'Alt']
    if not isinstance(settings.get('hotkeyKey'), str) or len(settings.get('hotkeyKey', '')) != 1:
        settings['hotkeyKey'] = 'V'
    if not isinstance(settings.get('reminderEnabled'), bool):
        settings['reminderEnabled'] = False
    if not isinstance(settings.get('reminderTime'), str):
        settings['reminderTime'] = '20:00'
    if not isinstance(settings.get('closeToTray'), bool):
        settings['closeToTray'] = True
    if not isinstance(settings.get('startupEnabled'), bool):
        settings['startupEnabled'] = get_startup_status().get('enabled', False)
    if settings != orig or settings_raw != _wrap_data(settings):
        write_data_json(settings_file, settings)

    favorites_file = str(FAVORITES_DIR / 'favorites.json')
    favorites_raw = read_json(favorites_file, [])
    favorites = _unwrap_data(favorites_raw, [])
    if not isinstance(favorites, list):
        favorites = []
    if favorites_raw != _wrap_data(favorites):
        write_data_json(favorites_file, favorites)


def set_app_user_model_id():
    """Set the Windows AppUserModelID so the taskbar icon works correctly."""
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('VocabMaster.App.1')
    except Exception:
        pass


class VocabAPI:
    """Backend API exposed to the JavaScript frontend via pywebview."""

    def __init__(self, runtime=None):
        self._runtime = runtime

    def set_runtime(self, runtime):
        self._runtime = runtime

    def get_word_list(self, category):
        if category not in VALID_CATEGORIES:
            return []
        builtin = load_builtin_words(category)
        custom_file = WORDS_DATA_DIR / f"{category}.json"
        custom = read_data_json(str(custom_file), [], backup_key='customWords')
        if not isinstance(custom, list):
            custom = []
        return builtin + custom

    def get_word_page(self, category, page=1, per_page=100):
        if category not in VALID_CATEGORIES:
            return {'words': [], 'total': 0, 'page': 1, 'per_page': per_page, 'has_more': False}
        try:
            page = max(1, int(page))
            per_page = max(1, min(500, int(per_page)))
        except (TypeError, ValueError):
            page = 1
            per_page = 100
        words = self.get_word_list(category)
        start = (page - 1) * per_page
        end = start + per_page
        return {
            'words': words[start:end],
            'total': len(words),
            'page': page,
            'per_page': per_page,
            'has_more': end < len(words),
        }

    def search_words(self, query, category=None, limit=20):
        query = str(query or '').strip().lower()
        if not query:
            return []
        try:
            limit = max(1, min(100, int(limit)))
        except (TypeError, ValueError):
            limit = 20
        categories = [category] if category in VALID_CATEGORIES else ['cet4', 'cet6', 'postgraduate', 'ielts', 'toefl']
        matches = []
        for cat in categories:
            for word in self.get_word_list(cat):
                word_text = str(word.get('word', '')).lower()
                meaning = str(word.get('meaning', '')).lower()
                if query in word_text or query in meaning:
                    item = dict(word)
                    item['_cat'] = cat
                    matches.append(item)
                    if len(matches) >= limit:
                        return matches
        return matches

    def get_wordbank_meta(self):
        categories = ['cet4', 'cet6', 'postgraduate', 'ielts', 'toefl']
        result = {}
        for cat in categories:
            result[cat] = {
                'name': cat.upper() if cat in {'cet4', 'cet6'} else cat,
                'total': len(self.get_word_list(cat)),
            }
        return result

    def get_all_words(self):
        categories = ['cet4', 'cet6', 'postgraduate', 'ielts', 'toefl']
        result = {}
        for cat in categories:
            result[cat] = self.get_word_list(cat)
        return result

    def add_custom_word(self, category, word):
        if category not in VALID_CATEGORIES:
            return {'success': False, 'message': '词库类别无效'}
        normalized = self._normalize_word(word)
        if not normalized:
            return {'success': False, 'message': '请至少填写单词和释义'}
        custom_file = str(WORDS_DATA_DIR / f"{category}.json")
        words = read_data_json(custom_file, [], backup_key='customWords')
        word_text = normalized.get('word', '').lower()
        if any(w.get('word', '').lower() == word_text for w in words):
            return {'success': False, 'message': '该单词已存在'}
        words.append(normalized)
        if not write_data_json(custom_file, words):
            return {'success': False, 'message': '单词保存失败'}
        return {'success': True, 'message': '单词添加成功'}

    def remove_custom_word(self, category, word_text):
        if category not in VALID_CATEGORIES:
            return {'success': False, 'message': '词库类别无效'}
        custom_file = str(WORDS_DATA_DIR / f"{category}.json")
        words = read_data_json(custom_file, [], backup_key='customWords')
        filtered = [w for w in words if w.get('word', '').lower() != word_text.lower()]
        success = write_data_json(custom_file, filtered)
        return {
            'success': success,
            'message': '单词已删除' if success else '单词删除失败',
        }

    def get_progress(self):
        return read_data_json(str(PROGRESS_DIR / 'progress.json'), {}, backup_key='progress')

    def save_progress(self, progress):
        return write_data_json(str(PROGRESS_DIR / 'progress.json'), progress)

    def get_stats(self):
        return read_data_json(str(STATS_DIR / 'stats.json'),
                              {'daily': {}, 'streak': 0, 'lastStudyDate': None, 'errorBook': {}, 'testHistory': []},
                              backup_key='statistics')

    def save_stats(self, stats):
        return write_data_json(str(STATS_DIR / 'stats.json'), stats)

    def get_settings(self):
        return read_data_json(str(SETTINGS_DIR / 'settings.json'),
                              {'fontSize': 18, 'dailyGoal': 30, 'darkMode': False,
                               'hotkeyModifiers': ['Ctrl', 'Alt'], 'hotkeyKey': 'V',
                               'reminderEnabled': False, 'reminderTime': '20:00',
                               'closeToTray': True,
                               'startupEnabled': get_startup_status().get('enabled', False)},
                              backup_key='settings')

    def save_settings(self, settings):
        return write_data_json(str(SETTINGS_DIR / 'settings.json'), settings)

    def save_learning_state(self, progress, stats, settings):
        if not all(isinstance(value, dict) for value in (progress, stats, settings)):
            return {'success': False, 'message': '学习状态格式无效'}
        success = write_data_transaction({
            PROGRESS_DIR / 'progress.json': progress,
            STATS_DIR / 'stats.json': stats,
            SETTINGS_DIR / 'settings.json': settings,
        })
        return {
            'success': success,
            'message': '学习状态已保存' if success else '学习状态保存失败',
        }

    def get_favorites(self):
        favorites = read_data_json(str(FAVORITES_DIR / 'favorites.json'), [], backup_key='favorites')
        return favorites if isinstance(favorites, list) else []

    def save_favorites(self, favorites):
        if not isinstance(favorites, list):
            return False
        cleaned = []
        seen = set()
        for item in favorites:
            if not isinstance(item, str) or item in seen:
                continue
            cleaned.append(item)
            seen.add(item)
        return write_data_json(str(FAVORITES_DIR / 'favorites.json'), cleaned)

    def get_hotkey_config(self):
        settings = self.get_settings()
        return {
            'modifiers': settings.get('hotkeyModifiers', ['Ctrl', 'Alt']),
            'key': settings.get('hotkeyKey', 'V'),
            'active': bool(self._runtime and self._runtime.is_hotkey_registered())
        }

    def set_hotkey(self, modifiers, key):
        settings = self.get_settings()
        if not isinstance(modifiers, list) or not modifiers or not isinstance(key, str) or len(key) != 1:
            return {'success': False, 'message': '热键格式无效'}
        allowed_mods = {'Ctrl', 'Alt', 'Shift', 'Win'}
        if not all(m in allowed_mods for m in modifiers):
            return {'success': False, 'message': '修饰键无效，可选: Ctrl/Alt/Shift/Win'}
        if not key.isalpha() or key.upper() < 'A' or key.upper() > 'Z':
            return {'success': False, 'message': '热键必须是 A-Z'}

        old_modifiers = settings.get('hotkeyModifiers', ['Ctrl', 'Alt'])
        old_key = settings.get('hotkeyKey', 'V')
        if self._runtime:
            if not self._runtime.update_hotkey(modifiers, key.upper()):
                return {'success': False, 'message': '热键注册失败，可能与系统或其他应用冲突'}

        settings['hotkeyModifiers'] = modifiers
        settings['hotkeyKey'] = key.upper()
        if not self.save_settings(settings):
            if self._runtime:
                self._runtime.update_hotkey(old_modifiers, old_key)
            return {'success': False, 'message': '热键设置保存失败'}
        return {'success': True, 'message': '热键已更新'}

    def get_hotkey_status(self):
        return {'active': bool(self._runtime and self._runtime.is_hotkey_registered())}

    def get_reminder_config(self):
        settings = self.get_settings()
        return {
            'enabled': settings.get('reminderEnabled', False),
            'time': settings.get('reminderTime', '20:00')
        }

    def set_reminder(self, enabled, time_str):
        try:
            hour, minute = map(int, str(time_str).split(':'))
        except (TypeError, ValueError):
            return {'success': False, 'message': '提醒时间格式无效'}
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return {'success': False, 'message': '提醒时间格式无效'}
        normalized_time = f'{hour:02d}:{minute:02d}'
        settings = self.get_settings()
        settings['reminderEnabled'] = bool(enabled)
        settings['reminderTime'] = normalized_time
        if not self.save_settings(settings):
            return {'success': False, 'message': '提醒设置保存失败'}
        if self._runtime:
            self._runtime.configure_reminder(bool(enabled), normalized_time)
        return {'success': True}

    def get_startup_status(self):
        return get_startup_status()

    def set_startup(self, enabled):
        return set_startup_enabled(bool(enabled))

    def set_app_in_use(self, in_use):
        if self._runtime:
            self._runtime.set_app_in_use(bool(in_use))
        return {'success': True}

    def send_test_notification(self):
        """Send a test toast to verify notification works."""
        try:
            from windows_toasts import WindowsToaster, Toast
            toaster = WindowsToaster('VocabMaster')
            toast = Toast()
            toast.text_fields = ['VocabMaster', '✅ 测试通知成功！你会在这个时间收到每日学习提醒。']
            toaster.show_toast(toast)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def save_window_geometry(self, geometry):
        """Save window position and size to settings."""
        settings = self.get_settings()
        if isinstance(settings, dict):
            settings['windowGeometry'] = geometry
            return self.save_settings(settings)
        return False

    def get_window_geometry(self):
        """Get saved window geometry from settings."""
        settings = self.get_settings()
        if isinstance(settings, dict):
            return settings.get('windowGeometry', None)
        return None

    def get_custom_words(self):
        result = {}
        for cat in sorted(VALID_CATEGORIES):
            custom_file = WORDS_DATA_DIR / f"{cat}.json"
            words = read_data_json(str(custom_file), [], backup_key='customWords')
            result[cat] = words if isinstance(words, list) else []
        return result

    def export_snapshot(self):
        return {
            'exportVersion': 2,
            'appVersion': __version__,
            'exportDate': datetime.now().isoformat(),
            'progress': self.get_progress(),
            'statistics': self.get_stats(),
            'settings': self.get_settings(),
            'favorites': self.get_favorites(),
            'customWords': self.get_custom_words()
        }

    def _create_safety_backup(self, reason):
        safe_reason = ''.join(c if c.isalnum() or c in ('-', '_') else '-' for c in str(reason))[:40]
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        filepath = BACKUPS_DIR / f'vocabmaster-{safe_reason}-{timestamp}.json'
        if not write_json(str(filepath), self.export_snapshot()):
            return None
        self._prune_backups()
        return str(filepath)

    def _prune_backups(self, keep=BACKUP_RETENTION):
        for path in _iter_backup_files()[keep:]:
            try:
                path.unlink()
            except Exception:
                pass

    def list_backups(self):
        backups = []
        for path in _iter_backup_files()[:BACKUP_RETENTION]:
            backups.append({
                'id': path.name,
                'path': str(path),
                'size': path.stat().st_size,
                'modified': datetime.fromtimestamp(path.stat().st_mtime).isoformat()
            })
        return backups

    def restore_backup(self, backup_id):
        path = BACKUPS_DIR / Path(str(backup_id)).name
        if not path.exists() or not path.is_file():
            return {'success': False, 'message': '备份不存在'}
        try:
            snapshot = _read_json_raw(str(path))
        except Exception as e:
            return {'success': False, 'message': f'备份读取失败: {str(e)}'}
        return self.restore_snapshot(snapshot)

    def delete_backup(self, backup_id):
        path = BACKUPS_DIR / Path(str(backup_id)).name
        if not path.exists() or not path.is_file():
            return {'success': False, 'message': '备份不存在'}
        try:
            path.unlink()
            return {'success': True, 'message': '备份已删除'}
        except Exception as e:
            return {'success': False, 'message': f'删除失败: {str(e)}'}

    def restore_snapshot(self, snapshot):
        if not isinstance(snapshot, dict):
            return {'success': False, 'message': '备份文件格式不正确'}

        progress = snapshot.get('progress')
        stats = snapshot.get('statistics')
        settings = snapshot.get('settings')
        favorites = snapshot.get('favorites', [])
        has_custom_words = 'customWords' in snapshot
        custom_words = snapshot.get('customWords')

        if not isinstance(progress, dict) or not isinstance(stats, dict) or not isinstance(settings, dict):
            return {'success': False, 'message': '备份缺少必要数据'}
        if not isinstance(favorites, list):
            favorites = []
        if has_custom_words and not isinstance(custom_words, dict):
            return {'success': False, 'message': '自定义词数据格式不正确'}

        backup_path = self._create_safety_backup('pre-restore')
        if not backup_path:
            return {'success': False, 'message': '无法创建恢复前安全备份'}

        cleaned_favorites = []
        seen_favorites = set()
        for item in favorites:
            if isinstance(item, str) and item not in seen_favorites:
                cleaned_favorites.append(item)
                seen_favorites.add(item)

        payloads = {
            PROGRESS_DIR / 'progress.json': progress,
            STATS_DIR / 'stats.json': stats,
            SETTINGS_DIR / 'settings.json': settings,
            FAVORITES_DIR / 'favorites.json': cleaned_favorites,
        }

        if has_custom_words:
            for cat in VALID_CATEGORIES:
                restored = []
                for word in custom_words.get(cat, []):
                    normalized = self._normalize_word(word)
                    if normalized:
                        restored.append(normalized)
                payloads[WORDS_DATA_DIR / f"{cat}.json"] = restored

        if not write_data_transaction(payloads):
            return {'success': False, 'message': '备份恢复失败，原数据已保留'}

        validate_and_migrate()
        return {'success': True, 'message': '备份恢复成功'}

    def restore_data(self):
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            filepath = filedialog.askopenfilename(
                title='恢复备份',
                filetypes=[('JSON文件', '*.json')]
            )
            root.destroy()
            if not filepath:
                return {'success': False, 'message': '已取消'}
            with open(filepath, 'r', encoding='utf-8') as f:
                snapshot = json.load(f)
            return self.restore_snapshot(snapshot)
        except Exception as e:
            return {'success': False, 'message': f'恢复失败: {str(e)}'}

    @staticmethod
    def _normalize_word(word):
        if not isinstance(word, dict):
            return None
        word_text = str(word.get('word', '')).strip()
        meaning = str(word.get('meaning', '')).strip()
        if not word_text or not meaning:
            return None
        return {
            'word': word_text[:80],
            'phonetic': str(word.get('phonetic', '')).strip()[:120],
            'meaning': meaning[:500],
            'example': str(word.get('example', '')).strip()[:500],
            'exampleTranslation': str(word.get('exampleTranslation', '')).strip()[:500]
        }

    def preview_import_words(self, data):
        if not isinstance(data, dict) or 'category' not in data or 'words' not in data or not isinstance(data['words'], list):
            return {'success': False, 'message': '文件格式不正确。需要 { "category": "...", "words": [...] }'}
        category = data['category']
        valid = sorted(VALID_CATEGORIES)
        if category not in valid:
            return {'success': False, 'message': f'词库类别无效。可选: {", ".join(valid)}'}

        existing_words = self.get_word_list(category)
        seen = {str(w.get('word', '')).strip().lower() for w in existing_words if isinstance(w, dict)}
        normalized_words = []
        added = duplicates = invalid = 0
        for item in data['words']:
            normalized = self._normalize_word(item)
            if not normalized:
                invalid += 1
                continue
            key = normalized['word'].lower()
            if key in seen:
                duplicates += 1
                continue
            seen.add(key)
            normalized_words.append(normalized)
            added += 1

        return {
            'success': True,
            'category': category,
            'added': added,
            'duplicates': duplicates,
            'invalid': invalid,
            'words': normalized_words
        }

    def import_words(self):
        try:
            import tkinter as tk
            from tkinter import filedialog, messagebox
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            filepath = filedialog.askopenfilename(
                title='导入词库',
                filetypes=[('JSON文件', '*.json')]
            )
            if not filepath:
                root.destroy()
                return {'success': False, 'message': '已取消'}
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            preview = self.preview_import_words(data)
            if not preview.get('success'):
                root.destroy()
                return preview
            confirmed = messagebox.askyesno(
                '确认导入词库',
                (
                    f'词库: {preview["category"]}\n'
                    f'新增: {preview["added"]} 个\n'
                    f'重复: {preview["duplicates"]} 个\n'
                    f'无效: {preview["invalid"]} 个\n\n'
                    '确认导入新增词条吗？'
                )
            )
            root.destroy()
            if not confirmed:
                return {'success': False, 'message': '已取消导入'}
            custom_file = str(WORDS_DATA_DIR / f"{preview['category']}.json")
            existing = read_data_json(custom_file, [], backup_key='customWords')
            if not isinstance(existing, list):
                existing = []
            merged = list(existing)
            merged.extend(preview['words'])
            if not write_data_json(custom_file, merged):
                return {'success': False, 'message': '导入写入失败，原词库已保留'}
            return {
                'success': True,
                'message': (
                    f'成功导入 {preview["added"]} 个单词到 {preview["category"]}'
                    f'，重复 {preview["duplicates"]} 个，无效 {preview["invalid"]} 个'
                ),
                'preview': {k: preview[k] for k in ('added', 'duplicates', 'invalid', 'category')}
            }
        except Exception as e:
            return {'success': False, 'message': f'导入失败: {str(e)}'}

    def export_data(self):
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            default_name = f"vocabmaster-data-{datetime.now().strftime('%Y-%m-%d')}.json"
            filepath = filedialog.asksaveasfilename(
                title='导出学习数据',
                defaultextension='.json',
                initialfile=default_name,
                filetypes=[('JSON文件', '*.json')]
            )
            root.destroy()
            if not filepath:
                return {'success': False, 'message': '已取消'}
            export = self.export_snapshot()
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(export, f, ensure_ascii=False, indent=2)
            return {'success': True, 'message': '数据导出成功'}
        except Exception as e:
            return {'success': False, 'message': f'导出失败: {str(e)}'}

    def reset_progress(self):
        try:
            backup_path = self._create_safety_backup('pre-reset')
            if not backup_path:
                return {'success': False, 'message': '无法创建重置前安全备份'}
            success = write_data_transaction({
                PROGRESS_DIR / 'progress.json': {},
                STATS_DIR / 'stats.json': {
                    'daily': {},
                    'streak': 0,
                    'lastStudyDate': None,
                    'errorBook': {},
                    'testHistory': [],
                },
            })
            return {
                'success': success,
                'message': '进度已重置' if success else '重置失败，原数据已保留',
            }
        except Exception as e:
            return {'success': False, 'message': str(e)}


def create_tray_image():
    """Create a simple 32x32 icon for the tray."""
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Draw a simple book shape
    draw.rectangle([6, 4, 26, 28], fill='#4a90d9')
    draw.rectangle([14, 8, 24, 12], fill='#ffffff')
    draw.rectangle([14, 14, 24, 18], fill='#ffffff')
    draw.rectangle([14, 20, 24, 24], fill='#ffffff')
    return img


class RuntimeBridge:
    """Small private bridge used by VocabAPI without exposing pywebview internals."""

    def __init__(self, context):
        self._context = context

    def is_hotkey_registered(self):
        return self._context.hotkey.is_registered()

    def update_hotkey(self, modifiers, key):
        return self._context.update_hotkey(modifiers, key)

    def configure_reminder(self, enabled, reminder_time):
        self._context.configure_reminder(enabled, reminder_time)

    def set_app_in_use(self, in_use):
        self._context.reminder.set_in_use(bool(in_use))


class AppContext:
    """Own the single window, API, tray, hotkey, and reminder lifecycle."""

    def __init__(
        self,
        api=None,
        webview_module=webview,
        hotkey=None,
        reminder=None,
        thread_factory=threading.Thread,
        tray_enabled=True,
        force_exit_on_close=True,
    ):
        self.webview = webview_module
        self.thread_factory = thread_factory
        self.force_exit_on_close = force_exit_on_close
        self.hotkey = hotkey or GlobalHotkey()
        self.reminder = reminder or ReminderScheduler()
        self.api = api or VocabAPI()
        if isinstance(self.api, VocabAPI):
            self.api.set_runtime(RuntimeBridge(self))
        self.tray_enabled = tray_enabled
        self.tray_icon = None
        self.tray_thread = None
        self.reminder_thread = None
        self.window = None
        self.window_hwnd = None
        self.exit_requested = False
        self.services_started = False
        self._services_lock = threading.Lock()

    def create_window(self, start_minimized=False):
        self.window = self.webview.create_window(
            title=APP_TITLE,
            url=str(SRC_DIR / 'index.html'),
            js_api=self.api,
            width=750,
            height=620,
            min_size=(620, 480),
            text_select=False,
            confirm_close=False,
            background_color='#f0f4f8',
            easy_drag=False,
            minimized=start_minimized,
        )
        self.window.events.closing += self.on_closing
        self.window.events.shown += self.on_shown
        return self.window

    def show_window(self):
        if not self.window:
            return
        activated = activate_window_handle(self.window_hwnd)
        if not activated:
            for method_name in ('restore', 'show', 'focus'):
                method = getattr(self.window, method_name, None)
                if callable(method):
                    try:
                        method()
                    except Exception:
                        pass
        self.window_hwnd = find_window_handle_by_title() or self.window_hwnd
        activate_window_handle(self.window_hwnd)

    def update_hotkey(self, modifiers, key):
        if self.hotkey.is_registered():
            return self.hotkey.update(modifiers, key, self.show_window)
        return self.hotkey.start(modifiers, key, self.show_window)

    def configure_reminder(self, enabled, reminder_time):
        self.reminder.configure(enabled, reminder_time)

    def _build_tray_icon(self):
        return pystray.Icon(
            'VocabMaster',
            create_tray_image(),
            'VocabMaster - 英语背单词',
            menu=pystray.Menu(
                pystray.MenuItem('显示主窗口', lambda icon, item: self.show_window(), default=True),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem('退出', lambda icon, item: self.request_exit(icon)),
            ),
        )

    def _run_tray(self):
        self.tray_icon = self._build_tray_icon()
        self.tray_icon.run()

    def start_services(self):
        if self.services_started:
            return
        self.services_started = True
        settings = self.api.get_settings()
        self.hotkey.start(
            settings.get('hotkeyModifiers', ['Ctrl', 'Alt']),
            settings.get('hotkeyKey', 'V'),
            self.show_window,
        )
        self.reminder.configure(
            settings.get('reminderEnabled', False),
            settings.get('reminderTime', '20:00'),
        )
        self.reminder.start()
        self.reminder_thread = self.thread_factory(
            target=self.reminder.run,
            args=(self.api, self.show_window),
            daemon=True,
        )
        self.reminder_thread.start()
        if self.tray_enabled:
            self.tray_thread = self.thread_factory(target=self._run_tray, daemon=True)
            self.tray_thread.start()

    def stop_services(self):
        with self._services_lock:
            if not self.services_started:
                return
            self.services_started = False
        self.reminder.stop()
        if self.reminder_thread and self.reminder_thread.is_alive():
            self.reminder_thread.join(timeout=2)
        self.hotkey.stop()
        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except Exception:
                pass

    def _save_window_geometry(self):
        if not self.window:
            return
        try:
            self.api.save_window_geometry({
                'x': self.window.x,
                'y': self.window.y,
                'width': self.window.width,
                'height': self.window.height,
            })
        except Exception:
            pass

    def _hide_to_tray(self):
        try:
            hide_window_handle(self.window_hwnd)
            hide_window_by_title()
            if self.window:
                self.window.hide()
        except Exception:
            hide_window_by_title()

    def _destroy_window_later(self):
        try:
            if self.window:
                self.window.destroy()
        except Exception:
            pass

    def _force_process_exit(self):
        try:
            self.stop_services()
        finally:
            os._exit(0)

    def on_closing(self):
        self.window_hwnd = find_window_handle_by_title() or self.window_hwnd
        self._save_window_geometry()
        settings = self.api.get_settings()
        close_to_tray = settings.get('closeToTray', True)
        write_runtime_trace(f"on_closing exit_requested={self.exit_requested} closeToTray={close_to_tray}")
        if self.exit_requested:
            return True
        if not close_to_tray:
            self.exit_requested = True
            self.reminder.set_in_use(False)
            write_runtime_trace("close policy: exit")
            threading.Timer(0.05, self._destroy_window_later).start()
            if self.force_exit_on_close:
                threading.Timer(1.0, self._force_process_exit).start()
            return True
        self.reminder.set_in_use(False)
        write_runtime_trace("close policy: hide to tray")
        threading.Timer(0.05, self._hide_to_tray).start()
        return False

    def on_shown(self):
        self.window_hwnd = find_window_handle_by_title() or self.window_hwnd
        self.reminder.set_in_use(True)
        try:
            saved = self.api.get_window_geometry()
            if not saved or not isinstance(saved, dict):
                return
            x = saved.get('x', self.window.x)
            y = saved.get('y', self.window.y)
            width = max(620, min(1920, saved.get('width', self.window.width)))
            height = max(480, min(1080, saved.get('height', self.window.height)))
            import tkinter as tk
            root = tk.Tk()
            root.withdraw()
            screen_width = root.winfo_screenwidth()
            screen_height = root.winfo_screenheight()
            root.destroy()
            if 0 <= x < screen_width - 100 and 0 <= y < screen_height - 100:
                self.window.resize(width, height)
                self.window.move(x, y)
        except Exception:
            pass

    def request_exit(self, icon=None):
        self.exit_requested = True
        if icon:
            icon.stop()
        if self.window:
            self.window.destroy()

    def run(self, start_minimized=False):
        self.create_window(start_minimized=start_minimized)
        start_single_instance_listener(self.show_window)
        try:
            self.webview.start(func=self.start_services, debug=False, gui='edgechromium')
        finally:
            self.stop_services()


def main():
    write_runtime_trace("main start")
    if not acquire_single_instance_lock():
        write_runtime_trace("single instance lock busy")
        print('VocabMaster is already running. Activating existing window.')
        return 0

    set_app_user_model_id()
    migrate_legacy_data()
    ensure_dirs()
    validate_and_migrate()
    context = AppContext()
    context.run(start_minimized='--minimized' in sys.argv)
    return 0


if __name__ == '__main__':
    main()
