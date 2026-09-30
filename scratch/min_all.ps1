$shell = New-Object -ComObject Shell.Application
$shell.MinimizeAll()
Start-Sleep -Milliseconds 1500
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_desktop_clean.jpg"
