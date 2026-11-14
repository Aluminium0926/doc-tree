# DocTree Web v1.0.1

网页版静态包，与 v1.0.4 同步。

## 用法

1. 解压
2. 用任意静态服务器托管（`npx serve .`、`python -m http.server`、或本项目 `mobile/static-server.mjs`）
3. 浏览器打开 → 「添加到桌面」

也可以直接访问在线版：https://aluminium0926.github.io/doc-tree/

## 本次更新

- 页面配色（深色/浅色、单主色派生、渐变、透明度）
- 代码块语法高亮 + 复制/下载
- 悬浮输入框、SVG 图标
- 修复 Markdown 被当成纯文本

## 模型请求

静态部署没有 `/proxy/llm`，前端会自动改为直连 `baseUrl`，需要端点允许 CORS（DeepSeek 官方已验证允许）。
