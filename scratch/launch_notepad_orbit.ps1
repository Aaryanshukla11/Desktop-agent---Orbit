# Kill existing notepad
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
Start-Process "notepad.exe" -ArgumentList "`"$file`""
Start-Sleep -Seconds 3

# Independently capture physical Windows screenshot
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
