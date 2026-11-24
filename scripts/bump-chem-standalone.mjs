import fs from 'node:fs'
let j=fs.readFileSync('public/chem.js','utf8')
j=j.replace(
"async function moleculeSvg(source) {\n  if (molCache.has(source)) return molCache.get(source)",
"async function moleculeSvg(source, bond = 22) {\n  const key = bond + ':' + source\n  if (molCache.has(key)) return molCache.get(key)"
)
j=j.replace("JSON.stringify({ width: 800, height: 600, fixedBondLength: 22 })", "JSON.stringify({ width: 900, height: 700, fixedBondLength: bond })")
j=j.replace("  molCache.set(source, cropped)", "  molCache.set(key, cropped)")
j=j.replace("    const item = await moleculeSvg(info.source)", "    const item = await moleculeSvg(info.source, 42)")
fs.writeFileSync('public/chem.js',j)
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("chem.js?v=1.0.33", "chem.js?v=1.0.34").replace("const UI_VERSION = 'v139'","const UI_VERSION = 'v140'").replace("const APP_VERSION = '1.0.33'","const APP_VERSION = '1.0.34'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.34';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
let m=fs.readFileSync('mobile/android/AndroidManifest.xml','utf8');m=m.replace('android:versionCode="31"','android:versionCode="32"').replace('android:versionName="1.0.31"','android:versionName="1.0.32"');fs.writeFileSync('mobile/android/AndroidManifest.xml',m)
console.log('standalone 42/reaction 22', j.includes('moleculeSvg(source, bond = 22)'), j.includes('moleculeSvg(info.source, 42)'))
