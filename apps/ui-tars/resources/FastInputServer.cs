using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Automation;

public class FastInputServer {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);
    private static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new IntPtr(-4);

    [DllImport("user32.dll")]
    public static extern uint MapVirtualKey(uint uCode, uint uMapType);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern short VkKeyScan(char ch);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr SetFocus(IntPtr hWnd);

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

    const uint SRCCOPY = 0x00CC0020;

    [DllImport("user32.dll")]
    public static extern bool OpenClipboard(IntPtr hWndNewOwner);

    [DllImport("user32.dll")]
    public static extern bool CloseClipboard();

    [DllImport("user32.dll")]
    public static extern bool EmptyClipboard();

    [DllImport("user32.dll")]
    public static extern IntPtr SetClipboardData(uint uFormat, IntPtr hMem);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GlobalLock(IntPtr hMem);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GlobalUnlock(IntPtr hMem);

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

    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP = 0x0040;

    const uint CF_UNICODETEXT = 13;
    const uint GMEM_MOVEABLE = 0x0002;

    static readonly Dictionary<string, ushort> KeyCodes = new Dictionary<string, ushort>(StringComparer.OrdinalIgnoreCase) {
        { "win", 0x5B }, { "windows", 0x5B }, { "super", 0x5B }, { "meta", 0x5B }, { "cmd", 0x5B },
        { "ctrl", 0x11 }, { "control", 0x11 },
        { "alt", 0x12 }, { "menu", 0x12 },
        { "shift", 0x10 },
        { "enter", 0x0D }, { "return", 0x0D },
        { "esc", 0x1B }, { "escape", 0x1B },
        { "backspace", 0x08 },
        { "tab", 0x09 },
        { "space", 0x20 },
        { "home", 0x24 }, { "end", 0x23 }, { "pageup", 0x21 }, { "pagedown", 0x22 },
        { "up", 0x26 }, { "down", 0x28 }, { "left", 0x25 }, { "right", 0x27 },
        { "delete", 0x2E }, { "del", 0x2E }, { "insert", 0x2D },
        { "f1", 0x70 }, { "f2", 0x71 }, { "f3", 0x72 }, { "f4", 0x73 },
        { "f5", 0x74 }, { "f6", 0x75 }, { "f7", 0x76 }, { "f8", 0x77 },
        { "f9", 0x78 }, { "f10", 0x79 }, { "f11", 0x7A }, { "f12", 0x7B },
        { "a", 0x41 }, { "b", 0x42 }, { "c", 0x43 }, { "d", 0x44 },
        { "e", 0x45 }, { "f", 0x46 }, { "g", 0x47 }, { "h", 0x48 },
        { "i", 0x49 }, { "j", 0x4A }, { "k", 0x4B }, { "l", 0x4C },
        { "m", 0x4D }, { "n", 0x4E }, { "o", 0x4F }, { "p", 0x50 },
        { "q", 0x51 }, { "r", 0x52 }, { "s", 0x53 }, { "t", 0x54 },
        { "u", 0x55 }, { "v", 0x56 }, { "w", 0x57 }, { "x", 0x58 },
        { "y", 0x59 }, { "z", 0x5A },
        { "0", 0x30 }, { "1", 0x31 }, { "2", 0x32 }, { "3", 0x33 },
        { "4", 0x34 }, { "5", 0x35 }, { "6", 0x36 }, { "7", 0x37 },
        { "8", 0x38 }, { "9", 0x39 },
        { ",", 0xBC }, { "comma", 0xBC },
        { ".", 0xBE }, { "period", 0xBE }, { "dot", 0xBE },
        { ";", 0xBA }, { "semicolon", 0xBA },
        { "/", 0xBF }, { "slash", 0xBF },
        { "\\", 0xDC }, { "backslash", 0xDC },
        { "'", 0xDE }, { "quote", 0xDE },
        { "[", 0xDB }, { "openbracket", 0xDB },
        { "]", 0xDD }, { "closebracket", 0xDD },
        { "`", 0xC0 }, { "backtick", 0xC0 }, { "~", 0xC0 },
        { "-", 0xBD }, { "minus", 0xBD },
        { "=", 0xBB }, { "equal", 0xBB }
    };

    static void SetClipboardText(string text) {
        bool opened = false;
        for (int i = 0; i < 10; i++) {
            if (OpenClipboard(IntPtr.Zero)) {
                opened = true;
                break;
            }
            Thread.Sleep(10);
        }
        if (!opened) return;
        try {
            EmptyClipboard();
            byte[] bytes = Encoding.Unicode.GetBytes(text + "\0");
            IntPtr hGlobal = GlobalAlloc(GMEM_MOVEABLE, (UIntPtr)bytes.Length);
            if (hGlobal != IntPtr.Zero) {
                IntPtr target = GlobalLock(hGlobal);
                if (target != IntPtr.Zero) {
                    Marshal.Copy(bytes, 0, target, bytes.Length);
                    GlobalUnlock(hGlobal);
                    SetClipboardData(CF_UNICODETEXT, hGlobal);
                }
            }
        } finally {
            CloseClipboard();
        }
    }

    private static ImageCodecInfo GetEncoder(ImageFormat format) {
        ImageCodecInfo[] codecs = ImageCodecInfo.GetImageDecoders();
        foreach (ImageCodecInfo codec in codecs) {
            if (codec.FormatID == format.Guid) {
                return codec;
            }
        }
        return null;
    }

    public static bool SnapToElement(int x, int y, string hint, out int outX, out int outY) {
        outX = x;
        outY = y;
        try {
            System.Windows.Point pt = new System.Windows.Point(x, y);
            AutomationElement el = AutomationElement.FromPoint(pt);
            if (el == null) return false;

            AutomationElement target = el;
            AutomationElement curr = el;
            for (int i = 0; i < 4 && curr != null; i++) {
                try {
                    ControlType cType = curr.Current.ControlType;
                    if (cType == ControlType.Button ||
                        cType == ControlType.MenuItem ||
                        cType == ControlType.TabItem ||
                        cType == ControlType.ListItem ||
                        cType == ControlType.Hyperlink ||
                        cType == ControlType.Edit ||
                        cType == ControlType.CheckBox ||
                        cType == ControlType.RadioButton ||
                        cType == ControlType.ComboBox ||
                        cType == ControlType.SplitButton) {
                        target = curr;
                        break;
                    }
                    curr = TreeWalker.ControlViewWalker.GetParent(curr);
                } catch {
                    break;
                }
            }

            ControlType targetType = null;
            try { targetType = target.Current.ControlType; } catch {}
            bool isClickable = (targetType == ControlType.Button ||
                                targetType == ControlType.MenuItem ||
                                targetType == ControlType.TabItem ||
                                targetType == ControlType.ListItem ||
                                targetType == ControlType.Hyperlink ||
                                targetType == ControlType.Edit ||
                                targetType == ControlType.CheckBox ||
                                targetType == ControlType.RadioButton ||
                                targetType == ControlType.ComboBox ||
                                targetType == ControlType.SplitButton);

            string cleanHint = !string.IsNullOrEmpty(hint) ? hint.Trim().ToLowerInvariant().Replace("_", " ") : "";

            // Case A: The element directly under the cursor is ALREADY a clickable control
            if (isClickable) {
                System.Windows.Rect rect = target.Current.BoundingRectangle;
                if (!rect.IsEmpty && rect.Width > 4 && rect.Height > 4 && rect.Width < 2200 && rect.Height < 1400) {
                    string targetName = target.Current.Name != null ? target.Current.Name.ToLowerInvariant() : "";

                    // If hint matches target, OR no hint, OR target's bounding box directly contains the click point:
                    // Keep cursor firmly locked to this target!
                    bool pointInside = (x >= rect.X - 5 && x <= rect.X + rect.Width + 5 &&
                                        y >= rect.Y - 5 && y <= rect.Y + rect.Height + 5);

                    if (string.IsNullOrEmpty(cleanHint) || targetName.Contains(cleanHint) || pointInside) {
                        outX = (int)Math.Round(rect.X + rect.Width / 2.0);
                        outY = (int)Math.Round(rect.Y + rect.Height / 2.0);
                        return true;
                    }

                    // If a specific hint was provided and target doesn't match, check immediate siblings
                    // ONLY within a strict radius of 80 physical pixels (never jump across toolbars/ribbons!)
                    AutomationElement parent = TreeWalker.ControlViewWalker.GetParent(target);
                    if (parent != null) {
                        AutomationElementCollection siblings = parent.FindAll(TreeScope.Children, Condition.TrueCondition);
                        double bestDist = 80.0;
                        AutomationElement bestEl = null;
                        foreach (AutomationElement sibling in siblings) {
                            try {
                                string sName = sibling.Current.Name != null ? sibling.Current.Name.ToLowerInvariant() : "";
                                if (sName.Contains(cleanHint)) {
                                    System.Windows.Rect sRect = sibling.Current.BoundingRectangle;
                                    if (!sRect.IsEmpty && sRect.Width > 4 && sRect.Height > 4) {
                                        int cX = (int)Math.Round(sRect.X + sRect.Width / 2.0);
                                        int cY = (int)Math.Round(sRect.Y + sRect.Height / 2.0);
                                        double d = Math.Sqrt(Math.Pow(cX - x, 2) + Math.Pow(cY - y, 2));
                                        if (d < bestDist) {
                                            bestDist = d;
                                            bestEl = sibling;
                                        }
                                    }
                                }
                            } catch {}
                        }

                        if (bestEl != null) {
                            System.Windows.Rect bRect = bestEl.Current.BoundingRectangle;
                            outX = (int)Math.Round(bRect.X + bRect.Width / 2.0);
                            outY = (int)Math.Round(bRect.Y + bRect.Height / 2.0);
                            return true;
                        }
                    }

                    // Fallback for clickable target: snap to target's center
                    outX = (int)Math.Round(rect.X + rect.Width / 2.0);
                    outY = (int)Math.Round(rect.Y + rect.Height / 2.0);
                    return true;
                }
            }

            // Case B: Point hit margin / empty space in a container (not a clickable control itself)
            try {
                AutomationElementCollection children = target.FindAll(TreeScope.Children, Condition.TrueCondition);
                double bestDist = 80.0;
                AutomationElement bestChild = null;

                // 1. If hint provided, search immediate children within 80px
                if (!string.IsNullOrEmpty(cleanHint)) {
                    foreach (AutomationElement child in children) {
                        try {
                            string cName = child.Current.Name != null ? child.Current.Name.ToLowerInvariant() : "";
                            if (cName.Contains(cleanHint)) {
                                System.Windows.Rect cRect = child.Current.BoundingRectangle;
                                if (!cRect.IsEmpty && cRect.Width > 4 && cRect.Height > 4) {
                                    int cX = (int)Math.Round(cRect.X + cRect.Width / 2.0);
                                    int cY = (int)Math.Round(cRect.Y + cRect.Height / 2.0);
                                    double d = Math.Sqrt(Math.Pow(cX - x, 2) + Math.Pow(cY - y, 2));
                                    if (d < bestDist) {
                                        bestDist = d;
                                        bestChild = child;
                                    }
                                }
                            }
                        } catch {}
                    }
                }

                // 2. Proximity search: find nearest clickable child within 60px
                if (bestChild == null) {
                    double bestProxDist = 60.0;
                    foreach (AutomationElement child in children) {
                        try {
                            ControlType ct = child.Current.ControlType;
                            if (ct == ControlType.Button || ct == ControlType.MenuItem || ct == ControlType.ListItem ||
                                ct == ControlType.Hyperlink || ct == ControlType.Edit || ct == ControlType.TabItem) {
                                System.Windows.Rect cRect = child.Current.BoundingRectangle;
                                if (!cRect.IsEmpty && cRect.Width > 4 && cRect.Height > 4) {
                                    int cX = (int)Math.Round(cRect.X + cRect.Width / 2.0);
                                    int cY = (int)Math.Round(cRect.Y + cRect.Height / 2.0);
                                    double d = Math.Sqrt(Math.Pow(cX - x, 2) + Math.Pow(cY - y, 2));
                                    if (d < bestProxDist) {
                                        bestProxDist = d;
                                        bestChild = child;
                                    }
                                }
                            }
                        } catch {}
                    }
                }

                if (bestChild != null) {
                    System.Windows.Rect nRect = bestChild.Current.BoundingRectangle;
                    outX = (int)Math.Round(nRect.X + nRect.Width / 2.0);
                    outY = (int)Math.Round(nRect.Y + nRect.Height / 2.0);
                    return true;
                }
            } catch {}
        } catch {}
        return false;
    }

    public static void ReleaseModifiers() {
        keybd_event(0x11, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(0x12, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(0x10, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    [STAThread]
    public static void Main() {
        try {
            if (!SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
                SetProcessDPIAware();
            }
        } catch {
            try { SetProcessDPIAware(); } catch {}
        }

        try {
            IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
                CloseDesktop(hDesk);
            }
        } catch {}

        try {
            Console.OutputEncoding = Encoding.UTF8;
        } catch {}

        // Preload UIAutomation subsystem to guarantee 0-1ms subsequent snap times
        try { int wx, wy; SnapToElement(10, 10, "", out wx, out wy); } catch {}

        Console.WriteLine("READY");
        string line;
        while ((line = Console.ReadLine()) != null) {
            line = line.TrimEnd('\r', '\n');
            if (string.IsNullOrEmpty(line)) continue;
            if (line == "exit" || line == "quit") break;

            try {
                var parts = line.Split(new[] { ' ' }, 2);
                var cmd = parts[0].ToLowerInvariant().Trim();
                var rest = parts.Length > 1 ? parts[1] : "";

                if (cmd == "click" || cmd == "left_click" || cmd == "left_single") {
                    var xyParts = rest.Trim().Split(new[] { ' ' }, 3);
                    int x = int.Parse(xyParts[0]);
                    int y = int.Parse(xyParts[1]);
                    string hint = xyParts.Length > 2 ? xyParts[2] : "";
                    int targetX, targetY;
                    SnapToElement(x, y, hint, out targetX, out targetY);
                    SetCursorPos(targetX, targetY);
                    Thread.Sleep(25);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(45);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(20);
                    Console.WriteLine("OK");
                }
                else if (cmd == "doubleclick" || cmd == "double_click" || cmd == "left_double") {
                    var xyParts = rest.Trim().Split(new[] { ' ' }, 3);
                    int x = int.Parse(xyParts[0]);
                    int y = int.Parse(xyParts[1]);
                    string hint = xyParts.Length > 2 ? xyParts[2] : "";
                    int targetX, targetY;
                    SnapToElement(x, y, hint, out targetX, out targetY);
                    SetCursorPos(targetX, targetY);
                    Thread.Sleep(25);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(40);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(50);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(40);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(20);
                    Console.WriteLine("OK");
                }
                else if (cmd == "rightclick" || cmd == "right_click" || cmd == "right_single") {
                    var xyParts = rest.Trim().Split(new[] { ' ' }, 3);
                    int x = int.Parse(xyParts[0]);
                    int y = int.Parse(xyParts[1]);
                    string hint = xyParts.Length > 2 ? xyParts[2] : "";
                    int targetX, targetY;
                    SnapToElement(x, y, hint, out targetX, out targetY);
                    SetCursorPos(targetX, targetY);
                    Thread.Sleep(25);
                    mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(45);
                    mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(20);
                    Console.WriteLine("OK");
                }
                else if (cmd == "move" || cmd == "hover") {
                    var xy = rest.Trim().Split(' ');
                    int x = int.Parse(xy[0]);
                    int y = int.Parse(xy[1]);
                    SetCursorPos(x, y);
                    Console.WriteLine("OK");
                }
                else if (cmd == "drag") {
                    var xy = rest.Trim().Split(' ');
                    int x1 = int.Parse(xy[0]);
                    int y1 = int.Parse(xy[1]);
                    int x2 = int.Parse(xy[2]);
                    int y2 = int.Parse(xy[3]);
                    SetCursorPos(x1, y1);
                    Thread.Sleep(15);
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(25);
                    int steps = 12;
                    for (int i = 1; i <= steps; i++) {
                        int curX = x1 + (x2 - x1) * i / steps;
                        int curY = y1 + (y2 - y1) * i / steps;
                        SetCursorPos(curX, curY);
                        Thread.Sleep(4);
                    }
                    SetCursorPos(x2, y2);
                    Thread.Sleep(30);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                    Console.WriteLine("OK");
                }
                else if (cmd == "hotkey") {
                    string cleanRest = rest.ToLowerInvariant().Trim().Replace(" ", "").Replace("+", "").Replace("-", "");

                    if (cleanRest == "winr") {
                        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                        Thread.Sleep(30);
                        keybd_event(0x52, 0x13, 0, UIntPtr.Zero);
                        Thread.Sleep(40);
                        keybd_event(0x52, 0x13, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(30);
                        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Console.WriteLine("OK");
                        continue;
                    }
                    if (cleanRest == "win" || cleanRest == "super" || cleanRest == "windows") {
                        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                        Thread.Sleep(35);
                        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Console.WriteLine("OK");
                        continue;
                    }
                    if (cleanRest == "wind") {
                        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                        Thread.Sleep(30);
                        keybd_event(0x44, 0x20, 0, UIntPtr.Zero);
                        Thread.Sleep(40);
                        keybd_event(0x44, 0x20, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(30);
                        keybd_event(0x5B, 0x5B, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Console.WriteLine("OK");
                        continue;
                    }
                    if (cleanRest == "enter" || cleanRest == "return") {
                        keybd_event(0x0D, 0x1C, 0, UIntPtr.Zero);
                        Thread.Sleep(35);
                        keybd_event(0x0D, 0x1C, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(35);
                        Console.WriteLine("OK");
                        continue;
                    }
                    if (cleanRest == "tab") {
                        keybd_event(0x09, 0x0F, 0, UIntPtr.Zero);
                        Thread.Sleep(25);
                        keybd_event(0x09, 0x0F, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Console.WriteLine("OK");
                        continue;
                    }
                    if (cleanRest == "esc" || cleanRest == "escape") {
                        keybd_event(0x1B, 0x01, 0, UIntPtr.Zero);
                        Thread.Sleep(25);
                        keybd_event(0x1B, 0x01, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Console.WriteLine("OK");
                        continue;
                    }
                    if (cleanRest == "backspace" || cleanRest == "back") {
                        keybd_event(0x08, 0x0E, 0, UIntPtr.Zero);
                        Thread.Sleep(25);
                        keybd_event(0x08, 0x0E, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Console.WriteLine("OK");
                        continue;
                    }

                    var keys = rest.Split(new[] { '+', ' ', '-' }, StringSplitOptions.RemoveEmptyEntries);
                    var modDowns = new List<INPUT>();
                    var modUps = new List<INPUT>();
                    var trigDowns = new List<INPUT>();
                    var trigUps = new List<INPUT>();

                    foreach (var k in keys) {
                        var cleanKey = k.ToLowerInvariant().Trim();
                        ushort vk = 0;
                        if (!KeyCodes.TryGetValue(cleanKey, out vk)) {
                            if (cleanKey.Length == 1) {
                                short scanned = VkKeyScan(cleanKey[0]);
                                if (scanned != -1) {
                                    vk = (ushort)(scanned & 0xFF);
                                }
                            }
                        }

                        if (vk != 0) {
                            uint flags = 0;
                            if (vk == 0x5B) flags |= KEYEVENTF_EXTENDEDKEY;

                            ushort scan = (ushort)MapVirtualKey(vk, 0);
                            var inDown = new INPUT { type = INPUT_KEYBOARD, wVk = vk, wScan = scan, dwFlags = flags };
                            var inUp = new INPUT { type = INPUT_KEYBOARD, wVk = vk, wScan = scan, dwFlags = flags | KEYEVENTF_KEYUP };

                            bool isMod = (vk == 0x5B || vk == 0x11 || vk == 0x12 || vk == 0x10);
                            if (isMod) {
                                modDowns.Add(inDown);
                                modUps.Insert(0, inUp);
                            } else {
                                trigDowns.Add(inDown);
                                trigUps.Insert(0, inUp);
                            }
                        }
                    }

                    if (modDowns.Count > 0) {
                        SendInput((uint)modDowns.Count, modDowns.ToArray(), Marshal.SizeOf(typeof(INPUT)));
                        Thread.Sleep(25);
                    }
                    if (trigDowns.Count > 0) {
                        SendInput((uint)trigDowns.Count, trigDowns.ToArray(), Marshal.SizeOf(typeof(INPUT)));
                        Thread.Sleep(45);
                        SendInput((uint)trigUps.Count, trigUps.ToArray(), Marshal.SizeOf(typeof(INPUT)));
                        Thread.Sleep(25);
                    }
                    if (modUps.Count > 0) {
                        SendInput((uint)modUps.Count, modUps.ToArray(), Marshal.SizeOf(typeof(INPUT)));
                        Thread.Sleep(20);
                    }

                    Console.WriteLine("OK");
                }
                else if (cmd == "minimize_all" || cmd == "minimizeall" || cmd == "showdesktop") {
                    try {
                        Type shellType = Type.GetTypeFromProgID("Shell.Application");
                        if (shellType != null) {
                            object shell = Activator.CreateInstance(shellType);
                            shellType.InvokeMember("MinimizeAll", System.Reflection.BindingFlags.InvokeMethod, null, shell, null);
                        }
                    } catch {}
                    try {
                        IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
                        if (hDesk != IntPtr.Zero) {
                            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                                if (!IsWindowVisible(hWnd)) return true;
                                StringBuilder sbClass = new StringBuilder(256);
                                GetClassName(hWnd, sbClass, 256);
                                string cls = sbClass.ToString();
                                if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd") {
                                    return true;
                                }
                                StringBuilder sb = new StringBuilder(256);
                                GetWindowText(hWnd, sb, 256);
                                string title = sb.ToString();
                                bool isIde = title.Contains("Antigravity") || title.Contains("Visual Studio") || title.Contains("Code") || title.Contains("UI-TARS-desktop-main");
                                bool isExactApp = title.Equals("UI-TARS", StringComparison.OrdinalIgnoreCase) || title.Equals("ORBIT", StringComparison.OrdinalIgnoreCase);
                                if (!string.IsNullOrEmpty(title) && (!isExactApp || isIde)) {
                                    ShowWindowAsync(hWnd, 6 /* SW_MINIMIZE */);
                                }
                                return true;
                            }, IntPtr.Zero);
                            CloseDesktop(hDesk);
                        }
                    } catch {}
                    Console.WriteLine("OK");
                }
                else if (cmd == "paste_b64") {
                    byte[] bytes = Convert.FromBase64String(rest.Trim());
                    string text = Encoding.UTF8.GetString(bytes).Replace("\r\n", "\n").Replace("\r", "\n").Replace("\n", "\r\n");
                    SetClipboardText(text);
                    Thread.Sleep(30);
                    INPUT[] ctrlV = new INPUT[4];
                    ctrlV[0] = new INPUT { type = INPUT_KEYBOARD, wVk = 0x11, dwFlags = 0 };
                    ctrlV[1] = new INPUT { type = INPUT_KEYBOARD, wVk = 0x56, dwFlags = 0 };
                    ctrlV[2] = new INPUT { type = INPUT_KEYBOARD, wVk = 0x56, dwFlags = KEYEVENTF_KEYUP };
                    ctrlV[3] = new INPUT { type = INPUT_KEYBOARD, wVk = 0x11, dwFlags = KEYEVENTF_KEYUP };
                    SendInput(4, ctrlV, Marshal.SizeOf(typeof(INPUT)));
                    Console.WriteLine("OK");
                }
                else if (cmd == "type_b64") {
                    byte[] bytes = Convert.FromBase64String(rest.Trim());
                    string text = Encoding.UTF8.GetString(bytes);
                    foreach (char c in text) {
                        if (c == '\r') continue;
                        if (c == '\n') {
                            Thread.Sleep(15);
                            keybd_event(0x0D, 0x1C, 0, UIntPtr.Zero);
                            Thread.Sleep(35);
                            keybd_event(0x0D, 0x1C, KEYEVENTF_KEYUP, UIntPtr.Zero);
                            Thread.Sleep(25);
                            continue;
                        }
                        if (c == '\t') {
                            keybd_event(0x09, 0x0F, 0, UIntPtr.Zero);
                            Thread.Sleep(20);
                            keybd_event(0x09, 0x0F, KEYEVENTF_KEYUP, UIntPtr.Zero);
                            Thread.Sleep(20);
                            continue;
                        }
                        short vkResult = VkKeyScan(c);
                        if (vkResult != -1) {
                            byte vk = (byte)(vkResult & 0xFF);
                            byte scan = (byte)MapVirtualKey(vk, 0);
                            byte shiftState = (byte)((vkResult >> 8) & 0xFF);
                            bool needShift = (shiftState & 1) != 0;
                            bool needCtrl = (shiftState & 2) != 0;
                            bool needAlt = (shiftState & 4) != 0;

                            if (needShift) { keybd_event(0x10, 0x2A, 0, UIntPtr.Zero); Thread.Sleep(8); }
                            if (needCtrl) { keybd_event(0x11, 0x1D, 0, UIntPtr.Zero); Thread.Sleep(8); }
                            if (needAlt) { keybd_event(0x12, 0x38, 0, UIntPtr.Zero); Thread.Sleep(8); }

                            keybd_event(vk, scan, 0, UIntPtr.Zero);
                            Thread.Sleep(15);
                            keybd_event(vk, scan, KEYEVENTF_KEYUP, UIntPtr.Zero);

                            if (needAlt) { Thread.Sleep(8); keybd_event(0x12, 0x38, KEYEVENTF_KEYUP, UIntPtr.Zero); }
                            if (needCtrl) { Thread.Sleep(8); keybd_event(0x11, 0x1D, KEYEVENTF_KEYUP, UIntPtr.Zero); }
                            if (needShift) { Thread.Sleep(8); keybd_event(0x10, 0x2A, KEYEVENTF_KEYUP, UIntPtr.Zero); }
                        } else {
                            INPUT[] inp = new INPUT[2];
                            inp[0].type = INPUT_KEYBOARD;
                            inp[0].wScan = (ushort)c;
                            inp[0].dwFlags = KEYEVENTF_UNICODE;

                            inp[1].type = INPUT_KEYBOARD;
                            inp[1].wScan = (ushort)c;
                            inp[1].dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

                            SendInput(2, inp, Marshal.SizeOf(typeof(INPUT)));
                        }
                        Thread.Sleep(12);
                    }
                    Console.WriteLine("OK");
                }
                else if (cmd == "type") {
                    string text = rest.Replace("\\\\", "\\").Replace("\\t", "\t");
                    bool pressEnterAtEnd = false;
                    if (text.EndsWith("\\n")) {
                        text = text.Substring(0, text.Length - 2);
                        pressEnterAtEnd = true;
                    } else if (text.EndsWith("\n")) {
                        text = text.Substring(0, text.Length - 1);
                        pressEnterAtEnd = true;
                    }

                    foreach (char c in text) {
                        if (c == '\t') {
                            INPUT[] tabInp = new INPUT[2];
                            tabInp[0].type = INPUT_KEYBOARD;
                            tabInp[0].wVk = 0x09;
                            tabInp[1].type = INPUT_KEYBOARD;
                            tabInp[1].wVk = 0x09;
                            tabInp[1].dwFlags = KEYEVENTF_KEYUP;
                            SendInput(2, tabInp, Marshal.SizeOf(typeof(INPUT)));
                            Thread.Sleep(8);
                            continue;
                        }

                        INPUT[] inp = new INPUT[2];
                        inp[0].type = INPUT_KEYBOARD;
                        inp[0].wScan = (ushort)c;
                        inp[0].dwFlags = KEYEVENTF_UNICODE;

                        inp[1].type = INPUT_KEYBOARD;
                        inp[1].wScan = (ushort)c;
                        inp[1].dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

                        SendInput(2, inp, Marshal.SizeOf(typeof(INPUT)));
                        Thread.Sleep(4);
                    }

                    if (pressEnterAtEnd) {
                        Thread.Sleep(50);
                        keybd_event(0x0D, 0x1C, 0, UIntPtr.Zero);
                        Thread.Sleep(30);
                        keybd_event(0x0D, 0x1C, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    }
                    Console.WriteLine("OK");
                }
                else if (cmd == "clipboard" || cmd == "paste") {
                    string text = rest.Replace("\\\\", "\\").Replace("\\t", "\t").Replace("\\n", "\r\n").Replace("\n", "\r\n");
                    bool pressEnterAtEnd = text.EndsWith("\r\n");
                    if (pressEnterAtEnd) {
                        text = text.Substring(0, text.Length - 2);
                    }
                    SetClipboardText(text);
                    if (cmd == "paste") {
                        Thread.Sleep(30);
                        INPUT[] ctrlV = new INPUT[4];
                        ctrlV[0] = new INPUT { type = INPUT_KEYBOARD, wVk = 0x11, dwFlags = 0 };
                        ctrlV[1] = new INPUT { type = INPUT_KEYBOARD, wVk = 0x56, dwFlags = 0 };
                        ctrlV[2] = new INPUT { type = INPUT_KEYBOARD, wVk = 0x56, dwFlags = KEYEVENTF_KEYUP };
                        ctrlV[3] = new INPUT { type = INPUT_KEYBOARD, wVk = 0x11, dwFlags = KEYEVENTF_KEYUP };
                        SendInput(4, ctrlV, Marshal.SizeOf(typeof(INPUT)));
                        if (pressEnterAtEnd) {
                            Thread.Sleep(50);
                            keybd_event(0x0D, 0x1C, 0, UIntPtr.Zero);
                            Thread.Sleep(30);
                            keybd_event(0x0D, 0x1C, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        }
                    }
                    Console.WriteLine("OK");
                }
                else if (cmd == "screenshot") {
                    string targetPath = rest.Trim().Trim('"');
                    int w = GetSystemMetrics(0); // SM_CXSCREEN
                    int h = GetSystemMetrics(1); // SM_CYSCREEN

                    var tokens = rest.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    if (tokens.Length >= 3) {
                        int parsedW, parsedH;
                        if (int.TryParse(tokens[0], out parsedW) && int.TryParse(tokens[1], out parsedH)) {
                            w = parsedW;
                            h = parsedH;
                            int prefixLen = tokens[0].Length + 1 + tokens[1].Length + 1;
                            targetPath = rest.Substring(prefixLen).Trim().Trim('"');
                        }
                    }

                    string dir = Path.GetDirectoryName(targetPath);
                    if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir)) {
                        Directory.CreateDirectory(dir);
                    }

                    IntPtr hInputDesk = OpenInputDesktop(0, false, 0x01FF);
                    if (hInputDesk != IntPtr.Zero) {
                        SetThreadDesktop(hInputDesk);
                    }

                    IntPtr hdcSrc = GetDC(IntPtr.Zero);
                    IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
                    IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, w, h);
                    IntPtr hOld = SelectObject(hdcDest, hBitmap);

                    bool success = BitBlt(hdcDest, 0, 0, w, h, hdcSrc, 0, 0, SRCCOPY);

                    SelectObject(hdcDest, hOld);
                    DeleteDC(hdcDest);
                    ReleaseDC(IntPtr.Zero, hdcSrc);
                    if (hInputDesk != IntPtr.Zero) CloseDesktop(hInputDesk);

                    if (success) {
                        using (Bitmap bmp = Image.FromHbitmap(hBitmap)) {
                            ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
                            EncoderParameters encParams = new EncoderParameters(1);
                            encParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 75L);
                            bmp.Save(targetPath, jpgEncoder, encParams);
                        }
                        DeleteObject(hBitmap);
                        Console.WriteLine("OK");
                    } else {
                        DeleteObject(hBitmap);
                        try {
                            using (Bitmap bmp = new Bitmap(w, h)) {
                                using (Graphics g = Graphics.FromImage(bmp)) {
                                    g.CopyFromScreen(0, 0, 0, 0, new System.Drawing.Size(w, h), CopyPixelOperation.SourceCopy);
                                }
                                ImageCodecInfo jpgEncoder = GetEncoder(ImageFormat.Jpeg);
                                EncoderParameters encParams = new EncoderParameters(1);
                                encParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 75L);
                                bmp.Save(targetPath, jpgEncoder, encParams);
                            }
                            Console.WriteLine("OK");
                        } catch (Exception ex) {
                            Console.WriteLine("ERR: " + ex.Message);
                        }
                    }
                }
                else if (cmd == "minimize_all") {
                    try {
                        IntPtr hInputDesk = OpenInputDesktop(0, false, 0x01FF);
                        EnumWindowsProc minimizeProc = delegate(IntPtr hWnd, IntPtr lParam) {
                            if (!IsWindowVisible(hWnd)) return true;
                            StringBuilder sb = new StringBuilder(256);
                            GetWindowText(hWnd, sb, 256);
                            string title = sb.ToString().Trim();
                            if (string.IsNullOrEmpty(title)) return true;

                            StringBuilder classSb = new StringBuilder(256);
                            GetClassName(hWnd, classSb, 256);
                            string className = classSb.ToString();
                            if (className == "Progman" || className == "WorkerW" || className == "Shell_TrayWnd" || className == "Shell_SecondaryTrayWnd") {
                                return true;
                            }

                            // Keep target apps visible (Notepad, Calculator) and UI-TARS app itself
                            bool isTarget = title.Equals("UI-TARS", StringComparison.OrdinalIgnoreCase) ||
                                            title.Equals("ORBIT", StringComparison.OrdinalIgnoreCase) ||
                                            title.Contains("Notepad") ||
                                            title.Contains("Calculator");
                            if (isTarget) return true;

                            ShowWindowAsync(hWnd, 6); // SW_MINIMIZE
                            return true;
                        };
                        EnumDesktopWindows(hInputDesk != IntPtr.Zero ? hInputDesk : IntPtr.Zero, minimizeProc, IntPtr.Zero);
                        if (hInputDesk != IntPtr.Zero) CloseDesktop(hInputDesk);
                    } catch {}
                    Console.WriteLine("OK");
                }
                else {
                    Console.WriteLine("UNKNOWN_CMD");
                }
            } catch (Exception ex) {
                ReleaseModifiers();
                Console.WriteLine("ERR: " + ex.Message);
            }
        }
    }
}
