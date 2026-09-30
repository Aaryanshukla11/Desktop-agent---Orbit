$code = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class DesktopEnterer {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const byte VK_RETURN = 0x0D;
    const uint KEYEVENTF_KEYUP = 0x0002;

    public static void SelectAndEnter(int x, int y) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        SetCursorPos(x, y);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(200);

        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

Write-Host "Clicking notes.txt and pressing Enter..."
[DesktopEnterer]::SelectAndEnter(570, 420)
Start-Sleep -Seconds 3

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
