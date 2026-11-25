# v157 · 系统提示词明确化学块协议

> 版本：**UI v157 / APP 1.0.47**，改动只有 lib/context.mjs 的系统提示词（桌面 + 移动端共用）

v156 修的是前端对「模型把分子式写成 reaction」的兜底。这次从源头降低误写的概率：

- 单个结构（分子式 / 结构式 / 互变异构 / 共振式 / 同一物质的不同写法）→ 用 `smiles` 块；
  **明确禁止写成 A>>A 这种左右一样的 reaction**。
- 只有「反应物变成产物」才用 `reaction`，且左右两边的结构必须不同。
- `conditions:` 只写温度/pH/溶剂/催化剂，≤30 字；**没有条件就整行省略，不要写 -、无、N/A 占位**（v156 前端已能过滤，这里是源头约束）。
- 其余沿用原有约束（不拆 reactants:/products:、不写 ortho/para/meta、副产物写进产物、不带旁观离子、RDKit 必须能解析、不画 ASCII 结构）。

## 验证

- `test-api` 新增 3 条「提示词契约」用例：假模型现在会记录收到的请求，断言 system 消息里包含
  `单个结构` / `A>>A` / `没有条件就整行省略` / `reactants:/products:`。
- `npm test` → API **84/84**、UI **58/58**；安装版 Electron **15/15**。
- `mobile/build.mjs` 会把新的 `lib/context.mjs` 一并拷进移动端。
