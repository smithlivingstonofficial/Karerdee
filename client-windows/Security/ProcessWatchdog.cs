using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;

namespace SafeExamClient.Security
{
    public sealed class ProcessWatchdog : IDisposable
    {
        private static readonly HashSet<string> BlacklistedProcesses = new(StringComparer.OrdinalIgnoreCase)
        {
            "anydesk",
            "teamviewer",
            "rustdesk",
            "ultraviewer",
            "vncviewer",
            "parsec",
            "logmein",
            "ammyy",
            "discord",
            "slack",
            "telegram",
            "zoom",
            "obs64",
            "obs32",
            "snippingtool",
            "sharex",
            "lightshot",
            "camtasia",
            "bandicam",
            "cheatengine",
            "wireshark",
            "fiddler",
            "processhacker",
            "taskmgr"
        };

        private Timer? _timer;
        public event Action<string>? OnBlacklistedProcessDetected;

        public void Start(int intervalMs = 1500)
        {
            _timer = new Timer(ScanProcesses, null, 0, intervalMs);
        }

        private void ScanProcesses(object? state)
        {
            try
            {
                var processes = Process.GetProcesses();
                foreach (var proc in processes)
                {
                    try
                    {
                        if (proc.Id == Environment.ProcessId) continue;

                        string name = proc.ProcessName;
                        if (BlacklistedProcesses.Contains(name))
                        {
                            OnBlacklistedProcessDetected?.Invoke(name);
                            // Terminate unauthorized process
                            proc.Kill();
                        }
                    }
                    catch
                    {
                        // Ignore process inspection errors for protected system services
                    }
                }
            }
            catch
            {
                // Watchdog scan resilience
            }
        }

        public void Dispose()
        {
            _timer?.Dispose();
            _timer = null;
        }
    }
}

