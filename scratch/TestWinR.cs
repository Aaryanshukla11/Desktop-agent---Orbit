using System;
using System.Runtime.InteropServices;
using System.Threading;

public class TestWinR {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    const int KEYEVENTF_EXTENDEDKEY = 0x0001;
    const int KEYEVENTF_KEYUP = 0x0002;

    public static void Main() {
        Console.WriteLine("Sending Win+R via keybd_event...");
        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
        Thread.Sleep(60);
        keybd_event(0x52, 0x13, 0, UIntPtr.Zero);
        Thread.Sleep(60);
        keybd_event(0x52, 0x13, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(60);
        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
        Console.WriteLine("Done");
    }
}
