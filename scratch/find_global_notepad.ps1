$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public class GlobalWinFinder {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public static void FindAll() {
        EnumWindows((hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            string name = "";
            try { name = Process.GetProcessById((int)pid).ProcessName; } catch {}
            StringBuilder sbTitle = new StringBuilder(256);
            GetWindowText(hWnd, sbTitle, 256);
            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);

            string title = sbTitle.ToString();
            string cls = sbClass.ToString();

            if (name.ToLower().Contains("notepad") || title.ToLower().Contains("notepad") || title.ToLower().Contains("test_notepad")) {
                Console.WriteLine("FOUND: HWND=" + hWnd + " PID=" + pid + " (" + name + ") Vis=" + IsWindowVisible(hWnd) + " Class=" + cls + " Title='" + title + "'");
                ShowWindow(hWnd, 9); // SW_RESTORE
                ShowWindow(hWnd, 1); // SW_SHOWNORMAL
                SetForegroundWindow(hWnd);
            }
            return true;
        }, IntPtr.Zero);
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[GlobalWinFinder]::FindAll()
Start-Sleep -Seconds 1
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
