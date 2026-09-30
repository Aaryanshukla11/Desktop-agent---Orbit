using System;
using System.Runtime.InteropServices;
using System.Threading;

public class TestKeys {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    const int KEYEVENTF_EXTENDEDKEY = 0x0001;
    const int KEYEVENTF_KEYUP = 0x0002;

    public static void Main(string[] args) {
        string mode = args.Length > 0 ? args[0] : "win";
        if (mode == "win") {
            Console.WriteLine("Pressing Win key...");
            keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            Thread.Sleep(50);
            keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
            Console.WriteLine("Win key pressed");
        } else if (mode == "winr") {
            Console.WriteLine("Pressing Win+R...");
            keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            Thread.Sleep(60);
            keybd_event(0x52, 0x13, 0, UIntPtr.Zero);
            Thread.Sleep(60);
            keybd_event(0x52, 0x13, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(60);
            keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
            Console.WriteLine("Win+R pressed");
        } else if (mode == "wind") {
            Console.WriteLine("Pressing Win+D...");
            keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
            Thread.Sleep(60);
            keybd_event(0x44, 0x20, 0, UIntPtr.Zero);
            Thread.Sleep(60);
            keybd_event(0x44, 0x20, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(60);
            keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
            Console.WriteLine("Win+D pressed");
        }
    }
}
