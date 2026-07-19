import threading
import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path
from unittest import mock

import app


class FakeWindow:
    def __init__(self):
        self.x = 10
        self.y = 20
        self.width = 750
        self.height = 620
        self.hidden = False
        self.destroyed = False
        self.shown = False

    def hide(self):
        self.hidden = True

    def restore(self):
        self.shown = True

    def show(self):
        self.shown = True

    def focus(self):
        self.shown = True

    def destroy(self):
        self.destroyed = True


class FakeAPI:
    def __init__(self, close_to_tray=True):
        self.settings = {
            "closeToTray": close_to_tray,
            "hotkeyModifiers": ["Ctrl", "Alt"],
            "hotkeyKey": "V",
            "reminderEnabled": True,
            "reminderTime": "20:00",
        }
        self.saved_geometry = None

    def get_settings(self):
        return dict(self.settings)

    def save_window_geometry(self, geometry):
        self.saved_geometry = geometry
        return True


class FakeHotkey:
    def __init__(self):
        self.started = None
        self.stopped = False

    def start(self, modifiers, key, callback):
        self.started = (modifiers, key, callback)
        return True

    def stop(self):
        self.stopped = True

    def is_registered(self):
        return self.started is not None and not self.stopped


class FakeReminder:
    def __init__(self):
        self.config = None
        self.started = False
        self.ran = False
        self.in_use = None
        self.stopped = False

    def configure(self, enabled, reminder_time):
        self.config = (enabled, reminder_time)

    def start(self):
        self.started = True

    def run(self, api, show_window):
        self.ran = self.started

    def set_in_use(self, in_use):
        self.in_use = in_use

    def stop(self):
        self.stopped = True


class FakeReminderAPI:
    def __init__(self, studied=0, daily_goal=30):
        self.studied = studied
        self.daily_goal = daily_goal

    def get_stats(self):
        return {
            "daily": {
                "2026-07-16": {"studied": self.studied},
            }
        }

    def get_settings(self):
        return {"dailyGoal": self.daily_goal}


class RecordingReminder(app.ReminderScheduler):
    def __init__(self):
        super().__init__()
        self.notifications = []

    def _send_notification(self, api, show_window):
        self.notifications.append((api, show_window))


class ImmediateThread:
    def __init__(self, target, args=(), daemon=None):
        self.target = target
        self.args = args

    def start(self):
        self.target(*self.args)

    def is_alive(self):
        return False

    def join(self, timeout=None):
        return None


class FakeUser32:
    def __init__(self):
        self.register_thread = None
        self.message_thread = None
        self.unregister_thread = None

    def RegisterHotKey(self, hwnd, hotkey_id, modifiers, key):
        self.register_thread = threading.get_ident()
        return 1

    def UnregisterHotKey(self, hwnd, hotkey_id):
        self.unregister_thread = threading.get_ident()
        return 1

    def PeekMessageW(self, msg, hwnd, minimum, maximum, remove):
        self.message_thread = threading.get_ident()
        return 0

    def TranslateMessage(self, msg):
        return 1

    def DispatchMessageW(self, msg):
        return 1


class AppRuntimeTests(unittest.TestCase):
    def make_context(self, close_to_tray=True):
        api = FakeAPI(close_to_tray)
        hotkey = FakeHotkey()
        reminder = FakeReminder()
        context = app.AppContext(
            api=api,
            hotkey=hotkey,
            reminder=reminder,
            thread_factory=ImmediateThread,
            tray_enabled=False,
            force_exit_on_close=False,
        )
        context.window = FakeWindow()
        return context, api, hotkey, reminder

    def test_close_to_tray_hides_window_and_keeps_process_alive(self):
        context, api, _, reminder = self.make_context(close_to_tray=True)

        should_close = context.on_closing()
        time.sleep(0.1)

        self.assertFalse(should_close)
        self.assertTrue(context.window.hidden)
        self.assertFalse(context.window.destroyed)
        self.assertFalse(reminder.in_use)
        self.assertEqual(api.saved_geometry["width"], 750)

    def test_close_policy_can_exit_instead_of_hiding(self):
        context, _, _, _ = self.make_context(close_to_tray=False)

        should_close = context.on_closing()
        time.sleep(0.1)

        self.assertTrue(should_close)
        self.assertFalse(context.window.hidden)
        self.assertTrue(context.window.destroyed)

    def test_start_services_starts_reminder_and_hotkey(self):
        context, _, hotkey, reminder = self.make_context()

        context.start_services()

        self.assertEqual(hotkey.started[:2], (["Ctrl", "Alt"], "V"))
        self.assertEqual(reminder.config, (True, "20:00"))
        self.assertTrue(reminder.started)
        self.assertTrue(reminder.ran)

    def test_global_hotkey_registers_and_polls_on_same_worker_thread(self):
        user32 = FakeUser32()
        hotkey = app.GlobalHotkey(user32=user32, poll_interval=0.001)
        main_thread = threading.get_ident()

        self.assertTrue(hotkey.start(["Ctrl", "Alt"], "V", lambda: None))
        hotkey.stop()

        self.assertNotEqual(user32.register_thread, main_thread)
        self.assertEqual(user32.register_thread, user32.message_thread)
        self.assertEqual(user32.register_thread, user32.unregister_thread)

    def test_reminder_fires_once_during_window_when_goal_is_incomplete(self):
        reminder = RecordingReminder()
        api = FakeReminderAPI(studied=5, daily_goal=30)
        show_window = lambda: None
        reminder.configure(True, "20:00")
        now = datetime(2026, 7, 16, 20, 5)

        reminder.check_once(api, show_window, now=now)
        reminder.check_once(api, show_window, now=now)

        self.assertEqual(reminder.notifications, [(api, show_window)])

    def test_reminder_does_not_notify_when_goal_is_complete(self):
        reminder = RecordingReminder()
        api = FakeReminderAPI(studied=30, daily_goal=30)
        reminder.configure(True, "20:00")

        reminder.check_once(api, lambda: None, now=datetime(2026, 7, 16, 20, 5))

        self.assertEqual(reminder.notifications, [])
        self.assertTrue(reminder._fired_today)

    def test_reminder_waits_while_app_is_in_use(self):
        reminder = RecordingReminder()
        api = FakeReminderAPI(studied=5, daily_goal=30)
        reminder.configure(True, "20:00")
        reminder.set_in_use(True)

        reminder.check_once(api, lambda: None, now=datetime(2026, 7, 16, 20, 5))

        self.assertEqual(reminder.notifications, [])
        self.assertFalse(reminder._fired_today)

    def test_startup_status_is_unavailable_outside_windows(self):
        with mock.patch.object(app.sys, "platform", "linux"):
            status = app.get_startup_status()

        self.assertFalse(status["available"])
        self.assertFalse(status["enabled"])

    def test_set_startup_enabled_creates_current_user_shortcut(self):
        with tempfile.TemporaryDirectory() as tmp:
            shortcut = (
                Path(tmp)
                / "Microsoft"
                / "Windows"
                / "Start Menu"
                / "Programs"
                / "Startup"
                / "VocabMaster.lnk"
            )

            def fake_run(*args, **kwargs):
                shortcut.parent.mkdir(parents=True, exist_ok=True)
                shortcut.write_text("shortcut", encoding="utf-8")
                return mock.Mock(returncode=0, stdout="OK", stderr="")

            with mock.patch.object(app.sys, "platform", "win32"), \
                    mock.patch.dict(app.os.environ, {"APPDATA": tmp}), \
                    mock.patch.object(app.subprocess, "run", side_effect=fake_run) as run:
                result = app.set_startup_enabled(True)

        self.assertTrue(result["success"])
        self.assertTrue(result["enabled"])
        self.assertEqual(run.call_count, 1)

    def test_set_startup_disabled_removes_current_user_shortcut(self):
        with tempfile.TemporaryDirectory() as tmp:
            shortcut = (
                Path(tmp)
                / "Microsoft"
                / "Windows"
                / "Start Menu"
                / "Programs"
                / "Startup"
                / "VocabMaster.lnk"
            )
            shortcut.parent.mkdir(parents=True)
            shortcut.write_text("shortcut", encoding="utf-8")

            with mock.patch.object(app.sys, "platform", "win32"), \
                    mock.patch.dict(app.os.environ, {"APPDATA": tmp}):
                result = app.set_startup_enabled(False)

            self.assertTrue(result["success"])
            self.assertFalse(result["enabled"])
            self.assertFalse(shortcut.exists())


if __name__ == "__main__":
    unittest.main()
