# v163 · 焦点回归：拖选文字后打字，字全丢

> 版本：**UI v163 / APP 1.0.53**
> 现象：用户报「怎么又丢焦点了」

## 一、复现（真实安装版 + CDP，非猜测）

`
在 PDF 里拖选一段文字（松手）
  → document.activeElement = BODY        ← 焦点掉了
  → 紧接着打字
  → #q.value 仍然是空                     ← 字全丢了
`

## 二、根因

public/modules/focus.js 的 click 处理里有一条规则：

`js
if (!explicit) {
  const sel = window.getSelection()
  if (sel && !sel.isCollapsed && String(sel).trim()) return   // “用户正在选字，别抢焦点”
}
`

这条规则的本意是**拖选过程中**不要打断选区，但它挂在 click 上 —— click 是**松手之后**才触发的，
此时选区已经是“选完了”的状态，结果焦点被留在 BODY，输入框再也拿不回来。

## 三、修法（两个坑一起补）

1. **保留选区**：松手后仍然不抢焦点（把焦点抢回 textarea 会让 Chrome 把选区移进输入框、高亮消失）。
   实测：抢焦点后 window.getSelection() 立刻变空 —— 用户会觉得“我选的文字怎么没了”。
2. **第一个按键一定落进输入框**：keydown 兜底原来用 document.execCommand('insertText')，
   焦点刚切换时可能失败，导致**开头几个字符丢失**（实测丢了 3 个）。
   改成 q.setRangeText(key, start, end, 'end') + 手动派发 input 事件，一个不丢。

另外补了两处原生对话框后的回焦：
- 删除节点的 confirm() 关闭后 → 回焦输入框
- 导入文件（文件选择框）完成后 → 回焦输入框

## 四、验证

| 场景 | 结果 |
|---|---|
| 拖选 PDF 文字 → 选区保留 + chip 出现 | ✅ |
| 拖选后直接敲英文 | 焦点回到 #q，value = "abc"，**首字符不丢** ✅ |
| 拖选后敲中文（输入法首键 229） | 先回焦，后续拼音正常上屏 ✅ |
| 点 PDF 空白 / 工具栏 / 树空白 | 回焦 ✅ |
| 删除节点（原生 confirm） | 回焦 ✅ |
| 点化学卡片的「复制 SMILES」 | 回焦 ✅ |

	est-ui 新增 4 条（总计 **79** 项）：拖选后选区保留、chip 出现、打字回焦、首字符不丢。

pm test → API 84/84、UI 79/79；安装版 Electron 15/15。
