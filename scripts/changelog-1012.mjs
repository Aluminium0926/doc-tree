import fs from 'node:fs'
let r=fs.readFileSync('README.md','utf8')
const block=`- **v1.0.12**
  - PPT/PPTX 用本机 PowerPoint 转 PDF，保留版式和图片；PPTX 文字兜底
  - 化学式 \\ce{} 渲染（mhchem），裸写法自动补公式
  - 窄窗口侧栏可收起、工具栏按文档区换行、输入框不再挤压
  - 搜索一页内全部命中高亮
  - 数据加载失败自动重试，不再显示成空库
  - 非法格式与超大文件拦截，PPT 导入不再卡死
  - 缩放查看恢复完整像素比，缩小不再发虚
`
r=r.replace('## 最近更新\n\n','## 最近更新\n\n'+block)
fs.writeFileSync('README.md',r)
console.log('changelog ok')
