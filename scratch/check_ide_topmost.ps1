Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinStyle {
    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TOPMOST = 0x00000008;
    public static bool IsTopMost(IntPtr hWnd) {
        int ex = GetWindowLong(hWnd, GWL_EXSTYLE);
        return (ex & WS_EX_TOPMOST) != 0;
    }
}
"@
# IDE HWND: 272866
Write-Output "Is TopMost: $([WinStyle]::IsTopMost([IntPtr]272866))"
