using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace SafeExamClient.Security
{
    public sealed class MouseLockdown : IDisposable
    {
        // Pinned static reference prevents Garbage Collector from collecting native delegate
        private static Win32.LowLevelMouseProc? _proc;
        private static IntPtr _hookId = IntPtr.Zero;

        public event Action<string>? OnUnauthorizedMouseAttempted;

        public void Install()
        {
            if (_hookId != IntPtr.Zero) return;

            _proc = HookCallback;
            using var curProcess = Process.GetCurrentProcess();
            using var curModule = curProcess.MainModule;

            if (curModule != null)
            {
                _hookId = Win32.SetWindowsHookEx(
                    Win32.WH_MOUSE_LL,
                    _proc,
                    Win32.GetModuleHandle(curModule.ModuleName!),
                    0
                );
            }
        }

        private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                int msg = wParam.ToInt32();

                // 1. Block Two-Finger Tap / Right Click (Context Menus)
                if (msg == Win32.WM_RBUTTONDOWN || msg == Win32.WM_RBUTTONUP)
                {
                    OnUnauthorizedMouseAttempted?.Invoke("TwoFingerTap/RightClick");
                    return (IntPtr)1; // Drop message
                }

                // 2. Block Three-Finger Tap / Middle Click
                if (msg == Win32.WM_MBUTTONDOWN || msg == Win32.WM_MBUTTONUP)
                {
                    OnUnauthorizedMouseAttempted?.Invoke("ThreeFingerTap/MiddleClick");
                    return (IntPtr)1; // Drop message
                }

                // 3. Block Hardware Side/Gesture Navigation Buttons (XButtons)
                if (msg == Win32.WM_XBUTTONDOWN || msg == Win32.WM_XBUTTONUP)
                {
                    OnUnauthorizedMouseAttempted?.Invoke("HardwareGestureButton");
                    return (IntPtr)1; // Drop message
                }
            }

            return Win32.CallNextHookEx(_hookId, nCode, wParam, lParam);
        }

        public void Dispose()
        {
            if (_hookId != IntPtr.Zero)
            {
                Win32.UnhookWindowsHookEx(_hookId);
                _hookId = IntPtr.Zero;
                _proc = null;
            }
        }
    }
}

