# VocabMaster 运行检测报告

检测时间：2026-07-19 +08:00
检测分支：`codex/production-readiness`
检测范围：功能自动化、数据安全、依赖健康、发布产物和软件市场阻断项。

## 1. 汇总结论

核心功能自动化测试通过，当前构建适合继续内部试用和发布前验收；公开软件市场发布仍被代码签名和真实发布者资料阻断。

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| 静态检查 | 通过 | Python 语法、版本一致性、词库校验、前端 JS 语法均通过 |
| 单元测试 | 通过 | Python `unittest` 43 项通过，Node 单元测试全部通过 |
| 浏览器 E2E | 通过 | Playwright 43 项通过 |
| npm 依赖漏洞 | 通过 | `npm audit --audit-level=moderate` 返回 0 vulnerabilities |
| 敏感信息扫描 | 通过，低风险误报 | 命中内容为文档示例和词库单词，未发现真实私钥/API key |
| 发布产物 | 存在 | `dist/VocabMaster/VocabMaster.exe` 和 `dist/installer/VocabMaster-Setup-2.0.0.exe` 均存在 |
| 发布签名 | 阻断 | EXE 和安装器 Authenticode 状态均为 `NotSigned` |
| 发布者资料 | 阻断 | 未提供真实支持 URL、隐私联系方式和版本化下载/更新地址 |
| Git 发布基线 | 通过 | 发布就绪优化已整理成本地提交，生成物和本地凭据不纳入 Git |
| 桌面烟测 | 通过 | 覆盖启动、托盘关闭、热键恢复、二次启动唤醒和退出 |
| 安装器烟测 | 通过 | 覆盖安装、启动、升级、卸载和用户数据保留 |

## 2. 已执行命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm run check` | 通过：`Python syntax OK`、`Version declarations OK`、`Word banks OK` |
| `npm test` | 通过：Python `Ran 43 tests`，`OK`；Node 单元测试无失败 |
| `npm run e2e` | 通过：Playwright `43 passed` |
| `npm audit --audit-level=moderate` | 通过：`found 0 vulnerabilities` |
| `rg` 敏感信息扫描 | 未发现真实密钥；命中文档示例和词库普通单词 |
| `Get-AuthenticodeSignature dist/...` | 阻断：EXE 和安装器均为 `NotSigned` |
| `npm run release:check` | 阻断：未签名、缺真实发布者资料；已提供本地发布配置和签名脚本 |
| `npm run desktop:smoke` | 通过：`launch, tray close, hotkey restore, second-instance restore, exit` |
| `npm run installer:smoke` | 通过：`install, launch, upgrade, uninstall, data retained` |

## 3. 功能覆盖情况

| 功能域 | 覆盖方式 | 结果 |
| --- | --- | --- |
| 学习主流程 | E2E：加载、揭示释义、评级、今日统计 | 通过 |
| 桌面布局 | E2E：最小窗口、常见尺寸、深色模式 | 通过 |
| 新手引导 | E2E：首次显示、跳过后持久化 | 通过 |
| 搜索与跳转 | E2E：搜索单词并跳转 | 通过 |
| 测试模式 | E2E：选择题、拼写、听音 | 通过 |
| 学习解释 | E2E：词卡提示、词根词缀、计划原因 | 通过 |
| 词库页 | E2E：打开独立词库页并切换词库 | 通过 |
| 统计页 | E2E：摘要、复习压力预测、周报、本地成就 | 通过 |
| 学习档案 | E2E：导出、恢复备份、备份管理 | 通过 |
| 设置中心 | E2E：分组、保存、失败回滚、词库持久化 | 通过 |
| 桌面能力 | E2E/单元：全局热键、提醒、关闭到托盘、开机自启设置 | 通过 |
| 数据安全 | 单元/E2E：事务保存失败回滚、重置确认、收藏回滚 | 通过 |
| 自定义词和错题本 | E2E/单元：添加、搜索、错题记录和复习队列 | 通过 |

## 4. 词库内容质量检查

结构校验通过。当前内置例句由本地模板生成，未复制外部语料，许可证风险较低；2026-07-19 已修复旧单一兜底句和一批明显错误搭配。

已完成的质量修复：

- 旧高频兜底句统计为 0。
- `fend your account`、`indemnify your account`、`proscribe your account`、`defend your account` 这类可疑搭配统计为 0。
- 为 `abnormal`、`aboard`、`absence`、`defend`、`fend`、`indemnify`、`proscribe` 等高风险样例补了专门例句。
- 新增 `tests/test_example_generation.py` 防止明显错误搭配回归。

剩余风险：自动生成翻译仍依赖释义切片，个别长释义可能造成中文表达不够自然；公开发布前建议继续做抽样人工审校。

## 5. 数据安全与恢复检查

已确认的安全设计：

- 用户数据默认写入系统用户数据目录，不写入安装目录。
- 进度、统计、设置使用事务写入，失败时回滚。
- 恢复备份和重置进度前会创建安全备份。
- 自定义词导入先做预览，统计新增、重复和无效词。
- 导入词条会限制字段长度，避免异常 JSON 直接污染数据结构。
- 桌面烟测脚本使用临时 `APPDATA`、`LOCALAPPDATA`、`TEMP` 和 WebView2 用户目录，设计上不触碰真实用户数据。

剩余风险：

- “导入学习档案”仍属于覆盖性操作，虽然有安全备份，但仍建议后续补更明确的导入差异预览。
- 导出的学习档案 JSON 没有加密或签名，用户需要自行保护文件。
- 词库内容结构已校验，但不等同于人工语义审校。

## 6. 漏洞与安全风险检查

已检查：

- npm 依赖漏洞：0 个。
- 硬编码密钥/私钥/API token：未发现。
- 恢复、重置、事务写入路径：已有单元测试覆盖。
- 开机自启：只写当前用户 Startup 快捷方式，不需要管理员权限。
- 外部命令：开机自启使用 PowerShell 创建快捷方式，路径参数经过引用处理。

仍需补充：

- Python 漏洞数据库审计，例如 `pip-audit -r requirements.txt`。
- `innerHTML` 渲染点专项审查，确认所有用户可控内容都经过转义或 DOM API 写入。

## 7. 发布风险评级

Production audit：82/100，属于“可发布但有注意事项”。
公开软件市场发布结论：当前不建议公开上架，必须先完成真实签名证书、真实发布资料和最终签名包验收。

## 8. 建议下一步

1. 复制 `scripts/release_metadata.example.ps1` 为 `.release.local.ps1`，填入真实发布者、支持页、隐私联系人、下载页、证书和时间戳服务。
2. 运行 `npm run release:build`，直到签名、发布资料和安装器检查全部通过。
3. 关闭当前 VocabMaster 实例后复跑 `npm run desktop:smoke` 和 `npm run installer:smoke`。
4. 继续对词库例句做抽样人工审校，重点检查长释义和专业词。
5. 补充 Python 依赖漏洞审计。
