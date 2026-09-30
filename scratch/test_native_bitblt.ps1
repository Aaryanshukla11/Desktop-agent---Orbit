$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class NativeCapture {
    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindowDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, uint dwRop);

    public const uint SRCCOPY = 0x00CC0020;

    public static bool Capture(string filePath, int width, int height) {
        IntPtr hDesktop = GetDesktopWindow();
        IntPtr hdcSrc = GetWindowDC(hDesktop);
        if (hdcSrc == IntPtr.Zero) {
            Console.WriteLine("GetWindowDC failed");
            return false;
        }

        IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
        IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, width, height);
        IntPtr hOld = SelectObject(hdcDest, hBitmap);

        bool success = BitBlt(hdcDest, 0, 0, width, height, hdcSrc, 0, 0, SRCCOPY);
        int err = Marshal.GetLastWin32Error();
        Console.WriteLine("BitBlt result: " + success + ", LastError: " + err);

        SelectObject(hdcDest, hOld);
        DeleteDC(hdcDest);
        ReleaseDC(hDesktop, hdcSrc);

        if (success) {
            using (Bitmap bmp = Image.FromHbitmap(hBitmap)) {
                bmp.Save(filePath, ImageFormat.Png);
            }
        }
        DeleteObject(hBitmap);
        return success;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
$dest = "c:\Users\Aaryan shukla\OneDrive\Desktop\UI-TARS-desktop-main\runs\native_capture.png"
$res = [NativeCapture]::Capture($dest, 1440, 900)
Write-Host "Capture result: $res, Saved to $dest"
