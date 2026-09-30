$code = @'
using System;
using System.Runtime.InteropServices;

public class Foregrounder {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    public static void Foreground(IntPtr hWnd) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) {
            SetThreadDesktop(hDesk);
        }
        ShowWindow(hWnd, 3); // SW_MAXIMIZE
        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);
        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
$p = Get-Process notepad++ -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p) {
    Write-Host "Foregrounding notepad++ HWND: $($p.MainWindowHandle)"
    [Foregrounder]::Foreground($p.MainWindowHandle)
} else {
    Write-Host "notepad++ not found"
}
Start-Sleep -Seconds 1
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_npp_foreground.jpg"
