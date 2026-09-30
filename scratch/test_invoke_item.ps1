Invoke-Item "C:\Users\Aaryan shukla\OneDrive\Desktop\notes.txt"
Start-Sleep -Seconds 3
Get-Process notepad -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_invoke_item.jpg"
