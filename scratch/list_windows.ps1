Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class WinEnumerator {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public static void ListVisibleWindows() {
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder title = new StringBuilder(256);
                GetWindowText(hWnd, title, 256);
                StringBuilder cls = new StringBuilder(256);
                GetClassName(hWnd, cls, 256);
                if (title.Length > 0) {
                    Console.WriteLine(string.Format("[0x{0:X}] Class: '{1}' | Title: '{2}'", hWnd.ToInt64(), cls, title));
                }
            }
            return true;
        }, IntPtr.Zero);
    }
}
"@

[WinEnumerator]::ListVisibleWindows()
