using System;
using System.Runtime.InteropServices;
using System.Threading;

class Program {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }

    static void Main() {
        SetProcessDPIAware();
        
        SetCursorPos(100, 100);
        Thread.Sleep(50);
        POINT p1;
        GetCursorPos(out p1);
        Console.WriteLine("Set (100, 100) -> Got (" + p1.X + ", " + p1.Y + ")");

        SetCursorPos(2000, 1000);
        Thread.Sleep(50);
        POINT p2;
        GetCursorPos(out p2);
        Console.WriteLine("Set (2000, 1000) -> Got (" + p2.X + ", " + p2.Y + ")");
    }
}
