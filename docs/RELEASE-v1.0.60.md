# DocTree v1.0.60（UI v170）发布说明

> 发布日：2026-11-25　·　本地构建产物在 `release/`，校验见 `release/SHA256SUMS.txt`

## 一、这一版解决了什么（v153 → v170）

**结构与安全（v153）**
- 服务端从 758 行单文件拆成 `http / routes / services`，存储改为原子写 + schema + 损坏隔离
- 修掉 4 个 P0：续写必崩（`webSearch is not defined`）、`id="../config"` 可删含 API Key 的配置、任意网页可 CSRF 改 baseUrl、崩溃时把整棵树写成空树
- Electron 加 CSP / `will-navigate` 拦截 / `sandbox`；外链不再把应用窗口导航走

**焦点（v152 → v163 → v170）**
- v152 用状态机修掉丢光标；v163 修掉拖选后打字丢字；**v170 全部推倒重来**：
  **只有鼠标点输入框区域才会聚焦**，删掉 `focus.js` 和 17 处自动回焦
- 方向键/PageUp/PageDown/←→ 翻页恢复；点页面、点按钮、切文档都不再抢焦点
- 原生 `confirm()` 全部换成应用内确认框，修掉"删完东西能粘贴不能打汉字"（IME 被原生模态打断）

**化学式**
- 修掉 CSP 挡 RDKit 导致所有结构"SMILES 无法解析"
- 修掉 15 秒看门狗把"部分失败"覆盖成"渲染超时"
- 修掉反应条件被裁切、+号/箭头/结构不在同一条中线
- 左右相同的"反应式"按单一结构画；`conditions: -` 这类占位不渲染
- 单分子朝向：键轴吸附（横平竖直）+ 1.5 倍放大上限，**不再为了变宽而强行旋转**

**图片与输入**
- 粘贴图片 / 「图片」按钮 / 拖到输入框 → 图片随本次提问发送（以前会变成导入文档）
- 服务端此前**根本没读** `body.image`，框选截图一直没送到模型 —— 一并修复
- 输入框工具条统一成 34×34 纯图标（地球 / 相片 / `>_`）

## 二、产物

| 平台 | 文件 | 大小 | SHA256（前 16 位） |
|---|---|---|---|
| Windows x64 | `DocTree-v1.0.60-win32-x64.zip` | 213.6 MB | `3d847be19502e27f` |
| Android | `DocTree-v1.0.60-android.apk` | 7.27 MB | `8c2b968ad6ce40f5` |
| Web / PWA | `DocTree-v1.0.60-web.zip` | 7.29 MB | `ed53404b52f57c6c` |

完整校验：`release/SHA256SUMS.txt`。

## 三、安装 / 使用

**Windows**：解压到**纯英文路径**（例如 `D:\DocTree`），双击 `DocTree.exe`。
- ⚠️ 中文路径会让 Electron 的 GPU 进程崩溃（已知问题，与本次改动无关）
- 同一个用户数据目录同时只能跑一个实例（和已安装版不能同时开）

**Android**：`adb install DocTree-v1.0.60-android.apk`，或传到手机点击安装（允许未知来源）。
- 使用 debug 证书签名，适合自用/内测；上架应用商店需要换成 release 签名

**Web**：解压后部署任意静态服务器即可（`index.html` + `assets/`）。也可以直接用线上 Pages 版本。

**macOS**：需要 macOS 环境构建（Windows 上无法产出可用的 `.app`）。
已提供 `.github/workflows/release.yml`，打 tag 或手动触发即可在 macOS runner 上产出 x64/arm64 包并挂到 Release。

## 四、测试

| 套件 | 结果 |
|---|---|
| `npm run test:api` | 91/91 |
| `npm run test:ui` | 107/107（真实 Chrome） |
| `scripts/test-electron.mjs` | 16/16（真实 Electron：CSP / 导航拦截 / PDF / RDKit / 焦点） |

## 五、已知问题

1. **中文路径**下 Electron GPU 进程崩溃（应用可能起不来）→ 解压到英文路径
2. **macOS 未签名**（CI 产物）：首次打开需右键 → 打开，或 `xattr -dr com.apple.quarantine DocTree.app`
3. **APK 为 debug 签名**，与旧版签名一致，可覆盖安装
4. 移动端 `mobile/src/*` 仍是 `lib/*` 的分叉（长期债务，未在本版处理）
5. Anthropic 通道仍无自动化测试（无测试条件，本版未改动其行为）

## 六、从源码构建

```bash
npm ci
npm test                      # API + UI
powershell -File scripts/dist.ps1        # Windows 便携包（stage + 生产依赖 + 打包）
powershell -File mobile/build-apk.ps1    # Android APK（需要 C:\dt-sdk）
node mobile/build.mjs                    # Web（mobile/www）
```
