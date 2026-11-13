#!/usr/bin/env bash
# 在 macOS 上构建 .app（必须在这台 Mac 上执行：Electron 的框架符号链接与签名只能在 macOS 完成）
set -euo pipefail

cd "$(dirname "$0")/.."

ARCH="${1:-arm64}"   # arm64 = Apple Silicon，x64 = Intel
echo "==> 构建架构: $ARCH"

npm install --no-audit --no-fund

npx --yes @electron/packager@18 . DocTree \
  --platform=darwin \
  --arch="$ARCH" \
  --out=release-mac \
  --overwrite \
  --asar=false \
  --prune=true \
  --ignore='^/release' \
  --ignore='^/mobile' \
  --ignore='^/mobile-build' \
  --ignore='^/docs' \
  --ignore='^/data'

APP="release-mac/DocTree-darwin-$ARCH/DocTree.app"
if [ ! -d "$APP" ]; then
  echo "构建失败：找不到 $APP"
  exit 1
fi

# 本地临时签名：不经 Apple 公证，单机可用
codesign --force --deep --sign - "$APP"

ZIP="release-mac/DocTree-mac-$ARCH.zip"
ditto -c -k --keepParent "release-mac/DocTree-darwin-$ARCH/DocTree.app" "$ZIP"

echo
echo "完成：$ZIP"
echo "双击前如果被 Gatekeeper 拦住，执行："
echo "  xattr -dr com.apple.quarantine \"$PWD/release-mac/DocTree-darwin-$ARCH/DocTree.app\""
echo "数据目录：~/Library/Application Support/文档树"
