using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace SafeExamClient.Security
{
    /// <summary>
    /// Hooks the native Win32 window message pump to suppress Precision Touchpad gestures,
    /// DirectManipulation flicks, tablet touch switches, system commands (minimize/restore),
    /// and listens for display hotplug events (WM_DISPLAYCHANGE).
    /// </summary>
    public sealed class TrackpadLockdown : IDisposable
    {
        private HwndSource? _hwndSource;
        private IntPtr _windowHandle = IntPtr.Zero;

        private const int WM_SYSCOMMAND = 0x0112;
        private const int SC_MINIMIZE = 0xF020;
        private const int SC_MOVE = 0xF010;
        private const int SC_KEYMENU = 0xF100;

        public event Action? OnDisplayChanged;
        public event Action<string>? OnGestureAttempted;

        public void Attach(Window window)
        {
            var helper = new WindowInteropHelper(window);
            _windowHandle = helper.Handle;

            if (_windowHandle == IntPtr.Zero) return;

            // 1. Explicitly disable multi-touch gestures via SetGestureConfig
            try
            {
                var configs = new Win32.GESTURECONFIG[]
                {
                    new Win32.GESTURECONFIG
                    {
                        dwID = 0, // 0 = apply to all gesture types
                        dwWant = 0,
                        dwBlock = Win32.GC_ALLGESTURES // Block all gestures (pinch, zoom, two-finger-tap, rotate, pan)
                    }
                };

                uint size = (uint)Marshal.SizeOf<Win32.GESTURECONFIG>();
                Win32.SetGestureConfig(_windowHandle, 0, (uint)configs.Length, configs, size);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Gesture config notice: {ex.Message}");
            }

            // 2. Attach HwndSourceHook to native window message pump
            _hwndSource = HwndSource.FromHwnd(_windowHandle);
            _hwndSource?.AddHook(WndProcHook);
        }

        private IntPtr WndProcHook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            // A. Intercept Tablet & Precision Touchpad System Gesture Query
            if (msg == Win32.WM_TABLET_QUERYSYSTEMGESTURESTATUS)
            {
                handled = true;
                // Instruct Windows driver to turn off all gestures, flicks, press-and-hold, and smooth scrolling
                return (IntPtr)Win32.TABLET_DISABLE_ALL_GESTURES;
            }

            // B. Intercept and swallow raw multi-touch gesture messages (Pinch, Zoom, Two-finger Pan, Rotate)
            if (msg == Win32.WM_GESTURE)
            {
                handled = true;
                OnGestureAttempted?.Invoke("WM_GESTURE");
                return IntPtr.Zero;
            }

            // C. Intercept gesture notification negotiation
            if (msg == Win32.WM_GESTURENOTIFY)
            {
                handled = true;
                return IntPtr.Zero;
            }

            // D. Intercept display changes (HDMI/Monitor plugged or unplugged)
            if (msg == Win32.WM_DISPLAYCHANGE)
            {
                OnDisplayChanged?.Invoke();
            }

            // E. Intercept System Commands: Suppress Minimize, Window Move, and Alt-Key System Menu
            if (msg == WM_SYSCOMMAND)
            {
                int cmd = wParam.ToInt32() & 0xFFF0;
                if (cmd == SC_MINIMIZE || cmd == SC_MOVE || cmd == SC_KEYMENU)
                {
                    handled = true;
                    return IntPtr.Zero;
                }
            }

            return IntPtr.Zero;
        }

        public void Dispose()
        {
            if (_hwndSource != null)
            {
                _hwndSource.RemoveHook(WndProcHook);
                _hwndSource = null;
            }
            _windowHandle = IntPtr.Zero;
        }
    }
}
