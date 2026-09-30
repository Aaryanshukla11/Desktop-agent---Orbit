$shell = New-Object -ComObject Shell.Application
$desktop = "C:\Users\Aaryan shukla\OneDrive\Desktop"
$folder = $shell.Namespace($desktop)
$item = $folder.ParseName("test_notepad.txt")
Write-Host "Found item: $($item.Name)"
foreach ($verb in $item.Verbs()) {
    Write-Host "Verb: $($verb.Name)"
}
$item.InvokeVerbEx("open")
Start-Sleep -Seconds 3
Get-Process notepad -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle
