# 打 Windows 便携版：stage 应用文件 → 只装生产依赖 → electron-packager
# 用法：powershell -ExecutionPolicy Bypass -File scripts/dist.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
Set-Location $root

$stage = Join-Path $root 'build\stage'
Write-Host '[1/3] 准备 stage'
if (Test-Path (Join-Path $root 'build')) { Remove-Item (Join-Path $root 'build') -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($p in @('server.mjs', 'lib', 'public', 'desktop', 'package.json', 'package-lock.json')) {
  Copy-Item (Join-Path $root $p) (Join-Path $stage $p) -Recurse -Force
}

Write-Host '[2/3] 安装生产依赖'
Push-Location $stage
try {
  npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund --loglevel=error
  if ($LASTEXITCODE -ne 0) { throw 'npm ci 失败' }
} finally {
  Pop-Location
}

Write-Host '[3/3] Electron 打包'
& node (Join-Path $here 'pack-dist.mjs')
if ($LASTEXITCODE -ne 0) { throw 'electron-packager 失败' }

$exe = Join-Path $root 'release\DocTree-win32-x64\DocTree.exe'
if (-not (Test-Path $exe)) { throw "没有产物：$exe" }
$size = [math]::Round(((Get-ChildItem (Join-Path $root 'release\DocTree-win32-x64') -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "[done] $exe  ($size MB)"
