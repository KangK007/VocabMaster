# VocabMaster - 英语背单词桌面软件

高效、科学的英语单词记忆软件，采用 **SM-2 间隔重复算法**，帮助系统性掌握高频词汇。

**版本：** 2.0.0

## 功能特性

- **内置词库**：CET-4、CET-6、考研、雅思、托福核心词汇，每个单词包含释义、音标、例句。
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

- Python 3.8+
- Windows 10/11（使用 Edge WebView2）

### 安装与运行

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. （可选）重新生成内置示例词库
python build_wordbanks.py

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
| `1` | 标记为“忘记了”（显示释义） |
| `2` | 标记为“记得了”（显示释义） |
| `3` | 标记为“太简单”（显示释义） |
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
├── build_wordbanks.py     # 词库生成脚本
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

当前仓库内置的是示例/核心小词库，不是完整考试大纲词库。当前数量约为：CET-4 101 个，CET-6/考研/雅思/托福各 50 个。若用于正式备考，应补充词库来源、许可、生成参数和词条校验流程。

## 数据位置

默认情况下，学习进度、统计、设置、收藏和自定义单词保存在用户数据目录：

- Windows: `%APPDATA%\VocabMaster`
- macOS: `~/Library/Application Support/VocabMaster`
- Linux: `$XDG_DATA_HOME/VocabMaster` 或 `~/.local/share/VocabMaster`

如果需要便携模式，可以在启动前设置环境变量 `VOCABMASTER_PORTABLE=1`，此时数据会写入项目内 `data/`。

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
