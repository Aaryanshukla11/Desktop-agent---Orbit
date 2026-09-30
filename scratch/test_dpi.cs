using System;
using System.Runtime.InteropServices;

class Program {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }

    static void Main() {
        Console.WriteLine("Without DPIAware: " + GetSystemMetrics(0) + "x" + GetSystemMetrics(1));
        SetProcessDPIAware();
        Console.WriteLine("With DPIAware: " + GetSystemMetrics(0) + "x" + GetSystemMetrics(1));
        SetCursorPos(1440, 900);
        POINT p;
        GetCursorPos(out p);
        Console.WriteLine("Set to (1440, 900) -> actual position: " + p.X + "x" + p.Y);
    }
}
