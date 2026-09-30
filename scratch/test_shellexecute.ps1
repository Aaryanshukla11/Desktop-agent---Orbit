Stop-Process -Name notepad* -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$shell = New-Object -ComObject Shell.Application
$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
$shell.ShellExecute("notepad.exe", "`"$file`"", "", "open", 1)
Start-Sleep -Seconds 3
Get-Process notepad* -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
