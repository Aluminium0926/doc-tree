import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')

// 组行：双击组名重命名
t = t.replace(
  `    row.querySelector('.g-add').addEventListener('click', (e) => {`,
  `    row.querySelector('.g-name').addEventListener('dblclick', (e) => {
      e.stopPropagation()
      const input = document.createElement('input')
      input.className = 'g-rename'
      input.value = g.name
      input.maxLength = 24
      const nameEl = row.querySelector('.g-name')
      nameEl.replaceWith(input)
      input.focus()
      input.select()
      let done = false
      const finish = async (save) => {
        if (done) return
        done = true
        const val = input.value.trim()
        if (save && val && val !== g.name) {
          await fetch('/api/group/update', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: g.id, name: val })
          })
          await loadState()
        }
        renderLibrary()
      }
      input.addEventListener('keydown', (ev) => {
        ev.stopPropagation()
        if (ev.key === 'Enter') finish(true)
        else if (ev.key === 'Escape') finish(false)
      })
      input.addEventListener('blur', () => finish(true))
      input.addEventListener('click', (ev) => ev.stopPropagation())
    })
    row.querySelector('.g-add').addEventListener('click', (e) => {`
)
fs.writeFileSync(F, t)
console.log('rename wired')
