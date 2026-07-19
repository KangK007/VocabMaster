# VocabMaster 公开发布页

该目录用于托管软件市场需要的公开页面：

- `/support/`：支持页面，对应 `VOCABMASTER_SUPPORT_URL`
- `/privacy/`：隐私说明，可作为 `VOCABMASTER_PRIVACY_CONTACT`
- `/downloads/vocabmaster/2.0.0/`：版本化下载页，对应 `VOCABMASTER_DOWNLOAD_URL`

正式发布前必须替换页面中的占位信息：

- 个人发布者真实名称
- 支持邮箱或公开 Issue 地址
- 隐私联系邮箱或 HTTPS 联系页
- 已签名安装器下载地址
- 签名后安装器的 SHA256 校验值

当前模板中的占位标记包括：

- `your-domain.example`
- `待替换`
- `<github-username>`
- `<repo-name>`

推荐使用 GitHub Pages、Cloudflare Pages、Netlify、Vercel 或自有服务器托管。若使用 GitHub Pages Actions 工作流，发布成功后的默认地址通常类似：

```text
https://<github-username>.github.io/<repo-name>/support/
https://<github-username>.github.io/<repo-name>/privacy/
https://<github-username>.github.io/<repo-name>/downloads/vocabmaster/2.0.0/
```
