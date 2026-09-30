$p = Start-Process "C:\Windows\WinSxS\amd64_microsoft-windows-notepad_31bf3856ad364e35_10.0.26100.9278_none_0af8678a1ff0a8d5\notepad.exe" -PassThru
Start-Sleep -Seconds 2
Get-Process -Id $p.Id | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_classic_notepad.jpg"
