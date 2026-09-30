$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class MinttyInspector {
    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public static void Inspect(IntPtr hWnd) {
        Console.WriteLine("Parent: " + hWnd);
        EnumChildWindows(hWnd, (hChild, lParam) => {
            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hChild, sbClass, 256);
            StringBuilder sbText = new StringBuilder(256);
            GetWindowText(hChild, sbText, 256);
            Console.WriteLine("Child HWND: " + hChild + " Class: " + sbClass + " Text: " + sbText);
            return true;
        }, IntPtr.Zero);
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[MinttyInspector]::Inspect([IntPtr]67712)
