# DocTree v1.0.1

## 新增

- **中文路径兼容**：新增 `start-doctree.vbs` 启动器。路径含非 ASCII 字符时，先把程序复制到 `%LOCALAPPDATA%\Programs\DocTree` 再从那里启动，绕过 Electron 在部分中文路径下启动即崩的问题；同时自动创建桌面快捷方式。

## 修复

- **思考强度滑块误触分栏**：滑块热区从 4px 加大到 22px，轨道加粗、滑块加大；右侧分栏边界在底部让开输入区，抓滑块时不会再改变左右宽度。
- `start.bat` 改为静默启动服务，不再闪控制台窗口。

## 下载

- **Windows 便携版**：`DocTree-1.0.1-win32-x64.zip`
  - 解压后双击 **`start-doctree.vbs`**（不是 `DocTree.exe`）
  - 解压位置随意，中文路径也可以

## 说明

- 仍然需要自己的 OpenAI 兼容 API Key
- 首次启动会自动复制包内 `data/` 到 `%APPDATA%\文档树`
