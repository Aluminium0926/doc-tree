import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("from './chem.js'", "from './chem.js?v=1.0.31'")
a=a.replace("const UI_VERSION = 'v136'","const UI_VERSION = 'v137'").replace("const APP_VERSION = '1.0.30'","const APP_VERSION = '1.0.31'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.31';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
let m=fs.readFileSync('mobile/android/AndroidManifest.xml','utf8');m=m.replace('android:versionCode="28"','android:versionCode="29"').replace('android:versionName="1.0.28"','android:versionName="1.0.29"');fs.writeFileSync('mobile/android/AndroidManifest.xml',m)
console.log('bump chem2 1.0.31 / apk 1.0.29', a.includes('chem.js?v='))
