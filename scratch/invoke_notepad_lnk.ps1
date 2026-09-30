$shell = New-Object -ComObject Shell.Application
$desktop = "C:\Users\Aaryan shukla\OneDrive\Desktop"
$folder = $shell.Namespace($desktop)
$item = $folder.ParseName("Notepad.lnk")
Write-Host "Found item: $($item.Name)"
$item.InvokeVerb("open")
Start-Sleep -Seconds 3

# Also minimize IDE if it popped up
$codeFind = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FindIde {
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

    public static void Minimize() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, 256);
            string title = sb.ToString();
            if (title.Contains("Antigravity IDE")) {
                ShowWindow(hWnd, 6);
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $codeFind -ErrorAction SilentlyContinue
[FindIde]::Minimize()
Start-Sleep -Seconds 1

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
