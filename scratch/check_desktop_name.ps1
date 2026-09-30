$code = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public class DesktopCheck {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetUserObjectInformation(IntPtr hObj, int nIndex, StringBuilder pvInfo, int nLength, ref int lpnLengthNeeded);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    public const int UOI_NAME = 2;

    public static void Check() {
        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
        int err = Marshal.GetLastWin32Error();
        Console.WriteLine("OpenInputDesktop: " + hDesk + " (err=" + err + ")");
        if (hDesk != IntPtr.Zero) {
            StringBuilder sb = new StringBuilder(256);
            int len = 0;
            if (GetUserObjectInformation(hDesk, UOI_NAME, sb, sb.Capacity, ref len)) {
                Console.WriteLine("Active Input Desktop Name: [" + sb.ToString() + "]");
            }
            CloseDesktop(hDesk);
        }
    }
}
'@

Add-Type -TypeDefinition $code
[DesktopCheck]::Check()
