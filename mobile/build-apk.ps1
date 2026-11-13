# Build Android APK without Gradle (stage into ASCII path: aapt2 can't handle CJK paths)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$sdk = 'C:\dt-sdk'
$bt = Join-Path $sdk 'build-tools\35.0.0'
$platform = Join-Path $sdk 'platforms\android-34\android.jar'
$androidDir = Join-Path $here 'android'
$www = Join-Path $here 'www'
$apk = Join-Path $here 'DocTree-android.apk'
$aapt2 = Join-Path $bt 'aapt2.exe'

$stage = 'C:\dt-android-build'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
New-Item -ItemType Directory -Force (Join-Path $stage 'gen') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $stage 'classes') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $stage 'dex') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $stage 'assets') | Out-Null

Write-Host '[0/6] stage sources'
& robocopy (Join-Path $androidDir 'res') (Join-Path $stage 'res') /E /NFL /NDL /NJH /NJS | Out-Null
& robocopy (Join-Path $androidDir 'java') (Join-Path $stage 'java') /E /NFL /NDL /NJH /NJS | Out-Null
& robocopy $www (Join-Path $stage 'assets\www') /E /NFL /NDL /NJH /NJS | Out-Null
Copy-Item (Join-Path $androidDir 'AndroidManifest.xml') (Join-Path $stage 'AndroidManifest.xml') -Force

Write-Host '[1/6] compile resources'
$compiled = Join-Path $stage 'compiled'
New-Item -ItemType Directory -Force $compiled | Out-Null
& $aapt2 compile --dir (Join-Path $stage 'res') -o $compiled
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile failed' }
$flats = @(Get-ChildItem $compiled -Filter '*.flat' | ForEach-Object { $_.FullName })
Write-Host ('  flats: ' + $flats.Count)

Write-Host '[2/6] link apk'
$baseApk = Join-Path $stage 'base.apk'
$linkArgs = @(
  'link',
  '-o', $baseApk,
  '-I', $platform,
  '--manifest', (Join-Path $stage 'AndroidManifest.xml'),
  '--java', (Join-Path $stage 'gen'),
  '--min-sdk-version', '24',
  '--target-sdk-version', '34'
) + $flats
& $aapt2 @linkArgs
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link failed' }

Write-Host '[3/6] compile java'
$sources = @()
$sources += (Get-ChildItem (Join-Path $stage 'gen') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
$sources += (Get-ChildItem (Join-Path $stage 'java') -Recurse -Filter '*.java' | ForEach-Object { $_.FullName })
$jcArgs = @('--release', '8', '-encoding', 'UTF-8', '-classpath', $platform, '-d', (Join-Path $stage 'classes')) + $sources
& javac @jcArgs
if ($LASTEXITCODE -ne 0) { throw 'javac failed' }

Write-Host '[4/6] dex'
$classes = @(Get-ChildItem (Join-Path $stage 'classes') -Recurse -Filter '*.class' | ForEach-Object { $_.FullName })
$d8Args = @('--lib', $platform, '--min-api', '24', '--output', (Join-Path $stage 'dex')) + $classes
& (Join-Path $bt 'd8.bat') @d8Args
if ($LASTEXITCODE -ne 0) { throw 'd8 failed' }

Write-Host '[5/6] package + align'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($baseApk, 'Update')
$old = $zip.GetEntry('classes.dex')
if ($old) { $old.Delete() }
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $stage 'dex\classes.dex'), 'classes.dex') | Out-Null

# 手动写入 assets，保证 zip 条目用正斜杠（aapt2 在 Windows 上会写成反斜杠）
$assetsRoot = Join-Path $stage 'assets'
$prefixLen = $assetsRoot.Length + 1
Get-ChildItem $assetsRoot -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($prefixLen).Replace('\', '/')
  $name = 'assets/' + $rel
  $e = $zip.GetEntry($name)
  if ($e) { $e.Delete() }
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $name) | Out-Null
}
$zip.Dispose()
$aligned = Join-Path $stage 'aligned.apk'
& (Join-Path $bt 'zipalign.exe') -f 4 $baseApk $aligned
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }

Write-Host '[6/6] sign'
$ks = Join-Path $stage 'debug.keystore'
if (-not (Test-Path $ks)) {
  $ktArgs = @('-genkeypair', '-keystore', $ks, '-storepass', 'android', '-keypass', 'android',
    '-alias', 'doctree', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=DocTree,OU=Dev,O=DocTree,L=CN,S=CN,C=CN')
  $keytool = (Get-ChildItem 'C:\Program Files\Java\jdk-*\bin\keytool.exe' -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
  if (-not $keytool) { $keytool = 'keytool' }
  & $keytool @ktArgs | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
}
$signArgs = @('sign', '--ks', $ks, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', $apk, $aligned)
& (Join-Path $bt 'apksigner.bat') @signArgs
if ($LASTEXITCODE -ne 0) { throw 'apksigner failed' }

Write-Host ''
Write-Host ('APK: ' + $apk)
Write-Host ('size: ' + [math]::Round((Get-Item $apk).Length / 1MB, 2) + ' MB')
& $aapt2 dump badging $apk | Select-Object -First 4
