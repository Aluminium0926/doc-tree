# DocTree v1.0.61（UI v171）发布说明

> 发布日：2026-11-26　·　产物在 `release/`，校验见 `release/SHA256SUMS.txt`
> 上一版：v1.0.60（UI v170），见 [RELEASE-v1.0.60.md](RELEASE-v1.0.60.md)

## 一、本版改动（相对 v1.0.60）

**化学结构图：杂原子符号与相连键长，对齐课件**

- 杂原子标签字号从 RDKit 默认的约 `0.6×键长` 提到 `0.85×键长`
- 增加标签内边距（`additionalAtomLabelPadding: 0.08`），键在符号边缘前收住，不会画进字母里
- 效果：符号占分子高度从 **11.8% → 16.3%**，连到 N/O/NH/NH₂ 的键随之变短，与课本（吡啶/胞嘧啶/尿嘧啶）一致

**Android 版本号**：`versionCode 60 → 61`，`versionName 1.0.61`

本版无其他行为变更（焦点规则、图片、化学式解析等都沿用 v1.0.60）。

## 二、产物

| 平台 | 文件 | 大小 |
|---|---|---|
| Windows x64 | `DocTree-v1.0.61-win32-x64.zip` | 213.4 MB |
| Android | `DocTree-v1.0.61-android.apk` | 7.27 MB |
| Web / PWA | `DocTree-v1.0.61-web.zip` | 7.3 MB |
| macOS arm64 | `DocTree-darwin-arm64.zip` | 见 Release 页 |
| macOS x64 | `DocTree-darwin-x64.zip` | 见 Release 页 |

SHA256 见 `SHA256SUMS.txt`（macOS 由 CI 构建后追加）。

## 三、安装 / 使用

**Windows**：解压后双击 `DocTree.exe`。
- 解压到**中文路径**时，改用包内的 `启动文档树.vbs` —— 它临时 `subst` 一个英文盘符再启动（老补丁，本版随包提供）

**Android**：`adb install DocTree-v1.0.61-android.apk`，或传手机点击安装（允许未知来源）。
- debug 证书签名，适合自用/内测；可覆盖安装旧版

**Web**：解压部署到任意静态服务器；线上版见 https://aluminium0926.github.io/doc-tree/

**macOS**：解压后双击「首次打开.command」（去掉隔离 + 本地临时签名 + 启动）。
- 未签名、未公证；无 DMG（DMG 需要 macOS 的 `hdiutil`）
- 构建方式：Ubuntu 交叉构建（`@electron/packager` + 对应架构的 `@napi-rs/canvas-darwin-<arch>`）

## 四、测试

| 套件 | 结果 |
|---|---|
| `npm run test:api` | 91/91 |
| `npm run test:ui` | 107/107（真实 Chrome，含化学比例/裁切/朝向） |
| 安装版实测 | `[DocTree] UI v171`，胞嘧啶标签高度 19.7、键长 45（比例 16.3%） |

## 五、已知问题

1. Windows：中文路径下直接双击 `DocTree.exe` 会 GPU 崩溃 → 用 `启动文档树.vbs`
2. macOS 未签名/未公证，且 **x64 包未在 Intel 真机验收**（仅校验了架构与原生模块）
3. APK 为 debug 签名
4. 同一个用户数据目录同时只能跑一个实例
5. 移动端 `mobile/src/*` 仍是 `lib/*` 的分叉（长期债务）
