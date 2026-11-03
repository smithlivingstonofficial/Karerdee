using System;
using System.Diagnostics;
using System.IO;
using Microsoft.Win32;

namespace SafeExamClient.Security
{
    /// <summary>
    /// Registers the custom URI scheme (kareses://) in the current user's Windows registry (HKCU).
    /// Requires zero administrator privileges. Enables direct one-click browser launch into the desktop client.
    /// </summary>
    public static class ProtocolRegistration
    {
        public const string UriScheme = "kareses";

        public static void RegisterUriScheme()
        {
            try
            {
                string? exePath = Process.GetCurrentProcess().MainModule?.FileName;
                if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
                {
                    exePath = Environment.ProcessPath;
                }

                if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath)) return;

                // HKCU\Software\Classes\kareses
                using var key = Registry.CurrentUser.CreateSubKey($@"Software\Classes\{UriScheme}");
                if (key != null)
                {
                    key.SetValue("", "URL:KARE Safe Exam Client Protocol");
                    key.SetValue("URL Protocol", "");

                    using var iconKey = key.CreateSubKey("DefaultIcon");
                    iconKey?.SetValue("", $"\"{exePath}\",0");

                    using var commandKey = key.CreateSubKey(@"shell\open\command");
                    commandKey?.SetValue("", $"\"{exePath}\" \"%1\"");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Protocol registration notice: {ex.Message}");
            }
        }
    }
}

