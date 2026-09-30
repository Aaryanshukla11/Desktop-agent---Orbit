$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
"ORBIT_T0_SUCCESS_123" | Set-Content -Path $file -Encoding utf8

$p = Start-Process "C:\Program Files\Notepad++\notepad++.exe" -ArgumentList "`"$file`"" -PassThru
Start-Sleep -Seconds 2

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinHelper {
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
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public static void ShowAndClean() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.Contains("Antigravity") || title.Contains("Brave") || title.Contains("MINGW64")) {
                    ShowWindow(hWnd, 6); // Minimize
                }
                if (title.Contains("Notepad") || title.Contains("test_notepad")) {
                    ShowWindow(hWnd, 9); // Restore
                    SetForegroundWindow(hWnd);
                }
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

[WinHelper]::ShowAndClean()
Start-Sleep -Seconds 1

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
