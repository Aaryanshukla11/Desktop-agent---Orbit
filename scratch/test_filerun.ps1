try {
    $shell = New-Object -ComObject Shell.Application
    $shell.FileRun()
    Write-Host "FileRun succeeded"
} catch {
    Write-Host "FileRun failed: $_"
}
