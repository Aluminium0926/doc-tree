# 抓“控制台窗口闪现”：记录 15 分钟内新出现的控制台类进程
# 用法：右键 → 使用 PowerShell 运行（建议“以管理员身份运行”，否则读不到别人的命令行）
$ErrorActionPreference = 'SilentlyContinue'
$log = Join-Path $PSScriptRoot 'console-watch.log'
$end = (Get-Date).AddMinutes(15)
$seen = @{}
Get-CimInstance Win32_Process | ForEach-Object { $seen[$_.ProcessId] = $true }
"[$(Get-Date -Format 'HH:mm:ss')] 开始监控，日志：$log" | Tee-Object -FilePath $log -Append
$watch = 'cmd|conhost|powershell|pwsh|node|wscript|cscript|mshta|python'
while ((Get-Date) -lt $end) {
  Get-CimInstance Win32_Process | Where-Object { -not $seen.ContainsKey($_.ProcessId) -and $_.Name -match $watch } | ForEach-Object {
    $pp = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.ParentProcessId)"
    $line = "[{0}] NEW {1} (pid {2})  parent={3}({4})\n    cmd: {5}" -f (Get-Date -Format 'HH:mm:ss'), $_.Name, $_.ProcessId, $pp.Name, $_.ParentProcessId, $_.CommandLine
    $line | Tee-Object -FilePath $log -Append
    $seen[$_.ProcessId] = $true
  }
  Start-Sleep -Milliseconds 400
}
"[$(Get-Date -Format 'HH:mm:ss')] 监控结束" | Tee-Object -FilePath $log -Append
