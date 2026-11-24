import fs from 'node:fs'
const F = 'scripts/page-menu-test.mjs'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  "  const box = await page.evaluate(() => {\n    const el = document.querySelector('.page[data-page=\"2\"]') || document.querySelectorAll('.page')[1]\n    const r = el.getBoundingClientRect()\n    return { x: r.x + r.width / 2, y: r.y + 120, p: el.dataset.page }\n  })",
  "  await page.evaluate(() => {\n    const el = document.querySelector('.page[data-page=\"2\"]') || document.querySelectorAll('.page')[1]\n    el.scrollIntoView({ block: 'center' })\n  })\n  await new Promise((r) => setTimeout(r, 600))\n  const box = await page.evaluate(() => {\n    const el = document.querySelector('.page[data-page=\"2\"]') || document.querySelectorAll('.page')[1]\n    const r = el.getBoundingClientRect()\n    return { x: r.x + r.width / 2, y: r.y + 120, p: el.dataset.page }\n  })"
)
fs.writeFileSync(F, t)
console.log('ok')
