# -*- mode: python ; coding: utf-8 -*-

import os
from pathlib import Path


ROOT = Path.cwd()
VERSION_INFO_FILE = os.environ.get('VOCABMASTER_VERSION_INFO_FILE', 'assets/version_info.txt')


a = Analysis(
    ['app.py'],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        ('src', 'src'),
        ('assets', 'assets'),
    ],
    hiddenimports=['webview', 'windows_toasts'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['PyQt5', 'PyQt6', 'PySide2', 'PySide6'],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='VocabMaster',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon='assets/icon.ico',
    version=VERSION_INFO_FILE,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='VocabMaster',
)
