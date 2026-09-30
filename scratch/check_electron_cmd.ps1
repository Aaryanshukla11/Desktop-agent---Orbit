Get-CimInstance Win32_Process -Filter "Name like '%node%'" | Select-Object ProcessId, CommandLine | Format-List
