$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class RunDialogHelper {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);
    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam);
    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    const uint WM_SETTEXT = 0x000C;
    const uint WM_COMMAND = 0x0111;
    const uint BM_CLICK = 0x00F5;

    public static void Submit(string command) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) {
            SetThreadDesktop(hDesk);
        }

        IntPtr hwndRun = FindWindow("#32770", "Run");
        if (hwndRun == IntPtr.Zero) {
            Console.WriteLine("Run window not found by class #32770, searching by title...");
            hwndRun = FindWindow(null, "Run");
        }

        if (hwndRun == IntPtr.Zero) {
            Console.WriteLine("Run dialog NOT found!");
            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
            return;
        }

        Console.WriteLine("Found Run dialog: " + hwndRun);
        SetForegroundWindow(hwndRun);
        ShowWindow(hwndRun, 9); // SW_RESTORE

        // Find ComboBox -> Edit
        IntPtr hwndCombo = FindWindowEx(hwndRun, IntPtr.Zero, "ComboBox", null);
        IntPtr hwndEdit = IntPtr.Zero;
        if (hwndCombo != IntPtr.Zero) {
            hwndEdit = FindWindowEx(hwndCombo, IntPtr.Zero, "Edit", null);
        }
        if (hwndEdit == IntPtr.Zero) {
            hwndEdit = FindWindowEx(hwndRun, IntPtr.Zero, "Edit", null);
        }

        Console.WriteLine("Combo: " + hwndCombo + ", Edit: " + hwndEdit);

        if (hwndEdit != IntPtr.Zero) {
            SendMessage(hwndEdit, WM_SETTEXT, IntPtr.Zero, command);
            Console.WriteLine("Set text to: " + command);
        }

        // Find OK button (Button with text "OK" or ID 1)
        IntPtr hwndOk = FindWindowEx(hwndRun, IntPtr.Zero, "Button", "OK");
        Console.WriteLine("OK Button: " + hwndOk);

        if (hwndOk != IntPtr.Zero) {
            SendMessage(hwndOk, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
            Console.WriteLine("Clicked OK button!");
        } else {
            // Post WM_COMMAND with ID 1
            SendMessage(hwndRun, WM_COMMAND, (IntPtr)1, IntPtr.Zero);
            Console.WriteLine("Sent WM_COMMAND 1 to Run dialog!");
        }

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
[RunDialogHelper]::Submit("notepad.exe")
Start-Sleep -Seconds 3
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_run_dialog.jpg"
