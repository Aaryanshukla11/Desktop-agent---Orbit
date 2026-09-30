
Get-Process | Where-Object { $_.ProcessName -match "notepad|calc|electron|orbit|ui-tars" } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | Format-Table -AutoSize
