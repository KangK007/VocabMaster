import importlib
import contextlib
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock


class AppDataTests(unittest.TestCase):
    def _use_temp_data_dirs(self, app, root):
        app.DATA_DIR = root
        app.WORDS_DATA_DIR = root / "words"
        app.PROGRESS_DIR = root / "progress"
        app.STATS_DIR = root / "stats"
        app.SETTINGS_DIR = root / "settings"
        app.FAVORITES_DIR = root / "favorites"
        app.BACKUPS_DIR = root / "backups"
        app.ensure_dirs()

    def test_default_data_dir_uses_user_appdata_on_windows(self):
        app = importlib.import_module("app")

        if os.name == "nt":
            expected = Path(os.environ["APPDATA"]) / "VocabMaster"
            self.assertEqual(app.get_default_data_dir(), expected)
        else:
            self.assertNotEqual(app.get_default_data_dir(), app.BASE_DIR / "data")

    def test_export_snapshot_includes_restorable_local_state(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)

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

    def test_word_page_search_and_meta_apis(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            app.write_data_json(
                str(app.WORDS_DATA_DIR / "cet4.json"),
                [{"word": "custom optics", "meaning": "自定义光学"}],
            )

            with mock.patch.object(app, "load_builtin_words", return_value=[
                {"word": "abandon", "meaning": "放弃"},
                {"word": "ability", "meaning": "能力"},
                {"word": "abnormal", "meaning": "反常的"},
            ]):
                api = app.VocabAPI()
                page = api.get_word_page("cet4", page=1, per_page=2)
                second_page = api.get_word_page("cet4", page=2, per_page=2)
                matches = api.search_words("光学", category="cet4")
                meta = api.get_wordbank_meta()

        self.assertEqual(page["total"], 4)
        self.assertEqual([word["word"] for word in page["words"]], ["abandon", "ability"])
        self.assertTrue(page["has_more"])
        self.assertEqual([word["word"] for word in second_page["words"]], ["abnormal", "custom optics"])
        self.assertEqual(matches[0]["word"], "custom optics")
        self.assertEqual(matches[0]["_cat"], "cet4")
        self.assertEqual(meta["cet4"]["total"], 4)

    def test_restore_snapshot_replaces_local_state(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)

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

    def test_restore_snapshot_creates_safety_backup_before_overwrite(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)

            (app.PROGRESS_DIR / "progress.json").write_text(
                json.dumps({"old_cet4": {"interval": 9}}),
                encoding="utf-8",
            )
            (app.STATS_DIR / "stats.json").write_text(
                json.dumps({"daily": {}, "streak": 3}),
                encoding="utf-8",
            )
            (app.SETTINGS_DIR / "settings.json").write_text(
                json.dumps({"fontSize": 18, "dailyGoal": 30, "darkMode": False}),
                encoding="utf-8",
            )

            result = app.VocabAPI().restore_snapshot({
                "progress": {"new_cet4": {"interval": 1}},
                "statistics": {"daily": {}, "streak": 0},
                "settings": {"fontSize": 20, "dailyGoal": 20, "darkMode": True},
                "favorites": [],
                "customWords": {}
            })

            self.assertTrue(result["success"])
            backups = list(app.BACKUPS_DIR.glob("vocabmaster-pre-restore-*.json"))
            self.assertEqual(len(backups), 1)
            backup = json.loads(backups[0].read_text(encoding="utf-8"))
            self.assertIn("old_cet4", backup["progress"])

    def test_restore_snapshot_without_custom_words_preserves_existing_words(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            app.write_data_json(
                str(app.WORDS_DATA_DIR / "cet4.json"),
                [{"word": "existing", "meaning": "现有"}],
            )

            result = app.VocabAPI().restore_snapshot({
                "progress": {},
                "statistics": {"daily": {}, "streak": 0},
                "settings": {"fontSize": 18, "dailyGoal": 30, "darkMode": False},
                "favorites": [],
            })
            custom_words = app.VocabAPI().get_custom_words()

        self.assertTrue(result["success"])
        self.assertEqual(custom_words["cet4"][0]["word"], "existing")

    def test_reset_progress_creates_safety_backup_before_delete(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)

            (app.PROGRESS_DIR / "progress.json").write_text(
                json.dumps({"old_cet4": {"interval": 9}}),
                encoding="utf-8",
            )
            (app.STATS_DIR / "stats.json").write_text(
                json.dumps({"daily": {}, "streak": 3}),
                encoding="utf-8",
            )

            result = app.VocabAPI().reset_progress()

            self.assertTrue(result["success"])
            backups = list(app.BACKUPS_DIR.glob("vocabmaster-pre-reset-*.json"))
            self.assertEqual(len(backups), 1)
            backup = json.loads(backups[0].read_text(encoding="utf-8"))
            self.assertIn("old_cet4", backup["progress"])

    def test_reset_progress_preserves_data_when_transaction_fails(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            app.write_data_json(str(app.PROGRESS_DIR / "progress.json"), {"old_cet4": {"interval": 9}})
            app.write_data_json(str(app.STATS_DIR / "stats.json"), {"daily": {}, "streak": 3})

            with mock.patch.object(app, "write_data_transaction", return_value=False):
                result = app.VocabAPI().reset_progress()

            progress = app.VocabAPI().get_progress()
            stats = app.VocabAPI().get_stats()

        self.assertFalse(result["success"])
        self.assertIn("old_cet4", progress)
        self.assertEqual(stats["streak"], 3)

    def test_save_progress_writes_schema_versioned_data(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)

            app.VocabAPI().save_progress({"abandon_cet4": {"interval": 1}})

            stored = json.loads((app.PROGRESS_DIR / "progress.json").read_text(encoding="utf-8"))
        self.assertEqual(stored["schemaVersion"], app.DATA_SCHEMA_VERSION)
        self.assertEqual(stored["data"]["abandon_cet4"]["interval"], 1)

    def test_write_data_transaction_commits_all_files(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            progress_file = app.PROGRESS_DIR / "progress.json"
            stats_file = app.STATS_DIR / "stats.json"

            result = app.write_data_transaction({
                progress_file: {"new_cet4": {"interval": 3}},
                stats_file: {"daily": {"2026-07-16": {"studied": 1, "correct": 1, "total": 1}}},
            })

            progress = json.loads(progress_file.read_text(encoding="utf-8"))
            stats = json.loads(stats_file.read_text(encoding="utf-8"))

        self.assertTrue(result)
        self.assertEqual(progress["data"]["new_cet4"]["interval"], 3)
        self.assertEqual(stats["data"]["daily"]["2026-07-16"]["studied"], 1)

    def test_write_data_transaction_rolls_back_on_replace_failure(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            progress_file = app.PROGRESS_DIR / "progress.json"
            stats_file = app.STATS_DIR / "stats.json"
            app.write_data_json(str(progress_file), {"old_cet4": {"interval": 9}})
            app.write_data_json(str(stats_file), {"daily": {}, "streak": 4})
            real_replace = os.replace

            def fail_second_commit(source, target):
                source_path = Path(source)
                target_path = Path(target)
                if source_path.name.startswith(".vocabmaster-transaction-") and target_path == stats_file:
                    raise OSError("simulated replace failure")
                return real_replace(source, target)

            with contextlib.redirect_stdout(io.StringIO()):
                with mock.patch.object(app.os, "replace", side_effect=fail_second_commit):
                    result = app.write_data_transaction({
                        progress_file: {"new_cet4": {"interval": 1}},
                        stats_file: {"daily": {}, "streak": 0},
                    })

            progress = app.read_data_json(str(progress_file), {})
            stats = app.read_data_json(str(stats_file), {})

        self.assertFalse(result)
        self.assertIn("old_cet4", progress)
        self.assertNotIn("new_cet4", progress)
        self.assertEqual(stats["streak"], 4)

    def test_save_learning_state_commits_progress_stats_and_settings(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            api = app.VocabAPI()

            result = api.save_learning_state(
                {"word_cet4": {"interval": 1, "repetitions": 1, "ef": 2.5}},
                {"daily": {"2026-07-16": {"studied": 1, "correct": 1, "total": 1}}, "streak": 1},
                {"fontSize": 18, "dailyGoal": 30, "category": "cet4"},
            )

            progress = api.get_progress()
            stats = api.get_stats()
            settings = api.get_settings()

        self.assertTrue(result["success"])
        self.assertIn("word_cet4", progress)
        self.assertEqual(stats["streak"], 1)
        self.assertEqual(settings["category"], "cet4")

    def test_saved_progress_settings_and_daily_session_survive_api_restart(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)

            first_api = app.VocabAPI()
            first_api.save_settings({
                "fontSize": 20,
                "dailyGoal": 2,
                "darkMode": True,
                "category": "cet6",
                "newLearningSession": {
                    "date": "2026-07-07",
                    "category": "cet6",
                    "target": 2,
                    "wordKeys": ["abandon_cet6", "ability_cet6"],
                    "completedKeys": ["abandon_cet6"]
                }
            })
            first_api.save_progress({
                "abandon_cet6": {
                    "interval": 1,
                    "repetitions": 1,
                    "ef": 2.6,
                    "nextReview": "2026-07-08"
                }
            })
            first_api.save_stats({
                "daily": {"2026-07-07": {"studied": 1, "correct": 1, "total": 1}},
                "streak": 1,
                "lastStudyDate": "2026-07-07"
            })

            reopened_api = app.VocabAPI()
            settings = reopened_api.get_settings()
            progress = reopened_api.get_progress()
            stats = reopened_api.get_stats()

        self.assertEqual(settings["category"], "cet6")
        self.assertEqual(settings["newLearningSession"]["completedKeys"], ["abandon_cet6"])
        self.assertEqual(progress["abandon_cet6"]["repetitions"], 1)
        self.assertEqual(stats["daily"]["2026-07-07"]["studied"], 1)

    def test_validate_and_migrate_wraps_legacy_data(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            (app.PROGRESS_DIR / "progress.json").write_text(
                json.dumps({"legacy_cet4": {"interval": 2, "repetitions": 1}}),
                encoding="utf-8",
            )

            app.validate_and_migrate()

            stored = json.loads((app.PROGRESS_DIR / "progress.json").read_text(encoding="utf-8"))
        self.assertEqual(stored["schemaVersion"], app.DATA_SCHEMA_VERSION)
        self.assertIn("legacy_cet4", stored["data"])

    def test_corrupt_progress_recovers_from_latest_backup(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            older = app.BACKUPS_DIR / "vocabmaster-auto-20260101-000000.json"
            newer = app.BACKUPS_DIR / "vocabmaster-auto-20260102-000000.json"
            older.write_text(json.dumps({"progress": {"old_cet4": {"interval": 1}}}), encoding="utf-8")
            newer.write_text(json.dumps({"progress": {"new_cet4": {"interval": 3}}}), encoding="utf-8")
            (app.PROGRESS_DIR / "progress.json").write_text("{broken json", encoding="utf-8")

            with contextlib.redirect_stdout(io.StringIO()):
                progress = app.VocabAPI().get_progress()

        self.assertEqual(progress["new_cet4"]["interval"], 3)

    def test_backup_management_lists_restores_deletes_and_prunes(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            api = app.VocabAPI()
            for idx in range(22):
                (app.PROGRESS_DIR / "progress.json").write_text(
                    json.dumps({"word_cet4": {"interval": idx}}),
                    encoding="utf-8",
                )
                api._create_safety_backup(f"manual-{idx:02d}")

            backups = api.list_backups()
            restore_id = backups[0]["id"]
            restored = api.restore_backup(restore_id)
            deleted = api.delete_backup(restore_id)
            remaining = api.list_backups()

        self.assertEqual(len(backups), 20)
        self.assertTrue(restored["success"])
        self.assertTrue(deleted["success"])
        self.assertEqual(len(remaining), 19)

    def test_preview_import_words_counts_added_duplicates_and_invalid(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._use_temp_data_dirs(app, root)
            app.write_data_json(str(app.WORDS_DATA_DIR / "cet4.json"), [{"word": "known", "meaning": "已知"}])

            preview = app.VocabAPI().preview_import_words({
                "category": "cet4",
                "words": [
                    {"word": "known", "meaning": "重复"},
                    {"word": "new", "meaning": "新增"},
                    {"word": "", "meaning": "无效"}
                ]
            })

        self.assertEqual(preview["added"], 1)
        self.assertEqual(preview["duplicates"], 1)
        self.assertEqual(preview["invalid"], 1)

    def test_add_custom_word_reports_write_failure(self):
        app = importlib.import_module("app")

        with tempfile.TemporaryDirectory() as tmp:
            self._use_temp_data_dirs(app, Path(tmp))
            with mock.patch.object(app, "write_data_json", return_value=False):
                result = app.VocabAPI().add_custom_word(
                    "cet4",
                    {"word": "optics", "meaning": "光学"},
                )

        self.assertFalse(result["success"])
        self.assertIn("保存失败", result["message"])


if __name__ == "__main__":
    unittest.main()
