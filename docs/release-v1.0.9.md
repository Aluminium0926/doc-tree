# DocTree v1.0.9

## 修复

- DeepSeek 等模型把工具调用写成 `<|DSML|invoke ...>` 文本时，原样显示在回答里的问题
- 现在会解析 DSML 里的 invoke/parameter，转成工具调用执行，并在流式输出中过滤标记
- 工具仍会正常读取页面，回答不再包含原始标记

## 下载

- Windows：`DocTree-1.0.9-win32-x64.zip`
- Android：`android-v1.0.8`
- 网页：https://aluminium0926.github.io/doc-tree/
- macOS：`mac-arm64-v1.0.6` / `mac-x64-v1.0.6`
