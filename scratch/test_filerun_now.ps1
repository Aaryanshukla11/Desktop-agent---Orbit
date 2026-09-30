$sh = New-Object -ComObject 'Shell.Application'
$sh.FileRun()
Write-Host "FileRun executed"
Start-Sleep -Seconds 1
$runWnd = Get-Process | Where-Object { $_.MainWindowTitle -match "Run" }
Write-Host "Run window process: $($runWnd.ProcessName)"
