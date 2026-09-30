$code = @'
using System;
using System.Runtime.InteropServices;

public class WinStationTest {
    [DllImport("user32.dll")]
    public static extern IntPtr GetProcessWindowStation();

    [DllImport("user32.dll")]
    public static extern IntPtr GetThreadDesktop(int dwThreadId);

    [DllImport("kernel32.dll")]
    public static extern int GetCurrentThreadId();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr CreateDCA(string lpszDriver, string lpszDevice, string lpszOutput, IntPtr lpInitData);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    public static void Run() {
        int tid = GetCurrentThreadId();
        IntPtr hwinsta = GetProcessWindowStation();
        IntPtr hdesk = GetThreadDesktop(tid);
        Console.WriteLine("Process WinStation: " + hwinsta);
        Console.WriteLine("Thread Desktop: " + hdesk);

        IntPtr hInputDesk = OpenInputDesktop(0, false, 0x01FF);
        int errInput = Marshal.GetLastWin32Error();
        Console.WriteLine("OpenInputDesktop: " + hInputDesk + " (LastError: " + errInput + ")");

        IntPtr hdc = GetDC(IntPtr.Zero);
        int errDc = Marshal.GetLastWin32Error();
        Console.WriteLine("GetDC(NULL): " + hdc + " (LastError: " + errDc + ")");
        if (hdc != IntPtr.Zero) ReleaseDC(IntPtr.Zero, hdc);

        IntPtr hdcDisplay = CreateDCA("DISPLAY", null, null, IntPtr.Zero);
        int errDisp = Marshal.GetLastWin32Error();
        Console.WriteLine("CreateDCA('DISPLAY'): " + hdcDisplay + " (LastError: " + errDisp + ")");
        if (hdcDisplay != IntPtr.Zero) DeleteDC(hdcDisplay);
    }
}
'@

Add-Type -TypeDefinition $code
[WinStationTest]::Run()
