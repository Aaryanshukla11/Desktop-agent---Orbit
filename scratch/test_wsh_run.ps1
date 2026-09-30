$wsh = New-Object -ComObject WScript.Shell
$wsh.Run("notepad.exe")
Start-Sleep -Seconds 3
Get-Process notepad -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_wsh_run.jpg"
