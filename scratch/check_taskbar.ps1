Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class Taskbar {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static void Check() {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);
            IntPtr tb = FindWindow("Shell_TrayWnd", null);
            bool vis = IsWindowVisible(tb);
            RECT r = new RECT();
            GetWindowRect(tb, out r);
            Console.WriteLine("Taskbar HWND: " + tb + ", Vis: " + vis + ", Rect: " + r.Left + ", " + r.Top + ", " + r.Right + ", " + r.Bottom);
            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
    }
}
"@
[Taskbar]::Check()
