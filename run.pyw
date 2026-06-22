"""
VocabMaster - 无控制台窗口启动入口
使用 pythonw.exe 运行，不显示命令行窗口。
双击此文件即可启动，或通过 launch.bat 启动。
"""
import sys
import os

# Ensure the app directory is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import main

if __name__ == '__main__':
    main()
