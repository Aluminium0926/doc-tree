import fs from 'node:fs'
import { pdf } from 'pdf-to-img'

for (const [f, o] of [
  ['scripts/lab-batch/A-0.pdf', 'scripts/cmp-A0p1.png'],
  ['scripts/lab-batch/B-0.pdf', 'scripts/cmp-B0p1.png']
]) {
  const d = await pdf(f, { scale: 1.2 })
  const png = await d.getPage(1)
  fs.writeFileSync(o, png)
  console.log(o, png.length)
  await d.destroy()
}
