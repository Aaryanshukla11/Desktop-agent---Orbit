# Kill existing notepad
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Minimize IDE
$codeMin = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class MinUtil {
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
    public static void MinimizeIde() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.Contains("Antigravity IDE")) {
                ShowWindow(hWnd, 6);
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $codeMin -ErrorAction SilentlyContinue
[MinUtil]::MinimizeIde()
Start-Sleep -Milliseconds 500

# Launch AppX Notepad
Start-Process "explorer.exe" "shell:AppsFolder\Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"
Start-Sleep -Seconds 3

Get-Process Notepad -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle

[MinUtil]::MinimizeIde()
Start-Sleep -Milliseconds 500

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_appx_test.jpg"
