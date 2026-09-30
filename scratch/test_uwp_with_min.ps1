Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public enum ActivateOptions {
    None = 0x00000000,
    DesignMode = 0x00000001,
    NoErrorUI = 0x00000002,
    NoSplashScreen = 0x00000004
}

[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
public interface IApplicationActivationManager {
    IntPtr ActivateApplication([In] String appUserModelId, [In] String arguments, [In] ActivateOptions options, [Out] out UInt32 processId);
    IntPtr ActivateForFile([In] String appUserModelId, [In] IntPtr itemArray, [In] String verb, [Out] out UInt32 processId);
    IntPtr ActivateForProtocol([In] String appUserModelId, [In] IntPtr itemArray, [Out] out UInt32 processId);
}

[ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
public class ApplicationActivationManager3 {}

public class UwpLauncher3 {
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

    public static void MinimizeIde() {
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

    public static uint Launch(string aumid, string args) {
        var mgr = (IApplicationActivationManager) new ApplicationActivationManager3();
        uint pid = 0;
        mgr.ActivateApplication(aumid, args, ActivateOptions.None, out pid);
        return pid;
    }
}
"@

# Kill existing notepad
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

[UwpLauncher3]::MinimizeIde()
Start-Sleep -Milliseconds 500

$aumid = "Microsoft.WindowsNotepad_8wekyb3d8bbwe!App"
Write-Output "Activating $aumid..."
$pidVal = [UwpLauncher3]::Launch($aumid, "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt")
Write-Output "Activated PID: $pidVal"

Start-Sleep -Seconds 3
Get-Process -Id $pidVal -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle

[UwpLauncher3]::MinimizeIde()
Start-Sleep -Milliseconds 500

& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_uwp_real.jpg"
