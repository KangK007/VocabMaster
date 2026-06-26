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
]

for name in FILES:
    path = ROOT / name
    ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))

print("Python syntax OK")
