import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("const UI_VERSION = 'v124'","const UI_VERSION = 'v125'").replace("const APP_VERSION = '1.0.18'","const APP_VERSION = '1.0.19'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.19';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
let m=fs.readFileSync('mobile/android/AndroidManifest.xml','utf8');m=m.replace('android:versionCode="16"','android:versionCode="17"').replace('android:versionName="1.0.16"','android:versionName="1.0.17"');fs.writeFileSync('mobile/android/AndroidManifest.xml',m)
console.log('bump 1.0.19 / apk 1.0.17')
