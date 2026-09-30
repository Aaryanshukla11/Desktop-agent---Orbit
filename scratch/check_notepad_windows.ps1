Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinProc {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public static void FindWindowsForPid(uint targetPid) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid == targetPid) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                Console.WriteLine("HWND " + hWnd + " Vis: " + IsWindowVisible(hWnd) + " Title: '" + sb.ToString() + "'");
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
"@

$procs = Get-Process notepad -ErrorAction SilentlyContinue
foreach ($p in $procs) {
    Write-Output "PID: $($p.Id)"
    [WinProc]::FindWindowsForPid([uint32]$p.Id)
}
