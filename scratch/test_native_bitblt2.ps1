$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class NativeCapture2 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetWindowDC(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr CreateDCA(string lpszDriver, string lpszDevice, string lpszOutput, IntPtr lpInitData);

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

    public static void Test() {
        IntPtr hDesktop = GetDesktopWindow();
        Console.WriteLine("hDesktop: " + hDesktop);

        IntPtr hdcSrc = GetDC(IntPtr.Zero);
        Console.WriteLine("hdcSrc (GetDC): " + hdcSrc + ", LastError: " + Marshal.GetLastWin32Error());

        IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
        Console.WriteLine("hdcDest: " + hdcDest + ", LastError: " + Marshal.GetLastWin32Error());

        IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, 1440, 900);
        Console.WriteLine("hBitmap: " + hBitmap + ", LastError: " + Marshal.GetLastWin32Error());

        IntPtr hOld = SelectObject(hdcDest, hBitmap);
        Console.WriteLine("hOld: " + hOld + ", LastError: " + Marshal.GetLastWin32Error());

        bool success = BitBlt(hdcDest, 0, 0, 1440, 900, hdcSrc, 0, 0, SRCCOPY);
        int err = Marshal.GetLastWin32Error();
        Console.WriteLine("BitBlt: " + success + ", LastError: " + err);

        SelectObject(hdcDest, hOld);
        DeleteObject(hBitmap);
        DeleteDC(hdcDest);
        ReleaseDC(IntPtr.Zero, hdcSrc);

        // Also test CreateDCA("DISPLAY")
        IntPtr hdcDisp = CreateDCA("DISPLAY", null, null, IntPtr.Zero);
        Console.WriteLine("\nhdcDisp: " + hdcDisp + ", LastError: " + Marshal.GetLastWin32Error());
        IntPtr hdcDest2 = CreateCompatibleDC(hdcDisp);
        IntPtr hBitmap2 = CreateCompatibleBitmap(hdcDisp, 1440, 900);
        IntPtr hOld2 = SelectObject(hdcDest2, hBitmap2);
        bool success2 = BitBlt(hdcDest2, 0, 0, 1440, 900, hdcDisp, 0, 0, SRCCOPY);
        int err2 = Marshal.GetLastWin32Error();
        Console.WriteLine("BitBlt from hdcDisp: " + success2 + ", LastError: " + err2);
        SelectObject(hdcDest2, hOld2);
        DeleteObject(hBitmap2);
        DeleteDC(hdcDest2);
        DeleteDC(hdcDisp);
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
[NativeCapture2]::Test()
