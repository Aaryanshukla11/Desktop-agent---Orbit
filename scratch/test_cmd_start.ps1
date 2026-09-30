cmd.exe /c start "" "C:\Users\Aaryan shukla\OneDrive\Desktop\notes.txt"
Start-Sleep -Seconds 3
Get-Process notepad -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
