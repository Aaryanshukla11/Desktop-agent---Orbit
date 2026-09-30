$code = @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

public class RunRectFinder {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    public static void Check(IntPtr hWnd) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        RECT r;
        GetWindowRect(hWnd, out r);
        bool vis = IsWindowVisible(hWnd);
        Console.WriteLine("Run Window " + hWnd + " Rect: " + r.Left + "," + r.Top + " to " + r.Right + "," + r.Bottom + " (Vis: " + vis + ")");

        // Move it to center of screen (e.g., 200, 200) and bring to top!
        ShowWindow(hWnd, 9); // SW_RESTORE
        SetWindowPos(hWnd, new IntPtr(-1), 200, 200, 420, 220, 0x0040); // HWND_TOPMOST, SWP_SHOWWINDOW
        SetForegroundWindow(hWnd);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
[RunRectFinder]::Check([IntPtr]338948)
Start-Sleep -Seconds 1
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_run_dialog_moved.jpg"
