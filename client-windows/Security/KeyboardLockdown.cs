using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Input;

namespace SafeExamClient.Security
{
    /// <summary>
    /// Low-Level WH_KEYBOARD_LL hook that intercepts, neutralizes, and logs all system-level shortcuts,
    /// Windows keys, Virtual Desktop navigation, Task View, and synthetic touchpad keystroke injections.
    /// </summary>
    public sealed class KeyboardLockdown : IDisposable
    {
        // Pinned static reference prevents Garbage Collector from collecting native delegate
        private static Win32.LowLevelKeyboardProc? _proc;
        private static IntPtr _hookId = IntPtr.Zero;

        // Internal real-time modifier state machine (updated on both KeyDown and KeyUp)
        private static volatile bool _isLWinDown;
        private static volatile bool _isRWinDown;
        private static volatile bool _isLCtrlDown;
        private static volatile bool _isRCtrlDown;
        private static volatile bool _isLAltDown;
        private static volatile bool _isRAltDown;

        public event Action<string>? OnSystemKeyAttempted;

        public void Install()
        {
            if (_hookId != IntPtr.Zero) return;

            _proc = HookCallback;
            using var curProcess = Process.GetCurrentProcess();
            using var curModule = curProcess.MainModule;

            if (curModule != null)
            {
                _hookId = Win32.SetWindowsHookEx(
                    Win32.WH_KEYBOARD_LL,
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
                bool isKeyDown = (msg == Win32.WM_KEYDOWN || msg == Win32.WM_SYSKEYDOWN);
                bool isKeyUp = (msg == Win32.WM_KEYUP || msg == Win32.WM_SYSKEYUP);

                var hookStruct = Marshal.PtrToStructure<Win32.KBDLLHOOKSTRUCT>(lParam);
                uint vk = hookStruct.vkCode;
                bool isInjected = (hookStruct.flags & Win32.LLKHF_INJECTED) != 0;

                // 1. Maintain Modifier State Machine on BOTH KeyDown and KeyUp
                switch (vk)
                {
                    case Win32.VK_LWIN:
                        _isLWinDown = isKeyDown;
                        break;
                    case Win32.VK_RWIN:
                        _isRWinDown = isKeyDown;
                        break;
                    case Win32.VK_LCONTROL:
                    case Win32.VK_CONTROL when (hookStruct.flags & Win32.LLKHF_EXTENDED) == 0:
                        _isLCtrlDown = isKeyDown;
                        break;
                    case Win32.VK_RCONTROL:
                    case Win32.VK_CONTROL when (hookStruct.flags & Win32.LLKHF_EXTENDED) != 0:
                        _isRCtrlDown = isKeyDown;
                        break;
                    case Win32.VK_LMENU:
                    case Win32.VK_MENU when (hookStruct.flags & Win32.LLKHF_EXTENDED) == 0:
                        _isLAltDown = isKeyDown;
                        break;
                    case Win32.VK_RMENU:
                    case Win32.VK_MENU when (hookStruct.flags & Win32.LLKHF_EXTENDED) != 0:
                        _isRAltDown = isKeyDown;
                        break;
                }

                // 2. Unconditionally SWALLOW all Windows Keys (Left Win & Right Win) on BOTH KeyDown & KeyUp.
                // By never delivering VK_LWIN / VK_RWIN to the Windows Desktop Window Manager (DWM),
                // Windows can never open Start, trigger Task View, switch desktops, or open Action Center.
                if (vk == Win32.VK_LWIN || vk == Win32.VK_RWIN)
                {
                    if (isKeyDown)
                    {
                        OnSystemKeyAttempted?.Invoke("WindowsKey");
                    }
                    return (IntPtr)1; // Drop message completely
                }

                // Compute combined modifier states with secondary GetAsyncKeyState sanity checks
                bool isWinActive = _isLWinDown || _isRWinDown ||
                                   (Win32.GetAsyncKeyState(Win32.VK_LWIN) & 0x8000) != 0 ||
                                   (Win32.GetAsyncKeyState(Win32.VK_RWIN) & 0x8000) != 0;

                bool isCtrlActive = _isLCtrlDown || _isRCtrlDown ||
                                    (Win32.GetAsyncKeyState(Win32.VK_CONTROL) & 0x8000) != 0;

                bool isAltActive = _isLAltDown || _isRAltDown ||
                                   (hookStruct.flags & Win32.LLKHF_ALTDOWN) != 0 ||
                                   (Win32.GetAsyncKeyState(Win32.VK_MENU) & 0x8000) != 0;

                // 3. Block Injected / Synthetic Touchpad Navigation Keystrokes
                if (isInjected && (isWinActive || isAltActive || vk == Win32.VK_TAB || vk == Win32.VK_LEFT || vk == Win32.VK_RIGHT))
                {
                    if (isKeyDown)
                    {
                        OnSystemKeyAttempted?.Invoke("TouchpadInjectedShortcut");
                    }
                    return (IntPtr)1;
                }

                // 4. Block Virtual Desktop Navigation & Creation (Ctrl + Win + Left/Right/D/F4)
                if (isWinActive && isCtrlActive)
                {
                    if (isKeyDown)
                    {
                        string desc = vk switch
                        {
                            Win32.VK_LEFT => "Ctrl+Win+Left (Previous Desktop)",
                            Win32.VK_RIGHT => "Ctrl+Win+Right (Next Desktop)",
                            0x44 => "Ctrl+Win+D (Create Virtual Desktop)",
                            Win32.VK_F4 => "Ctrl+Win+F4 (Close Virtual Desktop)",
                            _ => $"Ctrl+Win+{vk:X2}"
                        };
                        OnSystemKeyAttempted?.Invoke(desc);
                    }
                    return (IntPtr)1;
                }

                // 5. Block ANY keystroke while Windows key is held (Win+Tab, Win+D, Win+M, Win+A, Win+S, Win+P, etc.)
                if (isWinActive)
                {
                    if (isKeyDown)
                    {
                        string desc = vk switch
                        {
                            Win32.VK_TAB => "Win+Tab (Task View)",
                            0x44 => "Win+D (Show Desktop)",
                            0x4D => "Win+M (Minimize All)",
                            0x41 => "Win+A (Action Center)",
                            0x53 => "Win+S (Search)",
                            0x50 => "Win+P (Project Display)",
                            0x45 => "Win+E (File Explorer)",
                            0x49 => "Win+I (Settings)",
                            Win32.VK_LEFT or Win32.VK_RIGHT or Win32.VK_UP or Win32.VK_DOWN => "Win+Arrow (Aero Snap)",
                            _ => $"Win+{vk:X2}"
                        };
                        OnSystemKeyAttempted?.Invoke(desc);
                    }
                    return (IntPtr)1;
                }

                // 6. Block Alt Combinations (Alt+Tab, Alt+Esc, Alt+F4, Alt+Space)
                if (isAltActive && (vk == Win32.VK_TAB || vk == Win32.VK_ESCAPE || vk == Win32.VK_F4 || vk == Win32.VK_SPACE))
                {
                    if (isKeyDown)
                    {
                        string desc = vk switch
                        {
                            Win32.VK_TAB => "Alt+Tab (App Switch)",
                            Win32.VK_ESCAPE => "Alt+Esc (Window Cycle)",
                            Win32.VK_F4 => "Alt+F4 (Close Window)",
                            Win32.VK_SPACE => "Alt+Space (System Menu)",
                            _ => $"Alt+{vk:X2}"
                        };
                        OnSystemKeyAttempted?.Invoke(desc);
                    }
                    return (IntPtr)1;
                }

                // 7. Block Ctrl + Escape (Secondary Start Menu)
                if (isCtrlActive && vk == Win32.VK_ESCAPE)
                {
                    if (isKeyDown)
                    {
                        OnSystemKeyAttempted?.Invoke("Ctrl+Esc");
                    }
                    return (IntPtr)1;
                }

                // 8. Block PrintScreen (Screenshot attempt)
                if (vk == Win32.VK_SNAPSHOT)
                {
                    if (isKeyDown)
                    {
                        OnSystemKeyAttempted?.Invoke("PrintScreen");
                    }
                    return (IntPtr)1;
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
