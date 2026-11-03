---
name: wpf-security-lockdown
description: Use this skill when developing, testing, or debugging the C# .NET 8 WPF Windows Secure Exam Client. Covers low-level Win32 keyboard hooks, SetWindowDisplayAffinity screen capture blocking, VM detection, process watchdog, and WebView2 secure host communication.
---

# Windows WPF Security & Lockdown Implementation Guide

This skill provides step-by-step technical procedures, P/Invoke signatures, and security guardrails for building the **Windows Secure Exam Client** in C# .NET 8.

---

## 1. Low-Level Keyboard Hook (`WH_KEYBOARD_LL`)

### Guarding Against Garbage Collection
In .NET, passing a delegate to native code without pinning or storing it in a static field will result in a fatal `ExecutionEngineException` once the Garbage Collector collects the unreferenced delegate. **Always declare the hook callback delegate as a static field.**

```csharp
public sealed class KeyboardLockdownManager : IDisposable
{
    private static Win32.LowLevelKeyboardProc? _proc;
    private static IntPtr _hookId = IntPtr.Zero;

    public void InstallHook()
    {
        _proc = HookCallback; // Pinned via static field
        using var curProcess = Process.GetCurrentProcess();
        using var curModule = curProcess.MainModule!;
        _hookId = Win32.SetWindowsHookEx(Win32.WH_KEYBOARD_LL, _proc, Win32.GetModuleHandle(curModule.ModuleName!), 0);
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && (wParam == (IntPtr)0x0100 || wParam == (IntPtr)0x0104))
        {
            int vkCode = Marshal.ReadInt32(lParam);
            var key = KeyInterop.KeyFromVirtualKey(vkCode);

            bool isAlt = (Keyboard.Modifiers & ModifierKeys.Alt) != 0;
            bool isCtrl = (Keyboard.Modifiers & ModifierKeys.Control) != 0;

            // Drop unauthorized combinations (Return 1 to swallow key)
            if (isAlt && key is Key.Tab or Key.Escape or Key.F4 or Key.Space) return (IntPtr)1;
            if (key is Key.LWin or Key.RWin or Key.PrintScreen) return (IntPtr)1;
            if (isCtrl && key == Key.Escape) return (IntPtr)1;
        }
        return Win32.CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    public void Dispose()
    {
        if (_hookId != IntPtr.Zero)
        {
            Win32.UnhookWindowsHookEx(_hookId);
            _hookId = IntPtr.Zero;
        }
    }
}
```

---

## 2. Display Affinity Anti-Capture (`SetWindowDisplayAffinity`)

Run immediately inside `Window.Loaded` or after `IntPtr handle = new WindowInteropHelper(this).Handle`:

```csharp
public static void HardenWindowAgainstCapture(Window window)
{
    var helper = new WindowInteropHelper(window);
    // WDA_EXCLUDEFROMCAPTURE = 0x00000011 (Windows 10 2004+)
    // WDA_MONITOR = 0x00000001 (Legacy fallback)
    uint result = Win32.SetWindowDisplayAffinity(helper.Handle, 0x00000011);
    if (result == 0)
    {
        Win32.SetWindowDisplayAffinity(helper.Handle, 0x00000001);
    }
}
```

---

## 3. Hardware VM Detection

Run prior to authenticating or launching the WebView:

```csharp
public static bool IsRunningInVirtualMachine()
{
    try
    {
        // 1. WMI System Model Query
        using var searcher = new ManagementObjectSearcher("SELECT Manufacturer, Model FROM Win32_ComputerSystem");
        foreach (var obj in searcher.Get())
        {
            string manufacturer = obj["Manufacturer"]?.ToString()?.ToLowerInvariant() ?? "";
            string model = obj["Model"]?.ToString()?.ToLowerInvariant() ?? "";

            if (manufacturer.Contains("vmware") || model.Contains("virtualbox") ||
                model.Contains("qemu") || model.Contains("virtual machine") ||
                manufacturer.Contains("microsoft corporation") && model.Contains("virtual"))
            {
                return true;
            }
        }

        // 2. Network Adapter MAC Prefix Check
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            string mac = nic.GetPhysicalAddress().ToString();
            if (mac.StartsWith("000569") || mac.StartsWith("000C29") || mac.StartsWith("005056") || // VMware
                mac.StartsWith("080027")) // VirtualBox
            {
                return true;
            }
        }
    }
    catch
    {
        // Fail-safe: In strictly monitored exams, WMI query failure can be flagged
    }

    return false;
}
```

---

## 4. WebView2 Security Configuration

```csharp
public static async Task InitializeHardenedWebViewAsync(WebView2 webView, string targetUrl)
{
    var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Path.GetTempPath(), "SafeExam_UserData"));
    await webView.EnsureCoreWebView2Async(env);

    var s = webView.CoreWebView2.Settings;
    s.AreDevToolsEnabled = false;
    s.AreDefaultContextMenusEnabled = false;
    s.AreBrowserAcceleratorKeysEnabled = false;
    s.IsStatusBarEnabled = false;
    s.IsZoomControlEnabled = false;
    s.IsPinchZoomEnabled = false;
    s.IsSwipeNavigationEnabled = false;

    // Block non-authorized navigations
    webView.CoreWebView2.NavigationStarting += (sender, args) =>
    {
        if (!args.Uri.StartsWith(targetUrl, StringComparison.OrdinalIgnoreCase))
        {
            args.Cancel = true;
        }
    };
}
```

