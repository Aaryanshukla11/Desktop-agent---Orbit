$code = @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

public class DialogTrigger {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    const uint WM_COMMAND = 0x0111;
    const uint WM_KEYDOWN = 0x0100;
    const uint WM_KEYUP = 0x0101;
    const uint VK_RETURN = 0x0D;

    public static void Trigger(IntPtr hwndRun, IntPtr hwndEdit, IntPtr hwndOk) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        RECT r;
        GetWindowRect(hwndOk, out r);
        Console.WriteLine("OK Button Rect: " + r.Left + "," + r.Top + " - " + r.Right + "," + r.Bottom);

        SetForegroundWindow(hwndRun);

        // Send Enter to Edit control
        SendMessage(hwndEdit, WM_KEYDOWN, (IntPtr)VK_RETURN, IntPtr.Zero);
        SendMessage(hwndEdit, WM_KEYUP, (IntPtr)VK_RETURN, IntPtr.Zero);

        // Also post WM_COMMAND with ID 1 (IDOK)
        PostMessage(hwndRun, WM_COMMAND, (IntPtr)1, hwndOk);

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@
Add-Type -TypeDefinition $code
[DialogTrigger]::Trigger([IntPtr]338948, [IntPtr]208448, [IntPtr]207158)
Start-Sleep -Seconds 3
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_trigger_run.jpg"
