$path = "$env:LOCALAPPDATA\Microsoft\WindowsApps\notepad.exe"
Get-Item $path -ErrorAction SilentlyContinue | Select-Object FullName, Target, LinkType
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\notepad.exe" -ErrorAction SilentlyContinue
