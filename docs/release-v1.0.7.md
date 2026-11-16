# DocTree v1.0.7

四端同步更新。

## 文档组

- 侧栏「＋ 建组（多选文档）」：选中 2 份以上文档，可命名
- 组内文档共享一棵提问树和上下文，切到组内任意文档都能看到同一棵树
- 解散时提问树复制回每份文档，不丢内容

## 模型按需读原文（function calling）

- `read_page(page, doc?)`：读取任意一页原文
- `search_docs(query, doc?)`：在单篇或组内检索
- `list_docs()`：查看组内文档
- 支持 OpenAI 兼容与 Anthropic 两种工具调用格式；最多 6 轮
- 上下文不再硬塞全文：从 19k 字符降到约 2k，模型需要时自己取

## 提问体验

- 未选中文字时不再默认锚定第 1 页；改为“自由提问”，模型自行检索定位
- 当前页只作为位置提示，不再假定问题范围
- 服务端版本过期提示移到顶部，不再挡住提问框

## 其他

- Android 本地代理补齐 Anthropic 认证头
- Markdown 渲染 XSS 清洗
- 设置里的 Anthropic 地区提示、免责声明

## 下载

- Windows：`DocTree-1.0.7-win32-x64.zip`
- Android：`android-v1.0.6`
- 网页：https://aluminium0926.github.io/doc-tree/
- macOS：`mac-arm64-v1.0.4` / `mac-x64-v1.0.4`
