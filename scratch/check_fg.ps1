$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class FgCheck {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static void Check() {
        IntPtr hwnd = GetForegroundWindow();
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(hwnd, sb, sb.Capacity);
        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        Console.WriteLine("Foreground Window: " + hwnd + " [PID " + pid + "] \"" + sb.ToString() + "\"");
    }
}
'@

Add-Type -TypeDefinition $code
[FgCheck]::Check()
