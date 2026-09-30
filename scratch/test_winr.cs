using System;
using System.Text;
using System.Runtime.InteropServices;

public class TestWinR {
    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);

    public static void Main() {
        EnumWindows((h, l) => {
            if (IsWindowVisible(h)) {
                StringBuilder title = new StringBuilder(256);
                GetWindowText(h, title, 256);
                StringBuilder cls = new StringBuilder(256);
                GetClassName(h, cls, 256);
                if (title.Length > 0) {
                    Console.WriteLine(string.Format("Class: '{0}' | Title: '{1}'", cls, title));
                }
            }
            return true;
        }, IntPtr.Zero);
    }
}
