$code = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class WinKeyTest {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    public const byte VK_LWIN = 0x5B;
    public const byte VK_R = 0x52;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static void PressWin() {
        keybd_event(VK_LWIN, 0, 0, 0);
        Thread.Sleep(50);
        keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
        Console.WriteLine("Sent VK_LWIN");
    }

    public static void PressWinR() {
        keybd_event(VK_LWIN, 0, 0, 0);
        Thread.Sleep(50);
        keybd_event(VK_R, 0, 0, 0);
        Thread.Sleep(50);
        keybd_event(VK_R, 0, KEYEVENTF_KEYUP, 0);
        Thread.Sleep(50);
        keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
        Console.WriteLine("Sent VK_LWIN + R");
    }
}
'@

Add-Type -TypeDefinition $code
[WinKeyTest]::PressWin()
Start-Sleep -Seconds 1
