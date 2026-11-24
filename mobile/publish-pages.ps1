# 把 mobile/www 发布到 GitHub Pages（gh-pages 分支）
# 用法：powershell -ExecutionPolicy Bypass -File mobile/publish-pages.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here

Write-Host '[1/4] build www'
& node (Join-Path $here 'build.mjs') | Out-Null

$tmp = Join-Path $env:TEMP 'dt-pages-repo'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force $tmp | Out-Null

Write-Host '[2/4] copy files'
& robocopy (Join-Path $here 'www') $tmp /E /NFL /NDL /NJH /NJS | Out-Null

Write-Host '[3/4] commit'
Push-Location $tmp
try {
  git init -b gh-pages | Out-Null
  git remote add origin https://github.com/Aluminium0926/doc-tree.git
  git -c user.name='Aluminium0926' -c user.email='Aluminium0926@users.noreply.github.com' add -A
  git -c user.name='Aluminium0926' -c user.email='Aluminium0926@users.noreply.github.com' commit -m 'deploy: DocTree web build' | Out-Null
  Write-Host '[4/4] push gh-pages'
  git push -f origin gh-pages
} finally {
  Pop-Location
}
Write-Host 'done -> https://aluminium0926.github.io/doc-tree/'
