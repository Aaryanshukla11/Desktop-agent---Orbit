$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;

public class NewThreadDesktop {
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
    public const uint DESKTOP_READOBJECTS = 0x0001;
    public const uint DESKTOP_CREATEWINDOW = 0x0002;
    public const uint DESKTOP_CREATEMENU = 0x0004;
    public const uint DESKTOP_HOOKCONTROL = 0x0008;
    public const uint DESKTOP_JOURNALRECORD = 0x0010;
    public const uint DESKTOP_JOURNALPLAYBACK = 0x0020;
    public const uint DESKTOP_ENUMERATE = 0x0040;
    public const uint DESKTOP_WRITEOBJECTS = 0x0080;
    public const uint DESKTOP_SWITCHDESKTOP = 0x0100;
    public const uint GENERIC_ALL = 0x10000000;

    public static bool CaptureOnNewThread(string filePath, int width, int height) {
        bool captureSuccess = false;

        Thread t = new Thread(() => {
            IntPtr hInputDesk = OpenInputDesktop(0, false, 0x01FF);
            int errInput = Marshal.GetLastWin32Error();
            Console.WriteLine("[NewThread] OpenInputDesktop: " + hInputDesk + " (err=" + errInput + ")");

            if (hInputDesk == IntPtr.Zero) return;

            bool setOk = SetThreadDesktop(hInputDesk);
            int setErr = Marshal.GetLastWin32Error();
            Console.WriteLine("[NewThread] SetThreadDesktop: " + setOk + " (err=" + setErr + ")");

            if (!setOk) {
                CloseDesktop(hInputDesk);
                return;
            }

            IntPtr hdcSrc = GetDC(IntPtr.Zero);
            int dcErr = Marshal.GetLastWin32Error();
            Console.WriteLine("[NewThread] GetDC(0): " + hdcSrc + " (err=" + dcErr + ")");

            IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
            IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, width, height);
            IntPtr hOld = SelectObject(hdcDest, hBitmap);

            captureSuccess = BitBlt(hdcDest, 0, 0, width, height, hdcSrc, 0, 0, SRCCOPY);
            int err = Marshal.GetLastWin32Error();
            Console.WriteLine("[NewThread] BitBlt result: " + captureSuccess + ", LastError: " + err);

            SelectObject(hdcDest, hOld);
            DeleteDC(hdcDest);
            ReleaseDC(IntPtr.Zero, hdcSrc);

            if (captureSuccess) {
                using (Bitmap bmp = Image.FromHbitmap(hBitmap)) {
                    bmp.Save(filePath, ImageFormat.Png);
                    Console.WriteLine("[NewThread] Saved screenshot to " + filePath);
                }
            }
            DeleteObject(hBitmap);
            CloseDesktop(hInputDesk);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return captureSuccess;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
$dest = "c:\Users\Aaryan shukla\OneDrive\Desktop\UI-TARS-desktop-main\runs\new_thread_capture.png"
$res = [NewThreadDesktop]::CaptureOnNewThread($dest, 1440, 900)
Write-Host "Result: $res"
