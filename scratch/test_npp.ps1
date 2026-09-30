$p = Start-Process "C:\Program Files\Notepad++\notepad++.exe" -PassThru
Start-Sleep -Seconds 2
Get-Process -Id $p.Id | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_npp.jpg"
