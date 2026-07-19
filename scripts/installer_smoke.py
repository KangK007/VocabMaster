"""Verify silent install, upgrade, launch, uninstall, and data retention."""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INSTALLER = ROOT / "dist" / "installer" / "VocabMaster-Setup-2.0.0.exe"


def run_checked(command, *, env=None, timeout=180):
    result = subprocess.run(
        [str(item) for item in command],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {' '.join(map(str, command))}\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result


def install(installer, install_dir, log_path):
    run_checked([
        installer,
        "/VERYSILENT",
        "/SUPPRESSMSGBOXES",
        "/NORESTART",
        "/NOCANCEL",
        "/NOICONS",
        "/LANG=chinesesimplified",
        f"/DIR={install_dir}",
        f"/LOG={log_path}",
    ])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--installer", type=Path, default=DEFAULT_INSTALLER)
    args = parser.parse_args()

    if sys.platform != "win32":
        print("installer smoke skipped: Windows only")
        return 0

    installer = args.installer.resolve()
    if not installer.is_file():
        raise FileNotFoundError(installer)

    artifact_dir = ROOT / "artifacts" / "installer-smoke"
    if artifact_dir.exists():
        shutil.rmtree(artifact_dir)
    artifact_dir.mkdir(parents=True)

    sandbox = artifact_dir / "sandbox"
    install_dir = sandbox / "Programs" / "VocabMaster"
    data_dir = sandbox / "AppData" / "Roaming" / "VocabMaster"
    progress_file = data_dir / "progress" / "progress.json"
    install_log = artifact_dir / "install.log"
    upgrade_log = artifact_dir / "upgrade.log"
    uninstall_log = artifact_dir / "uninstall.log"

    install(installer, install_dir, install_log)
    app_exe = install_dir / "VocabMaster.exe"
    if not app_exe.is_file():
        raise AssertionError(f"Installed executable missing: {app_exe}")

    run_checked([
        sys.executable,
        ROOT / "scripts" / "desktop_smoke.py",
        "--app",
        app_exe,
    ], timeout=120)

    progress_file.parent.mkdir(parents=True, exist_ok=True)
    expected_progress = {
        "schemaVersion": 1,
        "data": {"installer_smoke_cet4": {"interval": 3, "repetitions": 2}},
    }
    progress_file.write_text(
        json.dumps(expected_progress, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    install(installer, install_dir, upgrade_log)
    actual_progress = json.loads(progress_file.read_text(encoding="utf-8"))
    if actual_progress != expected_progress:
        raise AssertionError("Upgrade modified user progress data")

    uninstallers = sorted(install_dir.glob("unins*.exe"))
    if len(uninstallers) != 1:
        raise AssertionError(f"Expected one uninstaller, found {len(uninstallers)}")
    run_checked([
        uninstallers[0],
        "/VERYSILENT",
        "/SUPPRESSMSGBOXES",
        "/NORESTART",
        f"/LOG={uninstall_log}",
    ])

    if app_exe.exists():
        raise AssertionError("Uninstall left the application executable behind")
    actual_progress = json.loads(progress_file.read_text(encoding="utf-8"))
    if actual_progress != expected_progress:
        raise AssertionError("Uninstall removed or modified user progress data")

    print("installer smoke passed: install, launch, upgrade, uninstall, data retained")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
