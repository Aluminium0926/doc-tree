# v165 · 粘贴图片：从“导入成文档”改成“跟着这次提问一起发送”

> 版本：**UI v165 / APP 1.0.55**

## 一、原来的行为

输入框里粘贴一张剪贴板图片，会走导入流程：

```js
document.addEventListener('paste', (e) => {
  const files = items.map(...)          // 剪贴板里的图片
  importFiles(files)                     // → 变成一份新文档，出现在左侧列表
})
```

用户要的是：**跟随本次输入，一起发送**（像聊天软件里贴图提问）。

## 二、顺带发现的真问题

前端发请求时一直带 `image` 字段（框选截图、讲解本页都用它）：

```js
body: JSON.stringify({ docId, parentId, anchor, question, image, web })
```

但服务端 `runAsk` **从来没读过 `body.image`**，只把服务端渲染的页图（`pageImage`）传给模型。
也就是说：**框选截图/讲解本页带的图，其实一直被丢掉**。这次一起修掉。

## 三、改动

### 前端

- 粘贴图片 → `readImageForAsk()`：长边 ≤1280、JPEG 0.85（通常 150~400KB，远低于 2MB 上限），
  PNG 透明底垫白，写进 `S.pendingShot`，输入框上方出现缩略图 chip：
  **「图片 · 随本次提问发送」**，`×` 可取消。
- 只贴图不打字 → 自动用「请解释这张图里的内容」作为问题。
- 导入文档仍然走「导入」按钮或把文件拖进列表（两条路分开，互不干扰）。
- 粘贴后焦点保持在输入框。

### 服务端

- `lib/services/ask.mjs` 新增 `sanitizeImage()`：只接受 `data:image/(png|jpeg|webp|gif);base64,`，
  长度 ≤1.8MB，其它一律忽略。
- 前端附的图优先于页图；带图时用 `visionModel`；节点上记 `hadImage`，
  续写时不再重复附页图。
- 非法/超长图片被忽略但仍能正常提问（不会 500）。

## 四、验证

**安装版实测**（真实数据，13 份文档）：

```
粘贴一张 80×40 的 PNG
  → 文档数 13 → 13（没有导入）
  → #shot-chip 出现，src = data:image/jpeg;base64,...
  → chip 文案「图片 · 随本次提问发送」
  → activeElement = #q
```

**自动化**：

- `test-ui` +7（共 **90** 项）：粘贴不导入、图片挂到输入框、chip 文案、焦点保持、
  带图发送、发完清空、模型请求里确实有 `image_url`。
- `test-api` +7（共 **91** 项）：带图提问 → 模型消息含 `image_url`；非法 dataURL 被忽略；
  超长图片被忽略；节点标记 `hadImage`。
- 安装版 Electron 15/15。

## 五、已知边界

- 一次只带一张图（多张时取第一张并 toast 提示）。
- 图片不上传、不进 data 目录，只随这一次请求发出去；回答里不会回显原图。
- 续写（继续生成）不重发图片，只发文字 + 已有回答。
