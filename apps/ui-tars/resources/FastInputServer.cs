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
    public static extern bool GetCursorPos(out POINT lpPoint);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern short VkKeyScan(char ch);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    private static IntPtr _hPersistentDesk = IntPtr.Zero;

    public static void EnsureDesktopAttached() {
        try {
            if (_hPersistentDesk == IntPtr.Zero) {
                _hPersistentDesk = OpenInputDesktop(0, false, 0x01FF);
                if (_hPersistentDesk == IntPtr.Zero) {
                    _hPersistentDesk = OpenDesktop("default", 0, false, 0x01FF);
                }
            }
            if (_hPersistentDesk != IntPtr.Zero) {
                SetThreadDesktop(_hPersistentDesk);
            }
        } catch {}
    }

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

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_SHOWWINDOW = 0x0040;

    [DllImport("user32.dll", ExactSpelling = true)]
    public static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);
    const uint GA_ROOT = 2;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr WindowFromPoint(System.Drawing.Point p);

    [DllImport("oleacc.dll")]
    public static extern int AccessibleObjectFromWindow(
        IntPtr hwnd,
        uint dwId,
        ref Guid riid,
        [MarshalAs(UnmanagedType.IUnknown)] out object ppvObject);

    static readonly Guid IID_IAccessible = new Guid("{618736E0-3C3D-11CF-810C-00AA00389B71}");
    const uint OBJID_CLIENT = 0xFFFFFFFC;

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

    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit, Size = 40)]
    public struct INPUT {
        [FieldOffset(0)] public uint type;
        [FieldOffset(8)] public ushort wVk;
        [FieldOffset(10)] public ushort wScan;
        [FieldOffset(12)] public uint dwFlags;
        [FieldOffset(16)] public uint time;
        [FieldOffset(24)] public IntPtr dwExtraInfo;
        [FieldOffset(8)] public MOUSEINPUT mi;
    }

    const uint INPUT_MOUSE = 0;
    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_UNICODE = 0x0004;

    const uint MOUSEEVENTF_MOVE = 0x0001;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    const uint MOUSEEVENTF_ABSOLUTE = 0x8000;

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
            try {
                IntPtr wnd = WindowFromPoint(new System.Drawing.Point(x, y));
                if (wnd != IntPtr.Zero) {
                    EnableChromiumAccessibility(wnd);
                }
            } catch {}

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
                        cType == ControlType.SplitButton ||
                        cType == ControlType.DataItem ||
                        cType == ControlType.HeaderItem ||
                        cType == ControlType.Custom) {
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
                                targetType == ControlType.SplitButton ||
                                targetType == ControlType.DataItem ||
                                targetType == ControlType.HeaderItem ||
                                targetType == ControlType.Custom);

            string cleanHint = !string.IsNullOrEmpty(hint) ? hint.Trim().ToLowerInvariant().Replace("_", " ") : "";
            string normHint = cleanHint.Replace(" ", "").Replace("\"", "");

            // Case A: The element directly under the cursor is a clickable control
            if (isClickable) {
                System.Windows.Rect rect = target.Current.BoundingRectangle;
                // Only snap to center if it is a small interactive control (button, checkbox, icon)
                // NEVER center large container panels (which can be 1000px wide)
                if (!rect.IsEmpty && rect.Width > 4 && rect.Height > 4 && rect.Width <= 350 && rect.Height <= 120) {
                    string targetName = target.Current.Name != null ? target.Current.Name.ToLowerInvariant() : "";
                    string normTargetName = targetName.Replace(" ", "").Replace("\"", "");

                    bool hintMatched = (!string.IsNullOrEmpty(cleanHint) &&
                                       (targetName.Contains(cleanHint) || normTargetName.Contains(normHint)));

                    int cX = (int)Math.Round(rect.X + rect.Width / 2.0);
                    int cY = (int)Math.Round(rect.Y + rect.Height / 2.0);
                    double distToCenter = Math.Sqrt(Math.Pow(cX - x, 2) + Math.Pow(cY - y, 2));

                    // Micro-snap: only snap if center is within 35 physical pixels
                    if (distToCenter <= 35.0) {
                        if (string.IsNullOrEmpty(cleanHint) || hintMatched) {
                            outX = cX;
                            outY = cY;
                            return true;
                        }
                    }

                    // If a specific hint was provided, only check immediate siblings within 35 physical pixels
                    if (!string.IsNullOrEmpty(cleanHint)) {
                        AutomationElement parent = TreeWalker.ControlViewWalker.GetParent(target);
                        if (parent != null) {
                            AutomationElementCollection siblings = parent.FindAll(TreeScope.Children, Condition.TrueCondition);
                            double bestDist = 35.0; // Strictly capped at 35px
                            AutomationElement bestEl = null;
                            foreach (AutomationElement sibling in siblings) {
                                try {
                                    string sName = sibling.Current.Name != null ? sibling.Current.Name.ToLowerInvariant() : "";
                                    string normSName = sName.Replace(" ", "").Replace("\"", "");
                                    if (sName.Contains(cleanHint) || normSName.Contains(normHint)) {
                                        System.Windows.Rect sRect = sibling.Current.BoundingRectangle;
                                        if (!sRect.IsEmpty && sRect.Width > 4 && sRect.Height > 4 && sRect.Width <= 350 && sRect.Height <= 120) {
                                            int sibX = (int)Math.Round(sRect.X + sRect.Width / 2.0);
                                            int sibY = (int)Math.Round(sRect.Y + sRect.Height / 2.0);
                                            double d = Math.Sqrt(Math.Pow(sibX - x, 2) + Math.Pow(sibY - y, 2));
                                            if (d <= bestDist) {
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

                        // When hint was specified but not matched within 35px, DO NOT snap to anything else
                        return false;
                    }

                    // If no hint was provided and cursor is within 35px of center, snap
                    if (distToCenter <= 35.0) {
                        outX = cX;
                        outY = cY;
                        return true;
                    }
                }
            }

            // Case B: Point hit margin / empty space in a container (not a clickable control itself)
            // Only search immediate children strictly within 30 physical pixels
            try {
                AutomationElementCollection children = target.FindAll(TreeScope.Children, Condition.TrueCondition);
                double bestDist = 30.0;
                AutomationElement bestChild = null;

                foreach (AutomationElement child in children) {
                    try {
                        ControlType ct = child.Current.ControlType;
                        bool childClickable = (ct == ControlType.Button || ct == ControlType.MenuItem || ct == ControlType.ListItem ||
                                               ct == ControlType.Hyperlink || ct == ControlType.Edit || ct == ControlType.TabItem ||
                                               ct == ControlType.CheckBox || ct == ControlType.RadioButton || ct == ControlType.ComboBox ||
                                               ct == ControlType.DataItem || ct == ControlType.HeaderItem || ct == ControlType.Custom);
                        if (!childClickable) continue;

                        System.Windows.Rect cRect = child.Current.BoundingRectangle;
                        if (!cRect.IsEmpty && cRect.Width > 4 && cRect.Height > 4 && cRect.Width <= 350 && cRect.Height <= 120) {
                            string cName = child.Current.Name != null ? child.Current.Name.ToLowerInvariant() : "";
                            string normCName = cName.Replace(" ", "").Replace("\"", "");

                            bool matches = string.IsNullOrEmpty(cleanHint) ||
                                           (cName.Contains(cleanHint) || normCName.Contains(normHint));
                            if (matches) {
                                int cX = (int)Math.Round(cRect.X + cRect.Width / 2.0);
                                int cY = (int)Math.Round(cRect.Y + cRect.Height / 2.0);
                                double d = Math.Sqrt(Math.Pow(cX - x, 2) + Math.Pow(cY - y, 2));
                                if (d <= bestDist) {
                                    bestDist = d;
                                    bestChild = child;
                                }
                            }
                        }
                    } catch {}
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

    public static void EnableChromiumAccessibility(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return;
        try {
            StringBuilder sb = new StringBuilder(256);
            GetClassName(hWnd, sb, 256);
            string cls = sb.ToString();
            bool isChromium = cls.Contains("Chrome_WidgetWin_1") || cls.Contains("Chrome_RenderWidgetHostHWND") || cls.Contains("Brave") || cls.Contains("Edge");
            if (!isChromium) {
                bool hasChromiumChild = false;
                EnumChildWindows(hWnd, (child, lp) => {
                    StringBuilder csb = new StringBuilder(256);
                    GetClassName(child, csb, 256);
                    if (csb.ToString().Contains("Chrome_RenderWidgetHostHWND")) {
                        hasChromiumChild = true;
                        return false;
                    }
                    return true;
                }, IntPtr.Zero);
                if (!hasChromiumChild) return;
            }

            SendMessage(hWnd, 0x003D /* WM_GETOBJECT */, IntPtr.Zero, (IntPtr)(-4) /* OBJID_CLIENT */);
            try {
                Guid iid = IID_IAccessible;
                object acc;
                AccessibleObjectFromWindow(hWnd, OBJID_CLIENT, ref iid, out acc);
            } catch {}

            EnumChildWindows(hWnd, (childHwnd, lParam) => {
                try {
                    StringBuilder csb = new StringBuilder(256);
                    GetClassName(childHwnd, csb, 256);
                    string ccls = csb.ToString();
                    if (ccls.Contains("Chrome_RenderWidgetHostHWND") || ccls.Contains("Intermediate D3D Window")) {
                        SendMessage(childHwnd, 0x003D, IntPtr.Zero, (IntPtr)(-4));
                        Guid ciid = IID_IAccessible;
                        object cacc;
                        AccessibleObjectFromWindow(childHwnd, OBJID_CLIENT, ref ciid, out cacc);
                    }
                } catch {}
                return true;
            }, IntPtr.Zero);
        } catch {}
    }

    public static void MaximizeWindow(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return;
        try {
            ShowWindowAsync(hWnd, 3 /* SW_MAXIMIZE */);
            ShowWindow(hWnd, 3 /* SW_MAXIMIZE */);
            SendMessage(hWnd, 0x0112 /* WM_SYSCOMMAND */, (IntPtr)0xF030 /* SC_MAXIMIZE */, IntPtr.Zero);
            EnableChromiumAccessibility(hWnd);
        } catch {}
    }

    public static void EnsureWindowFocused(int x, int y) {
        try {
            IntPtr wnd = WindowFromPoint(new System.Drawing.Point(x, y));
            if (wnd == IntPtr.Zero) return;
            IntPtr rootWnd = GetAncestor(wnd, GA_ROOT);
            if (rootWnd == IntPtr.Zero) rootWnd = wnd;

            IntPtr fg = GetForegroundWindow();
            if (fg != rootWnd) {
                uint curThread = GetCurrentThreadId();
                uint dummyProc;
                uint targetThread = GetWindowThreadProcessId(rootWnd, out dummyProc);

                if (curThread != targetThread && targetThread != 0) {
                    AttachThreadInput(curThread, targetThread, true);
                }

                BringWindowToTop(rootWnd);
                SetForegroundWindow(rootWnd);

                if (curThread != targetThread && targetThread != 0) {
                    AttachThreadInput(curThread, targetThread, false);
                }
                Thread.Sleep(10);
            }
        } catch {}
    }

    public static void DoHardwareClick(int x, int y) {
        EnsureDesktopAttached();
        try { EnsureWindowFocused(x, y); } catch {}
        int screenW = Math.Max(1, GetSystemMetrics(0));
        int screenH = Math.Max(1, GetSystemMetrics(1));
        int normX = (int)Math.Round((x * 65535.0) / (screenW - 1));
        int normY = (int)Math.Round((y * 65535.0) / (screenH - 1));

        SetCursorPos(x, y);

        INPUT[] moveInputs = new INPUT[1];
        moveInputs[0].type = INPUT_MOUSE;
        moveInputs[0].mi.dx = normX;
        moveInputs[0].mi.dy = normY;
        moveInputs[0].mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, moveInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(20);

        INPUT[] downInputs = new INPUT[1];
        downInputs[0].type = INPUT_MOUSE;
        downInputs[0].mi.dx = normX;
        downInputs[0].mi.dy = normY;
        downInputs[0].mi.dwFlags = MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, downInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(45);

        INPUT[] upInputs = new INPUT[1];
        upInputs[0].type = INPUT_MOUSE;
        upInputs[0].mi.dx = normX;
        upInputs[0].mi.dy = normY;
        upInputs[0].mi.dwFlags = MOUSEEVENTF_LEFTUP | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, upInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(20);
    }

    public static void DoHardwareRightClick(int x, int y) {
        EnsureDesktopAttached();
        try { EnsureWindowFocused(x, y); } catch {}
        int screenW = Math.Max(1, GetSystemMetrics(0));
        int screenH = Math.Max(1, GetSystemMetrics(1));
        int normX = (int)Math.Round((x * 65535.0) / (screenW - 1));
        int normY = (int)Math.Round((y * 65535.0) / (screenH - 1));

        SetCursorPos(x, y);

        INPUT[] moveInputs = new INPUT[1];
        moveInputs[0].type = INPUT_MOUSE;
        moveInputs[0].mi.dx = normX;
        moveInputs[0].mi.dy = normY;
        moveInputs[0].mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, moveInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(20);

        INPUT[] downInputs = new INPUT[1];
        downInputs[0].type = INPUT_MOUSE;
        downInputs[0].mi.dx = normX;
        downInputs[0].mi.dy = normY;
        downInputs[0].mi.dwFlags = MOUSEEVENTF_RIGHTDOWN | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, downInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(45);

        INPUT[] upInputs = new INPUT[1];
        upInputs[0].type = INPUT_MOUSE;
        upInputs[0].mi.dx = normX;
        upInputs[0].mi.dy = normY;
        upInputs[0].mi.dwFlags = MOUSEEVENTF_RIGHTUP | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, upInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(20);
    }

    public static void DoHardwareDrag(int x1, int y1, int x2, int y2) {
        EnsureDesktopAttached();
        try { EnsureWindowFocused(x1, y1); } catch {}
        int screenW = Math.Max(1, GetSystemMetrics(0));
        int screenH = Math.Max(1, GetSystemMetrics(1));

        SetCursorPos(x1, y1);
        int normX1 = (int)Math.Round((x1 * 65535.0) / (screenW - 1));
        int normY1 = (int)Math.Round((y1 * 65535.0) / (screenH - 1));

        INPUT[] moveInputs = new INPUT[1];
        moveInputs[0].type = INPUT_MOUSE;
        moveInputs[0].mi.dx = normX1;
        moveInputs[0].mi.dy = normY1;
        moveInputs[0].mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, moveInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(30);

        INPUT[] downInputs = new INPUT[1];
        downInputs[0].type = INPUT_MOUSE;
        downInputs[0].mi.dx = normX1;
        downInputs[0].mi.dy = normY1;
        downInputs[0].mi.dwFlags = MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, downInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(60);

        int dist = (int)Math.Sqrt((x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1));
        int steps = Math.Max(35, dist / 5);
        for (int i = 1; i <= steps; i++) {
            int curX = x1 + (x2 - x1) * i / steps;
            int curY = y1 + (y2 - y1) * i / steps;
            int curNormX = (int)Math.Round((curX * 65535.0) / (screenW - 1));
            int curNormY = (int)Math.Round((curY * 65535.0) / (screenH - 1));

            SetCursorPos(curX, curY);
            INPUT[] stepMove = new INPUT[1];
            stepMove[0].type = INPUT_MOUSE;
            stepMove[0].mi.dx = curNormX;
            stepMove[0].mi.dy = curNormY;
            stepMove[0].mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE;
            SendInput(1, stepMove, Marshal.SizeOf(typeof(INPUT)));
            Thread.Sleep(6);
        }

        int normX2 = (int)Math.Round((x2 * 65535.0) / (screenW - 1));
        int normY2 = (int)Math.Round((y2 * 65535.0) / (screenH - 1));
        SetCursorPos(x2, y2);
        Thread.Sleep(50);

        INPUT[] upInputs = new INPUT[1];
        upInputs[0].type = INPUT_MOUSE;
        upInputs[0].mi.dx = normX2;
        upInputs[0].mi.dy = normY2;
        upInputs[0].mi.dwFlags = MOUSEEVENTF_LEFTUP | MOUSEEVENTF_ABSOLUTE;
        SendInput(1, upInputs, Marshal.SizeOf(typeof(INPUT)));
        Thread.Sleep(30);
    }

    public static AutomationElement GetActiveWindowAutomationElement(out IntPtr activeHwnd, out string title, out string processName, out RECT rect) {
        activeHwnd = IntPtr.Zero;
        title = "";
        processName = "";
        rect = new RECT();

        try {
            activeHwnd = GetForegroundWindow();
            if (activeHwnd == IntPtr.Zero) return null;

            IntPtr rootWnd = GetAncestor(activeHwnd, GA_ROOT);
            if (rootWnd != IntPtr.Zero) {
                activeHwnd = rootWnd;
            }

            StringBuilder sb = new StringBuilder(512);
            GetWindowText(activeHwnd, sb, 512);
            title = sb.ToString();

            uint pid = 0;
            GetWindowThreadProcessId(activeHwnd, out pid);
            if (pid != 0) {
                try {
                    using (var proc = Process.GetProcessById((int)pid)) {
                        processName = proc.ProcessName;
                    }
                } catch {}
            }

            GetWindowRect(activeHwnd, out rect);

            if (IsIconic(activeHwnd)) {
                ShowWindow(activeHwnd, 9 /* SW_RESTORE */);
                Thread.Sleep(30);
            }

            return AutomationElement.FromHandle(activeHwnd);
        } catch {
            return null;
        }
    }

    public static AutomationElement GetWindowAutomationElementByFilter(string filter, out IntPtr targetHwnd, out string title, out string processName, out RECT rect) {
        targetHwnd = IntPtr.Zero;
        title = "";
        processName = "";
        rect = new RECT();

        if (string.IsNullOrEmpty(filter)) {
            return GetActiveWindowAutomationElement(out targetHwnd, out title, out processName, out rect);
        }

        string cleanFilter = filter.Trim().ToLowerInvariant();
        IntPtr foundHwnd = IntPtr.Zero;
        string foundTitle = "";
        string foundProc = "";

        EnsureDesktopAttached();
        IntPtr targetDesk = _hPersistentDesk != IntPtr.Zero ? _hPersistentDesk : IntPtr.Zero;

        EnumDesktopWindows(targetDesk, (hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;

            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hWnd, sb, 512);
            string t = sb.ToString();
            if (string.IsNullOrEmpty(t)) return true;

            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            string p = "";
            if (pid != 0) {
                try {
                    using (var proc = Process.GetProcessById((int)pid)) {
                        p = proc.ProcessName;
                    }
                } catch {}
            }

            bool matches = t.ToLowerInvariant().Contains(cleanFilter) || 
                           p.ToLowerInvariant().Contains(cleanFilter) ||
                           p.ToLowerInvariant().Replace(".exe", "").Contains(cleanFilter);

            if (matches) {
                foundHwnd = hWnd;
                foundTitle = t;
                foundProc = p;
                return false;
            }
            return true;
        }, IntPtr.Zero);

        if (foundHwnd != IntPtr.Zero) {
            targetHwnd = foundHwnd;
            title = foundTitle;
            processName = foundProc;
            GetWindowRect(targetHwnd, out rect);

            if (IsIconic(targetHwnd)) {
                ShowWindow(targetHwnd, 9 /* SW_RESTORE */);
                Thread.Sleep(30);
            }

            SwitchToThisWindow(targetHwnd, true);
            BringWindowToTop(targetHwnd);
            SetForegroundWindow(targetHwnd);
            Thread.Sleep(20);

            try {
                return AutomationElement.FromHandle(targetHwnd);
            } catch {}
        }

        return GetActiveWindowAutomationElement(out targetHwnd, out title, out processName, out rect);
    }

    public static ControlType ParseControlType(string typeStr) {
        if (string.IsNullOrEmpty(typeStr)) return null;
        string t = typeStr.Trim().ToLowerInvariant();
        if (t == "button" || t == "btn") return ControlType.Button;
        if (t == "edit" || t == "input" || t == "textbox" || t == "text") return ControlType.Edit;
        if (t == "menuitem" || t == "menu") return ControlType.MenuItem;
        if (t == "checkbox" || t == "check") return ControlType.CheckBox;
        if (t == "radiobutton" || t == "radio") return ControlType.RadioButton;
        if (t == "combobox" || t == "combo" || t == "select") return ControlType.ComboBox;
        if (t == "tabitem" || t == "tab") return ControlType.TabItem;
        if (t == "hyperlink" || t == "link") return ControlType.Hyperlink;
        if (t == "listitem" || t == "list") return ControlType.ListItem;
        if (t == "treeitem" || t == "tree") return ControlType.TreeItem;
        if (t == "document" || t == "doc") return ControlType.Document;
        if (t == "splitbutton") return ControlType.SplitButton;
        if (t == "headeritem" || t == "header") return ControlType.HeaderItem;
        if (t == "dataitem") return ControlType.DataItem;
        if (t == "custom") return ControlType.Custom;
        if (t == "pane") return ControlType.Pane;
        if (t == "window") return ControlType.Window;
        return null;
    }

    public static string NormalizeString(string s) {
        if (string.IsNullOrEmpty(s)) return "";
        s = s.Replace("&", "");
        var sb = new StringBuilder(s.Length);
        foreach (char c in s) {
            if (char.IsLetterOrDigit(c)) {
                sb.Append(char.ToLowerInvariant(c));
            }
        }
        return sb.ToString();
    }

    public class FoundElementResult {
        public AutomationElement Element;
        public System.Windows.Rect Rect;
        public string Name;
        public string AutomationId;
        public string ControlType;
        public int CenterX;
        public int CenterY;
    }

    public static FoundElementResult FindElementInWindow(AutomationElement windowRoot, string nameQuery, string controlTypeFilter) {
        if (windowRoot == null || string.IsNullOrEmpty(nameQuery)) return null;

        string cleanQuery = nameQuery.Trim().ToLowerInvariant();
        string normQuery = NormalizeString(nameQuery);
        ControlType targetCt = ParseControlType(controlTypeFilter);

        Condition searchCondition = Condition.TrueCondition;
        if (targetCt != null) {
            searchCondition = new PropertyCondition(AutomationElement.ControlTypeProperty, targetCt);
        }

        AutomationElementCollection elements = null;
        try {
            elements = windowRoot.FindAll(TreeScope.Descendants, searchCondition);
        } catch {
            return null;
        }

        if (elements == null || elements.Count == 0) return null;

        FoundElementResult bestResult = null;
        int bestScore = -1;

        foreach (AutomationElement el in elements) {
            try {
                bool isOffscreen = false;
                try { isOffscreen = el.Current.IsOffscreen; } catch {}
                if (isOffscreen) continue;

                System.Windows.Rect r = System.Windows.Rect.Empty;
                try { r = el.Current.BoundingRectangle; } catch {}
                if (r.IsEmpty || r.Width <= 0 || r.Height <= 0) continue;

                string elName = "";
                string elId = "";
                string elType = "";
                try { elName = el.Current.Name ?? ""; } catch {}
                try { elId = el.Current.AutomationId ?? ""; } catch {}
                try { elType = el.Current.ControlType != null ? el.Current.ControlType.ProgrammaticName.Replace("ControlType.", "") : ""; } catch {}

                string lowerName = elName.ToLowerInvariant();
                string lowerId = elId.ToLowerInvariant();
                string normName = NormalizeString(elName);
                string normId = NormalizeString(elId);

                int score = -1;

                if (!string.IsNullOrEmpty(elId)) {
                    if (lowerId == cleanQuery) score = 1000;
                    else if (normId == normQuery) score = 950;
                    else if (lowerId.Contains(cleanQuery)) score = 600;
                }

                if (score < 900 && !string.IsNullOrEmpty(elName)) {
                    if (lowerName == cleanQuery) score = Math.Max(score, 900);
                    else if (normName == normQuery) score = Math.Max(score, 850);
                    else if (lowerName.StartsWith(cleanQuery)) score = Math.Max(score, 700);
                    else if (lowerName.Contains(cleanQuery)) score = Math.Max(score, 500);
                    else if (normName.Contains(normQuery)) score = Math.Max(score, 450);
                }

                if (score > 0) {
                    if (targetCt != null) {
                        try {
                            if (el.Current.ControlType == targetCt) score += 100;
                        } catch {}
                    }

                    if (r.Width > 0 && r.Height > 0 && r.Width < 800 && r.Height < 400) {
                        score += 20;
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestResult = new FoundElementResult {
                            Element = el,
                            Rect = r,
                            Name = elName,
                            AutomationId = elId,
                            ControlType = elType,
                            CenterX = (int)Math.Round(r.X + r.Width / 2.0),
                            CenterY = (int)Math.Round(r.Y + r.Height / 2.0)
                        };

                        if (score >= 1000) {
                            break;
                        }
                    }
                }
            } catch {}
        }

        return bestResult;
    }

    public static bool SetElementText(AutomationElement el, string text, int fallbackCenterX, int fallbackCenterY) {
        if (el == null) return false;

        // Strategy 1: UIA ValuePattern (Instant direct injection, no clipboard or keyboard needed)
        try {
            object valPatternObj = null;
            if (el.TryGetCurrentPattern(ValuePattern.Pattern, out valPatternObj)) {
                ValuePattern valPattern = valPatternObj as ValuePattern;
                if (valPattern != null && !valPattern.Current.IsReadOnly) {
                    valPattern.SetValue(text);
                    return true;
                }
            }
        } catch {}

        // Strategy 2: Focus + Native Hardware Selection & Paste
        try {
            try { el.SetFocus(); } catch {}
            if (fallbackCenterX > 0 && fallbackCenterY > 0) {
                DoHardwareClick(fallbackCenterX, fallbackCenterY);
                Thread.Sleep(30);
            }

            // Select all existing text (Ctrl+A)
            keybd_event(0x11, 0, 0, UIntPtr.Zero);
            keybd_event(0x41, 0, 0, UIntPtr.Zero);
            Thread.Sleep(15);
            keybd_event(0x41, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(0x11, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(20);

            // Set clipboard and paste (Ctrl+V)
            SetClipboardText(text);
            Thread.Sleep(20);
            keybd_event(0x11, 0, 0, UIntPtr.Zero);
            keybd_event(0x56, 0, 0, UIntPtr.Zero);
            Thread.Sleep(25);
            keybd_event(0x56, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(0x11, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(25);
            return true;
        } catch {}

        return false;
    }

    public static string EscapeJson(string s) {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t");
    }

    public static void ListWindows() {
        EnsureDesktopAttached();
        IntPtr targetDesk = _hPersistentDesk != IntPtr.Zero ? _hPersistentDesk : IntPtr.Zero;
        var sbJson = new StringBuilder();
        sbJson.Append("WINDOW_LIST [");
        bool first = true;

        EnumDesktopWindows(targetDesk, (hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;

            StringBuilder sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, 256);
            string cls = sbClass.ToString();

            if (cls == "Shell_TrayWnd" || cls == "Progman" || cls == "WorkerW" || 
                cls == "Shell_SecondaryTrayWnd" || cls == "Windows.UI.Core.CoreWindow" || 
                cls == "EdgeUiInputWndClass") return true;

            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hWnd, sb, 512);
            string title = sb.ToString();
            if (string.IsNullOrEmpty(title)) return true;

            RECT r;
            GetWindowRect(hWnd, out r);
            int w = Math.Max(0, r.Right - r.Left);
            int h = Math.Max(0, r.Bottom - r.Top);
            if (w < 50 || h < 50) return true;

            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            string procName = "";
            if (pid != 0) {
                try {
                    using (var proc = Process.GetProcessById((int)pid)) {
                        procName = proc.ProcessName;
                    }
                } catch {}
            }

            string state = IsIconic(hWnd) ? "minimized" : (IsZoomed(hWnd) ? "maximized" : "normal");

            if (!first) sbJson.Append(",");
            first = false;

            sbJson.Append("{");
            sbJson.Append("\"hwnd\":" + hWnd.ToInt64() + ",");
            sbJson.Append("\"pid\":" + pid + ",");
            sbJson.Append("\"proc\":\"" + EscapeJson(procName) + "\",");
            sbJson.Append("\"state\":\"" + state + "\",");
            sbJson.Append("\"title\":\"" + EscapeJson(title) + "\",");
            sbJson.Append("\"x\":" + r.Left + ",");
            sbJson.Append("\"y\":" + r.Top + ",");
            sbJson.Append("\"width\":" + w + ",");
            sbJson.Append("\"height\":" + h);
            sbJson.Append("}");

            return true;
        }, IntPtr.Zero);

        sbJson.Append("]");
        Console.WriteLine(sbJson.ToString());
    }

    public static void PrintFocusedInfo() {
        IntPtr hwnd;
        string wTitle, wProc;
        RECT wRect;
        var el = GetActiveWindowAutomationElement(out hwnd, out wTitle, out wProc, out wRect);
        if (el == null || hwnd == IntPtr.Zero) {
            Console.WriteLine("ERROR no_active_window");
            return;
        }

        int w = Math.Max(0, wRect.Right - wRect.Left);
        int h = Math.Max(0, wRect.Bottom - wRect.Top);
        string state = IsIconic(hwnd) ? "minimized" : (IsZoomed(hwnd) ? "maximized" : "normal");

        string fName = "";
        string fType = "";
        string fId = "";
        try {
            AutomationElement focused = AutomationElement.FocusedElement;
            if (focused != null) {
                fName = focused.Current.Name ?? "";
                fId = focused.Current.AutomationId ?? "";
                fType = focused.Current.ControlType != null ? focused.Current.ControlType.ProgrammaticName.Replace("ControlType.", "") : "";
            }
        } catch {}

        var sb = new StringBuilder();
        sb.Append("FOCUSED_INFO {");
        sb.Append("\"hwnd\":" + hwnd.ToInt64() + ",");
        sb.Append("\"proc\":\"" + EscapeJson(wProc) + "\",");
        sb.Append("\"state\":\"" + state + "\",");
        sb.Append("\"title\":\"" + EscapeJson(wTitle) + "\",");
        sb.Append("\"x\":" + wRect.Left + ",");
        sb.Append("\"y\":" + wRect.Top + ",");
        sb.Append("\"width\":" + w + ",");
        sb.Append("\"height\":" + h + ",");
        sb.Append("\"focusedName\":\"" + EscapeJson(fName) + "\",");
        sb.Append("\"focusedType\":\"" + EscapeJson(fType) + "\",");
        sb.Append("\"focusedId\":\"" + EscapeJson(fId) + "\"");
        sb.Append("}");
        Console.WriteLine(sb.ToString());
    }

    public static void Main() {

        try {
            if (!SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {
                SetProcessDPIAware();
            }
        } catch {
            try { SetProcessDPIAware(); } catch {}
        }

        try {
            Console.OutputEncoding = Encoding.UTF8;
        } catch {}

        EnsureDesktopAttached();

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

                    if (!string.IsNullOrEmpty(hint)) {
                        int snapX, snapY;
                        if (SnapToElement(x, y, hint, out snapX, out snapY)) {
                            x = snapX;
                            y = snapY;
                        }
                    }

                    DoHardwareClick(x, y);
                    Console.WriteLine("OK");
                }
                else if (cmd == "doubleclick" || cmd == "double_click" || cmd == "left_double") {
                    var xyParts = rest.Trim().Split(new[] { ' ' }, 3);
                    int x = int.Parse(xyParts[0]);
                    int y = int.Parse(xyParts[1]);
                    string hint = xyParts.Length > 2 ? xyParts[2] : "";

                    if (!string.IsNullOrEmpty(hint)) {
                        int snapX, snapY;
                        if (SnapToElement(x, y, hint, out snapX, out snapY)) {
                            x = snapX;
                            y = snapY;
                        }
                    }

                    DoHardwareClick(x, y);
                    Thread.Sleep(50);
                    DoHardwareClick(x, y);
                    Console.WriteLine("OK");
                }
                else if (cmd == "rightclick" || cmd == "right_click" || cmd == "right_single") {
                    var xyParts = rest.Trim().Split(new[] { ' ' }, 3);
                    int x = int.Parse(xyParts[0]);
                    int y = int.Parse(xyParts[1]);
                    string hint = xyParts.Length > 2 ? xyParts[2] : "";

                    if (!string.IsNullOrEmpty(hint)) {
                        int snapX, snapY;
                        if (SnapToElement(x, y, hint, out snapX, out snapY)) {
                            x = snapX;
                            y = snapY;
                        }
                    }

                    DoHardwareRightClick(x, y);
                    Console.WriteLine("OK");
                }
                else if (cmd == "move" || cmd == "hover") {
                    var xy = rest.Trim().Split(' ');
                    int x = int.Parse(xy[0]);
                    int y = int.Parse(xy[1]);
                    SetCursorPos(x, y);
                    Console.WriteLine("OK");
                }
                else if (cmd == "getpos" || cmd == "get_pos") {
                    POINT pt;
                    GetCursorPos(out pt);
                    Console.WriteLine(string.Format("POS {0} {1}", pt.X, pt.Y));
                }
                else if (cmd == "drag") {
                    var xy = rest.Trim().Split(' ');
                    int x1 = int.Parse(xy[0]);
                    int y1 = int.Parse(xy[1]);
                    int x2 = int.Parse(xy[2]);
                    int y2 = int.Parse(xy[3]);
                    DoHardwareDrag(x1, y1, x2, y2);
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
                    if (cleanRest == "winup" || cleanRest == "superup") {
                        keybd_event(0x1B, 0x01, 0, UIntPtr.Zero);
                        Thread.Sleep(25);
                        keybd_event(0x1B, 0x01, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        Thread.Sleep(50);

                        IntPtr targetFg = IntPtr.Zero;
                        for (int i = 0; i < 20; i++) {
                            IntPtr fg = GetForegroundWindow();
                            if (fg != IntPtr.Zero) {
                                StringBuilder sbClass = new StringBuilder(256);
                                GetClassName(fg, sbClass, 256);
                                string cls = sbClass.ToString();
                                if (cls != "Shell_TrayWnd" && cls != "Progman" && cls != "WorkerW" && 
                                    cls != "Shell_SecondaryTrayWnd" && cls != "Windows.UI.Core.CoreWindow" &&
                                    !cls.Contains("StartMenu") && !cls.Contains("SearchHost")) {
                                    targetFg = fg;
                                    break;
                                }
                            }
                            Thread.Sleep(50);
                        }
                        if (targetFg != IntPtr.Zero) {
                            MaximizeWindow(targetFg);
                        }
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
                            bool isExtended = (vk == 0x5B || vk == 0x5C || 
                                               vk == 0x26 || vk == 0x28 || vk == 0x25 || vk == 0x27 || 
                                               vk == 0x24 || vk == 0x23 || vk == 0x21 || vk == 0x22 || 
                                               vk == 0x2D || vk == 0x2E || 
                                               vk == 0x90 || vk == 0x6F);
                            if (isExtended) flags |= KEYEVENTF_EXTENDEDKEY;

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

                    bool isWinUp = (keys.Length == 2 && 
                                   (keys[0].Equals("win", StringComparison.OrdinalIgnoreCase) || keys[0].Equals("super", StringComparison.OrdinalIgnoreCase)) && 
                                   keys[1].Equals("up", StringComparison.OrdinalIgnoreCase));
                    if (isWinUp) {
                        IntPtr fg = GetForegroundWindow();
                        if (fg != IntPtr.Zero) {
                            MaximizeWindow(fg);
                        }
                    }

                    Console.WriteLine("OK");
                }
                else if (cmd == "maximize" || cmd == "auto_maximize") {
                    IntPtr targetFg = IntPtr.Zero;
                    for (int i = 0; i < 25; i++) {
                        IntPtr fg = GetForegroundWindow();
                        if (fg != IntPtr.Zero) {
                            StringBuilder sbClass = new StringBuilder(256);
                            GetClassName(fg, sbClass, 256);
                            string cls = sbClass.ToString();
                            if (cls != "Shell_TrayWnd" && cls != "Progman" && cls != "WorkerW" && cls != "Shell_SecondaryTrayWnd" && cls != "Windows.UI.Core.CoreWindow") {
                                targetFg = fg;
                                break;
                            }
                        }
                        Thread.Sleep(80);
                    }
                    if (targetFg != IntPtr.Zero) {
                        MaximizeWindow(targetFg);
                    }
                    Console.WriteLine("OK");
                }
                else if (cmd == "get_active_window" || cmd == "active_window") {
                    IntPtr hwnd;
                    string wTitle, wProc;
                    RECT wRect;
                    var el = GetActiveWindowAutomationElement(out hwnd, out wTitle, out wProc, out wRect);
                    if (el != null && hwnd != IntPtr.Zero) {
                        int w = Math.Max(0, wRect.Right - wRect.Left);
                        int h = Math.Max(0, wRect.Bottom - wRect.Top);
                        string safeTitle = wTitle.Replace("\n", " ").Replace("\r", " ").Replace("\"", "");
                        Console.WriteLine("ACTIVE_WINDOW hwnd:" + hwnd.ToInt64() + " proc:" + wProc + " rect:" + wRect.Left + "," + wRect.Top + "," + w + "," + h + " title:\"" + safeTitle + "\"");
                    } else {
                        Console.WriteLine("ERROR no_active_window");
                    }
                }
                else if (cmd == "focus_window") {
                    IntPtr hwnd;
                    string wTitle, wProc;
                    RECT wRect;
                    var el = GetWindowAutomationElementByFilter(rest, out hwnd, out wTitle, out wProc, out wRect);
                    if (el != null && hwnd != IntPtr.Zero) {
                        int w = Math.Max(0, wRect.Right - wRect.Left);
                        int h = Math.Max(0, wRect.Bottom - wRect.Top);
                        string safeTitle = wTitle.Replace("\n", " ").Replace("\r", " ").Replace("\"", "");
                        Console.WriteLine("FOCUSED hwnd:" + hwnd.ToInt64() + " proc:" + wProc + " rect:" + wRect.Left + "," + wRect.Top + "," + w + "," + h + " title:\"" + safeTitle + "\"");
                    } else {
                        Console.WriteLine("ERROR window_not_found");
                    }
                }
                else if (cmd == "list_windows" || cmd == "windows" || cmd == "list_window") {
                    ListWindows();
                }
                else if (cmd == "get_focused_info" || cmd == "focused_info") {
                    PrintFocusedInfo();
                }
                else if (cmd == "find_element" || cmd == "find") {
                    string queryArgs = rest.Trim();
                    string windowFilter = "";
                    string nameQuery = "";
                    string ctFilter = "";

                    if (queryArgs.Contains("|")) {
                        var qParts = queryArgs.Split('|');
                        if (qParts.Length == 2) {
                            nameQuery = qParts[0].Trim();
                            ctFilter = qParts[1].Trim();
                        } else if (qParts.Length >= 3) {
                            windowFilter = qParts[0].Trim();
                            nameQuery = qParts[1].Trim();
                            ctFilter = qParts[2].Trim();
                        }
                    } else {
                        nameQuery = queryArgs;
                    }

                    IntPtr targetHwnd;
                    string winTitle, winProc;
                    RECT winRect;
                    var winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);

                    FoundElementResult found = null;
                    if (winElement != null) {
                        found = FindElementInWindow(winElement, nameQuery, ctFilter);
                    }

                    if (found == null) {
                        for (int attempt = 0; attempt < 2; attempt++) {
                            Thread.Sleep(35);
                            winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);
                            if (winElement != null) {
                                found = FindElementInWindow(winElement, nameQuery, ctFilter);
                                if (found != null) break;
                            }
                        }
                    }

                    if (winElement == null) {
                        Console.WriteLine("NOT_FOUND error:\"no_active_window\"");
                    } else if (found != null) {
                        int x = (int)Math.Round(found.Rect.X);
                        int y = (int)Math.Round(found.Rect.Y);
                        int w = (int)Math.Round(found.Rect.Width);
                        int h = (int)Math.Round(found.Rect.Height);
                        string safeName = found.Name.Replace("\"", "'").Replace("\n", " ").Replace("\r", " ");
                        string safeId = found.AutomationId.Replace("\"", "'");
                        Console.WriteLine("FOUND x:" + x + " y:" + y + " w:" + w + " h:" + h + " cx:" + found.CenterX + " cy:" + found.CenterY + " name:\"" + safeName + "\" type:" + found.ControlType + " id:\"" + safeId + "\"");
                    } else {
                        Console.WriteLine("NOT_FOUND query:\"" + nameQuery + "\"");
                    }
                }
                else if (cmd == "click_element" || cmd == "click_el") {
                    string queryArgs = rest.Trim();
                    string windowFilter = "";
                    string nameQuery = "";
                    string ctFilter = "";

                    if (queryArgs.Contains("|")) {
                        var qParts = queryArgs.Split('|');
                        if (qParts.Length == 2) {
                            nameQuery = qParts[0].Trim();
                            ctFilter = qParts[1].Trim();
                        } else if (qParts.Length >= 3) {
                            windowFilter = qParts[0].Trim();
                            nameQuery = qParts[1].Trim();
                            ctFilter = qParts[2].Trim();
                        }
                    } else {
                        nameQuery = queryArgs;
                    }

                    IntPtr targetHwnd;
                    string winTitle, winProc;
                    RECT winRect;
                    var winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);

                    FoundElementResult found = null;
                    if (winElement != null) {
                        found = FindElementInWindow(winElement, nameQuery, ctFilter);
                    }

                    if (found == null) {
                        for (int attempt = 0; attempt < 2; attempt++) {
                            Thread.Sleep(35);
                            winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);
                            if (winElement != null) {
                                found = FindElementInWindow(winElement, nameQuery, ctFilter);
                                if (found != null) break;
                            }
                        }
                    }

                    if (winElement == null) {
                        Console.WriteLine("NOT_FOUND error:\"no_active_window\"");
                    } else if (found != null) {
                        try {
                            if (targetHwnd != IntPtr.Zero) {
                                BringWindowToTop(targetHwnd);
                                SetForegroundWindow(targetHwnd);
                            }
                        } catch {}

                        DoHardwareClick(found.CenterX, found.CenterY);

                        int x = (int)Math.Round(found.Rect.X);
                        int y = (int)Math.Round(found.Rect.Y);
                        int w = (int)Math.Round(found.Rect.Width);
                        int h = (int)Math.Round(found.Rect.Height);
                        string safeName = found.Name.Replace("\"", "'").Replace("\n", " ").Replace("\r", " ");
                        string safeId = found.AutomationId.Replace("\"", "'");
                        Console.WriteLine("CLICKED x:" + x + " y:" + y + " w:" + w + " h:" + h + " cx:" + found.CenterX + " cy:" + found.CenterY + " name:\"" + safeName + "\" type:" + found.ControlType + " id:\"" + safeId + "\"");
                    } else {
                        Console.WriteLine("NOT_FOUND query:\"" + nameQuery + "\"");
                    }
                }
                else if (cmd == "double_click_element" || cmd == "doubleclick_element") {
                    string queryArgs = rest.Trim();
                    string windowFilter = "";
                    string nameQuery = "";
                    string ctFilter = "";

                    if (queryArgs.Contains("|")) {
                        var qParts = queryArgs.Split('|');
                        if (qParts.Length == 2) {
                            nameQuery = qParts[0].Trim();
                            ctFilter = qParts[1].Trim();
                        } else if (qParts.Length >= 3) {
                            windowFilter = qParts[0].Trim();
                            nameQuery = qParts[1].Trim();
                            ctFilter = qParts[2].Trim();
                        }
                    } else {
                        nameQuery = queryArgs;
                    }

                    IntPtr targetHwnd;
                    string winTitle, winProc;
                    RECT winRect;
                    var winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);

                    FoundElementResult found = null;
                    if (winElement != null) {
                        found = FindElementInWindow(winElement, nameQuery, ctFilter);
                    }

                    if (found == null) {
                        for (int attempt = 0; attempt < 2; attempt++) {
                            Thread.Sleep(35);
                            winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);
                            if (winElement != null) {
                                found = FindElementInWindow(winElement, nameQuery, ctFilter);
                                if (found != null) break;
                            }
                        }
                    }

                    if (winElement == null) {
                        Console.WriteLine("NOT_FOUND error:\"no_active_window\"");
                    } else if (found != null) {
                        try {
                            if (targetHwnd != IntPtr.Zero) {
                                BringWindowToTop(targetHwnd);
                                SetForegroundWindow(targetHwnd);
                            }
                        } catch {}

                        DoHardwareClick(found.CenterX, found.CenterY);
                        Thread.Sleep(50);
                        DoHardwareClick(found.CenterX, found.CenterY);

                        int x = (int)Math.Round(found.Rect.X);
                        int y = (int)Math.Round(found.Rect.Y);
                        int w = (int)Math.Round(found.Rect.Width);
                        int h = (int)Math.Round(found.Rect.Height);
                        string safeName = found.Name.Replace("\"", "'").Replace("\n", " ").Replace("\r", " ");
                        string safeId = found.AutomationId.Replace("\"", "'");
                        Console.WriteLine("DOUBLE_CLICKED x:" + x + " y:" + y + " w:" + w + " h:" + h + " cx:" + found.CenterX + " cy:" + found.CenterY + " name:\"" + safeName + "\" type:" + found.ControlType + " id:\"" + safeId + "\"");
                    } else {
                        Console.WriteLine("NOT_FOUND query:\"" + nameQuery + "\"");
                    }
                }
                else if (cmd == "set_element_text" || cmd == "set_text" || cmd == "type_element") {
                    string fullArgs = rest.Trim();
                    int lastPipe = fullArgs.LastIndexOf('|');
                    if (lastPipe == -1) {
                        Console.WriteLine("ERROR invalid_args:\"target|text required\"");
                        continue;
                    }

                    string targetSpec = fullArgs.Substring(0, lastPipe).Trim();
                    string textToSet = fullArgs.Substring(lastPipe + 1);

                    string windowFilter = "";
                    string nameQuery = "";
                    string ctFilter = "edit";

                    if (targetSpec.Contains("|")) {
                        var targetParts = targetSpec.Split('|');
                        if (targetParts.Length == 2) {
                            nameQuery = targetParts[0].Trim();
                            ctFilter = targetParts[1].Trim();
                        } else if (targetParts.Length >= 3) {
                            windowFilter = targetParts[0].Trim();
                            nameQuery = targetParts[1].Trim();
                            ctFilter = targetParts[2].Trim();
                        }
                    } else {
                        nameQuery = targetSpec;
                    }

                    IntPtr targetHwnd;
                    string winTitle, winProc;
                    RECT winRect;
                    var winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);

                    FoundElementResult found = null;
                    if (winElement != null) {
                        found = FindElementInWindow(winElement, nameQuery, ctFilter);
                        if (found == null && ctFilter == "edit") {
                            found = FindElementInWindow(winElement, nameQuery, "document");
                        }
                    }

                    if (found == null) {
                        for (int attempt = 0; attempt < 2; attempt++) {
                            Thread.Sleep(35);
                            winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);
                            if (winElement != null) {
                                found = FindElementInWindow(winElement, nameQuery, ctFilter);
                                if (found == null && ctFilter == "edit") {
                                    found = FindElementInWindow(winElement, nameQuery, "document");
                                }
                                if (found != null) break;
                            }
                        }
                    }

                    if (winElement == null) {
                        Console.WriteLine("NOT_FOUND error:\"no_active_window\"");
                    } else if (found != null) {
                        try {
                            if (targetHwnd != IntPtr.Zero) {
                                BringWindowToTop(targetHwnd);
                                SetForegroundWindow(targetHwnd);
                            }
                        } catch {}

                        bool ok = SetElementText(found.Element, textToSet, found.CenterX, found.CenterY);
                        int x = (int)Math.Round(found.Rect.X);
                        int y = (int)Math.Round(found.Rect.Y);
                        int w = (int)Math.Round(found.Rect.Width);
                        int h = (int)Math.Round(found.Rect.Height);
                        string safeName = found.Name.Replace("\"", "'").Replace("\n", " ").Replace("\r", " ");
                        Console.WriteLine("TEXT_SET x:" + x + " y:" + y + " w:" + w + " h:" + h + " cx:" + found.CenterX + " cy:" + found.CenterY + " name:\"" + safeName + "\" success:" + (ok ? "true" : "false"));
                    } else {
                        Console.WriteLine("NOT_FOUND query:\"" + nameQuery + "\"");
                    }
                }
                else if (cmd == "set_element_text_b64") {
                    string fullArgs = rest.Trim();
                    int lastPipe = fullArgs.LastIndexOf('|');
                    if (lastPipe == -1) {
                        Console.WriteLine("ERROR invalid_args:\"target|b64text required\"");
                        continue;
                    }

                    string targetSpec = fullArgs.Substring(0, lastPipe).Trim();
                    string b64 = fullArgs.Substring(lastPipe + 1).Trim();
                    string textToSet = "";
                    try {
                        byte[] data = Convert.FromBase64String(b64);
                        textToSet = Encoding.UTF8.GetString(data);
                    } catch {
                        Console.WriteLine("ERROR invalid_base64");
                        continue;
                    }

                    string windowFilter = "";
                    string nameQuery = "";
                    string ctFilter = "edit";

                    if (targetSpec.Contains("|")) {
                        var targetParts = targetSpec.Split('|');
                        if (targetParts.Length == 2) {
                            nameQuery = targetParts[0].Trim();
                            ctFilter = targetParts[1].Trim();
                        } else if (targetParts.Length >= 3) {
                            windowFilter = targetParts[0].Trim();
                            nameQuery = targetParts[1].Trim();
                            ctFilter = targetParts[2].Trim();
                        }
                    } else {
                        nameQuery = targetSpec;
                    }

                    IntPtr targetHwnd;
                    string winTitle, winProc;
                    RECT winRect;
                    var winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);

                    FoundElementResult found = null;
                    if (winElement != null) {
                        found = FindElementInWindow(winElement, nameQuery, ctFilter);
                        if (found == null && ctFilter == "edit") {
                            found = FindElementInWindow(winElement, nameQuery, "document");
                        }
                    }

                    if (found == null) {
                        for (int attempt = 0; attempt < 4; attempt++) {
                            Thread.Sleep(80);
                            winElement = GetWindowAutomationElementByFilter(windowFilter, out targetHwnd, out winTitle, out winProc, out winRect);
                            if (winElement != null) {
                                found = FindElementInWindow(winElement, nameQuery, ctFilter);
                                if (found == null && ctFilter == "edit") {
                                    found = FindElementInWindow(winElement, nameQuery, "document");
                                }
                                if (found != null) break;
                            }
                        }
                    }

                    if (winElement == null) {
                        Console.WriteLine("NOT_FOUND error:\"no_active_window\"");
                    } else if (found != null) {
                        try {
                            if (targetHwnd != IntPtr.Zero) {
                                BringWindowToTop(targetHwnd);
                                SetForegroundWindow(targetHwnd);
                            }
                        } catch {}

                        bool ok = SetElementText(found.Element, textToSet, found.CenterX, found.CenterY);
                        int x = (int)Math.Round(found.Rect.X);
                        int y = (int)Math.Round(found.Rect.Y);
                        int w = (int)Math.Round(found.Rect.Width);
                        int h = (int)Math.Round(found.Rect.Height);
                        string safeName = found.Name.Replace("\"", "'").Replace("\n", " ").Replace("\r", " ");
                        Console.WriteLine("TEXT_SET x:" + x + " y:" + y + " w:" + w + " h:" + h + " cx:" + found.CenterX + " cy:" + found.CenterY + " name:\"" + safeName + "\" success:" + (ok ? "true" : "false"));
                    } else {
                        Console.WriteLine("NOT_FOUND query:\"" + nameQuery + "\"");
                    }
                }
                else if (cmd == "topmost" || cmd == "focus_benchmark") {
                    EnsureDesktopAttached();
                    string search = rest.Trim().ToLowerInvariant();
                    if (string.IsNullOrEmpty(search)) search = "benchmark";

                    IntPtr targetDesk = _hPersistentDesk != IntPtr.Zero ? _hPersistentDesk : IntPtr.Zero;

                    // 1. Hide IDE window so benchmark page has 100% unobstructed display access
                    try {
                        EnumDesktopWindows(targetDesk, (hWnd, lParam) => {
                            if (!IsWindowVisible(hWnd)) return true;
                            StringBuilder sb = new StringBuilder(256);
                            GetWindowText(hWnd, sb, 256);
                            string title = sb.ToString();
                            if (title.Contains("Antigravity") || title.Contains("Visual Studio Code")) {
                                ShowWindow(hWnd, 0 /* SW_HIDE */);
                                ShowWindowAsync(hWnd, 0);
                            }
                            return true;
                        }, IntPtr.Zero);
                    } catch {}

                    Thread.Sleep(300);

                    // 2. Find benchmark target window
                    IntPtr found = IntPtr.Zero;
                    string foundTitle = "";
                    try {
                        EnumDesktopWindows(targetDesk, (hWnd, lParam) => {
                            StringBuilder sb = new StringBuilder(256);
                            GetWindowText(hWnd, sb, 256);
                            string title = sb.ToString();
                            if (string.IsNullOrEmpty(title)) return true;
                            if (title.Contains("Antigravity") || title.Contains("Visual Studio Code")) return true;

                            if (title.ToLowerInvariant().Contains(search) || title.ToLowerInvariant().Contains("chrome") || title.ToLowerInvariant().Contains("orbit beta")) {
                                found = hWnd;
                                foundTitle = title;
                                return false;
                            }
                            return true;
                        }, IntPtr.Zero);
                    } catch {}

                    if (found != IntPtr.Zero) {
                        ShowWindow(found, 9 /* SW_RESTORE */);
                        ShowWindow(found, 3 /* SW_MAXIMIZE */);
                        SetWindowPos(found, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
                        keybd_event(0x12, 0, 0, UIntPtr.Zero);
                        keybd_event(0x12, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                        SwitchToThisWindow(found, true);
                        BringWindowToTop(found);
                        SetForegroundWindow(found);
                        SendMessage(found, 0x0112 /* WM_SYSCOMMAND */, (IntPtr)0xF030 /* SC_MAXIMIZE */, IntPtr.Zero);
                        Console.WriteLine("OK " + found.ToInt64() + " \"" + foundTitle + "\"");
                    } else {
                        Console.WriteLine("NOT_FOUND");
                    }
                }
                else if (cmd == "restore_ide") {
                    EnsureDesktopAttached();
                    IntPtr targetDesk = _hPersistentDesk != IntPtr.Zero ? _hPersistentDesk : IntPtr.Zero;
                    try {
                        EnumDesktopWindows(targetDesk, (hWnd, lParam) => {
                            StringBuilder sb = new StringBuilder(256);
                            GetWindowText(hWnd, sb, 256);
                            string title = sb.ToString();
                            if (title.Contains("Antigravity") || title.Contains("Visual Studio Code")) {
                                ShowWindow(hWnd, 5 /* SW_SHOW */);
                                ShowWindow(hWnd, 3 /* SW_MAXIMIZE */);
                                BringWindowToTop(hWnd);
                                SetForegroundWindow(hWnd);
                            }
                            return true;
                        }, IntPtr.Zero);
                    } catch {}
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
                        EnumDesktopWindows(IntPtr.Zero, (hWnd, lParam) => {
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
                    } catch {}
                    Console.WriteLine("OK");
                }
                else if (cmd == "paste_b64") {
                    byte[] bytes = Convert.FromBase64String(rest.Trim());
                    string text = Encoding.UTF8.GetString(bytes).Replace("\r\n", "\n").Replace("\r", "\n").Replace("\n", "\r\n");
                    bool pressEnterAtEnd = text.EndsWith("\r\n");
                    if (pressEnterAtEnd) {
                        text = text.Substring(0, text.Length - 2);
                    }
                    SetClipboardText(text);
                    Thread.Sleep(30);

                    IntPtr fg = GetForegroundWindow();
                    if (fg != IntPtr.Zero) {
                        SetForegroundWindow(fg);
                    }

                    keybd_event(0x11, 0x1D, 0, UIntPtr.Zero);
                    Thread.Sleep(35);
                    keybd_event(0x56, 0x2F, 0, UIntPtr.Zero);
                    Thread.Sleep(45);
                    keybd_event(0x56, 0x2F, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    Thread.Sleep(25);
                    keybd_event(0x11, 0x1D, KEYEVENTF_KEYUP, UIntPtr.Zero);

                    if (pressEnterAtEnd) {
                        Thread.Sleep(50);
                        keybd_event(0x0D, 0x1C, 0, UIntPtr.Zero);
                        Thread.Sleep(30);
                        keybd_event(0x0D, 0x1C, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    }
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
                        IntPtr fg = GetForegroundWindow();
                        if (fg != IntPtr.Zero) {
                            SetForegroundWindow(fg);
                        }
                        keybd_event(0x11, 0x1D, 0, UIntPtr.Zero); // Ctrl down
                        Thread.Sleep(35);
                        keybd_event(0x56, 0x2F, 0, UIntPtr.Zero); // V down
                        Thread.Sleep(45);
                        keybd_event(0x56, 0x2F, KEYEVENTF_KEYUP, UIntPtr.Zero); // V up
                        Thread.Sleep(25);
                        keybd_event(0x11, 0x1D, KEYEVENTF_KEYUP, UIntPtr.Zero); // Ctrl up
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

                    EnsureDesktopAttached();

                    IntPtr hdcSrc = GetDC(IntPtr.Zero);
                    IntPtr hdcDest = CreateCompatibleDC(hdcSrc);
                    IntPtr hBitmap = CreateCompatibleBitmap(hdcSrc, w, h);
                    IntPtr hOld = SelectObject(hdcDest, hBitmap);

                    bool success = BitBlt(hdcDest, 0, 0, w, h, hdcSrc, 0, 0, SRCCOPY);

                    SelectObject(hdcDest, hOld);
                    DeleteDC(hdcDest);
                    ReleaseDC(IntPtr.Zero, hdcSrc);

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
                        EnsureDesktopAttached();
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
                        EnumDesktopWindows(IntPtr.Zero, minimizeProc, IntPtr.Zero);
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
