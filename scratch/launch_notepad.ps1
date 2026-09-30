$ws = New-Object -ComObject WScript.Shell
$ws.Run('notepad.exe', 1, $false)
Start-Sleep -Milliseconds 1500
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_notepad_ws.jpg"
