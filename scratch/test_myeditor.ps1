$p = Start-Process "$PSScriptRoot\myeditor.exe" -ArgumentList "`"C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt`"" -PassThru
Start-Sleep -Seconds 2
Get-Process -Id $p.Id | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
