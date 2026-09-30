Add-Type -AssemblyName System.Windows.Forms
$s = [System.Windows.Forms.Screen]::PrimaryScreen
Write-Output "Bounds: $($s.Bounds.Width) x $($s.Bounds.Height)"
Write-Output "WorkingArea: $($s.WorkingArea.Width) x $($s.WorkingArea.Height)"

$code = @'
using System;
using System.Runtime.InteropServices;
public class DpiChecker {
    [DllImport("user32.dll")]
    public static extern int GetDpiForSystem();
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$dpi = [DpiChecker]::GetDpiForSystem()
$cx = [DpiChecker]::GetSystemMetrics(0) # SM_CXSCREEN
$cy = [DpiChecker]::GetSystemMetrics(1) # SM_CYSCREEN
Write-Output "System DPI: $dpi (Scale = $($dpi / 96.0))"
Write-Output "SystemMetrics SM_CXSCREEN: $cx x $cy"
