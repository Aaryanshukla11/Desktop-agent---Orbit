Start-Process "explorer.exe" -ArgumentList "shell:AppsFolder\Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"
Start-Sleep -Seconds 3
Get-Process notepad -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_appsfolder.jpg"
