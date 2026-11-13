# DocTree Android v1.0.1

## 修复

- **重启后数据丢失**：本地服务原来用随机端口，而 WebView 的 localStorage / IndexedDB 按 origin（含端口）隔离，端口一变就“失忆”。现在固定 `127.0.0.1:47201`，被占用才回退随机端口。
- **旧版 WebView 下 PDF 解析失败**：pdf.js 4.10 依赖 `Promise.withResolvers`（Chrome 119+）。页面侧加了 polyfill，worker 侧加了包装模块 `pdf.worker.wrapper.mjs`，覆盖 Chrome 113 及更老的系统 WebView。
- **导入后抽屉不收起**：选择文件后自动关闭文档库抽屉，直接看到刚导入的文档。

## 已在 Android 14 模拟器实测

- 导入 PDF（含中文字体）→ 文字层解析 → 页面渲染
- 输入问题 → 本地代理转发到模型 → 流式返回（思考过程 4232 字 + 答案）
- 强制停止后重启 → 文档、追问树、API 配置全部保留

## 下载

`DocTree-android.apk`（约 2.6 MB，minSdk 24）

## 其他

- 移动端布局：竖屏文档在上、追问树在下，文档库改为抽屉；工具条横向滑动
- PWA/HarmonyOS NEXT 说明见 [安卓与鸿蒙](https://github.com/Aluminium0926/doc-tree/blob/main/docs/安卓与鸿蒙.md)
