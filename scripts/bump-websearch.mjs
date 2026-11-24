import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("const UI_VERSION = 'v120'","const UI_VERSION = 'v121'").replace("const APP_VERSION = '1.0.14'","const APP_VERSION = '1.0.15'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.15';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
let m=fs.readFileSync('mobile/android/AndroidManifest.xml','utf8')
m=m.replace('android:versionCode="12"','android:versionCode="13"').replace('android:versionName="1.0.12"','android:versionName="1.0.13"')
fs.writeFileSync('mobile/android/AndroidManifest.xml',m)
console.log('versions -> 1.0.15 / apk 1.0.13')
