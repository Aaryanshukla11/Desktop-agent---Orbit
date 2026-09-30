$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinEnumNotepadDesktop {
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

    public static void FindNotepadWindows() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            StringBuilder sbTitle = new StringBuilder(256);
            GetWindowText(hWnd, sbTitle, 256);
            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            string title = sbTitle.ToString();
            string cls = sbClass.ToString();
            bool visible = IsWindowVisible(hWnd);
            if (title.ToLower().Contains("notepad") || cls.ToLower().Contains("notepad") || cls == "Notepad") {
                Console.WriteLine("HWND: " + hWnd + " [PID " + pid + "] Vis: " + visible + " Class: " + cls + " Title: " + title);
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
[WinEnumNotepadDesktop]::FindNotepadWindows()
