$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class RunClicker {
    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);

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
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    const uint WM_SETTEXT = 0x000C;
    const uint WM_COMMAND = 0x0111;
    const uint BM_CLICK = 0x00F5;

    public static void Execute(IntPtr hwndRun) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        IntPtr hwndEdit = IntPtr.Zero;
        IntPtr hwndOk = IntPtr.Zero;

        EnumChildWindows(hwndRun, (hWnd, lParam) => {
            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            StringBuilder sbText = new StringBuilder(256);
            GetWindowText(hWnd, sbText, 256);
            string cls = sbClass.ToString();
            string txt = sbText.ToString();
            Console.WriteLine("Child HWND: " + hWnd + " Class: " + cls + " Text: " + txt);
            if (cls == "Edit") {
                hwndEdit = hWnd;
            }
            if (cls == "Button" && (txt == "OK" || txt == "&OK")) {
                hwndOk = hWnd;
            }
            return true;
        }, IntPtr.Zero);

        if (hwndEdit != IntPtr.Zero) {
            Console.WriteLine("Setting text of Edit HWND " + hwndEdit + " to 'notepad'");
            SendMessage(hwndEdit, WM_SETTEXT, IntPtr.Zero, "notepad");
        }

        if (hwndOk != IntPtr.Zero) {
            Console.WriteLine("Clicking OK Button HWND " + hwndOk);
            SendMessage(hwndOk, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
        } else {
            Console.WriteLine("Sending WM_COMMAND 1 to Run dialog");
            SendMessage(hwndRun, WM_COMMAND, (IntPtr)1, IntPtr.Zero);
        }

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
[RunClicker]::Execute([IntPtr]338948)
Start-Sleep -Seconds 3
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_run_notepad_clicked.jpg"
