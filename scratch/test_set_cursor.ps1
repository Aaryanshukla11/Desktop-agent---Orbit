$code = @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct POINT {
    public int X;
    public int Y;
}

public class CursorTester {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;

    public static void Test() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        POINT p;
        GetCursorPos(out p);
        Console.WriteLine("Initial Cursor: " + p.X + ", " + p.Y);

        SetCursorPos(500, 500);

        GetCursorPos(out p);
        Console.WriteLine("After SetCursorPos(500, 500): " + p.X + ", " + p.Y);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
[CursorTester]::Test()
