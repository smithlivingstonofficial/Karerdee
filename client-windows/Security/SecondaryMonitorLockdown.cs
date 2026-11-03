using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SafeExamClient.Security
{
    /// <summary>
    /// Enforces strict single-monitor policy:
    /// 1. Detects multi-monitor setups via Win32 EnumDisplayMonitors & SM_CMONITORS
    /// 2. Spawns high-priority, anti-capture barrier blackout windows on all secondary displays
    /// 3. Confines mouse cursor strictly to the primary exam monitor using ClipCursor
    /// </summary>
    public sealed class SecondaryMonitorLockdown : IDisposable
    {
        private readonly List<SecondaryBarrierWindow> _activeBarriers = new();
        private readonly HashSet<IntPtr> _barrierHandles = new();
        private bool _isCursorConfined = false;

        public event Action<string>? OnSecondaryDisplayDetected;

        public bool HasMultipleMonitors()
        {
            int monitorCount = Win32.GetSystemMetrics(Win32.SM_CMONITORS);
            if (monitorCount > 1) return true;

            int count = 0;
            Win32.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr hMon, IntPtr hdcMon, ref Win32.RECT rect, IntPtr data) =>
            {
                count++;
                return true;
            }, IntPtr.Zero);

            return count > 1;
        }

        public List<Win32.RECT> GetSecondaryMonitorRects()
        {
            var secondaryRects = new List<Win32.RECT>();

            Win32.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr hMon, IntPtr hdcMon, ref Win32.RECT rect, IntPtr data) =>
            {
                var mi = new Win32.MONITORINFOEX();
                mi.cbSize = Marshal.SizeOf<Win32.MONITORINFOEX>();
                if (Win32.GetMonitorInfo(hMon, ref mi))
                {
                    bool isPrimary = (mi.dwFlags & Win32.MONITORINFOF_PRIMARY) != 0;
                    if (!isPrimary)
                    {
                        secondaryRects.Add(mi.rcMonitor);
                    }
                }
                return true;
            }, IntPtr.Zero);

            return secondaryRects;
        }

        public void EnforceBarriers()
        {
            DismissBarriers();

            var secondaryRects = GetSecondaryMonitorRects();
            if (secondaryRects.Count == 0) return;

            OnSecondaryDisplayDetected?.Invoke($"Detected {secondaryRects.Count} unauthorized secondary monitor(s)");

            foreach (var rect in secondaryRects)
            {
                try
                {
                    var barrier = new SecondaryBarrierWindow(rect);
                    barrier.Show();

                    var helper = new WindowInteropHelper(barrier);
                    IntPtr hwnd = helper.Handle;
                    if (hwnd != IntPtr.Zero)
                    {
                        _barrierHandles.Add(hwnd);
                        Win32.SetWindowDisplayAffinity(hwnd, Win32.WDA_EXCLUDEFROMCAPTURE);
                        Win32.SetWindowPos(hwnd, Win32.HWND_TOPMOST, rect.Left, rect.Top, rect.Width, rect.Height, Win32.SWP_SHOWWINDOW);
                    }

                    _activeBarriers.Add(barrier);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Barrier spawn exception: {ex.Message}");
                }
            }
        }

        public void DismissBarriers()
        {
            foreach (var barrier in _activeBarriers)
            {
                try
                {
                    barrier.ForceClose();
                }
                catch { }
            }
            _activeBarriers.Clear();
            _barrierHandles.Clear();
        }

        public bool IsBarrierWindow(IntPtr hWnd)
        {
            return _barrierHandles.Contains(hWnd);
        }

        public void ConfineCursor(Window primaryWindow)
        {
            try
            {
                var helper = new WindowInteropHelper(primaryWindow);
                if (helper.Handle != IntPtr.Zero && Win32.GetWindowRect(helper.Handle, out Win32.RECT rect))
                {
                    Win32.ClipCursor(ref rect);
                    _isCursorConfined = true;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ClipCursor exception: {ex.Message}");
            }
        }

        public void ReleaseCursor()
        {
            if (_isCursorConfined)
            {
                Win32.ClipCursor(IntPtr.Zero);
                _isCursorConfined = false;
            }
        }

        public void Dispose()
        {
            ReleaseCursor();
            DismissBarriers();
        }
    }

    /// <summary>
    /// Light-Theme Academic Security Barrier Window displayed over unauthorized secondary screens.
    /// </summary>
    public sealed class SecondaryBarrierWindow : Window
    {
        private bool _allowClose = false;

        public SecondaryBarrierWindow(Win32.RECT monitorRect)
        {
            Title = "KARE-SES — Secondary Display Security Barrier";
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            Topmost = true;
            ShowInTaskbar = false;
            Background = new SolidColorBrush(Color.FromRgb(0xF8, 0xFA, 0xFC)); // Slate-50

            // Position precisely onto the secondary monitor's coordinate rectangle
            WindowStartupLocation = WindowStartupLocation.Manual;
            Left = monitorRect.Left;
            Top = monitorRect.Top;
            Width = monitorRect.Width;
            Height = monitorRect.Height;

            BuildContent();
        }

        private void BuildContent()
        {
            var grid = new Grid
            {
                Background = new SolidColorBrush(Color.FromRgb(0xF8, 0xFA, 0xFC))
            };

            var card = new Border
            {
                Background = Brushes.White,
                BorderBrush = new SolidColorBrush(Color.FromRgb(0xDC, 0x26, 0x26)), // Danger Red
                BorderThickness = new Thickness(2),
                CornerRadius = new CornerRadius(12),
                Width = 620,
                Padding = new Thickness(36),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                Effect = new System.Windows.Media.Effects.DropShadowEffect
                {
                    Color = Colors.Black,
                    Opacity = 0.08,
                    BlurRadius = 24,
                    ShadowDepth = 6
                }
            };

            var stack = new StackPanel
            {
                HorizontalAlignment = HorizontalAlignment.Center
            };

            // Institutional Logo
            try
            {
                var logoImg = new Image
                {
                    Source = new BitmapImage(new Uri("pack://application:,,,/KARE_Logo.png", UriKind.Absolute)),
                    Width = 72,
                    Height = 72,
                    Margin = new Thickness(0, 0, 0, 16)
                };
                stack.Children.Add(logoImg);
            }
            catch { }

            // Security Badge
            var badge = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(0xFE, 0xE2, 0xE2)), // Crimson-100
                BorderBrush = new SolidColorBrush(Color.FromRgb(0xFE, 0xCA, 0xCA)),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(14),
                Padding = new Thickness(14, 4, 14, 4),
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 0, 0, 14)
            };
            badge.Child = new TextBlock
            {
                Text = "SECURITY ENFORCEMENT • MONITORED EXAMINATION",
                FontWeight = FontWeights.Bold,
                FontSize = 11,
                Foreground = new SolidColorBrush(Color.FromRgb(0x99, 0x1B, 0x1B))
            };
            stack.Children.Add(badge);

            // Warning Header
            var title = new TextBlock
            {
                Text = "UNAUTHORIZED SECONDARY DISPLAY BLOCKED",
                FontWeight = FontWeights.ExtraBold,
                FontSize = 20,
                Foreground = new SolidColorBrush(Color.FromRgb(0x0F, 0x17, 0x2A)), // Slate-900
                TextAlignment = TextAlignment.Center,
                Margin = new Thickness(0, 0, 0, 12)
            };
            stack.Children.Add(title);

            // Warning Description
            var desc = new TextBlock
            {
                Text = "Institutional examination policy strictly prohibits secondary monitors, extended displays, or external projectors.\n\n" +
                       "This secondary screen has been secured to maintain integrity. Telemetry from this event has been streamed to the Chief Proctor.\n\n" +
                       "ACTION REQUIRED: Disconnect this HDMI, USB-C, or external display immediately. All exam interaction must occur solely on your laptop's primary built-in display.",
                FontSize = 13,
                Foreground = new SolidColorBrush(Color.FromRgb(0x47, 0x55, 0x69)), // Slate-600
                TextAlignment = TextAlignment.Center,
                TextWrapping = TextWrapping.Wrap,
                LineHeight = 20,
                Margin = new Thickness(0, 0, 0, 20)
            };
            stack.Children.Add(desc);

            card.Child = stack;
            grid.Children.Add(card);
            Content = grid;
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            if (!_allowClose)
            {
                e.Cancel = true; // Prevent candidate from closing via shortcuts
            }
            base.OnClosing(e);
        }

        public void ForceClose()
        {
            _allowClose = true;
            Close();
        }
    }
}

