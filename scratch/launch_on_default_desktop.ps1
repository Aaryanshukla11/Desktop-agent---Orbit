Add-Type @"
using System;
using System.Runtime.InteropServices;

public class ProcessLauncher {
    [StructLayout(LayoutKind.Sequential)]
    public struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    public const int SW_SHOWNORMAL = 1;
    public const int STARTF_USESHOWWINDOW = 1;

    public static bool Launch(string appPath) {
        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = @"Winsta0\Default";
        si.dwFlags = STARTF_USESHOWWINDOW;
        si.wShowWindow = (short)SW_SHOWNORMAL;

        PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
        bool res = CreateProcess(null, appPath, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, null, ref si, out pi);
        if (!res) {
            Console.WriteLine("CreateProcess failed: " + Marshal.GetLastWin32Error());
        } else {
            Console.WriteLine("Launched PID: " + pi.dwProcessId);
        }
        return res;
    }
}
"@

$exe = 'C:\Windows\System32\cmd.exe /c start cmd.exe'
Write-Output "Launching cmd on Winsta0\Default..."
[ProcessLauncher]::Launch($exe)
Start-Sleep -Milliseconds 1500
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_winsta0_notepad.jpg"
