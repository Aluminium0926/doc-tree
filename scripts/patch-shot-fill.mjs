import fs from 'node:fs'
const F = 'public/style.css'
let t = fs.readFileSync(F, 'utf8')
t = t.replace(
  `.shot-thumb {
  display: block; flex: 1 1 auto;
  min-width: 0; max-width: none;
  height: 64px; max-height: 64px;
  overflow: hidden;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--panel-3);
  line-height: 0;
}`,
  `.shot-thumb {
  display: block; flex: 1 1 auto;
  min-width: 0; max-width: none;
  height: auto; max-height: 120px;
  overflow: hidden;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--panel-3);
  line-height: 0;
}`
)
t = t.replace(
  `.shot-thumb img {
  display: block;
  height: 64px;
  width: auto;
  max-width: none;
  max-height: none;
}`,
  `.shot-thumb img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 120px;
  object-fit: cover;
  object-position: left top;
}`
)
fs.writeFileSync(F, t)
console.log('shot fills width')
