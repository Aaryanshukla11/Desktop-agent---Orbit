using System;
using System.Runtime.InteropServices;
using System.Threading;

public class TestWin {
    [StructLayout(LayoutKind.Sequential)]
    struct INPUT {
        public uint type;
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
        public uint pad1;
        public uint pad2;
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;

    public static void Main() {
        INPUT[] inputs = new INPUT[2];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].wVk = 0x5B; // VK_LWIN
        inputs[0].dwFlags = KEYEVENTF_EXTENDEDKEY;

        inputs[1].type = INPUT_KEYBOARD;
        inputs[1].wVk = 0x5B;
        inputs[1].dwFlags = KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP;

        uint res = SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
        Console.WriteLine("SendInput result: " + res + " LastError: " + Marshal.GetLastWin32Error());
    }
}
