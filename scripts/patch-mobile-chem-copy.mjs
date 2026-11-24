import fs from 'node:fs'
let b=fs.readFileSync('mobile/build.mjs','utf8')
if(!b.includes("'chem.js'")){
  b=b.replace("copy(path.join(root, 'public', 'app.js'), path.join(out, 'app.js'))", "copy(path.join(root, 'public', 'app.js'), path.join(out, 'app.js'))\ncopy(path.join(root, 'public', 'chem.js'), path.join(out, 'chem.js'))")
  fs.writeFileSync('mobile/build.mjs',b)
}
console.log('build chem.js copy', b.includes("'chem.js'"))
