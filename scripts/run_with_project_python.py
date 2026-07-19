"""Run a project script with the build Python when it is available."""

import subprocess
import sys
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/run_with_project_python.py <script> [args...]")
        return 2

    root = Path(__file__).resolve().parents[1]
    build_python = root / ".venv-build" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    python = build_python if build_python.exists() else Path(sys.executable)
    script = root / sys.argv[1]
    command = [str(python), str(script), *sys.argv[2:]]
    return subprocess.call(command, cwd=root)


if __name__ == "__main__":
    raise SystemExit(main())
