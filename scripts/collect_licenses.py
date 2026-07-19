"""Collect project and installed runtime license files into a release folder."""

import argparse
import re
import shutil
from importlib.metadata import distribution
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
METADATA_ONLY = {
    "proxy-tools",
    "winrt-runtime",
    "winrt-windows-data-xml-dom",
    "winrt-windows-foundation",
    "winrt-windows-foundation-collections",
    "winrt-windows-ui-notifications",
}


def runtime_packages(requirements_file):
    packages = []
    for line in requirements_file.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith(("#", "-")) and "==" in stripped:
            packages.append(stripped.split("==", 1)[0])
    return packages


def collect(output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    missing = []
    for package in runtime_packages(ROOT / "requirements.txt"):
        dist = distribution(package)
        license_files = [
            file for file in (dist.files or [])
            if re.search(r"(^|[._-])(license|copying|notice)([._-]|$)", file.name, re.IGNORECASE)
        ]
        if not license_files and package not in METADATA_ONLY:
            missing.append(package)
        for index, relative in enumerate(license_files, start=1):
            source = Path(dist.locate_file(relative))
            suffix = source.suffix or ".txt"
            target = output_dir / f"{package}-{dist.version}-{index}{suffix}"
            shutil.copy2(source, target)

    shutil.copy2(ROOT / "LICENSE", output_dir / "VocabMaster-LICENSE.txt")
    shutil.copy2(ROOT / "THIRD_PARTY_NOTICES.md", output_dir / "THIRD_PARTY_NOTICES.md")
    shutil.copy2(ROOT / "docs" / "licenses" / "ECDICT-LICENSE.txt", output_dir / "ECDICT-LICENSE.txt")
    if missing:
        raise RuntimeError("Missing packaged license files: " + ", ".join(missing))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    collect(args.output)
    print(f"License files collected: {args.output}")


if __name__ == "__main__":
    main()
