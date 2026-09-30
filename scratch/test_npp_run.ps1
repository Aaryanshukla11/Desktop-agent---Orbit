# Kill existing notepad++
Stop-Process -Name notepad++ -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Launch Notepad++ with test_notepad.txt
$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
$p = Start-Process "C:\Program Files\Notepad++\notepad++.exe" -ArgumentList "`"$file`"" -PassThru
Start-Sleep -Seconds 3

Get-Process -Id $p.Id | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle

# Capture screen
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\test_npp_window.jpg"
