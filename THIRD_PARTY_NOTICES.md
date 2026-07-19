# 第三方软件与数据声明

本文件对应 `requirements.txt` 中锁定的 VocabMaster 2.0.0 Windows 运行时。构建脚本会把已安装发行包随附的 LICENSE/COPYING/NOTICE 文件收集到发布目录的 `licenses/`。

| 组件 | 版本 | 许可证 | 用途/来源 |
| --- | --- | --- | --- |
| pywebview | 6.2.1 | BSD-3-Clause | Windows WebView 桌面壳层 |
| Pillow | 12.3.0 | MIT-CMU | 托盘图标图像处理 |
| pystray | 0.19.5 | LGPL-3.0 | Windows 系统托盘 |
| windows-toasts | 1.3.1 | Apache-2.0 | Windows 学习提醒 |
| bottle | 0.13.4 | MIT | pywebview 本地资源服务依赖 |
| proxy-tools | 0.1.0 | MIT | pywebview 依赖 |
| pythonnet | 3.1.0 | MIT | pywebview Windows/.NET 互操作 |
| clr-loader | 0.3.1 | MIT | pythonnet 运行时加载 |
| cffi | 2.1.0 | MIT-0 | CLR 加载依赖 |
| pycparser | 3.0 | BSD-3-Clause | cffi 解析依赖 |
| six | 1.17.0 | MIT | pystray 兼容层 |
| typing-extensions | 4.16.0 | PSF-2.0 | 类型兼容层 |
| winrt-runtime 及 Windows 命名空间包 | 3.2.1 | MIT | Windows 通知 API 绑定 |
| ECDICT | commit `bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b` | MIT | 内置考试标签词库数据 |

构建工具 PyInstaller 6.21.0 使用 GPL-2.0-or-later，并带有允许分发所生成程序的特殊例外。Microsoft Edge WebView2 Runtime 是系统前置组件，本项目不重新分发。

上游地址和 ECDICT 导入审计见 `docs/wordbank-sources.md`。本声明不替代各组件的完整许可证文本。
