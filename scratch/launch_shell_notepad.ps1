$sh = New-Object -ComObject Shell.Application
$sh.ShellExecute("notepad.exe", "", "", "open", 1)
Start-Sleep -Seconds 2
Get-Process notepad -ErrorAction SilentlyContinue | Select-Object Id, MainWindowTitle, MainWindowHandle
