$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class DesktopSwitcher {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);

    public const uint SRCCOPY = 0x00CC0020;
    public const uint GENERIC_ALL = 0x10000000;

    public static bool CaptureWithSwitch(string filePath, int width, int height) {
        IntPtr hInputDesk = OpenInputDesktop(0, false, 0x01FF);
        int errInput = Marshal.GetLastWin32Error();
        Console.WriteLine("OpenInputDesktop: " + hInputDesk + " (err=" + errInput + ")");

        if (hInputDesk != IntPtr.Zero) {
            bool setOk = SetThreadDesktop(hInputDesk);
            int setErr = Marshal.GetLastWin32Error();
            Console.WriteLine("SetThreadDesktop: " + setOk + " (err=" + setErr + ")");
        }

        IntPtr hdcSrc = GetDC(IntPtr.Zero);
        int dcErr = Marshal.GetLastWin32Error();
        Console.WriteLine("GetDC(0): " + hdcSrc + " (err=" + dcErr + ")");

        IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, width, height);
        IntPtr hOld = SelectObject(hdcDest, hBitmap);

        bool success = BitBlt(hdcDest, 0, 0, width, height, hdcSrc, 0, 0, SRCCOPY);
        int err = Marshal.GetLastWin32Error();
        Console.WriteLine("BitBlt result: " + success + ", LastError: " + err);

        SelectObject(hdcDest, hOld);
        DeleteDC(hdcDest);
        ReleaseDC(IntPtr.Zero, hdcSrc);

        if (success) {
            using (Bitmap bmp = Image.FromHbitmap(hBitmap)) {
                bmp.Save(filePath, ImageFormat.Png);
                Console.WriteLine("Saved screenshot to " + filePath);
            }
        }
        DeleteObject(hBitmap);
        if (hInputDesk != IntPtr.Zero) CloseDesktop(hInputDesk);
        return success;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
$dest = "c:\Users\Aaryan shukla\OneDrive\Desktop\UI-TARS-desktop-main\runs\switched_capture.png"
$res = [DesktopSwitcher]::CaptureWithSwitch($dest, 1440, 900)
Write-Host "Result: $res"
