import fs from 'node:fs'
let o=fs.readFileSync('lib/office.mjs','utf8')
o=o.replace(
  "  } finally {\n    await fs.rm(input, { force: true }).catch(() => {})",
  `  } catch (e) {
    try {
      await fs.writeFile(path.join(os.tmpdir(), 'doctree-ppt-error.txt'), String(e.stack || e))
    } catch {}
    throw e
  } finally {
    await fs.rm(input, { force: true }).catch(() => {})`
)
fs.writeFileSync('lib/office.mjs',o)
console.log('error log added')
