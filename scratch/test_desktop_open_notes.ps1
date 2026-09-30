$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class DesktopOpener {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

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

    public static void MinimizeOcclusions() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.Contains("Antigravity IDE") || title.Contains("Brave") || title.Contains("MINGW64")) {
                ShowWindow(hWnd, 6); // SW_MINIMIZE
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }

    public static void ClickAndEnter(int x, int y) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        SetCursorPos(x, y);
        Thread.Sleep(100);

        // Click to select
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(250);

        // Press Enter
        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

# Ensure clean slate for Notepad
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Minimizing occlusions..."
[DesktopOpener]::MinimizeOcclusions()
Start-Sleep -Milliseconds 800

Write-Host "Clicking notes.txt at (820, 530) and pressing Enter..."
[DesktopOpener]::ClickAndEnter(820, 530)
Start-Sleep -Seconds 4

# Check running notepad
Get-Process notepad -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle

# Minimize IDE again in case console output un-minimized it
[DesktopOpener]::MinimizeOcclusions()
Start-Sleep -Milliseconds 500

# Capture screenshot
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
