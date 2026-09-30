$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut("C:\Users\Aaryan shukla\OneDrive\Desktop\Notepad.lnk")
$sc.TargetPath = "notepad.exe"
$sc.Arguments = "`"C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt`""
$sc.Save()
Write-Host "Updated Notepad.lnk with Arguments successfully."
