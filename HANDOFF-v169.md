# 交接文档 · DocTree v169（APP 1.0.59）

> 写于 2026-11-25。上一份交接是 `HANDOFF-v147.md`（回滚点时代的记录），本文取代它作为**当前状态**。
> 本次跨度：**v152 → v169**（1.0.42 → 1.0.59），共 15 个提交。

---

## 0. 一句话现状

| 项 | 值 |
|---|---|
| 源码版本 | **UI v169 / APP 1.0.59**（`package.json` 1.0.59） |
| 安装版 | `%LOCALAPPDATA%\Programs\DocTree`，已同步 **1.0.59** |
| 移动端资源 | `mobile/www` 已按 v169 重建（含 `modules/`） |
| git | 仓库在项目根，`1daeff0`，tag `v152-before-refactor` … `v169`，工作区干净 |
| 测试 | `npm test` → **API 91/91 + UI 98/98**；Electron **15/15**（手动，见 §6） |
| 未发布的端 | GitHub 公开仓库 1.0.13 / release v1.0.12 / Pages 旧版 / APK v142(1.0.36) |

---

## 1. 环境与路径

```
源码      C:\Users\wangk\Desktop\大肥鱼的家\doc-tree
安装版    %LOCALAPPDATA%\Programs\DocTree\resources\app
数据      %APPDATA%\文档树\{docs,trees,files} + groups.json / flags.json / config.json
导出/备份 snapshots\v1xx\ + snapshots\doctree-v1xx-source.zip；rollback\installed-v152\
```

**必须知道的三个坑：**

1. **Electron 不能从中文路径启动**（会 GPU 崩溃）。用源码跑 Electron 时先 `subst S: "C:\Users\wangk\Desktop\大肥鱼的家"`，再从 `S:\doc-tree` 启动。
   安装版路径是英文，没这个问题。
2. **改完必须重启应用**才生效（Electron 不热更新）。安装版和源码是两份，改源码不会影响快捷方式指向的安装版。
3. 开发机需要 **Chrome**（`C:/Program Files/Google/Chrome/Application/chrome.exe`）跑 UI 测试；`puppeteer-core` 已在 devDependencies。

常用命令：

```bash
npm start            # 开发服务器 127.0.0.1:4317
npm run app          # Electron 开发窗口（需 S: 盘技巧）
npm test             # API + UI 全套（自带假模型和临时数据目录）
npm run mobile       # 重建 mobile/www
npm run bump 1.0.60 v170   # 升版本（改 3 个文件里的版本号 + 缓存号）
```

端口：开发 4317，安装版 43171，假模型 4318；测试用 4319/4321，mock 4399/4398。

---

## 2. 架构地图

```
server.mjs               133 行：静态服务 + 路由分发 + 统一错误处理
lib/ids.mjs              id 白名单（12 hex）+ HttpError 类型
lib/http/router.mjs      createRouter().get/post/del，:param 匹配
lib/http/body.mjs        读 body：空→{}，坏 JSON→400，上限 2MB（文件导入另有 300MB 流）
lib/http/guard.mjs       guardWrite：x-doctree-client + 同源 Origin + JSON content-type
lib/http/respond.mjs     json / text / openSSE（: ok 心跳 15s）
lib/routes/{state,docs,groups,ask}.mjs   19 个端点
lib/services/ask.mjs     提问/续写共用管线（SSE、90s 空闲超时、10min 硬上限、页图、图片、用量）
lib/store.mjs            原子写（tmp+fsync+rename，Windows 重试）、schema 2、损坏文件隔离 .corrupt-*
lib/llm.mjs              OpenAI 兼容 + Anthropic Messages、流式、重试、超时
lib/context.mjs          提示词、检索、祖先链、导出 Markdown（系统提示含化学块协议）
lib/extract.mjs          PDF（含中文 cmap）/docx/pptx/文本
lib/render.mjs           PDF 页面栅格化（句柄 LRU 2、页面缓存 24）
lib/office.mjs           PPT → PDF
lib/websearch.mjs        DeepSeek Search / Fetch

public/index.html        页面结构（含 #confirm 应用内确认框、#image-input）
public/app.js            3158 行：UI/视图/事件（PDF 渲染、树、搜索、导出、设置）
public/modules/util.js   $ / esc / trunc / formatTokens / usageLine
public/modules/markdown.js  marked + highlight.js + KaTeX + sanitizeHtml（外链强制 _blank）
public/modules/api.js    apiFetch（带 x-doctree-client）/ apiJson / apiStream
public/modules/sse.js    readSSE（\n\n 分帧）
public/modules/focus.js  DTFocus：焦点状态机（窗口激活、弹窗、选区、回焦规则）
public/chem.js           化学结构渲染（RDKit wasm、朝向吸附、反应式布局）
desktop/main.cjs         窗口、菜单、端口、焦点桥、CSP、will-navigate、日志轮转
mobile/build.mjs         生成 mobile/www（含 modules/ 与 lib/context.mjs）
scripts/test-{api,ui,electron}.mjs   三套自动化
```

---

## 3. 版本改动总览

| 版本 | 主题 | 关键点 |
|---|---|---|
| v152 | 焦点彻底修 | `DTFocus` 状态机 + 主进程 `dt:win-state` 桥（v147 的丢光标根因） |
| v153 | **结构大修 + 安全** | 服务端拆 `http/routes/services`；存储原子化；id 白名单；CSRF 守卫；前端抽 5 个模块；CSP/sandbox |
| v154 | 按 `BUGS-v147~v151` 复查 | chip 显示具体问题、armed 高亮、删除清 pending、空化学块跳过、孤儿节点兜底 |
| v155 | 化学 CSP | CSP 放行 eval（RDKit 必需）；partial 不再被 15s 看门狗覆盖成“超时”；条件不再被裁切 |
| v156 | 化学语义 | 左右相同的 reaction 按单一结构画；单分子 reaction 降级；占位条件（`-`）不渲染；+号/箭头/结构同中线 |
| v157 | 提示词 | 明确“单结构用 smiles、reaction 左右必须不同、空 conditions 省略”，API 测试加提示词契约 |
| v158 | 反应箭头 | 箭头列三行网格钉死行号（缺 reagents 时不再飞到顶部）；canvas padding 对称 |
| v159–v162 | 单分子朝向 | 键轴吸附（只纠正 ≤20° 小倾角）+ 显示尺寸 1.5 倍上限；**不为变宽而旋转**（横向空间宝贵） |
| v163 | 拖选后焦点 | 拖选文字后焦点停在 BODY → 首字符丢失；改 `setRangeText` 兜底，删除/导入后回焦 |
| v164 | 输入法 | 原生 `confirm()` 打断 IME（能粘贴不能打汉字）→ 全部换成应用内 `#confirm` |
| v165 | 粘贴图片 | 粘贴 = 随本次提问发送（不再导入成文档）；**服务端此前根本没读 `body.image`**，一并修好 |
| v166 | 图片按钮 | 输入框加「图片」按钮；缩略图 240×96；拖放分流（拖到输入框=配图） |
| v167 | 图标化 | 联网/图片/指令 统一 34×34 纯图标（地球/相片/`>_`） |
| v168 | 微调 | 图标 17→21px（按钮内占比 62%） |
| v169 | 文档选区 | 选中只出浮层，点「用这段提问」才挂锚点（不再选中即挂） |

每版细节见 `docs/v1xx-*.md`（18 篇）。v153 的结构/安全总账在 `docs/v153-upgrade.md`。

---

## 4. 关键契约（改代码前必读）

### 4.1 写操作必须带客户端头

所有 POST/DELETE 走 `apiFetch`（自动加 `x-doctree-client: doc-tree-web`），服务端 `guardWrite` 校验：
头 + `Origin` 同源 + `content-type: application/json`。**新增请求不要绕过 `apiFetch`**。

### 4.2 id 一律先校验

路径/参数里的 docId、nodeId、groupId 必须过 `lib/ids.mjs`（12 hex / 8 hex）。
历史上 `{"id":"../config"}` 能删掉含 API Key 的配置文件，就是这么来的。

### 4.3 存储

`store.mjs` 用 tmp+fsync+rename；解析失败把文件改名 `.corrupt-<时间戳>` 并抛 500，**绝不静默当空**。
树文件带 `{schema: 2}`；节点字段：`id/parentId/anchor/question/answer/model/status/createdAt/usage/stopped/hadImage`。

### 4.4 SSE 事件

`meta`（首帧，含 node） → 若干 `delta`（+ `reasoning`） → `done`（含 node，含 usage）。
错误走 `{type:'error', message}`；前端 `readSSE` 按 `\n\n` 分帧。

### 4.5 焦点规则（`focus.js`）

- 窗口激活状态以主进程 `dt:win-state/dt:win-focus/dt:win-blur` 为准（Electron 的 `document.hasFocus()` 会误报）
- `canFocus` 依次检查：有弹窗 → 搜索条 → 移动端(`DT_LOCAL`) → 窗口激活 → 别的文本框 → （可选）选区
- 点按钮（`FOCUS_BACK`）→ 清选区 + 回焦；**有选区时不抢焦点**，等第一次按键由 keydown 兜底（`setRangeText` 补首字符）
- 新增原生对话框会打断输入法，**禁止再用 `alert/confirm/prompt`**，用 `uiConfirm()`

### 4.6 化学块协议（提示词 + 前端双保险）

- 单结构 → ```smiles；真实反应 → ```reaction 一行 `反应物>>产物`
- 前端兜底：左右相同→单结构；无 `>>`→单结构；占位条件→不渲染
- 朝向：PCA 键轴吸附，仅当 |角度| ≤20° 才纠正；显示尺寸 `min(可用宽/w, 420/h, 1.5)`
- RDKit 的 `rotate` 生效，但**绘制坐标系与 molblock 相差固定 30°**，别用坐标预测朝向
- RDKit 需要 `'unsafe-eval'`（CSP 必须放行），否则所有结构报“SMILES 无法解析”

### 4.7 图片随提问

前端 `S.pendingShot`（dataURL，长边 ≤1280、JPEG 0.85）→ `POST /api/ask {image}` →
服务端 `sanitizeImage()`（`data:image/(png|jpe?g|webp|gif);base64,`，≤1.8MB）→ 优先于页图 → `image_url` 给视觉模型。
非法/超长忽略但照常回答。

---

## 5. 数据与安全

- 数据目录可由 `DOCTREE_DATA` 覆盖（`desktop/main.cjs` 会传）；测试全部用临时目录，**不碰用户数据**
- 日志：`%APPDATA%\文档树\app.log`，2MB 轮转
- Electron：`sandbox: true`、主框架 CSP、`will-navigate` 只放行本机 origin、外链走 `shell.openExternal`
- 渲染层：`sanitizeHtml` 丢 script/iframe/on*，外链强制 `target=_blank rel=noopener`

---

## 6. 测试与验收

```bash
npm test                                  # API 91 + UI 98
node scripts/test-api.mjs                 # 端点/CSRF/穿越/Range/空body/损坏数据/提问/续写/图片/提示词契约
node scripts/test-ui.mjs                  # 真 Chrome：渲染、提问、图片、拖选、搜索、焦点、化学、图标
```

Electron 验收（真实安装版）：

```bash
# 1) 以调试端口启动安装版
Start-Process "$env:LOCALAPPDATA\Programs\DocTree\DocTree.exe" -ArgumentList "--remote-debugging-port=9240"
# 2) 跑 15 项：CSP、外站导航拦截、PDF 渲染、焦点桥、RDKit、无 JS 报错
$env:CDP_PORT='9240'; node scripts/test-electron.mjs
```

写新测试的约定：
- API 测试用内置假模型（记录 `lastLlmPayload`，可断言提示词/图片确实送到模型）
- UI 测试用 `page.on('dialog')` 计数断言“没有原生弹窗”
- 每个修复至少一条**行为级**用例（不要只断言 DOM 存在）

---

## 7. 发布流程

```bash
npm test                                  # 1. 全绿
npm run bump 1.0.60 v170                  # 2. 升版本（package.json / app.js / index.html / chem.js）
npm run mobile                            # 3. 重建 mobile/www
# 4. 同步安装版（server.mjs、lib/**、public/{app,index,style,chem}.js、public/modules/**、desktop/main.cjs、package.json）
# 5. 重启应用，跑 test-electron
# 6. 快照 + 提交
#    snapshots\v170\ + snapshots\doctree-v170-source.zip
#    git add -A; git commit -m "chore(v170): ..."; git tag v170
```

回滚：

1. `git checkout v169 -- .` 后重新同步安装版
2. `snapshots\v169\` 直接覆盖源码
3. 安装版旧文件在 `rollback\installed-v152\`（只有 4 个文件，优先用 1/2）

**对外发布（目前都还是旧的）**：GitHub 仓库 1.0.13、Releases v1.0.12、Pages、Android APK 1.0.36。
要发的话：`npm run dist`（便携包）→ 删掉 `release\DocTree-win32-x64` 里 0.2.0/v24 的远古产物；
`mobile\publish-pages.ps1`（Pages）；`mobile\build-apk.ps1`（APK，需要 `mobile-build\` 里的 Android SDK）。

---

## 8. 已知债务 / 下一步建议

1. **`public/app.js` 还有 3158 行**：`S` 全局 82 字段，PDF 视图、树视图、搜索还没拆成模块。下一步优先拆 PDF 视图和树视图（有 `npm test` 兜底）。
2. **`mobile/src/{api,llm,websearch,extract}.js` 是 `lib/*` 的 fork**（已漂移）。要么抽 `core/` 共用，要么明确冻结移动端。
3. **`/api/state` 每次解析所有 doc JSON**（当前 25 份，暂不慢）；文档多了再加内存索引。
4. **`scripts/` 里 ~190 个历史脚本**，只有 3 个进 `npm test`；可以按 `_archive/` 归档。
5. **`release/` 里是 0.2.0 / v24 的远古构建**，别拿去分发。
6. 化学渲染：多图/极长链的朝向仍靠启发式；如需更稳，可上 RDKit 的 `compute2DCoords` 指定模板。
7. 移动端 `bootstrap.js` 的 fetch shim 不校验 `x-doctree-client`（本地无害，但和桌面语义不一致）。

---

## 9. 排障手册（都踩过）

| 现象 | 原因 / 处理 |
|---|---|
| Electron 一启动就 GPU 崩溃 | 从中文路径启动 → `subst S:` 或直接跑安装版 |
| 化学式全显示“SMILES 无法解析” | CSP 挡了 `eval` → `script-src` 必须含 `'unsafe-eval'` |
| 删除后能粘贴不能打汉字 | 原生 `confirm()` 打断 IME → 已全部换应用内确认框 |
| 选中文字后打字没反应 | 焦点在 BODY → keydown 兜底已补（`setRangeText`） |
| 反应箭头跑到顶部 | 网格没钉行号 → `.chem-arrow-line{grid-row:2}` |
| 反应条件被切 | 标签绝对定位不参与行高 → 改流式 + `has-labels` 下限高度 |
| 单分子竖着占满屏幕 | 旧排序选了“宽度更小”的候选 → v160 起按朝向算法；v162 起不强行变宽 |
| 改了源码但界面没变 | 安装版没同步 / 没重启 |
| CDP 测试里“焦点正常”但真人不行 | CDP 不能代表 OS 焦点；用主进程 `isFocused()` 的桥判断 |

---

## 10. 交接检查清单

- [x] 代码在 git，tag 到 `v169`，工作区干净
- [x] 安装版 1.0.59 已同步并跑过 Electron 15 项
- [x] `npm test` 全绿（API 91 + UI 98）
- [x] `mobile/www` 已重建
- [x] 快照 `snapshots/v169` + zip，回滚路径可用
- [x] 18 篇改动文档在 `docs/`
- [ ] （待办）对外发布：GitHub / Pages / APK / 便携包
