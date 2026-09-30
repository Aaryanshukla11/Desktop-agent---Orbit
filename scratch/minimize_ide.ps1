Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinUtil {
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@

Get-Process | Where-Object { $_.MainWindowTitle -match 'Antigravity' } | ForEach-Object {
    Write-Host "Minimizing window: " $_.MainWindowTitle
    [WinUtil]::ShowWindowAsync($_.MainWindowHandle, 2)
}
