$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\notes.txt"
$p = Start-Process "C:\Program Files\Notepad++\notepad++.exe" -ArgumentList "`"$file`"" -PassThru
Start-Sleep -Seconds 3
Get-Process -Id $p.Id | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_npp_opened.jpg"
