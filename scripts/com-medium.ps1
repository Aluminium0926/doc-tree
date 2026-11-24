$log = 'C:\Users\wangk\Desktop\大肥鱼的家\doc-tree\scripts\com-medium.log'
try {
  $app = [Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
  $count = $app.Presentations.Count
  "OK active count=$count" | Set-Content $log -Encoding UTF8
} catch {
  try {
    $app = New-Object -ComObject PowerPoint.Application
    $count = $app.Presentations.Count
    "OK new count=$count" | Set-Content $log -Encoding UTF8
  } catch {
    ('ERR ' + $_.Exception.Message) | Set-Content $log -Encoding UTF8
  }
}
