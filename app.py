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
import tempfile
import shutil
from datetime import datetime
from pathlib import Path

# Hide console window when running via python.exe (not pythonw.exe)
if sys.platform == 'win32' and sys.executable.lower().endswith('python.exe'):
    try:
        ctypes.windll.kernel32.FreeConsole()
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
VALID_CATEGORIES = {'cet4', 'cet6', 'postgraduate', 'ielts', 'toefl', 'custom'}

# Single-instance lock
LOCK_PORT = 57321  # Unique port for VocabMaster


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
        # Try to notify the existing instance to show its window
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect(('127.0.0.1', LOCK_PORT))
            sock.send(b'show')
            sock.close()
        except Exception:
            pass
        return False


def start_single_instance_listener(window):
    """Accept notifications from later launches and bring this window forward."""
    def listen():
        while True:
            try:
                conn, _ = _lock_socket.accept()
                with conn:
                    if conn.recv(32) != b'show':
                        continue
                for method_name in ('restore', 'show', 'focus'):
                    method = getattr(window, method_name, None)
                    if callable(method):
                        try:
                            method()
                        except Exception:
                            pass
            except Exception:
                break

    import threading
    threading.Thread(target=listen, daemon=True).start()


def ensure_dirs():
    for d in [DATA_DIR, WORDS_DATA_DIR, PROGRESS_DIR, STATS_DIR, SETTINGS_DIR, FAVORITES_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def migrate_legacy_data():
    """Copy repository-local data to the user data directory on first run."""
    if DATA_DIR == LEGACY_DATA_DIR or not LEGACY_DATA_DIR.exists() or DATA_DIR.exists():
        return
    try:
        shutil.copytree(str(LEGACY_DATA_DIR), str(DATA_DIR))
    except Exception as e:
        print(f"Error migrating data: {e}")


def read_json(filepath, fallback=None):
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
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
    progress = read_json(str(PROGRESS_DIR / 'progress.json'), {})
    cleaned = {}
    for key, card in progress.items():
        if not isinstance(card, dict):
            continue
        cleaned[key] = {
            'interval': card.get('interval', 0),
            'repetitions': card.get('repetitions', 0),
            'ef': card.get('ef', 2.5),
            'nextReview': card.get('nextReview', None)
        }
    if cleaned != progress:
        write_json(str(PROGRESS_DIR / 'progress.json'), cleaned)

    # Stats validation
    stats = read_json(str(STATS_DIR / 'stats.json'),
                      {'daily': {}, 'streak': 0, 'lastStudyDate': None})
    stats.setdefault('daily', {})
    stats.setdefault('streak', 0)
    stats.setdefault('lastStudyDate', None)
    # Only write if stats file doesn't exist yet (first run)
    if not (STATS_DIR / 'stats.json').exists():
        write_json(str(STATS_DIR / 'stats.json'), stats)

    # Settings validation
    settings = read_json(str(SETTINGS_DIR / 'settings.json'),
                         {'fontSize': 18, 'dailyGoal': 30,
                          'darkMode': False})
    orig = dict(settings)
    settings['fontSize'] = max(14, min(28, settings.get('fontSize', 18)))
    settings['dailyGoal'] = max(5, min(200, settings.get('dailyGoal', 30)))
    settings.setdefault('darkMode', False)
    # Migrate old settings: remove legacy reviewCount/newWordCount fields
    settings.pop('reviewCount', None)
    settings.pop('newWordCount', None)
    # Only write if settings were actually corrected
    if settings != orig:
        write_json(str(SETTINGS_DIR / 'settings.json'), settings)

    favorites = read_json(str(FAVORITES_DIR / 'favorites.json'), [])
    if not isinstance(favorites, list):
        write_json(str(FAVORITES_DIR / 'favorites.json'), [])


def set_app_user_model_id():
    """Set the Windows AppUserModelID so the taskbar icon works correctly."""
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID('VocabMaster.App.1')
    except Exception:
        pass


class VocabAPI:
    """Backend API exposed to the JavaScript frontend via pywebview."""

    def get_word_list(self, category):
        if category not in VALID_CATEGORIES:
            return []
        builtin = load_builtin_words(category)
        custom_file = WORDS_DATA_DIR / f"{category}.json"
        custom = read_json(str(custom_file), [])
        if not isinstance(custom, list):
            custom = []
        return builtin + custom

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
        words = read_json(custom_file, [])
        word_text = normalized.get('word', '').lower()
        if any(w.get('word', '').lower() == word_text for w in words):
            return {'success': False, 'message': '该单词已存在'}
        words.append(normalized)
        write_json(custom_file, words)
        return {'success': True, 'message': '单词添加成功'}

    def remove_custom_word(self, category, word_text):
        if category not in VALID_CATEGORIES:
            return {'success': False, 'message': '词库类别无效'}
        custom_file = str(WORDS_DATA_DIR / f"{category}.json")
        words = read_json(custom_file, [])
        filtered = [w for w in words if w.get('word', '').lower() != word_text.lower()]
        write_json(custom_file, filtered)
        return {'success': True}

    def get_progress(self):
        return read_json(str(PROGRESS_DIR / 'progress.json'), {})

    def save_progress(self, progress):
        return write_json(str(PROGRESS_DIR / 'progress.json'), progress)

    def get_stats(self):
        return read_json(str(STATS_DIR / 'stats.json'),
                        {'daily': {}, 'streak': 0, 'lastStudyDate': None})

    def save_stats(self, stats):
        return write_json(str(STATS_DIR / 'stats.json'), stats)

    def get_settings(self):
        return read_json(str(SETTINGS_DIR / 'settings.json'),
                        {'fontSize': 18, 'dailyGoal': 30, 'darkMode': False})

    def save_settings(self, settings):
        return write_json(str(SETTINGS_DIR / 'settings.json'), settings)

    def get_favorites(self):
        favorites = read_json(str(FAVORITES_DIR / 'favorites.json'), [])
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
        return write_json(str(FAVORITES_DIR / 'favorites.json'), cleaned)

    def get_custom_words(self):
        result = {}
        for cat in sorted(VALID_CATEGORIES):
            custom_file = WORDS_DATA_DIR / f"{cat}.json"
            words = read_json(str(custom_file), [])
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

    def restore_snapshot(self, snapshot):
        if not isinstance(snapshot, dict):
            return {'success': False, 'message': '备份文件格式不正确'}

        progress = snapshot.get('progress')
        stats = snapshot.get('statistics')
        settings = snapshot.get('settings')
        favorites = snapshot.get('favorites', [])
        custom_words = snapshot.get('customWords', {})

        if not isinstance(progress, dict) or not isinstance(stats, dict) or not isinstance(settings, dict):
            return {'success': False, 'message': '备份缺少必要数据'}
        if not isinstance(favorites, list):
            favorites = []
        if not isinstance(custom_words, dict):
            custom_words = {}

        write_json(str(PROGRESS_DIR / 'progress.json'), progress)
        write_json(str(STATS_DIR / 'stats.json'), stats)
        write_json(str(SETTINGS_DIR / 'settings.json'), settings)
        self.save_favorites(favorites)

        for cat in VALID_CATEGORIES:
            restored = []
            for word in custom_words.get(cat, []):
                normalized = self._normalize_word(word)
                if normalized:
                    restored.append(normalized)
            write_json(str(WORDS_DATA_DIR / f"{cat}.json"), restored)

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

    def import_words(self):
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            filepath = filedialog.askopenfilename(
                title='导入词库',
                filetypes=[('JSON文件', '*.json')]
            )
            root.destroy()
            if not filepath:
                return {'success': False, 'message': '已取消'}
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if 'category' not in data or 'words' not in data or not isinstance(data['words'], list):
                return {'success': False, 'message': '文件格式不正确。需要 { "category": "...", "words": [...] }'}
            valid = sorted(VALID_CATEGORIES)
            if data['category'] not in valid:
                return {'success': False, 'message': f'词库类别无效。可选: {", ".join(valid)}'}
            custom_file = str(WORDS_DATA_DIR / f"{data['category']}.json")
            existing = read_json(custom_file, [])
            if not isinstance(existing, list):
                existing = []
            merged = list(existing)
            added = 0
            for w in data['words']:
                normalized = self._normalize_word(w)
                if not normalized:
                    continue
                if not any(e.get('word', '').lower() == normalized['word'].lower() for e in merged):
                    merged.append(normalized)
                    added += 1
            write_json(custom_file, merged)
            return {'success': True, 'message': f'成功导入 {added} 个单词到 {data["category"]}'}
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
            import shutil
            if PROGRESS_DIR.exists():
                shutil.rmtree(str(PROGRESS_DIR))
            if STATS_DIR.exists():
                shutil.rmtree(str(STATS_DIR))
            ensure_dirs()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'message': str(e)}


def main():
    # Ensure only one instance runs
    if not acquire_single_instance_lock():
        print("VocabMaster is already running. Activating existing window.")
        sys.exit(0)

    set_app_user_model_id()
    migrate_legacy_data()
    ensure_dirs()
    validate_and_migrate()

    # Check for --minimized flag (used by startup shortcut)
    start_minimized = '--minimized' in sys.argv

    api = VocabAPI()
    html_path = str(SRC_DIR / 'index.html')

    window = webview.create_window(
        title='VocabMaster - 英语背单词',
        url=html_path,
        js_api=api,
        width=750,
        height=620,
        min_size=(620, 480),
        text_select=False,
        confirm_close=True,
        background_color='#f0f4f8',
        easy_drag=False
    )
    start_single_instance_listener(window)

    # Start minimized if launched from startup
    if start_minimized:
        # Use a small delay to let the window initialize, then minimize
        def minimize_after_start():
            import time
            time.sleep(0.5)
            try:
                window.minimize()
            except Exception:
                pass

        import threading
        threading.Thread(target=minimize_after_start, daemon=True).start()

    webview.start(debug=False, gui='edgechromium')


if __name__ == '__main__':
    main()
