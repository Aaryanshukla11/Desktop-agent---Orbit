$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class MingwSender {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    const uint WM_CHAR = 0x0102;
    const uint WM_KEYDOWN = 0x0100;
    const uint WM_KEYUP = 0x0101;
    const uint VK_RETURN = 0x0D;

    public static void Send(IntPtr hWnd, string cmd) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        ShowWindow(hWnd, 9); // SW_RESTORE
        SetForegroundWindow(hWnd);
        Thread.Sleep(500);

        foreach (char c in cmd) {
            PostMessage(hWnd, WM_CHAR, (IntPtr)c, IntPtr.Zero);
            Thread.Sleep(20);
        }
        PostMessage(hWnd, WM_KEYDOWN, (IntPtr)VK_RETURN, IntPtr.Zero);
        PostMessage(hWnd, WM_KEYUP, (IntPtr)VK_RETURN, IntPtr.Zero);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[MingwSender]::Send([IntPtr]67712, "notepad C:/Users/'Aaryan shukla'/OneDrive/Desktop/notes.txt")
Start-Sleep -Seconds 3

# Minimize IDE and Mingw so Notepad is visible
$codeMin = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WindowMinimizer {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public static void MinimizeIdeAndMingw() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.Contains("Antigravity IDE") || title.Contains("MINGW64")) {
                ShowWindow(hWnd, 6); // SW_MINIMIZE
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $codeMin -ErrorAction SilentlyContinue
[WindowMinimizer]::MinimizeIdeAndMingw()
Start-Sleep -Seconds 1

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
