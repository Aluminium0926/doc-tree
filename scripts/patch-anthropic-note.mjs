import fs from 'node:fs'
const F = 'public/app.js'
let t = fs.readFileSync(F, 'utf8')
const fn = `
function syncAnthropicNote() {
  const note = $('#anthropic-note')
  if (!note) return
  const fmt = $('#cfg-format')?.value
  const vfmt = $('#cfg-vision-format')?.value
  const base = ($('#cfg-base')?.value || '').toLowerCase()
  const vbase = ($('#cfg-vision-base')?.value || '').toLowerCase()
  const isAnthropic = fmt === 'anthropic' || vfmt === 'anthropic' || /anthropic\\.com/.test(base) || /anthropic\\.com/.test(vbase)
  note.hidden = !isAnthropic
}

`
if (!t.includes('function syncAnthropicNote')) t = t.replace('function openSettings() {', fn + 'function openSettings() {')
t = t.replace("  const noAsk = $('#cfg-ask-remove')", "  syncAnthropicNote()\n  $('#cfg-format')?.addEventListener('change', syncAnthropicNote)\n  $('#cfg-vision-format')?.addEventListener('change', syncAnthropicNote)\n  $('#cfg-base')?.addEventListener('input', syncAnthropicNote)\n  const noAsk = $('#cfg-ask-remove')")
fs.writeFileSync(F, t)
console.log('note wired')
