$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class WindowManager {
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
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public const int SW_HIDE = 0;
    public const int SW_SHOWNORMAL = 1;
    public const int SW_SHOWMINIMIZED = 2;
    public const int SW_SHOWMAXIMIZED = 3;
    public const int SW_MINIMIZE = 6;
    public const int SW_RESTORE = 9;

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

    public static void ForegroundNotepad() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        if (SetThreadDesktop(hDesk)) {
            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.Contains("Notepad") || title.Contains("test_notepad") || title.Contains("notes")) {
                    ShowWindow(hWnd, SW_RESTORE);
                    SetForegroundWindow(hWnd);
                }
                return true;
            }, IntPtr.Zero);
        }
        CloseDesktop(hDesk);
    }
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
        Thread.Sleep(100);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(80);
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

# 1. Minimize occlusions
[WindowManager]::MinimizeOcclusions()
Start-Sleep -Milliseconds 800

# 2. Double-click test_notepad.txt at (675, 520) and send Enter
Write-Host "Clicking test_notepad.txt at (675, 520)..."
[WindowManager]::SelectAndEnter(675, 520)
Start-Sleep -Seconds 3

# 3. Bring Notepad to foreground if needed
[WindowManager]::ForegroundNotepad()
Start-Sleep -Milliseconds 800

# 4. Capture physical desktop screenshot
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
