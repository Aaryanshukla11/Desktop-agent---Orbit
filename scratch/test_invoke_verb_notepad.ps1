$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class ShellMinimizer {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public static void MinimizeOcclusions() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.Contains("Antigravity IDE") || title.Contains("Brave") || title.Contains("MINGW64")) {
                ShowWindow(hWnd, 6); // SW_MINIMIZE
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

# Ensure clean slate for Notepad
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Minimizing occlusions..."
[ShellMinimizer]::MinimizeOcclusions()
Start-Sleep -Milliseconds 500

Write-Host "Invoking Notepad.lnk via Shell.Application..."
$shell = New-Object -ComObject Shell.Application
$desktop = $shell.Namespace("C:\Users\Aaryan shukla\OneDrive\Desktop")
$item = $desktop.ParseName("Notepad.lnk")
if ($item) {
    Write-Host "Found item: $($item.Name)"
    $item.InvokeVerb("open")
    Write-Host "InvokeVerb('open') called."
} else {
    Write-Host "Notepad.lnk not found in desktop namespace!"
}

Start-Sleep -Seconds 4

Get-Process notepad -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle

[ShellMinimizer]::MinimizeOcclusions()
Start-Sleep -Milliseconds 500

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
