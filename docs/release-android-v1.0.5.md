# DocTree Android v1.0.5

与桌面 v1.0.6 同步。

## 修复

- 本地代理补齐 Anthropic 认证头（`x-api-key` / `anthropic-version`），APK 内使用 Claude 不再 401
- Markdown 渲染 XSS 清洗

## 新增

- 设置里的 Anthropic 地区提示与免责声明
- 每次启动检查更新（可静默）

## 打包

- versionCode 5 / versionName 1.0.5
- minSdk 24 / targetSdk 34
