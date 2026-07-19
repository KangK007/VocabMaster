"""Syntax-check Python entry points without writing __pycache__ files."""
import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "app.py",
    "build_wordbanks.py",
    "generate_icon.py",
    "setup_shortcuts.py",
    "run.pyw",
    "scripts/import_ecdict_wordbanks.py",
    "scripts/generate_practical_examples.py",
    "scripts/validate_wordbanks.py",
    "scripts/validate_public_site.py",
    "scripts/check_version_consistency.py",
]

for name in FILES:
    path = ROOT / name
    ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))

print("Python syntax OK")
