Option Explicit
Dim shell, root, cmd
Set shell = CreateObject("WScript.Shell")
root = shell.CurrentDirectory
cmd = "node """ & root & "\tools\roblox-forge\online-mode.mjs"""
shell.Run cmd, 0, False
Set shell = Nothing
