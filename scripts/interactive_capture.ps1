$code = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public class FastDesktopCapture {
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

    public static string CaptureBase64(int width, int height, long quality) {
        string resultBase64 = null;

        Thread t = new Thread(() => {
            IntPtr hInputDesk = OpenInputDesktop(0, false, 0x01FF);
            if (hInputDesk == IntPtr.Zero) return;

            if (!SetThreadDesktop(hInputDesk)) {
                CloseDesktop(hInputDesk);
                return;
            }

            IntPtr hdcSrc = GetDC(IntPtr.Zero);
            IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
            IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, width, height);
            IntPtr hOld = SelectObject(hdcDest, hBitmap);

            bool success = BitBlt(hdcDest, 0, 0, width, height, hdcSrc, 0, 0, SRCCOPY);

            SelectObject(hdcDest, hOld);
            DeleteDC(hdcDest);
            ReleaseDC(IntPtr.Zero, hdcSrc);

            if (success) {
                using (Bitmap bmp = Image.FromHbitmap(hBitmap)) {
                    ImageCodecInfo jpgEncoder = null;
                    foreach (ImageCodecInfo codec in ImageCodecInfo.GetImageEncoders()) {
                        if (codec.MimeType == "image/jpeg") {
                            jpgEncoder = codec;
                            break;
                        }
                    }
                    using (MemoryStream ms = new MemoryStream()) {
                        if (jpgEncoder != null) {
                            EncoderParameters myEncoderParameters = new EncoderParameters(1);
                            myEncoderParameters.Param[0] = new EncoderParameter(Encoder.Quality, quality);
                            bmp.Save(ms, jpgEncoder, myEncoderParameters);
                        } else {
                            bmp.Save(ms, ImageFormat.Jpeg);
                        }
                        resultBase64 = Convert.ToBase64String(ms.ToArray());
                    }
                }
            }
            DeleteObject(hBitmap);
            CloseDesktop(hInputDesk);
        });

        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return resultBase64;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
$width = 1440
$height = 900
$outputFile = $null
if ($args.Count -ge 2) {
    $width = [int]$args[0]
    $height = [int]$args[1]
}
if ($args.Count -ge 3) {
    $outputFile = [string]$args[2]
}
$b64 = [FastDesktopCapture]::CaptureBase64($width, $height, 75)
if ($b64) {
    if ($outputFile) {
        [System.IO.File]::WriteAllBytes($outputFile, [System.Convert]::FromBase64String($b64))
        Write-Output "SAVED_TO_FILE: $outputFile"
    } else {
        [Console]::Out.Write($b64)
    }
} else {
    exit 1
}

