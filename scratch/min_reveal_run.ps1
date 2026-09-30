$codeFind = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Minimizer {
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
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public static void MinimizeWindows() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.Contains("Antigravity IDE") || title.Contains("Brave") || title.Contains("Word")) {
                Console.WriteLine("Minimizing: " + hWnd + " (" + title + ")");
                ShowWindow(hWnd, 6); // SW_MINIMIZE
            }
            if (title == "Run") {
                Console.WriteLine("Restoring & Foregrounding Run: " + hWnd);
                ShowWindow(hWnd, 9); // SW_RESTORE
                SetForegroundWindow(hWnd);
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $codeFind
[Minimizer]::MinimizeWindows()
Start-Sleep -Seconds 1
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_reveal_run.jpg"
