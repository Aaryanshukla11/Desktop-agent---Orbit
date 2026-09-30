$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinInfoCheck {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    public static void CheckAndShow(int pid) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        var proc = System.Diagnostics.Process.GetProcessById(pid);
        IntPtr h = proc.MainWindowHandle;
        Console.WriteLine("HWND: " + h);

        StringBuilder sb = new StringBuilder(256);
        GetWindowText(h, sb, 256);
        Console.WriteLine("Title: " + sb.ToString());
        Console.WriteLine("Visible: " + IsWindowVisible(h));

        RECT r;
        GetWindowRect(h, out r);
        Console.WriteLine("Rect: " + r.Left + "," + r.Top + " - " + r.Right + "," + r.Bottom);

        ShowWindow(h, 9); // SW_RESTORE
        SetForegroundWindow(h);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

$p = Get-Process notepad -ErrorAction SilentlyContinue | Select-Object -First 1
if ($p) {
    [WinInfoCheck]::CheckAndShow($p.Id)
    Start-Sleep -Seconds 1
    & "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
} else {
    Write-Host "No notepad process found."
}
