$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class RunLauncher {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam);
    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    const uint WM_SETTEXT = 0x000C;
    const uint WM_COMMAND = 0x0111;
    const uint BM_CLICK = 0x00F5;

    public static void MinimizeOcclusions() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (title.Contains("Antigravity") || title.Contains("Brave") || title.Contains("MINGW64")) {
                    ShowWindow(hWnd, 6);
                }
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }

    public static bool SubmitRun(string commandText) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        IntPtr hwndRun = IntPtr.Zero;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            StringBuilder sbTitle = new StringBuilder(256);
            GetWindowText(hWnd, sbTitle, 256);
            if (sbClass.ToString() == "#32770" && sbTitle.ToString() == "Run") {
                hwndRun = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);

        if (hwndRun == IntPtr.Zero) {
            Console.WriteLine("Run dialog not found!");
            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
            return false;
        }

        Console.WriteLine("Found Run dialog HWND: " + hwndRun);
        SetForegroundWindow(hwndRun);

        IntPtr hwndEdit = IntPtr.Zero;
        IntPtr hwndOk = IntPtr.Zero;

        EnumChildWindows(hwndRun, (hWnd, lParam) => {
            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            StringBuilder sbText = new StringBuilder(256);
            GetWindowText(hWnd, sbText, 256);
            string cls = sbClass.ToString();
            string txt = sbText.ToString();
            if (cls == "Edit") {
                hwndEdit = hWnd;
            }
            if (cls == "Button" && (txt == "OK" || txt == "&OK")) {
                hwndOk = hWnd;
            }
            return true;
        }, IntPtr.Zero);

        if (hwndEdit != IntPtr.Zero) {
            Console.WriteLine("Setting Edit text to: " + commandText);
            SendMessage(hwndEdit, WM_SETTEXT, IntPtr.Zero, commandText);
            Thread.Sleep(100);
        }

        if (hwndOk != IntPtr.Zero) {
            Console.WriteLine("Clicking OK button HWND: " + hwndOk);
            SendMessage(hwndOk, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
            PostMessage(hwndRun, WM_COMMAND, (IntPtr)1, hwndOk);
        } else {
            PostMessage(hwndRun, WM_COMMAND, (IntPtr)1, IntPtr.Zero);
        }

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        return true;
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

# Ensure clean slate for Notepad
Stop-Process -Name notepad* -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Ensure content in test_notepad.txt
$file = "C:\Users\Aaryan shukla\OneDrive\Desktop\test_notepad.txt"
"ORBIT_T0_SUCCESS_123" | Set-Content -Path $file -Encoding utf8

# Minimize occlusions
[RunLauncher]::MinimizeOcclusions()
Start-Sleep -Milliseconds 500

# Open Run dialog via Shell
Write-Host "Opening Run dialog..."
$shell = New-Object -ComObject Shell.Application
$shell.FileRun()
Start-Sleep -Milliseconds 1200

# Submit command in Run dialog
Write-Host "Submitting command to Run dialog..."
$cmd = "`"$file`""
$submitted = [RunLauncher]::SubmitRun($cmd)
Write-Host "Submitted: $submitted"

Start-Sleep -Seconds 4

# Check notepad process
Get-Process notepad* -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | Format-Table

# Minimize occlusions again
[RunLauncher]::MinimizeOcclusions()
Start-Sleep -Milliseconds 500

# Capture desktop
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
