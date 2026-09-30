$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public class WinListerAll {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static void ListAll() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;

        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            string procName = "";
            try {
                procName = Process.GetProcessById((int)pid).ProcessName;
            } catch {}

            StringBuilder sbTitle = new StringBuilder(256);
            GetWindowText(hWnd, sbTitle, 256);
            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            bool vis = IsWindowVisible(hWnd);

            if (procName.ToLower().Contains("notepad") || sbTitle.ToString().Length > 0) {
                Console.WriteLine("HWND: " + hWnd + " [PID " + pid + " / " + procName + "] Vis: " + vis + " Class: " + sbClass + " Title: " + sbTitle);
            }
            return true;
        }, IntPtr.Zero);

        CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[WinListerAll]::ListAll()
