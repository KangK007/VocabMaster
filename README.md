# VocabMaster - 英语背单词桌面软件

高效、科学的英语单词记忆软件，采用 **SM-2 间隔重复算法**，帮助系统性掌握高频词汇。

**版本：** 2.0.0

项目版本号以根目录 [VERSION](VERSION) 为准，`package.json`、`app.py`、`README.md` 和 `CHANGELOG.md` 会通过 `npm run check` 做一致性检查。

## 功能特性

- **内置词库**：基于 ECDICT 考试标签生成 CET-4、CET-6、考研、雅思、托福词库，包含单词、释义和音标；ECDICT 未提供例句的词条会显示明确占位说明。
- **四种学习模式**：
  - **复习模式**：基于 SM-2 算法智能安排到期复习。
  - **新学模式**：在完成到期复习后补足每日目标。
  - **强化模式**：根据遗忘次数、EF 难度系数和收藏状态集中练习薄弱词。
  - **测试模式**：选择题测验，检验学习成果。
- **间隔重复**：采用 SuperMemo-2 算法，根据记忆效果自动调整复习间隔。
- **学习统计**：日历热力图和正确率趋势图，可视化学习进度。
- **单词搜索**：快速查找词库中的任意单词。
- **收藏系统**：标记重点单词，方便集中复习。
- **单词详情**：查看每个单词的 SM-2 数据，包括间隔、次数、难度系数。
- **深色模式**：保护夜间学习视力。
- **发音功能**：使用系统语音引擎朗读单词。
- **自定义单词**：支持添加个人单词，可导入/导出词库。
- **灵活设置**：字体大小、每日目标和深色模式可保存；每日复习量由 SM-2 到期词动态决定。
- **达成庆祝**：完成每日目标时触发彩带效果。
- **键盘快捷键**：提高学习效率。
- **数据安全**：原子写入防止数据损坏，启动时自动验证数据完整性；恢复和重置前会自动创建安全备份。

## 快速开始

### 环境要求

- Python 3.12+（源码运行、测试和发布构建建议使用同一主版本）
- Windows 10/11（使用 Edge WebView2）

### 安装与运行

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. （可选）重新生成 ECDICT 内置词库
python scripts/import_ecdict_wordbanks.py --download

# 3. 运行应用（双击 run.pyw 或通过命令行）
pythonw run.pyw
```

### 设置桌面快捷方式和开机自启

```bash
python setup_shortcuts.py
```

## 操作指南

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `1` | 标记为“认识”（显示释义） |
| `2` | 标记为“模糊”（显示释义） |
| `3` | 标记为“忘记”（显示释义） |
| `→` | 切换到下一个单词 |
| `←` | 返回上一个单词 |
| `Space` | 发音 |
| `R` | 切换到复习模式 |
| `N` | 切换到新学模式 |
| `W` | 切换到强化模式 |
| `T` | 切换到测试模式 |
| `Ctrl+N` | 添加自定义单词 |
| `Esc` | 关闭弹窗 |

### 学习流程

1. 选择词库（CET-4/CET-6/考研/雅思/托福）。
2. 选择学习模式（复习/新学/强化/测试）。
3. 看到单词后先回忆释义，按 1/2/3 评级。
4. 评级后释义自动显示，确认后按 `→` 手动切换下一个。
5. 系统自动记录进度并安排 SM-2 复习时间。
6. 点击进度条区域展开单词详情面板。
7. 点击右上角星标收藏单词。

## 项目结构

```text
VocabMaster/
├── run.pyw                # 桌面启动入口（双击运行，无命令行窗口）
├── app.py                 # Python 桌面应用主程序
├── requirements.txt       # Python 依赖
├── build_wordbanks.py     # 历史示例词库生成脚本
├── generate_icon.py       # 图标生成脚本
├── setup_shortcuts.py     # 快捷方式和开机自启设置
├── launch.bat             # 正常启动脚本
├── launch_startup.bat     # 最小化启动脚本（开机自启用）
├── assets/                # 应用图标
├── data/                  # 旧版/便携模式用户数据；默认运行数据保存到系统用户目录
├── scripts/               # 项目检查脚本
├── tests/                 # Python/JavaScript 测试
├── src/
│   ├── index.html         # 主界面
│   ├── styles.css         # 样式表（含深色模式）
│   ├── app.js             # 前端界面逻辑
│   ├── core-utils.js      # 可测试通用工具
│   ├── learning-intelligence.js # 薄弱词和学习报告逻辑
│   ├── sm2-scheduler.js   # SM-2 和队列调度逻辑
│   └── words/             # 内置词库
│       ├── cet4.json
│       ├── cet6.json
│       ├── postgraduate.json
│       ├── ielts.json
│       └── toefl.json
```

## 技术栈

- **前端**：HTML5 + CSS3 + Vanilla JavaScript (Canvas 图表)
- **桌面框架**：pywebview（基于系统原生 WebView2）
- **后端**：Python 3
- **算法**：SM-2 (SuperMemo 2) 间隔重复
- **发音**：Web Speech API
- **数据存储**：JSON 文件（原子写入）。默认保存到系统用户数据目录；设置 `VOCABMASTER_PORTABLE=1` 时使用项目内 `data/`。

## 词库说明

当前仓库内置词库由 ECDICT 的考试标签生成，数量为：CET-4 3849 个、CET-6 5407 个、考研 4801 个、IELTS 5040 个、TOEFL 6974 个。

这些词库是 ECDICT 标签词库，不是教育部、考试院、IELTS 或 ETS 发布的官方考试大纲原件，不能宣传为“官方完整考纲”。词库来源、许可、上游 commit、字段映射和校验流程见 [docs/wordbank-sources.md](docs/wordbank-sources.md)。

## 数据位置

默认情况下，学习进度、统计、设置、收藏和自定义单词保存在用户数据目录：

- Windows: `%APPDATA%\VocabMaster`
- macOS: `~/Library/Application Support/VocabMaster`
- Linux: `$XDG_DATA_HOME/VocabMaster` 或 `~/.local/share/VocabMaster`

如果需要便携模式，可以在启动前设置环境变量 `VOCABMASTER_PORTABLE=1`，此时数据会写入项目内 `data/`。

## 数据安全与恢复

- 本地数据文件使用 `schemaVersion` 包装，启动时会自动迁移旧版裸 JSON 数据。
- 写入进度、统计、设置、收藏和自定义词库时使用原子写入，降低写入中断造成的数据损坏风险。
- 恢复备份和重置进度前会自动创建安全备份。
- 如果 `progress.json` 等数据文件损坏，应用会尝试从最近的本地备份恢复对应数据。
- 设置弹窗中的“管理备份”可以查看最近安全备份，并执行恢复或删除。
- 自动安全备份默认只保留最近 20 个。
- 导入词库会先统计新增、重复和无效词条数量；取消导入或文件格式错误不会写入现有词库。

## Windows 打包、安装与卸载

### 生成 Windows 可执行程序

发布构建要求 Python 3.12 或 3.13。先创建独立构建环境：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup_build_env.ps1 -PythonPath "C:\path\to\python.exe"
```

`requirements.txt` 和 `requirements-build.txt` 是由 `pip-tools` 根据对应 `.in` 文件生成的锁文件。不要使用包含其他科研包的全局环境生成发布包。

然后执行清洁构建：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_windows.ps1 -Clean
```

成功后产物位于：

```text
dist/VocabMaster/VocabMaster.exe
```

构建脚本只写入项目内的 `build/` 和 `dist/`，不会创建桌面快捷方式或把压缩包写到桌面。可运行以下命令验证真实窗口生命周期：

```powershell
.venv-build\Scripts\python.exe scripts\desktop_smoke.py --app dist\VocabMaster\VocabMaster.exe
```

### 运行要求

- Windows 10/11。
- 系统可用 Edge WebView2 Runtime。大多数 Windows 10/11 已预装；若无法启动窗口，应先安装 Microsoft Edge WebView2 Runtime。
- 用户数据默认保存到 `%APPDATA%\VocabMaster`，不会写入安装目录。

### 安装方式

安装器使用 Inno Setup 7。在已有 `dist/VocabMaster/` 的前提下执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_installer.ps1 -IsccPath "C:\path\to\ISCC.exe"
```

安装器输出到 `dist/installer/`，默认安装到当前用户的 `%LOCALAPPDATA%\Programs\VocabMaster`，不要求管理员权限。离线静默安装可使用 Inno Setup 标准参数 `/VERYSILENT /NORESTART`。

当前安装器尚未进行 Authenticode 签名，也没有自动更新服务；这两项是对外发布前的阻断项。不得用占位网址或测试证书替代真实发布者材料。

### 卸载方式

正式安装后可从 Windows“已安装的应用”卸载；目录包可直接删除复制出的程序目录。

默认卸载不删除用户数据。若用户明确要清空所有学习数据，可手动删除：

```text
%APPDATA%\VocabMaster
```

删除该目录会移除学习进度、统计、设置、收藏、自定义词库和本地安全备份，执行前建议先导出备份。

## 隐私与许可证

- 项目许可证：`LICENSE`（MIT）。
- 隐私说明：`docs/privacy-policy.md`。
- 第三方软件和数据声明：`THIRD_PARTY_NOTICES.md`。
- ECDICT 完整许可证：`docs/licenses/ECDICT-LICENSE.txt`。

发布构建会把可获得的第三方许可证文本收集到 `dist/VocabMaster/licenses/`。软件市场提交前仍需由真实发布者补充支持地址或隐私联系渠道。

Windows 分发渠道、签名和更新门禁见 `docs/distribution.md`。面向 Microsoft Store 时应在获得真实 Partner Center 发布者身份后生成 MSIX；Inno Setup 仅作为已签名的直接下载或离线分发渠道。

## 导入自定义词库

支持导入 JSON 格式的词库文件：

```json
{
  "category": "cet4",
  "words": [
    {
      "word": "example",
      "phonetic": "/ɪɡˈzæmpəl/",
      "meaning": "n. 例子；范例",
      "example": "This is a good example.",
      "exampleTranslation": "这是一个好例子。"
    }
  ]
}
```

可选类别：`cet4`, `cet6`, `postgraduate`, `ielts`, `toefl`, `custom`
