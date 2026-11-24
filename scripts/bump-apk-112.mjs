import fs from 'node:fs'
let m=fs.readFileSync('mobile/android/AndroidManifest.xml','utf8')
m=m.replace('android:versionCode="11"','android:versionCode="12"').replace('android:versionName="1.0.11"','android:versionName="1.0.12"')
fs.writeFileSync('mobile/android/AndroidManifest.xml',m)
console.log('android version 12 / 1.0.12')
