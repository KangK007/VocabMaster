"""
Setup script for VocabMaster:
- Creates desktop shortcut with custom icon
- Adds entry to Windows Startup folder for auto-start on boot (minimized)
"""
import os
import sys
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LAUNCHER = os.path.join(BASE_DIR, 'launch.bat')
LAUNCHER_STARTUP = os.path.join(BASE_DIR, 'launch_startup.bat')
ICON = os.path.join(BASE_DIR, 'assets', 'icon.ico')
APP_NAME = 'VocabMaster'

DESKTOP = os.path.join(os.environ['USERPROFILE'], 'Desktop')
STARTUP = os.path.join(
    os.environ['APPDATA'],
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
)


def create_shortcut(target_path, shortcut_name, icon_path, working_dir, launcher_path):
    """Create a .lnk shortcut using PowerShell COM."""
    ps_script = f'''
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut("{target_path}\\{shortcut_name}.lnk")
$Shortcut.TargetPath = "{launcher_path}"
$Shortcut.IconLocation = "{icon_path}"
$Shortcut.WorkingDirectory = "{working_dir}"
$Shortcut.WindowStyle = 7
$Shortcut.Description = "VocabMaster - 高效英语背单词软件"
$Shortcut.Save()
Write-Output "OK"
'''
    try:
        result = subprocess.run(
            ['powershell', '-NoProfile', '-Command', ps_script],
            capture_output=True, text=True, timeout=30
        )
        return result.returncode == 0 and 'OK' in result.stdout
    except Exception as e:
        print(f'  Error: {e}')
        return False


def remove_shortcut(target_path, shortcut_name):
    """Remove a shortcut if it exists."""
    shortcut_path = os.path.join(target_path, f'{shortcut_name}.lnk')
    if os.path.exists(shortcut_path):
        os.remove(shortcut_path)
        return True
    return False


def main():
    print('=' * 50)
    print('  VocabMaster - Shortcut & Startup Setup')
    print('=' * 50)
    print()

    # Check essential files
    for f, name in [(LAUNCHER, 'launch.bat'), (LAUNCHER_STARTUP, 'launch_startup.bat'), (ICON, 'icon.ico')]:
        if not os.path.exists(f):
            print(f'[ERROR] {name} not found: {f}')
            sys.exit(1)

    print(f'[INFO] App dir: {BASE_DIR}')
    print()

    # --- Desktop Shortcut ---
    print('--- Desktop Shortcut ---')
    choice = input('Create desktop shortcut? [Y/n]: ').strip().lower()
    if choice != 'n':
        # Remove old shortcut first (in case launcher changed)
        remove_shortcut(DESKTOP, APP_NAME)
        if create_shortcut(DESKTOP, APP_NAME, ICON, BASE_DIR, LAUNCHER):
            print(f'[OK] Desktop shortcut: {DESKTOP}\\{APP_NAME}.lnk')
        else:
            print('[FAIL] Could not create desktop shortcut')
    else:
        print('[SKIP] Desktop shortcut')

    print()

    # --- Auto-start (minimized) ---
    print('--- Auto-start on Boot (minimized) ---')
    choice = input('Set auto-start on boot? [Y/n]: ').strip().lower()
    if choice != 'n':
        remove_shortcut(STARTUP, APP_NAME)
        if create_shortcut(STARTUP, APP_NAME, ICON, BASE_DIR, LAUNCHER_STARTUP):
            print(f'[OK] Auto-start set (minimized): {STARTUP}\\{APP_NAME}.lnk')
        else:
            print('[FAIL] Could not set auto-start')
    else:
        print('[SKIP] Auto-start')

    print()
    print('=' * 50)
    print('  Setup complete!')
    print('  Desktop: normal launch | Startup: minimized launch')
    print('=' * 50)


if __name__ == '__main__':
    main()
