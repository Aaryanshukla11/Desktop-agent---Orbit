Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinKeyTest {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public const int KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const int KEYEVENTF_KEYUP = 0x0002;
    public const byte VK_LWIN = 0x5B;
    public const byte VK_R = 0x52;

    public static void PressWinR() {
        keybd_event(VK_LWIN, 0x5B, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_R, 0x13, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_R, 0x13, KEYEVENTF_KEYUP, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        keybd_event(VK_LWIN, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@
Write-Output "Pressing Win+R with EXTENDEDKEY..."
[WinKeyTest]::PressWinR()
Start-Sleep -Milliseconds 1500
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_extended_winr.jpg"
