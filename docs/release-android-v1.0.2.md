# DocTree Android v1.0.2

## 新增

- **模型请求自动回退**：`mobile/src/llm.js` 现在先试同源 `/proxy/llm`；如果返回 404/405 或不是 JSON/SSE（典型静态托管），自动改为直连 `baseUrl`。
  - 有代理（Android App、`server.mjs`）→ 走代理，任何兼容端点都能用
  - 纯静态托管 → 直连，要求端点允许 CORS（DeepSeek 官方已实测允许）
  - 附带 `mobile/static-server.mjs`，可本地起一个纯静态服务验证直连模式

## 沿用 v1.0.1 的修复

- 固定本地端口 47201，修复重启后数据丢失
- pdf.js worker 侧补 `Promise.withResolvers`，兼容 Chrome 113 及更老的系统 WebView
- 导入完成后自动收起文档库抽屉

## 验证

- 静态托管（4501，无 `/proxy/llm`）：`__DT_PROXY_STATE=none`，导入 PDF 后提问，204 个 delta、327 字答案，3.2 秒完成
- 带代理的开发服务（4500）：`__DT_PROXY_STATE=ok`，摘要正常生成（355 字）
