import tempfile
import unittest
from pathlib import Path


class VersionConsistencyTests(unittest.TestCase):
    def test_reads_expected_versions_from_project_files(self):
        from scripts.check_version_consistency import collect_versions

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "VERSION").write_text("2.0.0\n", encoding="utf-8")
            (root / "package.json").write_text('{"version": "2.0.0"}', encoding="utf-8")
            (root / "app.py").write_text("__version__ = '2.0.0'\n", encoding="utf-8")
            (root / "README.md").write_text("**版本：** 2.0.0\n", encoding="utf-8")
            (root / "CHANGELOG.md").write_text("## 2.0.0 - Unreleased\n", encoding="utf-8")

            versions = collect_versions(root)

        self.assertEqual(set(versions.values()), {"2.0.0"})

    def test_reports_mismatched_versions(self):
        from scripts.check_version_consistency import check_version_consistency

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "VERSION").write_text("2.0.0\n", encoding="utf-8")
            (root / "package.json").write_text('{"version": "2.0.1"}', encoding="utf-8")
            (root / "app.py").write_text("__version__ = '2.0.0'\n", encoding="utf-8")
            (root / "README.md").write_text("**版本：** 2.0.0\n", encoding="utf-8")
            (root / "CHANGELOG.md").write_text("## 2.0.0 - Unreleased\n", encoding="utf-8")

            errors = check_version_consistency(root)

        self.assertTrue(any("package.json" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
