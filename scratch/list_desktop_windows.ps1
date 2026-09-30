$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class WinEnumDesktop {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static void List() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        Console.WriteLine("Input Desktop: " + hDesk);
        if (hDesk == IntPtr.Zero) return;

        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, sb.Capacity);
                string title = sb.ToString();
                if (!string.IsNullOrWhiteSpace(title)) {
                    uint pid = 0;
                    GetWindowThreadProcessId(hWnd, out pid);
                    Console.WriteLine("HWND: " + hWnd + " [PID " + pid + "] \"" + title + "\"");
                }
            }
            return true;
        }, IntPtr.Zero);

        CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $code
[WinEnumDesktop]::List()
