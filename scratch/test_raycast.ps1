$code = @'
using System;
using System.Runtime.InteropServices;

public class RaycastTester {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public static void ShowRaycast(IntPtr hWnd) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        ShowWindow(hWnd, 9); // SW_RESTORE
        SetForegroundWindow(hWnd);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
[RaycastTester]::ShowRaycast([IntPtr]852058)
Start-Sleep -Seconds 1
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_raycast_shown.jpg"
