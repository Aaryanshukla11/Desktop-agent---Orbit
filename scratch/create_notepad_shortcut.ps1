$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
Write-Host "Desktop folder: $desktop"

$shortcutPath = Join-Path $desktop "Notepad.lnk"
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "notepad.exe"
$shortcut.Description = "Notepad"
$shortcut.Save()

# Also create in OneDrive Desktop if different
$oneDriveDesktop = "C:\Users\Aaryan shukla\OneDrive\Desktop"
if (Test-Path $oneDriveDesktop) {
    $sc2 = $wsh.CreateShortcut((Join-Path $oneDriveDesktop "Notepad.lnk"))
    $sc2.TargetPath = "notepad.exe"
    $sc2.Description = "Notepad"
    $sc2.Save()
}

Write-Host "Created Notepad.lnk successfully."
