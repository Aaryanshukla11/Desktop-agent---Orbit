$wsh = New-Object -ComObject WScript.Shell
$ret = $wsh.AppActivate("MINGW64")
Write-Host "AppActivate returned: $ret"
Start-Sleep -Milliseconds 500
$wsh.SendKeys("notepad notes.txt{ENTER}")
Start-Sleep -Seconds 3
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
