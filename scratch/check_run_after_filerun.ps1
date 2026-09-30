$shell = New-Object -ComObject Shell.Application
$shell.FileRun()
Start-Sleep -Milliseconds 1500

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinChecker {
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
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public static void Check() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sbTitle = new StringBuilder(256);
            GetWindowText(hWnd, sbTitle, 256);
            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            string title = sbTitle.ToString();
            string cls = sbClass.ToString();
            if (title.Length > 0 || cls.Contains("32770")) {
                Console.WriteLine("HWND: " + hWnd + " Vis: " + IsWindowVisible(hWnd) + " Class: " + cls + " Title: " + title);
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[WinChecker]::Check()
