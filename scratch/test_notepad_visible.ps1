$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
"ORBIT_T0_SUCCESS_123" | Set-Content -Path $file -Encoding utf8

Write-Host "Killing any running notepad instances..."
Stop-Process -Name notepad* -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Attempt 1: cmd /c start notepad.exe `"$file`""
cmd.exe /c start "" notepad.exe "$file"
Start-Sleep -Seconds 3

$p = Get-Process notepad -ErrorAction SilentlyContinue
Write-Host "Notepad processes:"
$p | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | Format-Table

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\test_notepad_visible.jpg"
