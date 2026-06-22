import importlib
import json
import os
import tempfile
import unittest
from pathlib import Path


class AppDataTests(unittest.TestCase):
    def test_default_data_dir_uses_user_appdata_on_windows(self):
        app = importlib.import_module("app")

        if os.name == "nt":
            expected = Path(os.environ["APPDATA"]) / "VocabMaster"
            self.assertEqual(app.DATA_DIR, expected)
        else:
            self.assertNotEqual(app.DATA_DIR, app.BASE_DIR / "data")

    def test_export_snapshot_includes_restorable_local_state(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            app.DATA_DIR = root
            app.WORDS_DATA_DIR = root / "words"
            app.PROGRESS_DIR = root / "progress"
            app.STATS_DIR = root / "stats"
            app.SETTINGS_DIR = root / "settings"
            app.FAVORITES_DIR = root / "favorites"
            app.ensure_dirs()

            (app.PROGRESS_DIR / "progress.json").write_text(
                json.dumps({"abandon_cet4": {"interval": 1}}),
                encoding="utf-8",
            )
            (app.STATS_DIR / "stats.json").write_text(
                json.dumps({"daily": {}, "streak": 2}),
                encoding="utf-8",
            )
            (app.SETTINGS_DIR / "settings.json").write_text(
                json.dumps({"fontSize": 18, "dailyGoal": 20, "darkMode": True}),
                encoding="utf-8",
            )
            (app.FAVORITES_DIR / "favorites.json").write_text(
                json.dumps(["abandon_cet4"]),
                encoding="utf-8",
            )
            (app.WORDS_DATA_DIR / "cet4.json").write_text(
                json.dumps([{"word": "custom", "meaning": "自定义"}], ensure_ascii=False),
                encoding="utf-8",
            )

            snapshot = app.VocabAPI().export_snapshot()

        self.assertIn("progress", snapshot)
        self.assertIn("statistics", snapshot)
        self.assertIn("settings", snapshot)
        self.assertIn("favorites", snapshot)
        self.assertIn("customWords", snapshot)
        self.assertEqual(snapshot["favorites"], ["abandon_cet4"])
        self.assertEqual(snapshot["customWords"]["cet4"][0]["word"], "custom")

    def test_restore_snapshot_replaces_local_state(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            app.DATA_DIR = root
            app.WORDS_DATA_DIR = root / "words"
            app.PROGRESS_DIR = root / "progress"
            app.STATS_DIR = root / "stats"
            app.SETTINGS_DIR = root / "settings"
            app.FAVORITES_DIR = root / "favorites"
            app.ensure_dirs()

            api = app.VocabAPI()
            result = api.restore_snapshot({
                "exportVersion": 2,
                "progress": {"ability_cet4": {"interval": 3, "repetitions": 2}},
                "statistics": {"daily": {"2026-06-21": {"studied": 4, "correct": 3, "total": 4}}, "streak": 1},
                "settings": {"fontSize": 19, "dailyGoal": 40, "darkMode": False},
                "favorites": ["ability_cet4"],
                "customWords": {
                    "cet4": [{"word": "restore", "meaning": "恢复"}],
                    "unknown": [{"word": "bad", "meaning": "bad"}]
                }
            })

            self.assertTrue(result["success"])
            self.assertEqual(api.get_progress()["ability_cet4"]["repetitions"], 2)
            self.assertEqual(api.get_settings()["dailyGoal"], 40)
            self.assertEqual(api.get_favorites(), ["ability_cet4"])
            self.assertEqual(api.get_custom_words()["cet4"][0]["word"], "restore")
            self.assertNotIn("unknown", api.get_custom_words())


if __name__ == "__main__":
    unittest.main()
