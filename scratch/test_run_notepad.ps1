$code = @'
using System;
using System.Runtime.InteropServices;

public class RunTyper {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public static void FocusRun(IntPtr hWnd) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);
        SetForegroundWindow(hWnd);
        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
[RunTyper]::FocusRun([IntPtr]338948)
Start-Sleep -Milliseconds 300

Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("notepad{ENTER}")

Start-Sleep -Seconds 3
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_enter_notepad.jpg"
