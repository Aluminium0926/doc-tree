import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("const UI_VERSION = 'v121'","const UI_VERSION = 'v122'").replace("const APP_VERSION = '1.0.15'","const APP_VERSION = '1.0.16'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.16';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
let m=fs.readFileSync('mobile/android/AndroidManifest.xml','utf8')
m=m.replace('android:versionCode="13"','android:versionCode="14"').replace('android:versionName="1.0.13"','android:versionName="1.0.14"')
fs.writeFileSync('mobile/android/AndroidManifest.xml',m)
console.log('bump 1.0.16 / apk 1.0.14')
