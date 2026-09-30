$shell = New-Object -ComObject Shell.Application
$shell.FileRun()
Start-Sleep -Milliseconds 800
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("notepad{ENTER}")
Write-Host "Launched Notepad via FileRun"
