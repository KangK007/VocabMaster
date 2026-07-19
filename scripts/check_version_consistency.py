"""Check that project version declarations stay in sync."""
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+$")


def _extract(pattern, text, label):
    match = re.search(pattern, text, re.MULTILINE)
    if not match:
        raise ValueError(f"{label}: version not found")
    return match.group(1)


def collect_versions(root=ROOT):
    root = Path(root)
    versions = {
        "VERSION": (root / "VERSION").read_text(encoding="utf-8-sig").strip(),
        "package.json": json.loads((root / "package.json").read_text(encoding="utf-8-sig"))["version"],
        "app.py": _extract(
            r"^__version__\s*=\s*['\"]([^'\"]+)['\"]",
            (root / "app.py").read_text(encoding="utf-8-sig"),
            "app.py",
        ),
        "README.md": _extract(
            r"\*\*版本：\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)",
            (root / "README.md").read_text(encoding="utf-8-sig"),
            "README.md",
        ),
        "CHANGELOG.md": _extract(
            r"^##\s+([0-9]+\.[0-9]+\.[0-9]+)\s+-",
            (root / "CHANGELOG.md").read_text(encoding="utf-8-sig"),
            "CHANGELOG.md",
        ),
    }
    optional_versions = {
        "installer.iss": (r'^#define\s+AppVersion\s+"([^"]+)"', root / "installer.iss"),
        "assets/version_info.txt": (
            r"StringStruct\('FileVersion',\s*'([^']+)'\)",
            root / "assets" / "version_info.txt",
        ),
    }
    for label, (pattern, path) in optional_versions.items():
        if path.exists():
            versions[label] = _extract(
                pattern,
                path.read_text(encoding="utf-8-sig"),
                label,
            )
    return versions


def check_version_consistency(root=ROOT):
    errors = []
    try:
        versions = collect_versions(root)
    except Exception as exc:
        return [str(exc)]

    expected = versions["VERSION"]
    if not SEMVER_RE.match(expected):
        errors.append(f"VERSION: '{expected}' is not semantic version x.y.z")

    for label, version in versions.items():
        if version != expected:
            errors.append(f"{label}: version '{version}' does not match VERSION '{expected}'")
    return errors


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
    errors = check_version_consistency(root)
    if errors:
        for error in errors:
            print(error)
        return 1
    print("Version declarations OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
