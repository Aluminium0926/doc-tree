# 文档树 DocTree · v147 交接文件

> **⚠️ 2026-11-25 再次更新：当前生效版本已到 v169 / 1.0.59。**
> **请优先看 `HANDOFF-v170.md`**（当前状态、发布/回滚流程、测试、排障手册、已知债务）。
> 本文保留为历史记录；其中「3.1 输入框焦点」早已被 v152 的状态机取代。

> 2026-11-25 更新：v152 / 1.0.42 时重写过输入框焦点管理（见 `docs/focus-fix-v152.md`）。
> 下面「3.1 输入框焦点」描述的是 v147 的旧实现。

> 生成时间：2026-11-25
> 当前回滚点：**UI v147 / APP 1.0.41**
> 状态：桌面源码与安装目录已回滚；**没有重新构建 APK**；GitHub 公开仓库不是 v147。

---

## 1. v147 文件在哪

### 1.1 当前生效源码

```
C:\Users\wangk\Desktop\大肥鱼的家\doc-tree
```

关键文件：

| 文件 | 说明 |
|---|---|
| `public\app.js` | 前端主逻辑，`UI_VERSION='v147'`、`APP_VERSION='1.0.41'` |
| `public\chem.js` | RDKit 化学结构/反应式渲染；`app.js` 里引用 `chem.js?v=1.0.41` |
| `public\style.css` | 主样式 + 化学卡片/箭头样式 |
| `public\index.html` | 页面结构 |
| `desktop\main.cjs` | Electron 主进程（焦点、窗口、服务启动） |
| `server.mjs` | 本地 HTTP/SSE 服务 |
| `lib\context.mjs` | 系统提示、上下文、工具定义 |
| `lib\llm.mjs` | 模型调用、function calling、搜索/OCR |
| `lib\websearch.mjs` | DeepSeek Search/Fetch API 工具（按次计费） |
| `lib\extract.mjs` | PDF/Word/PPTX/图片解析 |
| `lib\render.mjs` | PDF/图片页渲染 |
| `lib\office.mjs` | Windows/macOS PPT→PDF |
| `lib\store.mjs` | 本地文档/树存储 |
| `package.json` | 版本 `1.0.41`，RDKit 等在 devDependencies |

### 1.2 v147 快照

```
doc-tree\snapshots\v147\
doc-tree\snapshots\doctree-v147-source.zip
```

快照包含：

```
public\app.js
public\chem.js
public\style.css
public\index.html
desktop\main.cjs
lib\*.mjs
server.mjs
package.json
package-lock.json
VERSION.txt
```

### 1.3 已部署位置

安装版：

```
%LOCALAPPDATA%\Programs\DocTree\resources\app
```

便携构建目录：

```
doc-tree\build\DocTree-win32-x64\resources\app
```

这两个目录已同步 v147 的 `app.js`、`chem.js`、`style.css`、`main.cjs`、`context.mjs`、`package.json`。

### 1.4 不是 v147 的地方

- `doc-tree-public`（GitHub 公开仓库）：不是 v147，公开最新仍是 v1.0.12 左右。
- `doc-tree\rollback\v151-backup\`：这是回滚前 **v151 / 1.0.45** 的备份，不是 v147。
- `mobile\www` / APK：没有按 v147 重建。最近 APK 是 **1.0.34**，与桌面 v147 不是同一份前端。
- `public\vendor\rdkit`：RDKit WASM，属于 v147 依赖，但不在快照 zip 里；完整运行时需要保留此目录。

### 1.5 相关运行时目录（不要提交）

```
%APPDATA%\文档树\          配置、desktop.log、数据
doc-tree\data\             文档、文件、树
```

---

## 2. 如何运行 / 验证

### 桌面安装版

完全退出文档树后重新打开：

```
%LOCALAPPDATA%\Programs\DocTree\DocTree.exe
```

这次改了 `desktop\main.cjs`，**必须完全退出重开**；Ctrl+R 只刷新渲染进程。

### 开发服务

```powershell
cd C:\Users\wangk\Desktop\大肥鱼的家\doc-tree
node server.mjs
```

默认端口：`4317`。如果 Electron 已经在运行，不要重复起服务，否则端口冲突。

### 版本确认

浏览器控制台应出现：

```
[DocTree] UI v147
```

`public/app.js` 内：

```js
const UI_VERSION = 'v147'
const APP_VERSION = '1.0.41'
```

化学模块 URL：

```
/chem.js?v=1.0.41
```

---

## 3. v147 已知 Bug / 风险

### 3.1 输入框焦点 / 光标丢失（最高优先级）

**现象**

- 启动后输入框有时没有闪烁光标，点一下才出现。
- 选中上一条问题 → Ctrl+C → 中间点几次左键 → 滚回底部 → 点「追问」→ 光标丢失。
- 有时 `document.activeElement` 已经是 `#q`，但视觉上仍看不到光标。

**v147 状态**

v147 只有：

- `autoFocusComposer()`（启动 500/1600ms + window focus）
- 键盘救援：窗口有焦点但输入框没焦点时，敲单个可打印字符会写进 `#q`
- `desktop/main.cjs` 启动时 `webContents.focus()` + `executeJavaScript` 聚焦 `#q`

**没有**后来 v148+ 的中央焦点管理器、mouseup 守卫、焦点心跳、原生 `dt:native-focus` 桥、弹窗关闭恢复。

**已知诱因**

- Windows 窗口前台焦点与网页 DOM 焦点不一致。
- 选中回答文字后，页面上存在未折叠 Selection，焦点代码可能主动放弃抢焦点。
- 点击工具栏/追问按钮后，按钮本身获得焦点，输入框失焦。

**临时绕法**

- 点一下输入框。
- 直接敲一个字母/数字，键盘救援会把焦点送回输入框。
- 完全退出重开，确保 Electron 主进程是 v147 的 `main.cjs`。

### 3.2 选中回答只显示浮层，点击后才挂追问（v147 正确行为，不是 Bug）

v147 的预期行为：

1. 在右侧回答里选中文字
2. 只显示「追问这段」浮层
3. **不修改** `S.pendingAnchor` / `S.pendingParent`
4. 点击浮层按钮后，才挂上追问、更新输入框 chip、聚焦输入框

对应实现应保持：

```js
function markAnswerSelection(range, startEl, sel) {
  const card = startEl.closest('.node')
  if (!card) return hideFloat()
  const parentNode = S.tree?.nodes?.[card.dataset.id]
  const anchor = { kind: 'answer', nodeId: card.dataset.id, quote: sel.toString().trim(), page: parentNode?.anchor?.page || currentPage() }
  const parentId = card.dataset.id
  showFloat(range, [{
    label: '追问这段',
    primary: true,
    run: () => {
      S.pendingAnchor = anchor
      S.pendingParent = parentId
      updateChip()
    }
  }])
}
```

`showFloat` 的按钮点击里要执行 `b.run?.()`，再 `$('#q').focus()`。

**如果看到“一松手就自动挂追问”，说明加载的不是这份 v147 代码，或被回滚脚本错误改回了旧实现。** 当前 v147 源码与快照应为“选中只出浮层”。

### 3.3 删除节点后「追问」看起来没反应

**现象**

- 删除一条追问后，再点别的「追问」，chip 文案仍是“回答片段 · 「整段提问」”，看起来按钮失效。
- 删除的节点如果正好是待追问锚点，v147 不会清空 `S.pendingParent` / `S.pendingAnchor`。

**根因**

- v147 的 chip 文案只显示 `anchor.quote`，空 quote 一律显示“整段提问”。
- v147 没有节点 `armed` 高亮，也没有删除时清理待追问状态。

**实际行为**

按钮事件仍会更新 `S.pendingParent`；只是 UI 没有反馈。v150 曾加“chip 显示具体问题 + 节点高亮 + 删除清理”，已在本次回滚中撤掉。

**临时绕法**

- 点击目标节点「追问」后，直接输入并发送；父节点会更新。
- 不要依赖 chip 文案判断当前挂的是哪一条。

### 3.4 化学结构 / 反应式

**已保留的 v147 能力**

- RDKit.js 本地 WASM，离线渲染
- `smiles` / `reaction` 代码块
- 试剂 `reagents:` 在箭头上方、条件 `conditions:` 在下方
- `[N+]#N` → `N#[N+]` 规范化
- 旁观离子过滤
- 条件清洗（去掉 ortho/para/meta、机理解释、`-> 产物`）
- 主惯性轴（PCA）水平/垂直候选，选横向更窄的
- 加号/箭头垂直中心对齐
- 反应组分键长 18、单独分子 30

**已知问题**

1. **空化学块**
   - 只有 `label:` / `conditions:`、没有 SMILES 的块会尝试渲染空分子，显示“结构图为空”。
   - v147 没有空块跳过（v151 曾修，已回滚）。

2. **非法 SMILES**
   - 模型经常写错产物，如 `Occc(/N=N/c2ccccc2)cc1` 缺环闭合，RDKit 无法解析。
   - 重氮盐 `[N+]#Nc1ccccc1` 已被规范化；但产物本身写错无法自动修复。
   - 单个组分失败时会显示红色“SMILES 无法解析”徽标，或在整块失败时显示错误 + 原始 SMILES。

3. **条件文本仍可能带解释**
   - v147 会清洗常见 ortho/para/meta、括号机理、ASCII `-> 产物`，但无法覆盖所有自然语言。
   - 根治要依赖模型按提示只输出条件。

4. **模型输出协议**
   - 期望：
     ```reaction
     label: ...
     reaction: 反应物>>产物
     reagents: 箭头上方试剂
     conditions: 箭头下方条件
     ```
   - 若模型拆成 `reactants:/products:`，v147 解析器支持一部分，但拼接错误时仍会失败。

5. **排版限制**
   - 不支持机理箭头、电子推动、原子 mapping 高亮。
   - 复杂天然产物可能拥挤/裁切。
   - RDKit WASM 约 7MB，桌面打包会增大体积。

### 3.5 联网搜索

- v147 使用 DeepSeek **Search / Fetch API**，可与 `read_page` 同轮混用。
- 计费：官方 Search/Fetch API **按次收费**（约 5 元 / 1000 次成功请求），不是免费 server tool。
- 仅支持 DeepSeek 官方接口；需要有效 API Key 和余额。
- 搜索/抓取失败会作为工具错误回到模型，可能回答不完整。
- 若想零搜索费，需要另做“服务端工具两段式”免费模式，v147 没有。

### 3.6 版本 / 启动状态

- 运行时如果 **服务端进程仍是旧版本**，页面会弹“服务端版本 1.0.30，界面版本 1.0.41”的过期提示。
  - 这是正常提示，不是数据损坏。
  - 完全退出重开即可。
- 公开仓库、Android APK、Web 部署都**不是** v147。
- 不要把 `%APPDATA%\文档树` 或 `data/` 提交到仓库。

### 3.7 移动端

- v147 是桌面回滚，没有重建 `mobile/www` 和 APK。
- 最近 APK 是 1.0.34，包含的是更早/不同的前端，不能视为 v147 移动版。
- 移动端 PPT 仍是 A 路线（前端渲染截图 PDF）；LibreOffice WASM B 方案未进 APK。
- 图片 OCR、PPT 文本层等功能在移动端存在，但没有随本次桌面回滚统一版本。

---

## 4. 回滚 / 恢复

### 回到 v147

当前源码已经是 v147；如需从别处恢复：

```powershell
Copy-Item doc-tree\snapshots\v147\* doc-tree\ -Recurse -Force
```

注意：快照不含 `public\vendor\rdkit`，恢复后要确保该目录还在。

### 回到回滚前的 v151

```powershell
Copy-Item doc-tree\rollback\v151-backup\app.js   doc-tree\public\app.js
Copy-Item doc-tree\rollback\v151-backup\chem.js  doc-tree\public\chem.js
Copy-Item doc-tree\rollback\v151-backup\style.css doc-tree\public\style.css
Copy-Item doc-tree\rollback\v151-backup\main.cjs doc-tree\desktop\main.cjs
Copy-Item doc-tree\rollback\v151-backup\context.mjs doc-tree\lib\context.mjs
Copy-Item doc-tree\rollback\v151-backup\package.json doc-tree\package.json
```

v151 包含中央焦点管理、原生焦点桥、选中延迟挂载、chip 显示问题、节点高亮、空化学块跳过。

---

## 5. 建议下一步

优先级从高到低：

1. 修焦点：不要再打补丁，单独做一个“焦点状态机”，只允许输入框/搜索框/弹窗输入持有焦点，并在窗口激活时用原生事件同步。
2. 选区与追问解耦：选中只显示浮层，点击浮层后才挂载；明确 chip 文案和节点高亮。
3. 化学空块：无 SMILES 直接降级为普通代码块；非法 SMILES 保留原文，不要整块报错。
4. 发布前做真机/大文件回归；v147 不是发布候选，只是回滚点。
