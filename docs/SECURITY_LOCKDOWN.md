# Windows Security & Anti-Cheat Engine Specification

This document provides the technical specification and implementation guide for the **C# .NET 8 WPF Security Shell** running on candidate hardware.

---

## 1. Win32 Low-Level Keyboard Interception

Standard Windows keys (`Alt+Tab`, `Win`, `Ctrl+Esc`) bypass normal application key events. To capture and discard these keystrokes before the OS acts on them, the client registers a **Low-Level Keyboard Hook (`WH_KEYBOARD_LL`)**.

### P/Invoke Signatures
```csharp
public static class Win32Hook
{
    public const int WH_KEYBOARD_LL = 13;
    public const int WM_KEYDOWN = 0x0100;
    public const int WM_SYSKEYDOWN = 0x0104;

    public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern IntPtr GetModuleHandle(string lpModuleName);
}
```

### Key Filtering Logic
```csharp
private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
{
    if (nCode >= 0 && (wParam == (IntPtr)Win32Hook.WM_KEYDOWN || wParam == (IntPtr)Win32Hook.WM_SYSKEYDOWN))
    {
        int vkCode = Marshal.ReadInt32(lParam);
        Key key = KeyInterop.KeyFromVirtualKey(vkCode);

        bool isAlt = (Keyboard.Modifiers & ModifierKeys.Alt) != 0;
        bool isCtrl = (Keyboard.Modifiers & ModifierKeys.Control) != 0;

        // Block Alt+Tab
        if (isAlt && key == Key.Tab) return (IntPtr)1;

        // Block Alt+Escape
        if (isAlt && key == Key.Escape) return (IntPtr)1;

        // Block Alt+F4
        if (isAlt && key == Key.F4) return (IntPtr)1;

        // Block Windows Keys
        if (key == Key.LWin || key == Key.RWin) return (IntPtr)1;

        // Block Ctrl+Escape (Opens Start Menu)
        if (isCtrl && key == Key.Escape) return (IntPtr)1;

        // Block PrintScreen
        if (key == Key.PrintScreen) return (IntPtr)1;
    }

    return Win32Hook.CallNextHookEx(_hookID, nCode, wParam, lParam);
}
```

---

## 2. Screen Capture & Screen Share Prevention

To prevent candidate screens from being recorded by OBS, Discord, Zoom, Snipping Tool, or HDMI capture cards, the application sets the Windows Display Affinity on all windows.

### Implementation
```csharp
[DllImport("user32.dll")]
public static extern uint SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);

// Constants
public const uint WDA_NONE = 0x00000000;
public const uint WDA_MONITOR = 0x00000001;
public const uint WDA_EXCLUDEFROMCAPTURE = 0x00000011; // Windows 10 Version 2004 and higher

// Applied during Window Loaded
public void EnableAntiCapture(Window window)
{
    IntPtr handle = new WindowInteropHelper(window).Handle;
    uint result = SetWindowDisplayAffinity(handle, WDA_EXCLUDEFROMCAPTURE);
    if (result == 0)
    {
        // Fallback for older Windows versions
        SetWindowDisplayAffinity(handle, WDA_MONITOR);
    }
}
```
*Result: Any recording, screen share, or screenshot software renders a solid black rectangle in place of the exam window.*

---

## 3. Virtual Machine (VM) Detection

To prevent candidates from running the exam inside VMware, VirtualBox, Hyper-V, or Sandboxie while searching answers on the host OS:

1. **CPUID Hypervisor Check**:
   - Query CPUID leaf `0x1`.
   - Examine bit 31 of ECX (`Hypervisor Present Bit`). On bare metal, this bit is 0.
2. **WMI Hardware Model Inspection**:
   - Query `SELECT Manufacturer, Model FROM Win32_ComputerSystem`.
   - Match strings: `VMware`, `VirtualBox`, `QEMU`, `KVM`, `Virtual Machine`.
3. **Known VM Driver / MAC Prefixes**:
   - Check MAC address OUI prefixes:
     - `00:05:69`, `00:0C:29`, `00:50:56` (VMware)
     - `08:00:27` (VirtualBox)
   - If any check triggers, the application halts immediately with a fatal diagnostic error before granting exam access.

---

## 4. Multi-Monitor Enforcement

- At launch and on a periodic 2-second background poll:
```csharp
int screenCount = System.Windows.Forms.Screen.AllScreens.Length;
if (screenCount > 1)
{
    LockExamForMultiMonitorViolation();
}
```
- If a secondary display is attached:
  - An auxiliary fullscreen blackout window is opened over every non-primary monitor.
  - The exam session on the primary monitor is masked with a warning: *"External display detected. Unplug all additional monitors to resume."*
  - An audit violation event is emitted to the server.

---

## 5. Blacklisted Process Supervision

A dedicated background `System.Threading.Timer` scans active processes every 1,500ms against a configurable blacklist:

```csharp
private static readonly HashSet<string> BlacklistedProcesses = new(StringComparer.OrdinalIgnoreCase)
{
    "anydesk", "teamviewer", "discord", "obs64", "obs32",
    "chrome", "firefox", "msedge", "brave", "opera",
    "powershell", "cmd", "taskmgr", "cheatengine", "snippingtool"
};
```
- Upon detection:
  1. The process is terminated immediately using `Process.Kill()`.
  2. A violation log `{ processName: "anydesk.exe", time: ... }` is transmitted.
  3. The student receives a strike on their counter.

---

## 6. Microsoft WebView2 Hardening

The embedded Chromium browser control is locked down using its initialization API:

```csharp
var options = new CoreWebView2EnvironmentOptions();
var environment = await CoreWebView2Environment.CreateAsync(null, null, options);
await webView.EnsureCoreWebView2Async(environment);

var settings = webView.CoreWebView2.Settings;
settings.AreDevToolsEnabled = false;            // Prevent Inspect Element
settings.AreDefaultContextMenusEnabled = false; // Disable Right-Click
settings.IsStatusBarEnabled = false;            // Hide URL hover previews
settings.AreBrowserAcceleratorKeysEnabled = false; // Block F12, F5, Ctrl+R
settings.IsZoomControlEnabled = false;          // Prevent zooming out
settings.IsPinchZoomEnabled = false;
```

