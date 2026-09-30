$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
Invoke-Item $file
Start-Sleep -Seconds 3
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
