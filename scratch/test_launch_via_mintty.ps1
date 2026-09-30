$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class MinttyRunner {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public MOUSEKEYBDHARDWAREINPUT mi;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct MOUSEKEYBDHARDWAREINPUT {
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;

    public static IntPtr FindWindowContaining(string sub) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return IntPtr.Zero;
        IntPtr result = IntPtr.Zero;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString();
            if (title.Contains(sub)) {
                result = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
        return result;
    }

    public static void MinimizeAppsExceptNotepad() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk == IntPtr.Zero) return;
        EnumDesktopWindows(hDesk, (hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, sb.Capacity);
                string title = sb.ToString();
                if (title.Contains("Antigravity") || title.Contains("MINGW64") || title.Contains("Brave")) {
                    ShowWindow(hWnd, 6); // Minimize
                }
            }
            return true;
        }, IntPtr.Zero);
        CloseDesktop(hDesk);
    }

    public static void SendText(IntPtr hWnd, string text) {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        if (hDesk != IntPtr.Zero) SetThreadDesktop(hDesk);

        ShowWindow(hWnd, 9); // SW_RESTORE
        SetForegroundWindow(hWnd);
        Thread.Sleep(500);

        foreach (char c in text) {
            INPUT[] inputs = new INPUT[2];
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].mi.ki.wVk = 0;
            inputs[0].mi.ki.wScan = (ushort)c;
            inputs[0].mi.ki.dwFlags = KEYEVENTF_UNICODE;

            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].mi.ki.wVk = 0;
            inputs[1].mi.ki.wScan = (ushort)c;
            inputs[1].mi.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

            SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
            Thread.Sleep(30);
        }

        // Enter key
        INPUT[] enter = new INPUT[2];
        enter[0].type = INPUT_KEYBOARD;
        enter[0].mi.ki.wVk = 0x0D; // VK_RETURN
        enter[0].mi.ki.dwFlags = 0;

        enter[1].type = INPUT_KEYBOARD;
        enter[1].mi.ki.wVk = 0x0D;
        enter[1].mi.ki.dwFlags = KEYEVENTF_KEYUP;

        SendInput(2, enter, Marshal.SizeOf(typeof(INPUT)));

        if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

$hwnd = [MinttyRunner]::FindWindowContaining("MINGW64")
Write-Host "Found MINGW64 HWND: $hwnd"

if ($hwnd -ne [IntPtr]::Zero) {
    Write-Host "Sending notepad command to MINGW64..."
    [MinttyRunner]::SendText($hwnd, "notepad `"C:/Users/Aaryan shukla/OneDrive/Desktop/test_notepad.txt`"")
    Start-Sleep -Seconds 3

    Write-Host "Minimizing occlusions..."
    [MinttyRunner]::MinimizeAppsExceptNotepad()
    Start-Sleep -Milliseconds 800

    Write-Host "Capturing desktop screenshot..."
    & "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\t0_final_pass.jpg"
} else {
    Write-Host "MINGW64 window not found!"
}
