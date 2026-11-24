import fs from 'node:fs'
let a=fs.readFileSync('public/app.js','utf8')
a=a.replace("chem.js?v=1.0.35", "chem.js?v=1.0.36").replace("const UI_VERSION = 'v141'","const UI_VERSION = 'v142'").replace("const APP_VERSION = '1.0.35'","const APP_VERSION = '1.0.36'")
fs.writeFileSync('public/app.js',a)
let p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.36';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')
let m=fs.readFileSync('mobile/android/AndroidManifest.xml','utf8');m=m.replace('android:versionCode="33"','android:versionCode="34"').replace('android:versionName="1.0.33"','android:versionName="1.0.34"');fs.writeFileSync('mobile/android/AndroidManifest.xml',m)
console.log('bump textbook 1.0.36 / apk 1.0.34')
