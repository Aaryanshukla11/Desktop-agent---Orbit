Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" | Select-Object ProcessId, CommandLine | Format-List
