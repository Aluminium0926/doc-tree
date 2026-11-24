# v153 大修说明（结构 + 具体 bug）

> 版本：**UI v153 / APP 1.0.43**
> 基线：v152 / 1.0.42（git tag `v152-before-refactor`，commit `a095acf`）
> 备份：`snapshots/pre-refactor-*`、`snapshots/doctree-v152-before-refactor-*.zip`、`rollback/installed-v152/`
> 一键回滚：`git checkout v152-before-refactor -- .`（或从备份目录复制）

---

## 1. 现状（改动前的判断依据）

| 项 | 结论 |
|---|---|
| 运行环境 | Windows 10/11 + Electron（安装版 33.x / 源码 dev 45.x）+ Node 22 |
| 发布形态 | 桌面便携包、安装版、Android APK、PWA 网页、GitHub Pages；**同一份 `public/app.js` 服务所有端** |
| 公开仓库 | `Aluminium0926/doc-tree`，main 分支 1.0.13，release 到 v1.0.12；本机是 1.0.42 |
| 数据 | `data/docs|trees|files`（桌面）、IndexedDB（移动端），无 schema 版本、无备份 |
| 主要问题 | 无版本控制、前后端各两套拷贝且已漂移、前端 3.5k 行单文件 + 82 字段全局、服务端 19 分支 if 链无边界层、写入非原子 |

需求侧没有变化：仍然要「划词提问 + 追问树 + 多端可用 + 本地数据」。所以这次**不改产品形态**，只做「把地基换掉」。

---

## 2. 目标结构（已落地）

```
server.mjs                 入口：静态 + 路由分发 + 统一错误处理（758 → 150 行）
lib/ids.mjs                id 白名单 + 统一 HTTP 错误类型
lib/http/router.mjs        路由表（替代 19 个 if (p === …)）
lib/http/body.mjs          读 body：空 → {}，坏 JSON → 400，超限 → 400
lib/http/guard.mjs         CSRF 守卫：要求 x-doctree-client，Origin 必须同源
lib/http/respond.mjs       json / text / SSE（含心跳和立即 flush）
lib/routes/{state,docs,groups,ask}.mjs   每个文件一组端点
lib/services/ask.mjs       提问/续写共用管线（原来两份复制粘贴）
lib/store.mjs              原子写 + schema + 损坏隔离 + id 断言
public/modules/{util,markdown,api,sse,focus}.js   前端公共模块
public/app.js              只留 UI / 视图 / 事件（3582 → 2936 行）
desktop/main.cjs           加 CSP、will-navigate、sandbox、bounds 校验、日志轮转
mobile/build.mjs           同步拷贝 public/modules
scripts/bump-version.mjs   版本号单一入口
scripts/test-{api,ui,electron}.mjs   三套自动化测试
```

共享边界（这次明确了）：
- `lib/` 是「可被浏览器/Node 共用的纯逻辑」（`context.mjs` 已同时被移动端复用）
- `lib/http`、`lib/routes`、`lib/services` 只跑在 Node
- `public/modules` 只跑在浏览器；`app.js` 负责组装
- `desktop/` 不写业务逻辑，只做窗口/焦点桥/安全策略

---

## 3. 修掉的具体 bug（全部有测试或实测）

### P0（会丢数据 / 丢 Key / 功能完全不可用）

| # | 问题 | 修法 | 验证 |
|---|---|---|---|
| 1 | 「继续生成」100% 报 `webSearch is not defined`（`handleResume` 引用了不存在的作用域变量） | 抽出 `lib/services/ask.mjs`，ask/resume 走同一管线 | `test-api` 续写用例 + 假模型全链路 |
| 2 | `POST /api/doc/purge {"id":"../config"}` 能删掉 `config.json`（含 API Key） | `lib/ids.mjs` 白名单 + 每个用到 id 的路由先 `assertDocId`，store 里再断言一次 | `test-api` 四个穿越用例全部 400，config 仍在 |
| 3 | 任意网页可 CSRF 改 `baseUrl`，把 key 和提问内容发到攻击者服务器 | 写操作要求 `x-doctree-client` 头 + Origin 与 Host 同源 + JSON 接口校验 content-type | `test-api` 缺头/跨源/text-plain 三种都 400 |
| 4 | 写文件非原子 + 损坏静默当空树 → 一次崩溃永久丢整棵树 | tmp+fsync+rename（带 Windows 重试）；解析失败改名 `.corrupt-<时间戳>` 并抛错，绝不覆盖 | `test-api` 截断树文件 → 500 + 备份存在 + 原文件不被空树覆盖 |
| 5 | 点回答里的链接会把整个应用窗口导航到外站 | `sanitizeHtml` 给外链加 `target=_blank rel=noopener`；主进程 `will-navigate` 只允许本地 origin，其余 `shell.openExternal` | `test-ui` 外链属性 + Electron 实测导航被拦 |

### P1（高价值）

| # | 问题 | 修法 |
|---|---|---|
| 6 | 空 body → 500（`Buffer || '{}'` 永远为真） | `readJson` 空 body 返回 `{}`，坏 JSON 400 |
| 7 | `/api/file` 声称 `accept-ranges` 却不实现；文件缺失 500 | 实现 206/Content-Range/416，缺失 404，支持 HEAD |
| 8 | 流式固定 120s 墙钟截断；非流式请求无超时 | 流式改「90s 无输出」+ 10 分钟硬上限；`chat()` 加 120s |
| 9 | `read_page` 每读一页都附整页截图（token/费用翻倍） | 只在页面无文字层时附图，最多 3 张；新增配置 `pageImage: auto/always/never` |
| 10 | 兜底轮 `max_tokens` 2048（其他 4096） | 统一 4096 |
| 11 | `openDoc` 无竞态令牌，快速连点会串页 | `docOpenSeq` 令牌，`renderPdf(seq)` 每页检查 |
| 12 | `renderTree` 每次 meta/done 全量重建（大树叶卡） | 增量：新节点 append、done 只替换该节点 |
| 13 | `closeSearch` 没清防抖定时器（Esc 后又画高亮并滚动） | `clearTimeout(searchTimer)` |
| 14 | `.search-hit` 挡住文字选择 | `pointer-events: none` |
| 15 | `molCache` 无上限 + `queue/running` 死代码 | LRU 200 条，删死代码 |
| 16 | `loadBounds` 不校验屏幕（换显示器后窗口在屏幕外） | 用 `screen.getAllDisplays()` 夹到可见工作区 |
| 17 | 输入框固定两行高，长问题在框内滚 | 跟随内容自增高（54–170px） |

### P2（顺手做掉的）

- `renderPageImage` 复用 PDF 句柄（原来每页重新打开整个 PDF），LRU 2 个文件
- 主进程日志 2MB 轮转
- `HOST` 非本机时打印风险提示
- Electron：`sandbox: true`、主框架 CSP（`script-src 'self' 'wasm-unsafe-eval'` 等）
- 版本号 4 处 → 一条 `npm run bump`；测试断言各端版本一致
- 移动端构建补 `modules/`，`mobile/www` 重新生成到 v153

---

## 4. 测试

```
npm test                          # test-api（81 项） + test-ui（31 项）
node scripts/test-electron.mjs    # 真实 Electron（13 项，需应用以 --remote-debugging-port 启动）
```

- `test-api`：自带假模型 + 临时数据目录；覆盖全部端点、CSRF、路径穿越、Range、空 body、损坏数据、提问/续写/用量/导出/分组/高亮/指令
- `test-ui`：本机 Chrome 真实页面；覆盖加载与版本一致、PDF 渲染、txt 渲染、真 UI 提问、Markdown/外链/KaTeX、搜索与高亮层、输入框自增高、点按钮/空白/关弹窗后回焦
- `test-electron`：CSP 生效（内联脚本被拦）、外站导航被拦、PDF 渲染、焦点桥、点按钮回焦、零 JS 报错

结果：**API 81/81、UI 31/31、Electron 13/13 全绿。**

---

## 5. 部署与回滚

已同步到安装目录：`%LOCALAPPDATA%\Programs\DocTree\resources\app`
（`server.mjs`、`lib/**`、`public/{app.js,index.html,style.css,chem.js,modules/**}`、`desktop/main.cjs`、`package.json`）

回滚三种方式：
1. `git checkout v152-before-refactor -- .` 后重新同步
2. 从 `snapshots/pre-refactor-<时间>/` 复制回源码
3. 安装目录：`rollback/installed-v152/` 里是旧的 4 个部署文件（但 v152 的 lib 没有单独备份，建议用 1 或 2）

---

## 6. 这次没做的（诚实清单）

- `public/app.js` 仍有 2936 行：`S` 全局状态、PDF 视图、树视图、搜索还没拆成独立模块（这次先切掉了 util/markdown/api/sse/focus 这 5 个跨切面模块）
- `mobile/src/{api,llm,websearch,extract}.js` 仍是 `lib/*` 的 fork（已漂移）；彻底解决要抽 `core/` 让两端共用，或明确冻结移动端
- `scripts/` 里 690 个历史脚本没清理（只改了 5 个进 `npm test`）
- `/api/state` 仍每次解析所有 doc JSON（当前 31 份 / 0.7MB，暂不是瓶颈）
- `release/`（326MB）和 `mobile/www`（17.8MB）仍在工作区（已 gitignore，但没删）
