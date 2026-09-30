$code = @'
using System;
using System.Runtime.InteropServices;
public class MinM {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    public static void Min() { ShowWindow((IntPtr)67712, 6); }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[MinM]::Min()
Start-Sleep -Seconds 1
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_after_min_mingw.jpg"
