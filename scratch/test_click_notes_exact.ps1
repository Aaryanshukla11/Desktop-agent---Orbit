$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class DesktopTester {
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
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public const int SW_MINIMIZE = 6;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const byte VK_RETURN = 0x0D;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public static void MinimizeOcclusions() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;

        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (!string.IsNullOrWhiteSpace(title)) {
                    if (title.Contains("Antigravity") || title.Contains("Brave") || title.Contains("MINGW64") || title.Contains("Raycast")) {
                        ShowWindow(hWnd, SW_MINIMIZE);
                    }
                }
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
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(200);

        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        Thread.Sleep(50);
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }

    public static void DoubleClick(int x, int y) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        SetCursorPos(x, y);
        Thread.Sleep(100);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(80);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

# Ensure clean slate
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Ensure content in test_notepad.txt
$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
"ORBIT_T0_SUCCESS_123" | Set-Content -Path $file -Encoding utf8

# Minimize occlusions
[DesktopTester]::MinimizeOcclusions()
Start-Sleep -Milliseconds 600

# Select and Enter on test_notepad.txt at (675, 550)
Write-Host "Triggering ClickAndEnter at (675, 550)..."
[DesktopTester]::ClickAndEnter(675, 550)
Start-Sleep -Seconds 3

# Also double click just in case
[DesktopTester]::DoubleClick(675, 550)
Start-Sleep -Seconds 3

# Minimize occlusions again in case IDE popped back up
[DesktopTester]::MinimizeOcclusions()
Start-Sleep -Milliseconds 500

# Capture physical desktop screenshot
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
