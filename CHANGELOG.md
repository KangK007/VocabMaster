# 更新日志

## 2.0.0 - Unreleased

- 明确 2.0 完整版产品范围：新学、复习、强化、测试、统计和备份。
- 新增产品规格、词库来源审计和发布 checklist 文档。
- 新增版本一致性检查，避免 `VERSION`、`package.json`、`app.py`、`README.md` 和 `CHANGELOG.md` 不一致。
- 新增词库 schema、重复词、超长字段、非法类别和 metadata 一致性校验。
- 使用 ECDICT MIT 数据按考试标签生成 CET-4、CET-6、考研、IELTS 和 TOEFL 内置词库。
- 记录当前内置词库是 ECDICT 标签词库，不能宣传为官方完整考试大纲。
- 拆分可测试的前端统计、设置和备份辅助模块。
- 扩展 Playwright E2E 覆盖学习、搜索、测试、设置、收藏、恢复和统计流程。
- 新增 Windows PyInstaller 打包原型。

## 2.0.0-p2 - Unreleased

- 新增词库学习进度仪表盘（环形图）
- 新增错题本功能（自动记录 + 集中复习）
- 新增测试成绩历史
- 新增 Windows Inno Setup 安装器
