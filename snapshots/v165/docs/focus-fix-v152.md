# 提问框「有时不能正常输入文字」——根因与 v152 修复

> 生成时间：2026-11-25
> 版本：**UI v152 / APP 1.0.42**
> 基线：v147 / 1.0.41（`snapshots/v147`）
> 状态：源码已改、已同步安装目录、已通过自动化测试

---

## 1. 现象

- 启动后输入框有时没有光标，点一下才出现。
- 点过「联网 / 搜索 / 追问 / 发送」等按钮、或点过追问树空白之后，接着打字没反应；
  敲英文字母有时又能进去，但会跑错位置。
- 中文输入法最明显：拼音敲了一串，输入框里什么都没有（或全是半截拼音）。
- `document.activeElement` 明明是 `#q`，屏幕上却看不到光标，键盘也打不进字。

---

## 2. 结论：两层根因叠加

### 2.1 DOM 层：焦点被点走，且没有任何代码负责要回来

`#q` 是普通 `<textarea>`（`public/index.html`），没有 autofocus。Chromium 里点 `<button>` 会让按钮拿到焦点，
而 v147 里**没有任何“操作结束后把焦点还给输入框”的机制**：

| 操作 | 焦点去向（v147 实测） | 有没有回焦 |
|---|---|---|
| 点「发送」 | `BODY`（按钮被 disable，焦点掉回 body） | ❌ |
| 点「联网 / 指令 / 导出 / 树状图 / 搜索」 | 对应按钮 | ❌ |
| 点追问树空白 / 文档区空白 | `BODY` | ❌ |
| 关设置、关搜索条（Esc）、关树状图、关配色 | `BODY` | ❌ |
| 切换文档 | `BODY` | ❌ |
| 页码框回车 | `BODY` | ❌ |

唯一想兜住这些的 `autoFocusComposer()` 守卫写反了：

```js
// v147 public/app.js:3392
if (ae && ae !== q && ae !== document.body && ae.tagName !== 'HTML') return
```

**焦点在按钮上时它主动放弃**；而它只挂在 `window focus` 上、延迟 60ms——正好在「点击事件已经把焦点交给按钮」之后执行。
实测：点「联网」后再派发 `window focus`，焦点仍然停在按钮上。

### 2.2 窗口层：`document.hasFocus()` 会骗人，主进程又在盲抢焦点

`document.activeElement === #q` 只说明 **DOM** 焦点在输入框，不代表窗口是 Windows 前台活动窗口。
窗口没激活时 Chromium 不画光标，键盘事件也根本到不了渲染进程——就是「有焦点、没光标、打不进字」。

这个假状态是程序自己造出来的：

- v147 的 `autoFocusComposer()` 不判断窗口是否激活，照样 `q.focus()`。
- `desktop/main.cjs` 里 `revealWindow()` 从主进程直接
  `executeJavaScript("document.querySelector('#q')?.focus(...)")`，也不判断窗口是否激活、还绕过了页面自己的弹窗守卫。
- `revealWindow` 同时绑在 `ready-to-show` 和 `did-finish-load` 上，整套抢焦点跑两遍，
  350ms/1200ms 两次注入各跑两遍 = 最多 4 次。
- `app.focus({ steal: true })` 的 `steal` 在 Electron 文档里是 **@platform darwin（仅 macOS）**，
  Windows 上等于没加；`webContents.focus()` 只改渲染进程内部焦点，**不激活 OS 窗口**。

**实测（安装版 v147）**：从后台进程启动后，Windows 前台窗口是**任务栏**（`Shell_TrayWnd`），
而渲染进程报告 `document.hasFocus() === true`、`document.activeElement === '#q'`。
—— 这就是「activeElement 是 #q 却看不到光标」的确切成因，也说明 `document.hasFocus()` 不能当判据。

### 2.3 为什么键盘兜底一定救不了中文

v147 有两处 keydown 重放（`q.value += e.key`）。它们只处理「单个可打印字符」：

- 中文输入法首键是 `keyCode 229 / key: "Process"`（长度 7）→ 直接 return；
  后面全是 `compositionstart/update` 事件，只会送到**当前焦点元素**，`#q` 收不到。
- Backspace / Delete / Enter / 方向键 / 粘贴同样不是单字符 → 全部被吞。
- `q.value += e.key` 是追加到末尾，**忽略光标**：值 `abcdef`、光标在索引 2，敲 X 得到 `abcdefX`。
  而且直接赋值不触发 `input` 事件。

---

## 3. v152 修复

### 3.1 主进程：改成「状态广播」，不再盲抢焦点

`desktop/main.cjs`：

- 新增 `sendToRenderer()`，通过 `executeJavaScript` 派发自定义事件：
  - `dt:win-state` `{ active: boolean }` —— 权威的窗口激活状态（`mainWindow.isFocused()`）
  - `dt:win-blur` / `dt:win-focus`
- `mainWindow.on('focus' / 'blur')`、`webContents.on('focus')`、`did-finish-load`（+120ms/+1200ms 兜底）都会广播状态。
- **删掉**从主进程直接 `#q.focus()` 的注入。
- `revealWindow()` 用 `revealed` 去重，只跑一次；`ensureActive()` 按 `isFocused()` 重试最多 5 次
  （`setAlwaysOnTop` → `focus` → 取消置顶），仍拿不到前台就 **`flashFrame(true)` 闪任务栏**提示用户点一下。
- macOS 才用 `app.focus({ steal: true })`。

### 3.2 渲染进程：单一焦点入口 `DTFocus`

`public/app.js` 新增 `DTFocus`（文件末尾），全部聚焦行为只走它：

```js
DTFocus.focus({ end, clearSelection, external, respectSelection })
```

`canFocus()` 的判定：

1. `#q` 存在且没被禁用；
2. 没有可见弹窗、没有搜索条；
3. 窗口激活（`known ? active : document.hasFocus() !== false`，`active` 来自主进程）；
4. 当前焦点不是**另一个真能打字的控件**（`textarea` / 文本类 `input` / contenteditable；
   **range、checkbox、button 不算**，否则拖动「思考强度」滑块后又打不了字）；
5. 需要尊重选区时，页面上没有未折叠的文本选区（避免打断「选中文字提问」）。

配套三件事：

- **点击回焦**：document 捕获阶段监听 `click`，凡不是「输入控件 / 弹窗 / 菜单 / 搜索条 / 分组框」的点击，
  结束后统一 `DTFocus.focus()`；点按钮这类明确操作还会先清掉残留选区（顺手修掉「点追问时浮层乱弹、锚点被旧选区覆盖」）。
- **弹窗关闭回焦**：`MutationObserver` 盯 `.modal / #treeview / #search-bar / #group-bar / #instr-pop / #theme-pop`
  的 `hidden` 变化，全部关掉后回焦。
- **键盘兜底重写**：只补焦点、不重放字符。`keyCode 229 / Process` 只把焦点挪回来；单个可打印字符用
  `execCommand('insertText')` 回放（保留光标位置、触发 `input`）。

另外把会掉焦点的路径补上回焦：`send()` / `resumeNode()` 的 finally、`openDoc()`（60ms+700ms）、
页码框回车、浮层按钮、节点「追问」、指令模式、框选截图。

---

## 4. 测试

三套自动化（脚本都在 `doc-tree/scripts/`）：

| 脚本 | 环境 | 覆盖 | 结果 |
|---|---|---|---|
| `focus-test.mjs` | Chrome + 本地服务 | 启动、8 类按钮、2 处空白、发送、4 种弹窗、切换文档、拖选文字+浮层、中文输入法、光标位置、页码框 | **34/34** |
| `electron-focus-matrix.mjs` | 真实 Electron（CDP） | 点输入框/联网/缩放/指令/树空白/发送 + 派发 window focus | **11/11** |
| `electron-state-test.mjs` | 真实 Electron（CDP） | 主进程广播、未激活不抢焦点、激活后自动回焦、blur/focus | **8/8** |

v147 → v152 在真实 Electron 里的同一组动作对照：

| 动作 | v147 | v152 |
|---|---|---|
| 启动 | `#q` | `#q` |
| 点「联网」 | `#btn-web` | `#q` |
| 点后派发 window focus | `#btn-web`（不回来） | `#q` |
| 点追问树空白 | `BODY` | `#q` |
| 点「发送」 | `BODY` | `#q` |
| 关设置 / 关搜索 / 关树状图 / 关配色 | `BODY` | `#q` |
| 未激活窗口点按钮 | `#q`（假焦点） | 不抢焦点（等激活后再回焦） |

---

## 5. 部署 / 回滚

- 源码：`doc-tree/public/app.js`、`public/index.html`、`desktop/main.cjs`、`package.json`
- 快照：`doc-tree/snapshots/v152/`、`doc-tree/snapshots/doctree-v152-source.zip`
- 安装目录已同步：`%LOCALAPPDATA%\Programs\DocTree\resources\app\{public\app.js, public\index.html, desktop\main.cjs, package.json}`
- 回滚到 v147：备份在 `doc-tree/rollback/before-v152/`
  ```powershell
  Copy-Item doc-tree\rollback\before-v152\* "$env:LOCALAPPDATA\Programs\DocTree\resources\app" -Recurse -Force
  ```

**必须完全退出文档树再重开**（`main.cjs` 改了；Ctrl+R 只刷新渲染进程，服务端还是旧的，会弹版本不一致横幅）。

---

## 6. 还需要你目视确认的一次

自动化能证明「焦点在输入框、输入法能上屏、点击后不回丢」，但**光标闪烁**属于渲染层，机器验不了。
解锁后请做 4 步（30 秒）：

1. 双击桌面「文档树」→ 不点任何地方，直接打中文（应直接进输入框、有光标）。
2. 点「联网」→ 直接打中文（应仍然进输入框）。
3. 点追问树空白 → 直接打中文（应仍然进输入框）。
4. 点「发送」→ 等回答出来 → 直接打下一句中文（应仍然进输入框）。

任何一步不通过，把 `node doc-tree/scripts/electron-lab.mjs read` 的输出发我（会打印 activeElement / 窗口激活状态）。
