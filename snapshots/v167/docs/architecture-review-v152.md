# DocTree 宏观结构诊断

> 基线：v152 / 1.0.42（2026-11-25）
> 范围：整个 `doc-tree` 工作区（源码、脚本、构建产物、移动端、运行时数据）的**结构**，不是逐行 bug（逐行问题见 `code-review-v152.md`）
> 方法：静态通读 + 量化统计（行数/文件数/体积/重复度/漂移度）

---

## 1. 一句话结论

这个项目是「一个人边用边加功能」长出来的，功能是完整的，但**三个基础设施缺位**：
**没有版本控制、没有模块边界、没有单一事实来源**。

于是同一份逻辑被复制成 2 套前端 + 2 套后端 + 4 处版本号，改代码靠 277 个一次性 `patch-*.mjs` 字符串替换，
回归靠 212 个一次性测试脚本。上一轮查出的 5 个 P0，全部是这个结构的**直接产物**，不是运气不好。

---

## 2. 现状画像（量化）

| 指标 | 数值 | 说明 |
|---|---|---|
| `public/app.js` | 3582 行 / 122 KB | 单文件含：主题、文档库、PDF 渲染、文字层、高亮、搜索、树状图、输入框、设置、更新检查、化学渲染、SSE 客户端、焦点管理 |
| `app.js` 里的 `S.*` 字段 | **82 个** | 一个可变全局对象承载全部状态 |
| `app.js` 里的 `window.DT*` | 22 处 | 用全局变量当模块边界 |
| 裸 `fetch('/api/...')` | **21 处** | 各自拼 header、各自 catch |
| `server.mjs` | 758 行 / **19 条路由** | 16 个 `if (p === …)` + 3 个正则，线性查找 |
| `scripts/` | **690 个文件 / 61.8 MB** | 其中 `patch-*` **277 个**、`bump-*` 31 个、`*test*` 212 个、png/pdf 27.4 MB |
| 版本号出现位置 | **4 处** | `package.json`、`app.js` 的 `UI_VERSION`+`APP_VERSION`、`index.html` 两处 `?v=` |
| 前端拷贝 | 2 份 | `public/app.js`(v152) ↔ `mobile/www/app.js`(v147，3401 行，265 行差异) |
| 后端拷贝 | 2 份 | `server.mjs`+`lib/*.mjs` ↔ `mobile/src/{api,llm,websearch,extract,config,db,ppt}.js` |
| `lib/llm.mjs` vs `mobile/src/llm.js` | 774 行 vs **674 行** | 后者 `fetchWithRetry` 出现 **0 次**（服务端 7 次）→ 429/5xx 重试行为已不一致 |
| 工作区体积（不含 node_modules） | **≈470 MB** | `release/` 326 MB、`scripts/` 61.8 MB、`mobile/` 32.1 MB、`data/` 22.4 MB、顶层图片/压缩包 11.7 MB |
| 版本控制 | **没有 `.git`** | 但存在 `.gitignore`（说明本来打算有） |

---

## 3. 六个结构性问题（按"拖慢你的程度"排序）

### 3.1 没有版本控制，用「快照 + patch 脚本」代替 git

- 277 个 `patch-*.mjs` 是"用 Node 脚本做字符串替换来改源码"。这类脚本不可 diff、不可 review、不可回滚，
  且**跑第二遍结果可能不同**（比如 `replace` 匹配到已改过的文本时会静默跳过或用错锚点）。
- `bump-*.mjs` 31 个，专门改版本号和 `?v=` 缓存号 —— 这就是版本号散落 4 处的代价。
- 回滚靠 `snapshots/v147/`、`rollback/v151-backup/`、`rollback/before-v152/`、`release/` 里的 326 MB 旧包；
  "现在到底是哪个版本"要靠 `HANDOFF-v147.md` 用文字描述。
- **后果**：不敢大改（改坏没有 `git diff` 兜底）→ 只能继续加补丁 → 补丁更多。
  这直接解释了 v147→v148→…→v151→回滚 的循环。

### 3.2 同一份产品有 2 套前端 + 2 套后端，而且已经漂移

- **前端**：`mobile/build.mjs` 把 `public/app.js` 拷进 `mobile/www/app.js` 并提交进工作区。
  现在 www 里是 **v147**（3401 行），public 里是 **v152**（3582 行）——
  也就是说 v152 修的焦点问题，在移动端那份里完全不存在（还是老 bug），但两边看起来"是同一个 app"。
- **后端**：`mobile/src/api.js`（27 KB）**把 `server.mjs` 的 19 个 `/api/*` 端点又实现了一遍**（IndexedDB 版），
  并配套 `llm.js` / `websearch.js` / `extract.js` 三份 `lib/*.mjs` 的 fork。
  只有 `context.mjs` 是构建时从 `lib/` 拷过去的（唯一"真共享"的文件）——
  共享边界不一致，比"完全复制"更危险：改的人分不清哪份是真的。
- **版本号**：`package.json` / `APP_VERSION` / `UI_VERSION` / `index.html` 两处 `?v=`，
  所以才有 `checkStaleServer()` 那个"服务端 1.0.30、界面 1.0.41"的横幅去兜底。
- **后果**：每个后端改动要做 2 次（桌面 + 移动），每 2 次里漏 1 次；实际已经漂移（见上表 `fetchWithRetry` 0 vs 7）。

### 3.3 前端：3.5k 行单文件 + 82 字段可变全局 + 21 处裸 fetch

- 一个 `S` 对象承载全部状态；另有 10+ 个 module 级可变变量（`zoomPreviewZ`、`relayoutBusy`、`buildingPdf`、
  `viewRestoring`、`healing`、`drag`、`tv`、`searchTimer`…）散落在文件各处。
- **DOM 有时是 store，有时 `S` 是 store**：`#q.value` 直接读（5 处）、`#page-input.value` 由 `updatePageNav` 回写、
  `S.views` 又镜像 localStorage。没有单一数据流向。
- 21 处裸 `fetch` 各自处理错误（有的 `catch {}` 静默、有的 toast），
  所以"加一个统一请求头/统一错误处理/统一超时"这种横切关注点必须改 21 个地方。
- 初始化路径是隐式的：`bind()`（约 380 行）注册一批监听，文件中间和末尾又零散地 `addEventListener`/`setTimeout`
  （例如 `#page-scroll` 的 scroll、`beforeunload`、启动聚焦 3 个 timer）。
  **加载顺序变成隐式契约** —— 这就是为什么 v152 的 `DTFocus` 必须用 `window.DTFocus?.` 去防"还没定义"。
- **后果**：所有竞态类 bug 都出在这里（`openDoc` 串页、`renderTree` 全量重建、搜索防抖泄漏、焦点乱飞）。

### 3.4 服务端：19 分支 if 链，没有"边界层"

- 请求处理的每一步都在每个端点里重抄一遍：`读 body → JSON.parse → 取 doc → 取 tree → 算 → 写 SSE`。
- 没有 schema 校验、没有 id 校验、没有 `Origin` 检查、没有 content-type 检查、没有统一错误码。
- 于是：**P0-2 路径穿越**（id 没校验）、**P0-3 CSRF**（没 Origin 检查）、**P1-6 空 body 500**（复制漏改）
  三个问题长在同一个缺失层上；而 **P0-1 `handleResume` 引用未定义变量** 是 `handleAsk` 被复制粘贴的直接结果。
- **后果**：每加一个新端点，就多一份"没有边界的复制"，也许多一个同类漏洞。

### 3.5 数据层：没有 schema、没有迁移、没有备份

- 文档 JSON 内嵌全文（`pages[].text`），树是"每次全量重写的一个 blob"（最大 256 KB，问一次写两次）。
- 没有 `schemaVersion` 字段，加字段只能"读到就兼容"；没有迁移脚本。
- 没有 `.bak`/journal；写坏 = 整棵树静默变空（P0-4，已实测）。
- `doc` / `tree` / `file` / `groups` / `flags` / `config` 六个存储面，靠 id 字符串松散关联，没有一致性检查。

### 3.6 工程卫生：源码、产物、运行时数据、截图、安装包混在一个目录

- `release/` 326 MB（历史安装包）、`mobile/DocTree-android.apk` 7.6 MB + `debug.keystore` + 截图、
  顶层 113 个 png/zip（11.7 MB）、`scripts/` 里 27.4 MB 的测试图片/PDF。
- `.gitignore` 里写了 `data/`，但 `data/`（22.4 MB 运行时数据）仍然躺在项目里 —— 因为没有 git。
- **后果**：备份/迁移/同步成本高；"哪些是源码、哪些是产物"要靠人记；误删风险高。

---

## 4. 目标结构（分层，不推倒重来）

```
doc-tree/
├── core/                  ← 纯逻辑：无 DOM、无 Node-only、无 Electron（桌面+移动共用）
│   ├── context.mjs           提示词/检索（现在的 lib/context.mjs）
│   ├── tree.mjs              树的后代收集、导出 markdown（现在前后端各一份）
│   ├── ids.mjs               id 白名单校验（P0-2 的单点修复）
│   ├── sse.mjs               流式分帧（前后端各一份 → 一份）
│   └── sanitize.mjs          markdown→HTML 白名单（安全策略单点）
├── server/                ← 仅 Node
│   ├── http/{router,body,json,guard}.mjs   路由表 + 边界层（校验/Origin/错误码）
│   ├── routes/{state,import,ask,groups,doc,instruction,usage,export}.mjs
│   ├── services/{ask,summary,ocr,usage}.mjs  handleAsk 与 handleResume 收敛成一个 pipeline
│   └── store/{docs,trees,groups,flags}.mjs  原子写 + schemaVersion + 迁移 + .bak
├── web/                   ← 仅浏览器
│   ├── main.js               入口：init + 事件绑定（现在 app.js 的头尾）
│   ├── state.js             唯一可变状态 + 订阅（替代 82 字段的 S）
│   ├── api.js               统一 fetch 客户端（含 x-doctree-client 头）
│   ├── focus.js             现成的 DTFocus 直接搬
│   ├── ui/{composer,library,tree,toolbar,modals,theme}.js
│   └── view/{pdf,text,search,highlight,chem}.js
├── desktop/main.cjs       ← 只留窗口/菜单/端口/日志/原生焦点桥
├── mobile/                ← 薄壳：import core/ + web/；或明确宣布冻结
└── scripts/               ← 只留可重复运行的测试；patch/bump/截图归档
```

四条"共享/隔离"准则：

1. **`core/` 只允许纯函数**，跑在 Node 和浏览器都行 —— 桌面服务端和移动端都 import 它，这才叫单一事实来源。
2. **`server/` 和 `web/` 互不 import**，只通过 HTTP 契约（`/api/*`）通信。
3. **`desktop/` 不写业务逻辑**，焦点桥只广播"窗口激活状态"，判断留在渲染层（v152 已经这么做了，保持）。
4. **所有生成物（`mobile/www`、`release/`、快照 zip）不进工作区**，需要时由脚本生成。

---

## 5. 迁移路径（strangler，每步都能单独上线）

### 第 0 周：立护栏（半天，零功能风险）——**先做这个**

1. `git init` + 补 `.gitignore`（`release/`、`mobile/www/`、`mobile/*.apk`、`data/`、`.npm-cache/`、`*.png` 里的截图）→ 提交当前 v152 → `git tag v152`。
2. 把 277 个 `patch-*.mjs`、31 个 `bump-*.mjs`、27.4 MB 图片/PDF 移到 `_archive/`（**不删**，只是移出主目录）。
3. 从此"回滚"= `git checkout`，不再复制文件、不再靠快照目录。

> 这一步之后，后面所有重构才有"安全网"。

### 第 1 周：前端拆模块（行为不变，纯搬家）

4. 建 `web/`，先搬**最独立的四块**：`focus.js`（已独立）、`api.js`（21 个 fetch）、`sanitize.js`+`renderMarkdown`、`sse.js`。
5. 再搬 `view/pdf.js`（`renderPdf/drawPage/buildTextLayer/healBlankPages/relayoutPages`）和 `view/search.js`。
6. `app.js` 缩成 `main.js`（init + bind），`S` 先原样保留，下一个迭代再拆 `state.js`。
7. 每搬一块跑一次 `focus-test.mjs` + 手工点一遍——**这是唯一能保证"搬家不搬坏"的方式**。

### 第 2 周：服务端边界层 + 去重

8. `server/http/router.mjs`：把 19 个 `if (p === …)` 换成路由表；`guard.mjs` 做 id 校验 + Origin/自定义头 + content-type。
9. `services/ask.mjs`：`handleAsk` 和 `handleResume` 共用一个 `runAsk()`（P0-1 这类 bug 从此不会再现）。
10. 顺手把 P0-2 / P0-3 / P1-6 修在边界层上（一处修，全端点受益）。

### 第 3 周：数据层 + 移动端决策

11. `store` 原子写（tmp+rename）+ `schemaVersion` + 解析失败备份 `.corrupt-*`（P0-4）。
12. `doc` 元数据与 `pages` 分离，`/api/state` 只读轻量索引（当前 0.7 MB 还无所谓，但结构要先对）。
13. 移动端二选一：
    - **A**：抽 `core/`，`mobile/src/*.js` 改成 import `core/`，重建 `www`（一次性成本约 2–3 天）；
    - **B**：明确冻结移动端，把 `mobile/www`、APK 移出工作区，HANDOFF 里写清楚"移动端停在 v147，不含 v152 修复"。
    （按你现在主要用桌面，我建议先 B，等 `core/` 稳定了再 A。）

---

## 6. 三处"别改"（现在的方向是对的）

- **`lib/{store,llm,context,extract}.mjs` 的分层方向**：存储/模型/上下文/解析分开是对的，只是需要再往上抽 `core/`。
- **"本地 HTTP + 单页 + SSE" 的架构**：对一个本地优先的文档工具非常合适，不要换成 Electron IPC 或 WebSocket。
- **`theme.js` 的 token 派生、`chem.js` 对 RDKit 的封装**：都是干净的小模块，保持。

---

## 7. 结构如何直接生产了上一轮的 P0

| P0 | 结构病根 |
|---|---|
| 1. `resume` 引用未定义变量 | `handleAsk`/`handleResume` 复制粘贴（3.4） |
| 2. 路径穿越 | 没有边界层，id 不校验（3.4） |
| 3. CSRF | 没有边界层，无 Origin/头校验（3.4） |
| 4. 写坏丢整棵树 | 没有 schema/迁移/原子写（3.5） |
| 5. 链接把应用导航走 | 前端安全策略分散、无统一出口（3.3） |

---

## 8. 如果只做一件事

**`git init` + 提交 + 打 tag。**
它不解决任何 bug，但它让后面所有修复、重构、回滚都有据可查 —— 也是这个项目目前唯一"零风险、立即见效"的结构改进。

如果做第二件：把 `release/`、`mobile/www`、`scripts` 里的截图移出工作区，让"源码"重新变成一个能一眼看懂的目录。
