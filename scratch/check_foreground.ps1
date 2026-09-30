Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class WinUtil {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public static void TestForeground() {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
            Console.WriteLine("Input Desktop Handle: " + hDesk);
            if (hDesk != IntPtr.Zero) {
                bool set = SetThreadDesktop(hDesk);
                Console.WriteLine("SetThreadDesktop: " + set);
            }
            IntPtr fg = GetForegroundWindow();
            Console.WriteLine("Foreground Handle: " + fg);
            uint pid = 0;
            GetWindowThreadProcessId(fg, out pid);
            Console.WriteLine("Foreground PID: " + pid);
            System.Text.StringBuilder sb = new System.Text.StringBuilder(256);
            GetWindowText(fg, sb, 256);
            Console.WriteLine("Foreground Title: " + sb.ToString());
            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
    }
}
"@

[WinUtil]::TestForeground()
