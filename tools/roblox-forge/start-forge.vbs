Option Explicit

Dim shell, fso, root, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetAbsolutePathName(fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "..\.."))
command = "cmd.exe /c cd /d """ & root & """ && node tools\roblox-forge\forge-server.mjs"

shell.Run command, 0, False
WScript.Sleep 1200
shell.Run "http://127.0.0.1:43117/", 1, False
