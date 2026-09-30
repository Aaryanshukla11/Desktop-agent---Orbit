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
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

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
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

# Ensure clean slate
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Verify file content
$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
"ORBIT_T0_SUCCESS_123" | Set-Content -Path $file -Encoding utf8
Write-Host "File content: $(Get-Content $file)"

# Minimize occlusions
[WindowManager]::MinimizeOcclusions()
Start-Sleep -Milliseconds 500

# Open test_notepad.txt using Invoke-Item
Invoke-Item $file
Start-Sleep -Seconds 4

# Minimize occlusions again in case IDE popped up
[WindowManager]::MinimizeOcclusions()
Start-Sleep -Milliseconds 500

# Capture physical desktop screenshot
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
