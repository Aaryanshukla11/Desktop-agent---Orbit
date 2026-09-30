Stop-Process -Name notepad* -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$p = Start-Process "$PSScriptRoot\notepad_classic.exe" -ArgumentList "`"C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt`"" -PassThru
Start-Sleep -Seconds 2
Get-Process -Id $p.Id | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
