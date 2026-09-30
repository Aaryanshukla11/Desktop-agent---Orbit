$key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3"
$val = (Get-ItemProperty $key).Settings
$val[8] = 2 # 2 = auto-hide disabled (permanently visible)
Set-ItemProperty -Path $key -Name Settings -Value $val
Stop-Process -Name explorer -Force
Start-Sleep -Seconds 3
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_taskbar_permanent.jpg"
