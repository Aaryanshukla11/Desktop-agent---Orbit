Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAct {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
# Word HWND: 2753218
[WinAct]::ShowWindow([IntPtr]2753218, 9)
[WinAct]::SetForegroundWindow([IntPtr]2753218)
Start-Sleep -Milliseconds 1500
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_word.jpg"
