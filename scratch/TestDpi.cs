
using System;
using System.Runtime.InteropServices;

public class TestDpi {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }

    public static void Main() {
        Console.WriteLine("Before DPI aware: " + GetSystemMetrics(0) + "x" + GetSystemMetrics(1));
        SetProcessDPIAware();
        Console.WriteLine("After DPI aware: " + GetSystemMetrics(0) + "x" + GetSystemMetrics(1));
        POINT pt;
        GetCursorPos(out pt);
        Console.WriteLine("Current Cursor Pos: " + pt.X + ", " + pt.Y);
    }
}
