Add-Type @"
using System;
using System.Runtime.InteropServices;
public class InputTest {
    [StructLayout(LayoutKind.Explicit, Size = 40)]
    public struct INPUT {
        [FieldOffset(0)] public uint type;
        [FieldOffset(8)] public ushort wVk;
        [FieldOffset(10)] public ushort wScan;
        [FieldOffset(12)] public uint dwFlags;
        [FieldOffset(16)] public uint time;
        [FieldOffset(24)] public IntPtr dwExtraInfo;
    }
    public const uint INPUT_KEYBOARD = 1;
    public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const ushort VK_LWIN = 0x5B;
    public const ushort VK_R = 0x52;

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    public static void SendWinR() {
        System.Threading.Thread t = new System.Threading.Thread(() => {
            IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }

            // Win down
            INPUT[] in1 = new INPUT[1];
            in1[0].type = INPUT_KEYBOARD;
            in1[0].wVk = VK_LWIN;
            in1[0].dwFlags = KEYEVENTF_EXTENDEDKEY;
            SendInput(1, in1, Marshal.SizeOf(typeof(INPUT)));

            System.Threading.Thread.Sleep(60);

            // R down
            INPUT[] in2 = new INPUT[1];
            in2[0].type = INPUT_KEYBOARD;
            in2[0].wVk = VK_R;
            SendInput(1, in2, Marshal.SizeOf(typeof(INPUT)));

            System.Threading.Thread.Sleep(60);

            // R up
            INPUT[] in3 = new INPUT[1];
            in3[0].type = INPUT_KEYBOARD;
            in3[0].wVk = VK_R;
            in3[0].dwFlags = KEYEVENTF_KEYUP;
            SendInput(1, in3, Marshal.SizeOf(typeof(INPUT)));

            System.Threading.Thread.Sleep(60);

            // Win up
            INPUT[] in4 = new INPUT[1];
            in4[0].type = INPUT_KEYBOARD;
            in4[0].wVk = VK_LWIN;
            in4[0].dwFlags = KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP;
            SendInput(1, in4, Marshal.SizeOf(typeof(INPUT)));

            Console.WriteLine("Sent Win+R with delays!");

            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });
        t.SetApartmentState(System.Threading.ApartmentState.STA);
        t.Start();
        t.Join();
    }
}
"@

[InputTest]::SendWinR()
Start-Sleep -Milliseconds 1000
& "$PSScriptRoot\..\scripts\interactive_capture.ps1" 1440 900 "$PSScriptRoot\..\runs\screen_sendinput_winr.jpg"
