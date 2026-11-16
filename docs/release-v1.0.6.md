# DocTree v1.0.6

安全与合规修正。

## 修复

- **Markdown XSS**：渲染出的 HTML 现在会清洗（移除 script/iframe/事件属性/危险 URL）。此前恶意文档或模型输出可执行脚本并读取浏览器里的 API Key。
- **Android 代理认证头**：本地代理补齐 `x-api-key`、`anthropic-version`，APK 内使用 Anthropic 不再 401。

## 新增

- 设置里选择 Anthropic 时显示地区提示：请勿用 VPN/代理规避地区限制，不要跨地区共用同一个 Key
- 首次启动弹窗与设置页增加免责声明
- 每次启动检查更新（设置里可静默）

## 其他

- 通用 `max_tokens` 上限，避免异常长输出
- 版本检测不再固定 24 小时一次

## 下载

- Windows：`DocTree-1.0.6-win32-x64.zip`
- Android：`android-v1.0.5`
- 网页：https://aluminium0926.github.io/doc-tree/
- macOS：`mac-arm64-v1.0.3` / `mac-x64-v1.0.3`
