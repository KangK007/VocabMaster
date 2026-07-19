# Windows 分发策略

## 渠道决策

VocabMaster 面向公开软件市场时，主渠道选择 Microsoft Store 的 MSIX 包。原因是 Store 可托管包签名、更新分发和版本回退，用户不需要绕过 Windows 的未知发布者警告。

当前仓库不生成 MSIX 清单，因为清单必须包含与 Partner Center 完全一致的真实 `Publisher` 身份。缺少发布者账号时写入占位主体会导致签名和商店关联无效。

## 直接下载渠道

Inno Setup 安装器用于实验室内网、离线机器或项目发布页直接下载。当前脚本具备以下属性：

- 当前用户安装，不请求管理员权限。
- 安装文件完整包含在单个安装器中，可离线执行。
- 支持 `/VERYSILENT /NORESTART` 静默参数。
- 升级和卸载均不删除 `%APPDATA%\VocabMaster` 用户数据。
- 安装包包含项目许可证、第三方声明和可获得的依赖许可证文本。

直接下载公开发布前仍必须完成：

1. 使用真实发布者的 Authenticode 证书签名 EXE 和安装器，并验证时间戳。
2. 提供真实 HTTPS 支持地址、隐私联系渠道和版本化下载地址。
3. 建立更新检查或明确的更新通知机制；不得静默下载并执行未签名程序。
4. 在干净 Windows 10/11 虚拟机验证安装、覆盖升级、静默安装、卸载和用户数据保留。

## 当前阻断项

- 未提供 Microsoft Partner Center 发布者身份。
- 未提供 Authenticode 证书和时间戳服务配置。
- 未提供真实支持 URL、隐私联系方式和版本化更新源。
- 商业用途需要发布者确认并满足 Inno Setup 的商业许可要求；科研或非商业构建也应保留许可证记录。

这些项需要真实外部身份或环境，不能通过占位值替代。

## 发布资料与签名流程

先复制本地发布配置模板，填入真实信息：

```powershell
Copy-Item scripts\release_metadata.example.ps1 .release.local.ps1
notepad .release.local.ps1
```

`.release.local.ps1` 不应提交到 Git。它需要包含：

- `VOCABMASTER_PUBLISHER`：真实法律发布者名称，应与证书或 Store 发布者身份一致。
- `VOCABMASTER_SUPPORT_URL`：公开 HTTPS 支持页面。
- `VOCABMASTER_PRIVACY_CONTACT`：`mailto:` 隐私邮箱或 HTTPS 隐私联系页面。
- `VOCABMASTER_DOWNLOAD_URL`：版本化下载页、更新页或 Store 页面。
- `VOCABMASTER_SIGN_CERT_PATH` 或 `VOCABMASTER_SIGN_CERT_THUMBPRINT`：真实代码签名证书。
- `VOCABMASTER_TIMESTAMP_URL`：证书机构推荐的时间戳服务。

发布构建顺序：

```powershell
npm run release:build
```

该命令会清理构建目录、生成 EXE、签名 EXE、生成 Inno Setup 安装器、签名安装器，并运行 `npm run release:check` 等价检查。没有真实证书时，可临时使用：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_release.ps1 -SkipSigning -AllowUnsigned
```

该模式只适合内部验证，不能作为公开发布包。
