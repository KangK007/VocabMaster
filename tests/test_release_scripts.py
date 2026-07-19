import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ReleaseScriptTests(unittest.TestCase):
    def test_package_scripts_include_release_workflow(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8-sig"))
        scripts = package["scripts"]

        self.assertIn("release:check", scripts)
        self.assertIn("release:sign", scripts)
        self.assertIn("release:build", scripts)
        self.assertIn("check_release_artifacts.ps1", scripts["release:check"])
        self.assertIn("sign_release_artifacts.ps1", scripts["release:sign"])
        self.assertIn("build_release.ps1", scripts["release:build"])

    def test_private_release_material_is_ignored(self):
        gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8-sig")

        self.assertIn(".release.local.ps1", gitignore)
        self.assertIn("*.pfx", gitignore)
        self.assertIn("*.p12", gitignore)

    def test_release_metadata_template_documents_required_values(self):
        template = (ROOT / "scripts" / "release_metadata.example.ps1").read_text(
            encoding="utf-8-sig"
        )

        for name in (
            "VOCABMASTER_PUBLISHER",
            "VOCABMASTER_SUPPORT_URL",
            "VOCABMASTER_PRIVACY_CONTACT",
            "VOCABMASTER_DOWNLOAD_URL",
            "VOCABMASTER_SIGN_CERT_PATH",
            "VOCABMASTER_TIMESTAMP_URL",
        ):
            self.assertIn(name, template)


if __name__ == "__main__":
    unittest.main()
