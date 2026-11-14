# 文档树 · DocTree

**选中就问，问过还在。**

上课听不懂的那一句、论文卡住的那一段——选中它，点「用这段提问」，回车。
不用截图、不用复制粘贴、不用切屏，连问题都可以不打。

答案贴在那行字旁边；在回答里继续选中还能追问。
每个问题都记着自己锚在原文第几页、哪一句，长成一棵树，而不是一条滚不到头的聊天记录。
下次翻回这一页，问过的都还在。

支持 PDF / Word / Markdown / 纯文本，电脑和手机都能用。

## 六种用法

| 平台 | 怎么用 | 说明 |
|---|---|---|
| **手机 / 平板浏览器** | 打开 **https://aluminium0926.github.io/doc-tree/** ，「添加到桌面」 | 零安装，数据存浏览器本地，可离线 |
| **iOS** | Safari 打开同一网址 → 分享 → 添加到主屏幕 | 不需要 App Store，长按选中提问已适配 |
| **安卓** | 下载 `android-v1.0.2` 里的 `DocTree-android.apk` | 独立 App，2.6 MB，无需联网服务端 |
| **鸿蒙 NEXT** | 用系统自带的**卓易通**安装同一个 APK；不装就用上面的网页版 | 卓易通提供安卓运行时，装完 APK 可当普通 App 用 |
| **Windows** | 下载 `DocTree-1.0.3-win32-x64.zip`，双击 `start-doctree.vbs` | 便携版，中文路径也能用 |
| **macOS** | 网页版开箱可用；原生 `.app` 用 `bash scripts/build-macos.sh` 在 Mac 上构建 | 未公证，首次需右键「打开」 |
| 开发者 | `npm install && npm start` | 起本地服务端，`HOST=0.0.0.0` 可让局域网手机访问 |

### 网页版最省事

手机浏览器打开上面那个网址，第一次点右上角 ⚙ 填 Base URL / API Key / 模型，之后：

- 安卓 / 鸿蒙浏览器：菜单「添加到桌面」，下次像 App 一样打开
- 离线可用（Service Worker 缓存外壳，文档与追问树存在浏览器本地）
- 不需要装 Node、不需要命令行

> 页面是公开的，但你的文档、问答、Key 只存在你自己浏览器的本地存储里；只有模型请求会发给你配置的端点。

![阅读界面](docs/screenshots/reader.png)

| 追问树结构图 | PDF + 荧光笔 |
|---|---|
| ![树](docs/screenshots/tree.png) | ![PDF](docs/screenshots/pdf.png) |

详细用法见 [使用手册](docs/使用手册.md)，各端差异见 [安卓与鸿蒙](docs/安卓与鸿蒙.md)。

## 功能

| 能力 | 说明 |
|---|---|
| 文档阅读 | PDF 按页原版式渲染，文字层可选中；Word / Markdown / 纯文本重排阅读 |
| 划词提问 | 选中即挂引用，写不写问题都行，点「发送」才发 |
| 追问树 | 在回答里继续选中 → 追问，节点锚定原文或上一段回答；可折叠、可导出、可看结构图 |
| 上下文 | 全文摘要 + 选中处前后文 + 跨页检索 + 祖先链，追问不跑题 |
| 截图提问 | PDF 上框选一块区域发给多模态模型（同样先挂引用、点发送才发） |
| 荧光笔 | 三色高亮，本地保存；擦除模式点一下删除 |
| 检索 | Ctrl+F 文档内搜索，命中计数 + 位置标记 |
| 阅读控制 | 页码跳转、← → 瞬切翻页、↑ ↓ / PgUp / PgDn / Home / End 滚动、旋转 |
| 公式 | KaTeX 渲染 `$...$` 与 `$$...$$`，兼容 `\(...\)` / `\[...\]` |
| 输出 | 流式回答、思考过程可展开、思考强度三档、整棵树导出 Markdown |
| 多端 | 桌面 / 安卓 App / PWA 网页，同一套界面；移动端文档在上、追问树在下，文档库变抽屉 |

## 最近更新

- **web-v1.0.0 + GitHub Pages**：手机直接开网址就能用；静态部署无代理时自动直连模型端点
- **android-v1.0.2**
  - 修复重启后数据丢失（本地服务固定端口 47201）
  - 修复旧版 WebView（Chrome 113 及更早）下 PDF 解析失败：页面与 worker 双侧补 `Promise.withResolvers`
  - 模型请求自动回退：优先本地代理，静态部署时直连
  - 导入完成后自动收起文档库抽屉
- **v1.0.3（Windows 桌面）**
  - 输入框光标不显示：窗口启动主动获取焦点 + 显式 `caret-color`
  - 分栏抓取区移入侧栏内侧，不再遮挡文档区滚动条
  - 思考强度滑块热区加大到 22px
- **v1.0.1（Windows 桌面）**：中文路径启动器 `start-doctree.vbs`、静默启动、滑块与分栏误触

## 下载

| 产物 | Release |
|---|---|
| `DocTree-android.apk` | [android-v1.0.2](https://github.com/Aluminium0926/doc-tree/releases/tag/android-v1.0.2) |
| `DocTree-mac-arm64.zip`（Apple Silicon） | [mac-arm64-v1.0.0](https://github.com/Aluminium0926/doc-tree/releases/tag/mac-arm64-v1.0.0) |
| `DocTree-mac-x64.zip`（Intel Mac） | [mac-x64-v1.0.0](https://github.com/Aluminium0926/doc-tree/releases/tag/mac-x64-v1.0.0) |
| `DocTree-web-v1.0.0.zip`（静态包，自建托管用） | [web-v1.0.0](https://github.com/Aluminium0926/doc-tree/releases/tag/web-v1.0.0) |
| `DocTree-1.0.3-win32-x64.zip`（Windows 便携版） | [v1.0.3](https://github.com/Aluminium0926/doc-tree/releases/tag/v1.0.3) |

## 快速开始（源码）

```bash
npm install
npm start
```

浏览器打开 http://127.0.0.1:4317 ，点右上角 **⚙** 填：

- Base URL（例如 `https://api.deepseek.com/v1`）
- API Key
- 模型名（例如 `deepseek-flash`）

也可以直接编辑 `data/config.json`（参考 `data/config.example.json`）。

不想花额度、只想试交互：`npm run mock` 会起一个假模型端点（4318），把 Base URL 指过去即可。

```bash
HOST=0.0.0.0 npm start      # 让同局域网手机访问
```

## 快捷键

| 键 | 作用 |
|---|---|
| ← / → | 上一页 / 下一页（PDF，瞬切） |
| ↑ / ↓ | 滚动 90px |
| PgUp / PgDn | 翻一屏 |
| Home / End | 到首尾 |
| Ctrl+F | 文档内搜索 |
| Ctrl+B | 收起/展开左栏 |
| Esc | 关闭浮层、退出荧光笔/擦除、关搜索 |

## 数据

桌面 / 服务端：

```
data/config.json     模型配置（含明文 key，注意别提交）
data/docs/*.json     文档元信息 + 分页文本 + 摘要 + 高亮
data/trees/*.json    追问树（问题、回答、引用锚点）
data/files/*         原始文件
```

手机 / 网页版：存在浏览器 **IndexedDB**（文档、追问树、原文件）与 `localStorage`（配置），不同设备、不同浏览器各自独立。清站点数据会清空，导出 Markdown 可留存追问树。

## 桌面版

```bash
npm install
npm run app     # 开发模式直接开窗口
npm run dist    # 用 electron-packager 打包到 release/
```

打包后是便携目录（`DocTree-win32-x64`），双击 `start-doctree.vbs` 启动。数据目录会切到 `%APPDATA%\文档树`，首次启动自动从包内 `data/` 复制。

> **中文路径**：直接双击 `DocTree.exe` 时，Electron 在某些含非 ASCII 字符的路径下会启动即崩（`0x80000003`）。`start-doctree.vbs` 会检测路径，必要时把程序复制到 `%LOCALAPPDATA%\Programs\DocTree` 再从那里启动，所以解压位置随意。

## 各平台细节

### 手机 / 安卓 / 鸿蒙

- **网页版（最省事）**：https://aluminium0926.github.io/doc-tree/
- **安卓 APK**：`android-v1.0.2` 里的 `DocTree-android.apk`
  - WebView + 应用内本地服务（`127.0.0.1:47201`），数据存 IndexedDB，模型请求经本地代理
  - 架构与构建步骤见 [安卓与鸿蒙](docs/安卓与鸿蒙.md)
- **HarmonyOS NEXT**：系统自带**卓易通**（安卓运行时），用它安装同一个 APK 即可，装完就是一个普通 App。不装就用网页版（PWA 可添加到桌面）；用 ArkTS `Web` 组件套壳也能复用 `mobile/www`
- **iOS**：Safari 打开网页版 → 分享 → 添加到主屏幕；长按选中提问、导出、存储持久化都做了适配
- **自建自托管**：`DocTree-web-v1.0.0.zip` 解压后任意静态服务器托管；`HOST=0.0.0.0 node mobile/static-server.mjs` 会打印手机可访问地址

### macOS

三种方式，按省事程度排：

1. **现成安装包**（推荐）
   - Apple Silicon：[mac-arm64-v1.0.0](https://github.com/Aluminium0926/doc-tree/releases/tag/mac-arm64-v1.0.0) → `DocTree-mac-arm64.zip`
   - Intel：[mac-x64-v1.0.0](https://github.com/Aluminium0926/doc-tree/releases/tag/mac-x64-v1.0.0) → `DocTree-mac-x64.zip`

   解压后**双击「首次打开.command」**：它会自动去掉隔离标记、做本地临时签名，然后启动。

   也可以手动：

   ```bash
   xattr -dr com.apple.quarantine DocTree-darwin-arm64/DocTree.app
   codesign --force --deep --sign - DocTree-darwin-arm64/DocTree.app
   open DocTree-darwin-arm64/DocTree.app
   ```

2. **网页版**：Safari / Chrome 打开 https://aluminium0926.github.io/doc-tree/ ，Chrome 可「安装应用」，Safari 17+ 可「添加到程序坞」。
3. **自己构建**：

   ```bash
   bash scripts/build-macos.sh arm64    # 在 Mac 上；Intel 用 x64
   ```

   或者用 GitHub Actions 的 Linux runner 交叉构建：`.github/workflows/build-mac-cross.yml`（workflow_dispatch，可选架构，产物直接发到 Release）。

macOS 上窗口菜单已补 App 菜单与「编辑」菜单（Cmd+C / Cmd+V / Cmd+Z 可用），数据目录在 `~/Library/Application Support/文档树`。

> **关于签名**：包是**未签名、未公证**的，所以才有「首次打开.command」这一步。它用 `codesign -` 做 ad-hoc 签名（Apple Silicon 上必需），并清掉下载隔离属性。想要双击即开、无任何提示，需要 Apple 开发者证书 + 公证，这一步只能在有证书的 Mac 上完成。
>
> **构建方式**：`.app` 里 Electron 框架有 14 个符号链接，Windows 上打包会丢。这里在 GitHub Actions 的 **Ubuntu** runner 上交叉构建，用 `zip -ry` 保留符号链接，构建日志里会打印 `symlinks: 14` 核对。

## 目录结构

```
server.mjs            HTTP 服务：静态资源、导入、SSE 转发、持久化
lib/extract.mjs       PDF（含中文 cmap）/ docx / 文本解析
lib/store.mjs         data/ 读写
lib/llm.mjs           OpenAI 兼容端点、流式解析、思考强度
lib/context.mjs       摘要、检索、祖先链、导出；系统提示词也在这里
public/               前端（index.html / app.js / style.css）
public/vendor/        pdfjs、marked、katex、cmaps（离线可用）
desktop/main.cjs      Electron 主进程
mobile/               手机端：本地数据层、Android 壳、PWA、Pages 发布脚本
scripts/              冒烟测试、假模型、导入测试
```

## 自定义

- 回答风格、是否生成应试内容：改 `lib/context.mjs` 里的 system prompt
- 默认端口：环境变量 `PORT`（默认 4317）；监听地址：`HOST`（默认 `127.0.0.1`）
- 数据目录：环境变量 `DOCTREE_DATA`
- 重新发布网页版：`powershell -File mobile/publish-pages.ps1`

## 已知限制

- 扫描版 PDF 没有文字层，划词选不中 → 用「框选截图」
- 旋转视图下高亮暂不显示（坐标会错位）
- 一棵树只属于一个文档，暂不支持跨文档引用
- 没有 TTS 朗读与协作
- 手机端尚未在真机（尤其鸿蒙 NEXT）验证；模拟器验证的是 Android 14 + Chrome 113 内核
- 鸿蒙原生 HAP 未构建（需要 DevEco Studio 与 HarmonyOS SDK）
- 首字延迟取决于模型；思考强度「轻」最快

## 许可

MIT
