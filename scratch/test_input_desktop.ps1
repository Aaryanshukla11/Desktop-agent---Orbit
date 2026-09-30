Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class DesktopInput {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const int KEYEVENTF_KEYUP = 0x0002;
    public const byte VK_LWIN = 0x5B;
    public const byte VK_R = 0x52;

    public static void SendWinR() {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }
            // Press Win+R
            keybd_event(VK_LWIN, 0, 0, UIntPtr.Zero);
            Thread.Sleep(50);
            keybd_event(VK_R, 0, 0, UIntPtr.Zero);
            Thread.Sleep(50);
            keybd_event(VK_R, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(50);
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
    }
}
"@

Write-Output "Sending Win+R..."
[DesktopInput]::SendWinR()
Start-Sleep -Milliseconds 800
Write-Output "Done sending Win+R"
