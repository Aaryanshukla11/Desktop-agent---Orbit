$pkg = Get-AppxPackage *Microsoft.WindowsNotepad*
$manifest = [xml](Get-AppxPackageManifest $pkg)
$manifest.Package.Applications.Application.Extensions.Extension | ForEach-Object {
    Write-Output "Category: $($_.Category)"
    if ($_.Protocol) {
        Write-Output "Protocol Name: $($_.Protocol.Name)"
    }
}
