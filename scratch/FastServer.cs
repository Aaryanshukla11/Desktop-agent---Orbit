
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class FastServer {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [StructLayout(LayoutKind.Explicit, Size = 40)]
    public struct INPUT {
        [FieldOffset(0)] public uint type;
        [FieldOffset(8)] public ushort wVk;
        [FieldOffset(10)] public ushort wScan;
        [FieldOffset(12)] public uint dwFlags;
        [FieldOffset(16)] public uint time;
        [FieldOffset(24)] public IntPtr dwExtraInfo;
    }

    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;
    const ushort VK_LWIN = 0x5B;
    const ushort VK_R = 0x52;

    public static void Main() {
        Console.WriteLine("READY");
        string line;
        while ((line = Console.ReadLine()) != null) {
            line = line.Trim();
            if (line == "exit") break;
            var parts = line.Split(' ');
            var cmd = parts[0].ToLower();
            var sw = System.Diagnostics.Stopwatch.StartNew();

            if (cmd == "click" && parts.Length >= 3) {
                int x = int.Parse(parts[1]);
                int y = int.Parse(parts[2]);
                SetCursorPos(x, y);
                mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero); // LEFTDOWN
                mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero); // LEFTUP
                sw.Stop();
                Console.WriteLine("OK click " + sw.ElapsedMilliseconds + "ms");
            } else if (cmd == "winr") {
                INPUT[] inputs = new INPUT[4];
                // Win down
                inputs[0].type = INPUT_KEYBOARD;
                inputs[0].wVk = VK_LWIN;
                inputs[0].dwFlags = KEYEVENTF_EXTENDEDKEY;
                // R down
                inputs[1].type = INPUT_KEYBOARD;
                inputs[1].wVk = VK_R;
                // R up
                inputs[2].type = INPUT_KEYBOARD;
                inputs[2].wVk = VK_R;
                inputs[2].dwFlags = KEYEVENTF_KEYUP;
                // Win up
                inputs[3].type = INPUT_KEYBOARD;
                inputs[3].wVk = VK_LWIN;
                inputs[3].dwFlags = KEYEVENTF_KEYUP | KEYEVENTF_EXTENDEDKEY;
                SendInput(4, inputs, Marshal.SizeOf(typeof(INPUT)));
                sw.Stop();
                Console.WriteLine("OK winr " + sw.ElapsedMilliseconds + "ms");
            } else if (cmd == "type" && parts.Length >= 2) {
                string text = line.Substring(5);
                foreach (char c in text) {
                    INPUT[] inp = new INPUT[2];
                    inp[0].type = INPUT_KEYBOARD;
                    inp[0].wScan = (ushort)c;
                    inp[0].dwFlags = KEYEVENTF_UNICODE;
                    inp[1].type = INPUT_KEYBOARD;
                    inp[1].wScan = (ushort)c;
                    inp[1].dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
                    SendInput(2, inp, Marshal.SizeOf(typeof(INPUT)));
                }
                sw.Stop();
                Console.WriteLine("OK type " + sw.ElapsedMilliseconds + "ms");
            } else {
                Console.WriteLine("UNKNOWN");
            }
        }
    }
}
