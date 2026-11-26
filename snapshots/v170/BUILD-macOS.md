# macOS 打包 Runbook（给 Agent）

> 适用源码：**1.0.60 / UI v170 / tag v170 / commit d9ccd0a**
> 目标：在**不使用 electron-builder、不加签名**的前提下，用当前仓库已有工具产出可运行的 macOS `.app` zip（arm64 / x64）。
> 重要：当前 macOS 产物是 **未签名、未公证、无 dmg、无自定义图标**。这是内部/自用包，不是可公开分发的正式包。

---

## 1. 先看结论

| 问题 | 答案 |
|---|---|
| Windows 能打 macOS 包吗？ | **不能当交付**。`electron-packager --platform=darwin` 可以在 Windows 上跑，但原生模块、签名、归档行为都不可靠；当前发布说明也明确要求 macOS 环境。 |
| 当前推荐方式 | **GitHub Actions 的 `macos` job**，或一台真实 macOS + `electron-packager`。 |
| 产物是什么 | `DocTree-darwin-arm64.zip`、`DocTree-darwin-x64.zip`，里面是 `DocTree.app`。 |
| 有 dmg 吗 | 没有。只有 zip。 |
| 签名/公证 | 没有。Gatekeeper 会拦，需右键打开或 `xattr`。 |
| 图标 | 没有 `.icns`，使用 Electron 默认图标。 |
| 公开 GitHub 能直接 clone 吗 | **不能**。公开仓库仍是 1.0.13 左右，不是当前 1.0.60。必须从当前本地仓库取源码。 |

---

## 2. 当前仓库事实

```text
源码      C:\Users\wangk\Desktop\大肥鱼的家\doc-tree
版本      1.0.60 / UI v170
HEAD      d9ccd0a
tag       v170
主进程    desktop/main.cjs
打包工具  electron-packager 17.1.2
Electron  45.3.0
Node      22
```

已有文件：

```text
.github/workflows/release.yml       macOS CI job（未签名）
docs/RELEASE-v1.0.60.md             发布说明（macOS 一段）
package.json                        scripts / deps / version
desktop/main.cjs                    窗口、端口、焦点、CSP、日志
lib/office.mjs                      macOS PPT 转换分支
scripts/dist.ps1                    仅 Windows，不要在 mac 上用
```

**不要**改 `scripts/dist.ps1` 来打 mac；它是 Windows stage + 生产依赖 + `pack-dist.mjs` 的专用脚本。

---

## 3. 先拿到正确源码

公开仓库不是当前版本。优先用本仓库的 git 对象传输，避免把 `node_modules`、`data`、截图带过去。

在 Windows 源码目录：

```powershell
cd C:\Users\wangk\Desktop\大肥鱼的家\doc-tree
git status --short
git archive --format=zip -o ..\doc-tree-v170.zip v170
```

`git archive` 只包含已跟踪文件，适合：

- 排除 `data/`（用户文档，绝不能进包）
- 排除 `node_modules/`
- 排除 `release/`、`snapshots/`、`rollback/`

传到 Mac 后解压：

```bash
unzip doc-tree-v170.zip -d doc-tree
cd doc-tree
git status 2>/dev/null || true   # archive 没有 .git，正常
node -v                          # 应为 v22.x
npm ci
```

> 如果用 `git bundle` 也可以，但 `git archive` 更简单，且不会带用户数据。

---

## 4. 路径 A：GitHub Actions（推荐）

### 4.1 现有 workflow

`.github/workflows/release.yml` 的 `macos` job：

```yaml
runs-on: macos-latest
steps:
  - checkout
  - setup-node 22
  - npm ci
  - npx electron-packager . DocTree \
      --platform=darwin --arch=arm64,x64 \
      --out=release --overwrite --asar=false --prune=true \
      --ignore='^/(data|build|release|scripts|docs|snapshots|rollback|mobile|mobile-build|wasm|ppt-lab|\.git|\.npm-cache)' \
      --ignore='\.(png|log|zip|apk)$'
  - ditto 压缩两个 .app
  - upload-artifact name: macos
```

触发方式：

```bash
# 正式 Release（推荐）：tag 必须是 v*，当前约定是 v170 这种 UI 版本号
git tag v171
git push origin v171
```

或在 GitHub：

```text
Actions → release → Run workflow
```

注意：

- 手动 `workflow_dispatch` 会同时跑 Windows / macOS / Web；macOS artifact 仍会生成。
- `publish` job 使用 `softprops/action-gh-release`，它需要 tag。**没有 tag 的手动运行可能只拿到 artifact，Release 发布步骤会失败**；要正式发布请用 tag。
- 当前 `macos` job **不跑测试**，只打包；不要把它当验收。

### 4.2 下载产物

Actions 页面 → 对应 run → Artifacts → `macos`；或：

```bash
gh run list --workflow=release.yml
gh run download <run-id> -n macos -D macos-artifacts
```

得到：

```text
DocTree-darwin-arm64.zip
DocTree-darwin-x64.zip
```

如果 tag 触发了正式 Release，`publish` job 会把这两个 zip 一起挂到 Release assets。

### 4.3 CI 的已知限制

1. **未签名**：用户首次打开会被 Gatekeeper 拦。
2. **单 runner 打双架构**：`npm ci` 安装的是 runner 当前架构的 `@napi-rs/canvas` 等原生依赖；`--arch=arm64,x64` 只保证 Electron 二进制是双架构，**不保证 node_modules 里的原生 `.node` 是双架构**。
3. `macos-latest` 的具体架构随 GitHub 镜像变化。先跑：

```bash
uname -m
```

如果是 arm64，x64 包必须额外验证；不要因为「zip 生成成功」就认为 Intel 能跑。

4. 没有 `--icon`，产物是 Electron 默认图标。
5. 没有 dmg、没有公证、没有 hardened runtime。

---

## 5. 路径 B：本地 macOS 打包

### 5.1 环境

- macOS 13+（以 Electron 45 实际支持范围为准）
- Node 22
- 命令行工具：`git`、`npm`、`ditto`（系统自带）
- 不要求完整 Xcode；`electron-packager` 未签名打包不需要 Xcode 工程
- 需要测试 PPT 预览时：安装 LibreOffice 或 Microsoft PowerPoint

### 5.2 安装与测试

```bash
npm ci

# API 测试不需要浏览器
npm run test:api

# UI 测试脚本默认写死 Windows Chrome 路径，必须覆盖
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:ui
```

`scripts/test-ui.mjs` 读取环境变量 `CHROME`；没有 Chrome 就跳过 UI 测试，不要伪造通过。

### 5.3 打 arm64 包

在源码根目录：

```bash
rm -rf release/DocTree-darwin-arm64 release/DocTree-darwin-arm64.zip

npx electron-packager . DocTree \
  --platform=darwin \
  --arch=arm64 \
  --out=release \
  --overwrite \
  --asar=false \
  --prune=true \
  --ignore='^/(data|build|release|scripts|docs|snapshots|rollback|mobile|mobile-build|wasm|ppt-lab|\.git|\.npm-cache)' \
  --ignore='\.(png|log|zip|apk)$'
```

说明：

- `--asar=false` 与当前 release workflow 保持一致，便于排查；不是安全边界。
- `--prune=true` 会裁掉 devDependencies；`electron` 本身由 packager 处理。
- `--ignore` 中的 `data` 必须保留。**本地工作区的 `data/` 是用户文档，不能打进 app。**
- 不要把 `public/vendor/rdkit` ignore 掉；RDKit 的 wasm 必须随包。
- 产物：`release/DocTree-darwin-arm64/DocTree.app`。

### 5.4 打 x64 包

**不要**在 arm64 Mac 上直接复用同一份 `node_modules` 产出 x64 包就交付。正确做法二选一：

1. 在 Intel Mac / x64 runner 上重新 `npm ci`，再 `--arch=x64`。
2. 为 x64 目标单独准备依赖（原生模块必须是 x64），再打包。

```bash
npx electron-packager . DocTree \
  --platform=darwin \
  --arch=x64 \
  --out=release \
  --overwrite \
  --asar=false \
  --prune=true \
  --ignore='^/(data|build|release|scripts|docs|snapshots|rollback|mobile|mobile-build|wasm|ppt-lab|\.git|\.npm-cache)' \
  --ignore='\.(png|log|zip|apk)$'
```

### 5.5 压缩

```bash
cd release
for d in DocTree-darwin-*; do
  ditto -c -k --sequesterRsrc --keepParent "$d" "$d.zip"
done
```

### 5.6 本机启动

```bash
open release/DocTree-darwin-arm64/DocTree.app
```

如果被 Gatekeeper 拦：

```bash
xattr -dr com.apple.quarantine release/DocTree-darwin-arm64/DocTree.app
open release/DocTree-darwin-arm64/DocTree.app
```

也可以右键 → 打开；新版 macOS 可能要求在「系统设置 → 隐私与安全性」里点「仍要打开」。

### 5.7 日志与数据目录

```text
日志     ~/文档树/desktop.log
用户数据 ~/Library/Application Support/DocTree/
```

说明：

- `desktop/main.cjs` 里 `LOG_DIR = APPDATA || HOME`，macOS 没有 `APPDATA`，所以落到 `~/文档树`。
- Electron 的 `userData` 默认是 `~/Library/Application Support/DocTree`。
- 测试时可用 `DOCTREE_USERDATA` / `DOCTREE_DATA` 指到临时目录，避免污染真实数据。

---

## 6. 架构与原生模块

当前生产依赖里至少这些是平台/架构相关的：

```text
@napi-rs/canvas      PDF/页面渲染
pdf-to-img           间接依赖 canvas
```

`@napi-rs/canvas` 在 package-lock 里按平台安装 optional dependency，例如：

```text
@napi-rs/canvas-darwin-arm64
@napi-rs/canvas-darwin-x64
```

检查产物实际架构：

```bash
file release/DocTree-darwin-arm64/DocTree.app/Contents/MacOS/DocTree
lipo -archs release/DocTree-darwin-arm64/DocTree.app/Contents/MacOS/DocTree

# 原生模块也要查
find release/DocTree-darwin-arm64/DocTree.app/Contents/Resources/app/node_modules/@napi-rs -name '*.node' -exec file {} \;
```

如果 x64 包里出现 `arm64` 的 `.node`：

- 应用可能启动，但打开 PDF / 渲染页面时报 `dlopen`、`cannot open shared object`、`mach-o` 架构错误
- 不要把它当“能用的 x64 包”；换 x64 环境重装依赖并重打

---

## 7. 签名与公证（当前没有）

现状：

- `electron-packager` 不签名
- CI 不解锁钥匙串、不设置 `CSC_LINK`、不 notarize
- 产物没有 dmg
- `spctl --assess` 会拒绝，这是预期行为，不是打包失败

验证：

```bash
codesign -dv --verbose=4 release/DocTree-darwin-arm64/DocTree.app
# 预期类似：code object is not signed at all
spctl -a -vv release/DocTree-darwin-arm64/DocTree.app
# 预期 rejected
```

如果以后要公开分发，需要另开任务：

1. Apple Developer Program 账号
2. `Developer ID Application` 证书
3. hardened runtime + entitlements
4. `codesign --deep --force --options runtime`
5. `xcrun notarytool submit ... --wait`
6. `xcrun stapler staple`
7. CI 里用 secrets 管理证书/密码/Apple ID

**不要在当前流程里假装已经签名或公证。** 现在的 zip 只能作为内测包，附上 `xattr` 说明。

---

## 8. 产物验收清单

在真实 Mac 上，至少逐项过：

- [ ] `uname -m` 与包架构一致；x64 包在 Intel 或 Rosetta 下启动
- [ ] 双击/`open` 能起窗口，无“已损坏”
- [ ] 首次启动日志 `~/文档树/desktop.log` 无 uncaughtException
- [ ] 导入 PDF，能滚动、缩放、选中文字
- [ ] 导入 DOCX / Markdown，能渲染
- [ ] 导入 PPTX：有 LibreOffice/PowerPoint 时能转 PDF；没有时应给出明确错误，不应白屏
- [ ] 选中文字 → 提问 → 回答流式输出
- [ ] 生成追问子节点，树结构正确
- [ ] 粘贴图片 / 图片按钮 / 拖放图片随提问发送
- [ ] 化学 `smiles` / `reaction` 块能渲染；RDKit 不报“SMILES 无法解析”
- [ ] 设置里 API Key / baseURL 保存后可用
- [ ] 外链在系统浏览器打开，不把应用窗口导航走
- [ ] 退出重开，数据目录不丢；端口 43171 正常
- [ ] 如果验证 x64：PDF 渲染和图片/PPT 流程都要单独测，不能只测启动

---

## 9. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `DocTree.app is damaged` | 未签名 + 下载隔离 | `xattr -dr com.apple.quarantine DocTree.app` 或右键打开 |
| `cannot be opened because the developer cannot be verified` | 未签名 | 系统设置 → 隐私与安全性 → 仍要打开 |
| 启动即崩 | 架构不匹配 / 原生模块 | 查 `.node` 的 `file`；换对应架构重装依赖 |
| 窗口空白 / 一直转 | 本地 server 没起来 / 端口问题 | 看 `~/文档树/desktop.log`；确认 43171 空闲 |
| PDF 能开但页面空白 | `@napi-rs/canvas` 架构错误 | 重建对应架构依赖 |
| 化学全部“SMILES 无法解析” | CSP 挡了 RDKit 的 eval，或 vendor 未打进包 | 检查 `public/vendor/rdkit` 和 `desktop/main.cjs` CSP |
| PPT 导入失败 | Mac 没装 LibreOffice / PowerPoint | 安装 LibreOffice，或先导出 PDF |
| UI 测试找不到 Chrome | 脚本默认 Windows 路径 | `CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` |
| `npm ci` 后 electron 下载失败 | 网络/镜像 | 配 `ELECTRON_MIRROR` 或代理，重试 |
| 包体积很大 | `asar=false` + 未裁剪文件 | 检查是否把 `data` / `docs` / 截图打进去；确认 `--prune` |

---

## 10. 给 Agent 的最短路径

如果你只拿到一台 Apple Silicon Mac，目标是先出一个**能启动的内测包**：

```bash
git archive ... # 或从当前源码同步，不要 clone 公开仓库
npm ci
npm run test:api
npx electron-packager . DocTree \
  --platform=darwin --arch=arm64 --out=release --overwrite \
  --asar=false --prune=true \
  --ignore='^/(data|build|release|scripts|docs|snapshots|rollback|mobile|mobile-build|wasm|ppt-lab|\.git|\.npm-cache)' \
  --ignore='\.(png|log|zip|apk)$'
cd release
ditto -c -k --sequesterRsrc --keepParent DocTree-darwin-arm64 DocTree-darwin-arm64.zip
```

然后按第 8 节验收。

要 Intel 包，先在 x64 环境重复 `npm ci`，不要复用 arm64 的 `node_modules`。

---

## 11. 当前已知缺口 / 下一步

1. **未签名、未公证**：公开分发前必须补。
2. **没有 dmg**：当前只有 zip；需要 dmg 时在 macOS 用 `hdiutil` 或改 electron-builder。
3. **没有 macOS 图标**：当前是 Electron 默认图标；需要 `build/icon.icns` + `--icon`。
4. **CI 单 runner 双架构有原生依赖风险**：建议改成 matrix 或两台机器分别构建。
5. **CI 不跑 mac 测试**：至少加 `npm run test:api`；UI 测试需要 Chrome，按 runner 决定。
6. **公开仓库不是当前源码**：发布前先把 1.0.60 推到公开仓库，否则用户 clone 到的是旧版。
7. 本文件基于 workflow/源码审查，**尚未在真实 Mac 上做最终验收**；接手 Agent 必须补一次真机启动和 PDF/PPT/化学回归。
