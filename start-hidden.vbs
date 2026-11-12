' 文档树：静默启动本地服务（不弹控制台窗口）
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c node server.mjs >> server.log 2>&1", 0, False
