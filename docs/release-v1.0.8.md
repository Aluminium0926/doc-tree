# DocTree v1.0.8

## 首次启动引导

- 欢迎页只在第一次启动出现
- 两个入口：
  - **我是新手**：DeepSeek 注册 → 创建 API Key → 充值 → 回填，5 步带链接
  - **我有 API Key**：直接打开设置并聚焦 Key 输入框
- 免责声明保留在首次引导底部

## 修复

- 桌面端每次启动换随机端口导致 localStorage 重置（欢迎页、缩放、跳过的版本等反复失效）；改为固定端口 43171
- 欢迎页状态同时写入服务端 `data/flags.json`，换浏览器/清缓存也不会重复弹
- 新手引导按钮换行布局

## 下载

- Windows：`DocTree-1.0.8-win32-x64.zip`
- Android：`android-v1.0.7`
- 网页：https://aluminium0926.github.io/doc-tree/
- macOS：`mac-arm64-v1.0.5` / `mac-x64-v1.0.5`
