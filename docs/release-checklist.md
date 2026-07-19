# 发布 Checklist

发布 VocabMaster 构建前使用本 checklist。

## 版本与范围

- [ ] `VERSION` 是本次发布版本号来源。
- [ ] `npm run check` 已验证 `VERSION`、`package.json`、`app.py`、`README.md` 和 `CHANGELOG.md` 版本一致。
- [ ] `README.md` 描述的是实际发布行为。
- [ ] `CHANGELOG.md` 包含用户可感知变更。
- [ ] `docs/product-spec.md` 仍匹配本次发布范围。

## 数据与词库

- [ ] Built-in word banks pass `python scripts/validate_wordbanks.py`.
- [ ] 新增或更新的词库来源已记录到 `docs/wordbank-sources.md`。
- [ ] 发布材料没有把当前示例/核心小词库宣传为完整考试词库。
- [ ] Git 未跟踪 `data/progress`、`data/stats`、`data/settings`、`data/favorites` 或 `data/words` 下的用户数据。
- [ ] 备份和恢复已用非生产数据测试。

## Verification

- [ ] `npm test` passes.
- [ ] `npm run check` passes.
- [ ] `npm run e2e` passes on Windows.
- [ ] `npm run release:check` passes for the final public release artifact.
- [ ] `npm run desktop:smoke` passes from source.
- [ ] App starts from source with `python app.py`.
- [ ] App starts from packaged build.

## Windows Package

- [ ] Copy `scripts/release_metadata.example.ps1` to `.release.local.ps1` and replace all placeholders with real publisher information.
- [ ] `.release.local.ps1` is not committed and certificate files are outside Git.
- [ ] `VOCABMASTER_PUBLISHER` is the legal publisher name used by the signing certificate or Store publisher identity.
- [ ] `VOCABMASTER_TIMESTAMP_URL` points to the timestamp service recommended by the certificate authority.
- [ ] Full release command completed: `npm run release:build`.
- [ ] Build command completed: `powershell -ExecutionPolicy Bypass -File scripts/build_windows.ps1 -Clean`.
- [ ] `dist/VocabMaster/VocabMaster.exe` launches.
- [ ] Packaged smoke passes: `.venv-build\Scripts\python.exe scripts\desktop_smoke.py --app dist\VocabMaster\VocabMaster.exe`.
- [ ] EXE `FileVersion` and `ProductVersion` match `VERSION`.
- [ ] `dist/VocabMaster/licenses` contains project, ECDICT and dependency license files.
- [ ] App icon displays in the taskbar.
- [ ] User data is written to `%APPDATA%\VocabMaster` by default.
- [ ] Upgrading does not overwrite existing user data.
- [ ] Uninstall behavior is documented.
- [ ] Installer supports `/VERYSILENT /NORESTART` in an offline VM.
- [ ] Installer and EXE have valid Authenticode signatures from the real publisher.
- [ ] `VOCABMASTER_SUPPORT_URL`, `VOCABMASTER_PRIVACY_CONTACT` and `VOCABMASTER_DOWNLOAD_URL` point to real public release resources and pass `npm run release:check`.
- [ ] Upgrade and uninstall preserve `%APPDATA%\VocabMaster`.

## Manual Smoke Test

- [ ] Open app.
- [ ] Switch to new-word mode.
- [ ] Rate one word and confirm the meaning appears.
- [ ] Favorite a word.
- [ ] Open statistics.
- [ ] Save settings.
- [ ] Export data.
- [ ] Restore data from a test backup.
- [ ] Restart app and confirm progress persists.

## Release Artifacts

- [ ] Packaged build is archived.
- [ ] Release notes are written.
- [ ] Known limitations are listed.
- [ ] Source commit/tag is recorded.
- [ ] `site/` public pages have real publisher, support, privacy, download and checksum information.
- [ ] `npm run site:check` passes before deployment.
- [ ] `npm run site:check:release` passes before public listing.
- [ ] Real publisher identity, support URL and privacy contact are present.
- [ ] Versioned download/update URL is live, or the package is submitted through Microsoft Store.
- [ ] Store screenshots were captured from the signed release build.
