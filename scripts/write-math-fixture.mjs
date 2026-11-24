import fs from 'node:fs'
const content = '# 公式测试\n\n行内 $x^2 + y^2 = z^2$。\n\n独立公式：\n\n$$\\frac{a}{b} = c$$\n\n```python\nprint(1)\n```\n'
fs.writeFileSync('mobile/fixtures/math.md', content, 'utf8')
console.log(fs.readFileSync('mobile/fixtures/math.md','utf8').slice(0,60))
