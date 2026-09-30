taskkill /f /im notepad.exe
Start-Sleep -Seconds 1

$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
Start-Process "C:\Program Files\Notepad++\notepad++.exe" -ArgumentList "`"$file`""
Start-Sleep -Seconds 3

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
