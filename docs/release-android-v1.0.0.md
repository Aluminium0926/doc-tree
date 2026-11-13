# DocTree Android v1.0.0

安卓版首个版本：独立运行，不依赖电脑。

## 特点

- **独立 APK**（约 2.6 MB，minSdk 24）：WebView + 应用内本地服务，无需 Node、无需联网服务端
- **离线可用**：文档、追问树、原始文件都存在手机 IndexedDB 里，断网也能读
- **同一套界面**：PDF 原版式渲染、划词提问、回答内继续追问、树状图、搜索、荧光笔
- **模型自选**：任意 OpenAI 兼容端点，请求经应用内本地代理转发（绕开浏览器 CORS）
- **移动适配**：竖屏下文档区在上、追问树在下，文档库改为抽屉；工具条可横向滑动

## 安装

下载 `DocTree-android.apk`，传到手机安装（需允许「未知来源」）。

首次打开：点右上角 ⚙ 填 Base URL / API Key / 模型名，然后导入 PDF / DOCX / MD / TXT。

## 已知限制

- debug 签名，仅用于自用/测试
- 扫描版 PDF 没有文字层，划词选不中，需要用「框选截图」
- 导出 Markdown 写入系统「下载」目录
- 尚未在真机验证（本仓库的环境没有安卓设备），如遇问题请开 issue 并附机型与系统版本

## HarmonyOS NEXT

APK 无法在鸿蒙 NEXT 上运行。同一套前端已支持移动布局与 PWA，可在鸿蒙浏览器中「添加到桌面」使用；ArkTS Web 壳的移植路径见 [docs/安卓与鸿蒙.md](https://github.com/Aluminium0926/doc-tree/blob/main/docs/安卓与鸿蒙.md)。
