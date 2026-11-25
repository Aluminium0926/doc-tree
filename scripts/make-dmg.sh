#!/usr/bin/env bash
# 用法：bash scripts/make-dmg.sh <DocTree.app> <out.dmg> [卷名]
# 必须在 macOS 上运行；只做“可挂载的 DMG”，不负责签名/公证。
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "make-dmg.sh: 必须在 macOS 上运行（需要 hdiutil）" >&2
  exit 1
fi

APP="${1:-}"
OUT="${2:-}"
VOL="${3:-DocTree}"

if [[ -z "$APP" || -z "$OUT" ]]; then
  echo "用法: $0 <DocTree.app> <out.dmg> [卷名]" >&2
  exit 1
fi
if [[ ! -d "$APP" || "$APP" != *.app ]]; then
  echo "不是 .app bundle: $APP" >&2
  exit 1
fi

APP="$(cd "$(dirname "$APP")" && pwd)/$(basename "$APP")"
OUT_DIR="$(dirname "$OUT")"
mkdir -p "$OUT_DIR"
OUT="$(cd "$OUT_DIR" && pwd)/$(basename "$OUT")"

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/doctree-dmg.XXXXXX")"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

# 拖拽安装的标准布局：左侧 app，右侧 Applications 快捷方式
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

echo "[dmg] 创建 $OUT"
hdiutil create \
  -volname "$VOL" \
  -srcfolder "$STAGE" \
  -ov \
  -format UDZO \
  "$OUT" >/dev/null

hdiutil verify "$OUT"
echo "[dmg] 完成: $OUT ($(du -h "$OUT" | awk '{print $1}'))"
