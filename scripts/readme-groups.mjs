import fs from 'node:fs'
let r = fs.readFileSync('README.md', 'utf8')
if (!r.includes('文档组')) {
  r = r.replace('- **划词提问**', '- **文档组**：选中多份文档建组，组内共享一棵提问树和上下文，可跨文档提问\n- **划词提问**')
  fs.writeFileSync('README.md', r)
}
console.log('readme ok')
