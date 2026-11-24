import fs from 'node:fs'
let h = fs.readFileSync('public/index.html', 'utf8')
h = h.replace(
  '<button id="btn-stop" class="stop-btn" hidden title="停止生成">■</button>',
  '<button id="btn-stop" class="stop-btn" hidden title="停止生成"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" rx="1.8" fill="currentColor"/></svg></button>'
)
fs.writeFileSync('public/index.html', h)

let css = fs.readFileSync('public/style.css', 'utf8')
css = css.replace(
  `  display: grid; place-items: center; font-size: 9px; line-height: 1;
  flex: 0 0 auto;
}`,
  `  display: grid; place-items: center; line-height: 0;
  flex: 0 0 auto;
}
.stop-btn svg { display: block; width: 10px; height: 10px; }`
)
fs.writeFileSync('public/style.css', css)
console.log('stop icon svg ok')
