# DocTree Web v1.0.2

与桌面 v1.0.5 同步的纯静态包。

## 用法

1. 解压
2. 任意静态服务器托管（`npx serve .`、`python -m http.server`、或 `mobile/static-server.mjs`）
3. 浏览器打开 →「添加到桌面」

在线版：https://aluminium0926.github.io/doc-tree/

## 本次更新

- 每次启动检查新版本（可静默）
- 文件移出列表保留提问树，重新导入同一文件恢复
- 文本 / 视觉模型可分别配置；支持 Anthropic
- 长按页面「讲解本页」、无极缩放

## 模型请求

静态部署没有 `/proxy/llm`，会自动直连配置的 Base URL，需要端点允许 CORS（DeepSeek 已验证允许；Anthropic 需带 browser-access 头，已内置）。
