using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using SafeExamClient.Models;
using SafeExamClient.Security;
using SafeExamClient.Services;

namespace SafeExamClient
{
    public partial class MainWindow : Window
    {
        private readonly KeyboardLockdown _keyboardLockdown = new();
        private readonly ProcessWatchdog _processWatchdog = new();
        private readonly MouseLockdown _mouseLockdown = new();
        private readonly TrackpadLockdown _trackpadLockdown = new();
        private readonly SecondaryMonitorLockdown _secondaryMonitorLockdown = new();
        private readonly ExamClientService _examService = new();

        // Native Window & Virtual Desktop COM State
        private IntPtr _mainWindowHandle = IntPtr.Zero;
        private IVirtualDesktopManager? _virtualDesktopManager;
        private DispatcherTimer? _focusWatchdogTimer;
        private DateTime _lastFocusViolationUtc = DateTime.MinValue;

        // State Tracking
        private string _hardwareFingerprint = string.Empty;
        private string _serverUrl = "http://localhost:3000";
        private string? _sessionToken;
        private string? _sessionId;
        private CandidateModel? _candidate;
        private ExamModel? _exam;

        // Trackpad & Single Touch State
        private int? _primaryTouchDeviceId;

        // Exam Runtime
        private readonly List<QuestionModel> _questions = new();
        private int _currentQuestionIndex = 0;
        private readonly Dictionary<string, List<string>> _answers = new();
        private readonly HashSet<string> _reviewQuestions = new();
        private int _secondsRemaining = 90 * 60;
        private long _clockSkewMs = 0;
        private DateTime? _examEndTimeUtc = null;
        private int _strikes = 0;
        private int _maxStrikes = 3;
        private bool _isExamActive = false;
        private bool _isExitingCleanly = false;
        private string? _selectedSectionId;
        private int _previousExtraTimeMinutes = 0;

        // Timers
        private DispatcherTimer? _examCountdownTimer;
        private DispatcherTimer? _answerSyncTimer;
        private DispatcherTimer? _heartbeatTimer;

        // Calculator State
        private string _calcExpression = "";

        public MainWindow()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            var helper = new WindowInteropHelper(this);
            _mainWindowHandle = helper.Handle;

            // 1. Anti-Capture Display Affinity
            try
            {
                uint res = Win32.SetWindowDisplayAffinity(_mainWindowHandle, Win32.WDA_EXCLUDEFROMCAPTURE);
                if (res == 0)
                {
                    Win32.SetWindowDisplayAffinity(_mainWindowHandle, Win32.WDA_MONITOR);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Affinity notice: {ex.Message}");
            }

            // 2. Hardware Security Fingerprint
            _hardwareFingerprint = HardwareFingerprint.Generate();
            LblFingerprint.Text = _hardwareFingerprint;

            // 3. Pre-flight VM Detection Check
            if (VmDetector.IsVirtualMachine(out string vmReason))
            {
                LblStatus.Text = $"SECURITY HALT: {vmReason}";
                LblStatus.Foreground = Brushes.Crimson;
                BtnLaunch.IsEnabled = false;
                return;
            }

            // 4. Initialize Windows 10/11 Virtual Desktop COM Manager
            try
            {
                _virtualDesktopManager = (IVirtualDesktopManager)new VirtualDesktopManager();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"IVirtualDesktopManager initialization notice: {ex.Message}");
            }

            // 5. Pre-flight Multi-Monitor Verification
            if (_secondaryMonitorLockdown.HasMultipleMonitors())
            {
                LblStatus.Text = "SECURITY HALT: Multiple displays detected. Please disconnect external monitors/HDMI cables to proceed.";
                LblStatus.Foreground = Brushes.Crimson;
                BtnLaunch.IsEnabled = false;
                _secondaryMonitorLockdown.EnforceBarriers();
            }

            // 6. Arm Low-Level Keyboard Lockdown Immediately From Launch
            // Neutralizes Windows keys, Task View, Start menu, Alt+Tab, and desktop shortcuts across the entire app
            _keyboardLockdown.Install();

            // 7. Attach Native Trackpad & Gesture Driver Lockdown
            _trackpadLockdown.Attach(this);
            _trackpadLockdown.OnDisplayChanged += HandleDisplayChanged;
            _trackpadLockdown.OnGestureAttempted += (gesture) =>
            {
                Dispatcher.Invoke(() => RegisterSecurityViolation($"Unauthorized trackpad gesture: {gesture}"));
            };

            // 8. Attach Secondary Display Notification
            _secondaryMonitorLockdown.OnSecondaryDisplayDetected += (reason) =>
            {
                Dispatcher.Invoke(() => RegisterSecurityViolation($"Secondary display violation: {reason}"));
            };

            // 9. Register Anti-Cheat Listeners
            _keyboardLockdown.OnSystemKeyAttempted += (keyName) =>
            {
                Dispatcher.Invoke(() => RegisterSecurityViolation($"System shortcut intercepted: {keyName}"));
            };

            _mouseLockdown.OnUnauthorizedMouseAttempted += (actionName) =>
            {
                Dispatcher.Invoke(() => RegisterSecurityViolation($"Unauthorized pointer action: {actionName}"));
            };

            _processWatchdog.OnBlacklistedProcessDetected += (procName) =>
            {
                Dispatcher.Invoke(() => RegisterSecurityViolation($"Blacklisted process terminated: {procName}"));
            };

            // 10. Start Unyielding Focus & Virtual Desktop Watchdog (40ms)
            _focusWatchdogTimer = new DispatcherTimer(DispatcherPriority.Render)
            {
                Interval = TimeSpan.FromMilliseconds(40)
            };
            _focusWatchdogTimer.Tick += FocusWatchdog_Tick;
            _focusWatchdogTimer.Start();

            // 11. Register kareses:// Custom URI Protocol in Windows HKCU Registry
            ProtocolRegistration.RegisterUriScheme();

            // 12. Start Inter-Process Communication (IPC) Server for incoming browser launches
            SingleInstanceIpc.StartIpcServer((uriString) =>
            {
                Dispatcher.InvokeAsync(() =>
                {
                    // Bring window to foreground and maximize
                    Win32.ShowWindow(_mainWindowHandle, Win32.SW_SHOWMAXIMIZED);
                    Win32.SetWindowPos(_mainWindowHandle, Win32.HWND_TOPMOST, 0, 0, 0, 0, Win32.SWP_NOMOVE | Win32.SWP_NOSIZE | Win32.SWP_SHOWWINDOW);
                    Win32.BringWindowToTop(_mainWindowHandle);
                    Win32.SetForegroundWindow(_mainWindowHandle);
                    Activate();
                    Focus();

                    ParseAndExecuteDirectLaunchUri(uriString);
                });
            });

            // 13. Check Command-Line Arguments for Direct Launch Protocol (kareses://launch?ticket=...)
            CheckForDirectLaunchArgument();
        }

        private void CheckForDirectLaunchArgument()
        {
            try
            {
                string[] args = Environment.GetCommandLineArgs();
                for (int i = 1; i < args.Length; i++)
                {
                    string cleanedArg = args[i].Trim('"', '\'');
                    if (cleanedArg.StartsWith("kareses://", StringComparison.OrdinalIgnoreCase))
                    {
                        ParseAndExecuteDirectLaunchUri(cleanedArg);
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Direct launch parse exception: {ex.Message}");
            }
        }

        private void ParseAndExecuteDirectLaunchUri(string launchUri)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(launchUri)) return;

                launchUri = launchUri.Trim('"', '\'', ' ', '\t', '\r', '\n');
                if (!launchUri.StartsWith("kareses://", StringComparison.OrdinalIgnoreCase)) return;

                string query = launchUri.Contains("?") ? launchUri.Substring(launchUri.IndexOf('?') + 1) : "";
                var pairs = query.Split('&', StringSplitOptions.RemoveEmptyEntries);
                string? ticket = null;
                string? server = null;

                foreach (var pair in pairs)
                {
                    var parts = pair.Split(new[] { '=' }, 2);
                    if (parts.Length == 2)
                    {
                        string key = Uri.UnescapeDataString(parts[0]).Trim();
                        string val = Uri.UnescapeDataString(parts[1]).Trim();
                        if (key.Equals("ticket", StringComparison.OrdinalIgnoreCase))
                        {
                            ticket = val.TrimEnd('/', '"', '\'');
                        }
                        else if (key.Equals("server", StringComparison.OrdinalIgnoreCase))
                        {
                            server = val.TrimEnd('/', '"', '\'');
                        }
                    }
                }

                if (!string.IsNullOrEmpty(server))
                {
                    _serverUrl = server.TrimEnd('/');
                    TxtServerUrl.Text = _serverUrl;
                }

                if (!string.IsNullOrEmpty(ticket))
                {
                    _ = ProcessDirectLaunchTicketAsync(_serverUrl, ticket);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Direct launch execution exception: {ex.Message}");
            }
        }

        private async Task ProcessDirectLaunchTicketAsync(string serverUrl, string ticket)
        {
            if (_isExamActive) return;

            BtnLaunch.IsEnabled = false;
            LblStatus.Text = "One-Click Launch Ticket detected. Authenticating candidate...";
            LblStatus.Foreground = (SolidColorBrush)FindResource("PrimaryBlue");

            var authResult = await _examService.AuthenticateWithTicketAsync(serverUrl, ticket, _hardwareFingerprint);

            if (!authResult.Success || authResult.Exam == null || authResult.Candidate == null)
            {
                string msg = authResult.Error ?? "Direct ticket authentication failed.";
                if (authResult.Code == "CONCURRENT_EXAM_RESTRICTION")
                {
                    msg = $"[Concurrent Exam Restricted]\n{authResult.Error}";
                }
                else if (authResult.Code == "LATE_ENTRY_DENIED")
                {
                    msg = $"[Late Entry Restricted]\n{authResult.Error}";
                }
                else if (authResult.Code == "EXAM_NOT_STARTED")
                {
                    msg = $"[Exam Not Started]\n{authResult.Error}";
                }
                LblStatus.Text = msg;
                LblStatus.Foreground = Brushes.Crimson;
                BtnLaunch.IsEnabled = true;
                return;
            }

            TransitionToInstructionsScreen(authResult);
        }

        #region Authentication & Entrance

        private async void BtnLaunch_Click(object sender, RoutedEventArgs e)
        {
            string email = TxtEmail.Text.Trim();
            string password = TxtAppPassword.Text.Trim();
            string passcode = TxtPasscode.Text.Trim();
            _serverUrl = TxtServerUrl.Text.Trim().TrimEnd('/');

            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password) || string.IsNullOrEmpty(passcode))
            {
                MessageBox.Show("Please enter your registered Email ID, Application ID, and Exam Security Passcode.", "Validation Notice", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            BtnLaunch.IsEnabled = false;
            LblStatus.Text = "Authenticating with institutional examination server...";
            LblStatus.Foreground = (SolidColorBrush)FindResource("PrimaryBlue");

            var authResult = await _examService.AuthenticateAsync(_serverUrl, email, password, passcode, _hardwareFingerprint);

            if (!authResult.Success || authResult.Exam == null || authResult.Candidate == null)
            {
                string msg = authResult.Error ?? "Authentication failed.";
                if (authResult.Code == "CONCURRENT_EXAM_RESTRICTION")
                {
                    msg = $"[Concurrent Exam Restricted]\n{authResult.Error}";
                }
                else if (authResult.Code == "LATE_ENTRY_DENIED")
                {
                    msg = $"[Late Entry Restricted]\n{authResult.Error}\n(Arrival logged with Chief Proctor. If an exception is granted, click Launch Exam to retry.)";
                }
                else if (authResult.Code == "EXAM_NOT_STARTED")
                {
                    msg = $"[Exam Not Started]\n{authResult.Error}";
                }
                LblStatus.Text = msg;
                LblStatus.Foreground = Brushes.Crimson;
                BtnLaunch.IsEnabled = true;
                return;
            }

            TransitionToInstructionsScreen(authResult);
        }

        private void TransitionToInstructionsScreen(AuthResponseModel authResult)
        {
            if (authResult.Candidate == null || authResult.Exam == null) return;

            // Record Server-Authoritative Time & Skew
            if (authResult.ServerEpochMs > 0)
            {
                long localMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                _clockSkewMs = authResult.ServerEpochMs - localMs;
            }

            if (!string.IsNullOrEmpty(authResult.EndTime) && DateTime.TryParse(authResult.EndTime, out var dt))
            {
                _examEndTimeUtc = dt.ToUniversalTime();
            }

            if (authResult.RemainingSeconds > 0)
            {
                _secondsRemaining = authResult.RemainingSeconds;
            }

            // Authentication Succeeded
            _sessionToken = authResult.Token;
            _sessionId = authResult.SessionId;
            _candidate = authResult.Candidate;
            _exam = authResult.Exam;
            _maxStrikes = _exam.MaxStrikes > 0 ? _exam.MaxStrikes : 3;
            _strikes = _exam.CurrentStrikes;

            _questions.Clear();
            if (_exam.Questions != null)
            {
                _questions.AddRange(_exam.Questions);
            }

            if (_questions.Count == 0)
            {
                LblStatus.Text = "No examination questions available for your department curriculum.";
                LblStatus.Foreground = Brushes.Crimson;
                BtnLaunch.IsEnabled = true;
                return;
            }

            // Transition to Native Instructions Screen
            LblInstrExamTitle.Text = _exam.Title;
            LblInstrCandName.Text = _candidate.FullName;
            LblInstrAppNo.Text = _candidate.ApplicationNumber ?? _candidate.RollNumber;
            LblInstrDept.Text = !string.IsNullOrEmpty(_candidate.Department) ? _candidate.Department : "General";
            LblInstrDuration.Text = $"{_exam.DurationMinutes} Minutes ({_questions.Count} Questions)";

            LblMarkingPolicy.Text = _exam.EnableNegativeMarking
                ? "Marking Policy: Negative Marking is ENABLED (Deductions applied for incorrect answers)"
                : "Marking Policy: Negative Marking is DISABLED (No penalty for incorrect answers)";

            string calcStr = (!string.IsNullOrEmpty(_exam.CalculatorMode) && _exam.CalculatorMode != "NONE")
                ? $"Calculator ({_exam.CalculatorMode})"
                : "Calculator (Disabled)";
            string scratchStr = _exam.EnableScratchpad ? "Rough Space (Enabled)" : "Rough Space (Disabled)";
            string flagStr = _exam.EnableQuestionFlagging ? "Flagging (Enabled)" : "Flagging (Disabled)";
            LblToolsAllowed.Text = $"Permitted Tools: {calcStr} • {scratchStr} • {flagStr}";

            if (!string.IsNullOrEmpty(_exam.Instructions))
            {
                LblCustomInstructions.Text = $"Specific Instructions:\n{_exam.Instructions}";
                LblCustomInstructions.Visibility = Visibility.Visible;
            }
            else
            {
                LblCustomInstructions.Visibility = Visibility.Collapsed;
            }

            AuthGatePanel.Visibility = Visibility.Collapsed;
            InstructionsPanel.Visibility = Visibility.Visible;
        }

        private void BtnStartExam_Click(object sender, RoutedEventArgs e)
        {
            if (ChkAgreeRules.IsChecked != true)
            {
                MessageBox.Show("Please confirm that you agree to all examination rules before starting.", "Agreement Required", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            // Arm Windows Security & Lockdown strictly based on LockdownPolicy
            bool blockKeys = _exam?.LockdownPolicy?.BlockKeyboardHooks ?? true;
            bool blockWatchdog = _exam?.LockdownPolicy?.BlockBlacklistedProcesses ?? true;

            if (blockKeys) _keyboardLockdown.Install();
            _mouseLockdown.Install(); // Always enforce single-touch / pointer trackpad lockdown
            if (blockWatchdog) _processWatchdog.Start();

            // Confine mouse pointer strictly to primary exam monitor
            if (_secondaryMonitorLockdown.HasMultipleMonitors())
            {
                _secondaryMonitorLockdown.EnforceBarriers();
            }
            _secondaryMonitorLockdown.ConfineCursor(this);

            _isExamActive = true;

            // Configure tool buttons strictly conditioned on exam settings
            BtnCalculatorToggle.Visibility = (_exam?.CalculatorMode != null && _exam.CalculatorMode != "NONE")
                ? Visibility.Visible : Visibility.Collapsed;
            BtnScratchpadToggle.Visibility = (_exam?.EnableScratchpad ?? true)
                ? Visibility.Visible : Visibility.Collapsed;
            BtnMarkReview.Visibility = (_exam?.EnableQuestionFlagging ?? true)
                ? Visibility.Visible : Visibility.Collapsed;

            // Initialize Exam State
            _secondsRemaining = (_exam?.DurationMinutes ?? 90) * 60;
            _currentQuestionIndex = 0;
            LblTopExamTitle.Text = _exam?.Title ?? "Examination";
            string candApp = _candidate?.ApplicationNumber ?? _candidate?.RollNumber ?? "";
            LblTopCandTag.Text = $"{_candidate?.FullName} ({candApp}) • {_candidate?.Department}";
            LblStrikesCount.Text = $"Strikes: {_strikes} / {_maxStrikes}";

            // Setup Timers
            StartExamTimers();

            // Build Section Tabs
            BuildSectionTabs();

            // Render First Question and Palette
            RenderCurrentQuestion();
            UpdateQuestionPalette();

            InstructionsPanel.Visibility = Visibility.Collapsed;
            ExamActivePanel.Visibility = Visibility.Visible;
        }

        private void StartExamTimers()
        {
            // 1. Server-Bound Live Countdown Timer (1s)
            _examCountdownTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1)
            };
            _examCountdownTimer.Tick += (s, args) =>
            {
                if (_examEndTimeUtc.HasValue)
                {
                    long currentServerEpoch = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + _clockSkewMs;
                    var serverNowUtc = DateTimeOffset.FromUnixTimeMilliseconds(currentServerEpoch).UtcDateTime;
                    int remaining = (int)Math.Max(0, (_examEndTimeUtc.Value - serverNowUtc).TotalSeconds);
                    _secondsRemaining = remaining;
                }
                else
                {
                    _secondsRemaining--;
                }

                if (_secondsRemaining <= 0)
                {
                    _examCountdownTimer.Stop();
                    AutoSubmitExamOnTimeOut();
                    return;
                }

                var ts = TimeSpan.FromSeconds(_secondsRemaining);
                LblCountdown.Text = $"{(int)ts.TotalHours:D2}:{ts.Minutes:D2}:{ts.Seconds:D2}";

                if (_secondsRemaining < 300) // Less than 5 mins
                {
                    LblCountdown.Foreground = Brushes.Crimson;
                }
            };
            _examCountdownTimer.Start();

            // 2. Answer Sync Timer (every 15s)
            _answerSyncTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(15)
            };
            _answerSyncTimer.Tick += async (s, args) =>
            {
                if (!string.IsNullOrEmpty(_sessionToken) && !string.IsNullOrEmpty(_sessionId))
                {
                    bool ok = await _examService.SyncAnswersAsync(_serverUrl, _sessionToken, _sessionId, _answers);
                    LblSyncStatus.Text = ok ? "☁ Synced" : "⚠ Offline Buffer";
                    LblSyncStatus.Foreground = ok ? (SolidColorBrush)FindResource("SuccessGreen") : (SolidColorBrush)FindResource("WarningAmber");
                }
            };
            _answerSyncTimer.Start();

            // 3. Telemetry Heartbeat & Authoritative Clock Sync (every 4s)
            _heartbeatTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(4)
            };
            _heartbeatTimer.Tick += async (s, args) =>
            {
                if (!string.IsNullOrEmpty(_sessionToken) && !string.IsNullOrEmpty(_sessionId))
                {
                    var hb = await _examService.SendHeartbeatAsync(_serverUrl, _sessionToken, _sessionId, _hardwareFingerprint, _answers.Count);
                    if (hb != null)
                    {
                        if (hb.ServerEpochMs > 0)
                        {
                            long localMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                            _clockSkewMs = hb.ServerEpochMs - localMs;
                        }
                        if (hb.ServerCalculatedSecondsRemaining > 0)
                        {
                            _secondsRemaining = hb.ServerCalculatedSecondsRemaining;
                        }

                        // Compensatory Extra Time Sync
                        if (hb.ExtraTimeMinutes > _previousExtraTimeMinutes)
                        {
                            int added = hb.ExtraTimeMinutes - _previousExtraTimeMinutes;
                            _previousExtraTimeMinutes = hb.ExtraTimeMinutes;
                            _secondsRemaining += added * 60;
                            LblSyncStatus.Text = $"+{added}m Extra Time";
                            LblSyncStatus.Foreground = (SolidColorBrush)FindResource("PrimaryBlue");
                        }

                        // Synchronize Remote Strikes
                        if (hb.StrikesCount != _strikes)
                        {
                            _strikes = hb.StrikesCount;
                            LblStrikesCount.Text = $"Strikes: {_strikes} / {_maxStrikes}";
                        }

                        if (hb.IsExpired || _secondsRemaining <= 0)
                        {
                            _examCountdownTimer?.Stop();
                            AutoSubmitExamOnTimeOut();
                            return;
                        }

                        // Handle Remote Proctor Lock / Unlock
                        if (hb.SessionStatus == "LOCKED" || hb.SessionStatus == "DISQUALIFIED")
                        {
                            LblLockoutReason.Text = "Your workstation has been locked by the proctor.";
                            LockoutOverlay.Visibility = Visibility.Visible;
                        }
                        else if (hb.SessionStatus == "IN_PROGRESS" && LockoutOverlay.Visibility == Visibility.Visible)
                        {
                            // Proctor granted remote unlock
                            LockoutOverlay.Visibility = Visibility.Collapsed;
                        }
                    }
                }
            };
            _heartbeatTimer.Start();
        }

        #endregion

        #region Native Question Engine

        private void BuildSectionTabs()
        {
            SectionTabsContainer.Children.Clear();
            if (_exam?.Sections == null || _exam.Sections.Count == 0) return;

            if (string.IsNullOrEmpty(_selectedSectionId) && _questions.Count > 0)
            {
                _selectedSectionId = _questions[0].SectionId;
            }

            foreach (var sec in _exam.Sections)
            {
                bool isActive = sec.Id == _selectedSectionId;
                var btn = new Button
                {
                    Content = sec.Title,
                    Tag = sec.Id,
                    Height = 32,
                    Margin = new Thickness(0, 0, 8, 0),
                    Background = isActive ? (SolidColorBrush)FindResource("PrimaryBlue") : Brushes.White,
                    Foreground = isActive ? Brushes.White : (SolidColorBrush)FindResource("TextPrimary"),
                    BorderBrush = isActive ? (SolidColorBrush)FindResource("PrimaryBlue") : (SolidColorBrush)FindResource("BorderMedium"),
                    FontWeight = isActive ? FontWeights.Bold : FontWeights.SemiBold,
                    Style = (Style)FindResource("RoundedButton")
                };

                btn.Click += (s, e) =>
                {
                    _selectedSectionId = (string)btn.Tag;
                    // Jump to first question of this section
                    int firstIdx = _questions.FindIndex(q => q.SectionId == _selectedSectionId);
                    if (firstIdx >= 0)
                    {
                        _currentQuestionIndex = firstIdx;
                        RenderCurrentQuestion();
                        UpdateQuestionPalette();
                    }
                    UpdateSectionTabHighlights();
                };

                SectionTabsContainer.Children.Add(btn);
            }
        }

        private void UpdateSectionTabHighlights()
        {
            foreach (var child in SectionTabsContainer.Children)
            {
                if (child is Button btn)
                {
                    bool isActive = (string)btn.Tag == _selectedSectionId;
                    btn.Background = isActive ? (SolidColorBrush)FindResource("PrimaryBlue") : Brushes.White;
                    btn.Foreground = isActive ? Brushes.White : (SolidColorBrush)FindResource("TextPrimary");
                    btn.BorderBrush = isActive ? (SolidColorBrush)FindResource("PrimaryBlue") : (SolidColorBrush)FindResource("BorderMedium");
                    btn.FontWeight = isActive ? FontWeights.Bold : FontWeights.SemiBold;
                }
            }
        }

        private void RenderCurrentQuestion()
        {
            if (_questions.Count == 0 || _currentQuestionIndex < 0 || _currentQuestionIndex >= _questions.Count) return;

            var q = _questions[_currentQuestionIndex];

            // Update active section tab highlight dynamically
            if (!string.IsNullOrEmpty(q.SectionId) && q.SectionId != _selectedSectionId)
            {
                _selectedSectionId = q.SectionId;
                UpdateSectionTabHighlights();
            }

            // Header Meta
            LblQuestionNumber.Text = $"Question {_currentQuestionIndex + 1} of {_questions.Count}";
            string negText = q.NegativePoints > 0 ? $"-{q.NegativePoints:F2}" : "0.00";
            LblQuestionMarks.Text = $"+{q.Points:F2} Marks / {negText} Neg";

            // Multi-Select Badge
            bool isMultiple = q.QuestionType == "MCQ_MULTIPLE";
            BadgeMultiSelect.Visibility = isMultiple ? Visibility.Visible : Visibility.Collapsed;

            // Review Badge
            BadgeReview.Visibility = _reviewQuestions.Contains(q.Id) ? Visibility.Visible : Visibility.Collapsed;
            BtnMarkReview.Content = _reviewQuestions.Contains(q.Id) ? "✓ Marked for Review" : "⚑ Mark for Review";

            // Prompt
            LblQuestionPrompt.Text = q.Prompt;

            // Code Snippet
            if (!string.IsNullOrWhiteSpace(q.CodeSnippet))
            {
                LblCodeSnippet.Text = q.CodeSnippet;
                CodeSnippetBorder.Visibility = Visibility.Visible;
            }
            else
            {
                CodeSnippetBorder.Visibility = Visibility.Collapsed;
            }

            // Options List
            OptionsContainer.Children.Clear();
            _answers.TryGetValue(q.Id, out var selectedOptIds);
            selectedOptIds ??= new List<string>();

            char optLetter = 'A';
            foreach (var opt in q.Options)
            {
                bool isSelected = selectedOptIds.Contains(opt.Id);
                string prefix = $"{optLetter}.";

                var optCard = new Border
                {
                    Background = isSelected ? new SolidColorBrush(Color.FromRgb(0xEE, 0xF2, 0xFF)) : Brushes.White,
                    BorderBrush = isSelected ? (SolidColorBrush)FindResource("PrimaryBlue") : (SolidColorBrush)FindResource("BorderSubtle"),
                    BorderThickness = new Thickness(isSelected ? 2 : 1),
                    CornerRadius = new CornerRadius(8),
                    Padding = new Thickness(14, 12, 14, 12),
                    Margin = new Thickness(0, 0, 0, 10),
                    Cursor = Cursors.Hand,
                    Tag = opt.Id
                };

                var grid = new Grid();
                grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(28) });
                grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

                // Option Indicator (Square Checkbox for Multi-Select, Circle Radio for Single Choice)
                var indicator = new Border
                {
                    Width = 22,
                    Height = 22,
                    CornerRadius = new CornerRadius(isMultiple ? 4 : 11),
                    Background = isSelected ? (SolidColorBrush)FindResource("PrimaryBlue") : (SolidColorBrush)FindResource("CanvasBg"),
                    BorderBrush = isSelected ? (SolidColorBrush)FindResource("PrimaryBlue") : (SolidColorBrush)FindResource("BorderMedium"),
                    BorderThickness = new Thickness(1),
                    HorizontalAlignment = HorizontalAlignment.Left,
                    VerticalAlignment = VerticalAlignment.Center
                };
                var indicatorTxt = new TextBlock
                {
                    Text = isMultiple ? (isSelected ? "✓" : prefix.TrimEnd('.')) : prefix.TrimEnd('.'),
                    FontSize = 11,
                    FontWeight = FontWeights.Bold,
                    Foreground = isSelected ? Brushes.White : (SolidColorBrush)FindResource("TextSecondary"),
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center
                };
                indicator.Child = indicatorTxt;
                Grid.SetColumn(indicator, 0);

                // Option Text
                var txt = new TextBlock
                {
                    Text = opt.Text,
                    FontSize = 14,
                    FontWeight = isSelected ? FontWeights.Bold : FontWeights.Normal,
                    Foreground = isSelected ? (SolidColorBrush)FindResource("PrimaryBlue") : (SolidColorBrush)FindResource("TextPrimary"),
                    TextWrapping = TextWrapping.Wrap,
                    VerticalAlignment = VerticalAlignment.Center,
                    Margin = new Thickness(8, 0, 0, 0)
                };
                Grid.SetColumn(txt, 1);

                grid.Children.Add(indicator);
                grid.Children.Add(txt);
                optCard.Child = grid;

                // Option Click Event
                string optId = opt.Id;
                optCard.MouseLeftButtonDown += (s, e) =>
                {
                    SelectOption(q.Id, optId);
                };

                OptionsContainer.Children.Add(optCard);
                optLetter++;
            }

            // Navigation Button States
            BtnPrevQuestion.IsEnabled = _currentQuestionIndex > 0;
            BtnNextQuestion.Content = _currentQuestionIndex == _questions.Count - 1 ? "Review & Finish" : "Next →";

            UpdatePaletteCounts();
        }

        private void SelectOption(string questionId, string optionId)
        {
            var q = _questions.FirstOrDefault(x => x.Id == questionId);
            bool isMultiple = q != null && q.QuestionType == "MCQ_MULTIPLE";

            if (isMultiple)
            {
                if (!_answers.TryGetValue(questionId, out var currentList))
                {
                    currentList = new List<string>();
                    _answers[questionId] = currentList;
                }

                if (currentList.Contains(optionId))
                {
                    currentList.Remove(optionId);
                    if (currentList.Count == 0)
                    {
                        _answers.Remove(questionId);
                    }
                }
                else
                {
                    currentList.Add(optionId);
                }
            }
            else
            {
                _answers[questionId] = new List<string> { optionId };
            }

            RenderCurrentQuestion();
            UpdateQuestionPalette();
        }

        private void BtnPrevQuestion_Click(object sender, RoutedEventArgs e)
        {
            if (_currentQuestionIndex > 0)
            {
                _currentQuestionIndex--;
                RenderCurrentQuestion();
                UpdateQuestionPalette();
            }
        }

        private void BtnNextQuestion_Click(object sender, RoutedEventArgs e)
        {
            if (_currentQuestionIndex < _questions.Count - 1)
            {
                _currentQuestionIndex++;
                RenderCurrentQuestion();
                UpdateQuestionPalette();
            }
            else
            {
                BtnSubmitExam_Click(sender, e);
            }
        }

        private void BtnMarkReview_Click(object sender, RoutedEventArgs e)
        {
            if (_questions.Count == 0) return;
            string qId = _questions[_currentQuestionIndex].Id;

            if (_reviewQuestions.Contains(qId))
                _reviewQuestions.Remove(qId);
            else
                _reviewQuestions.Add(qId);

            RenderCurrentQuestion();
            UpdateQuestionPalette();
        }

        private void BtnClearResponse_Click(object sender, RoutedEventArgs e)
        {
            if (_questions.Count == 0) return;
            string qId = _questions[_currentQuestionIndex].Id;
            _answers.Remove(qId);
            RenderCurrentQuestion();
            UpdateQuestionPalette();
        }

        #endregion

        #region Question Palette & Counts

        private void UpdateQuestionPalette()
        {
            QuestionPaletteContainer.Children.Clear();

            for (int i = 0; i < _questions.Count; i++)
            {
                var q = _questions[i];
                bool isCurrent = i == _currentQuestionIndex;
                bool isAnswered = _answers.ContainsKey(q.Id) && _answers[q.Id].Count > 0;
                bool isReview = _reviewQuestions.Contains(q.Id);

                var btn = new Button
                {
                    Content = (i + 1).ToString(),
                    Width = 38,
                    Height = 38,
                    Margin = new Thickness(3),
                    FontWeight = FontWeights.Bold,
                    FontSize = 12,
                    Cursor = Cursors.Hand,
                    Tag = i
                };

                // Styling based on state
                if (isCurrent)
                {
                    btn.Background = (SolidColorBrush)FindResource("PrimaryBlue");
                    btn.Foreground = Brushes.White;
                    btn.BorderBrush = (SolidColorBrush)FindResource("PrimaryBlue");
                }
                else if (isReview)
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(0xFE, 0xF3, 0xC7));
                    btn.Foreground = new SolidColorBrush(Color.FromRgb(0x92, 0x40, 0x0E));
                    btn.BorderBrush = new SolidColorBrush(Color.FromRgb(0xF5, 0x9E, 0x0B));
                }
                else if (isAnswered)
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(0xEC, 0xFD, 0xF5));
                    btn.Foreground = new SolidColorBrush(Color.FromRgb(0x04, 0x78, 0x57));
                    btn.BorderBrush = new SolidColorBrush(Color.FromRgb(0x10, 0xB9, 0x81));
                }
                else
                {
                    btn.Background = new SolidColorBrush(Color.FromRgb(0xF8, 0xFA, 0xFC));
                    btn.Foreground = new SolidColorBrush(Color.FromRgb(0x64, 0x74, 0x8B));
                    btn.BorderBrush = (SolidColorBrush)FindResource("BorderSubtle");
                }

                btn.Click += (s, e) =>
                {
                    int targetIdx = (int)btn.Tag;
                    _currentQuestionIndex = targetIdx;
                    RenderCurrentQuestion();
                    UpdateQuestionPalette();
                };

                QuestionPaletteContainer.Children.Add(btn);
            }

            UpdatePaletteCounts();
        }

        private void UpdatePaletteCounts()
        {
            int answered = _answers.Count(kv => kv.Value.Count > 0);
            int review = _reviewQuestions.Count;
            int unanswered = Math.Max(0, _questions.Count - answered);

            LblCountAnswered.Text = $"Answered: {answered}";
            LblCountReview.Text = $"Review: {review}";
            LblCountUnanswered.Text = $"Unanswered: {unanswered}";
        }

        #endregion

        #region Violations & Lockdown

        private void RegisterSecurityViolation(string reason)
        {
            if (!_isExamActive) return;

            _strikes++;
            LblStrikesCount.Text = $"Strikes: {_strikes} / {_maxStrikes}";

            // Report violation telemetry to backend
            if (!string.IsNullOrEmpty(_sessionToken) && !string.IsNullOrEmpty(_sessionId))
            {
                _ = _examService.ReportViolationAsync(_serverUrl, _sessionToken, _sessionId, reason);
            }

            // Workstation Freeze on Strikeout Threshold
            if (_strikes >= _maxStrikes)
            {
                LblLockoutReason.Text = $"Security Violation Strikeout: {reason}";
                LockoutOverlay.Visibility = Visibility.Visible;
            }
        }

        #endregion

        #region In-Exam Calculator

        private void BtnToggleCalculator_Click(object sender, RoutedEventArgs e)
        {
            CalculatorPanel.Visibility = CalculatorPanel.Visibility == Visibility.Visible ? Visibility.Collapsed : Visibility.Visible;
        }

        private void BtnCloseCalculator_Click(object sender, RoutedEventArgs e)
        {
            CalculatorPanel.Visibility = Visibility.Collapsed;
        }

        private void BtnCalcKey_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Content != null)
            {
                string key = btn.Content.ToString()!;
                if (LblCalcDisplay.Text == "0" && key != ".")
                    _calcExpression = key;
                else
                    _calcExpression += key;

                LblCalcDisplay.Text = _calcExpression;
            }
        }

        private void BtnCalcClear_Click(object sender, RoutedEventArgs e)
        {
            _calcExpression = "";
            LblCalcDisplay.Text = "0";
        }

        private void BtnCalcBackspace_Click(object sender, RoutedEventArgs e)
        {
            if (_calcExpression.Length > 0)
            {
                _calcExpression = _calcExpression.Substring(0, _calcExpression.Length - 1);
                LblCalcDisplay.Text = _calcExpression.Length == 0 ? "0" : _calcExpression;
            }
        }

        private void BtnCalcEquals_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_calcExpression)) return;
                var dt = new DataTable();
                var result = dt.Compute(_calcExpression, "");
                LblCalcDisplay.Text = Convert.ToString(result) ?? "0";
                _calcExpression = LblCalcDisplay.Text;
            }
            catch
            {
                LblCalcDisplay.Text = "Error";
                _calcExpression = "";
            }
        }

        #endregion

        #region In-Exam Rough Space / Scratchpad

        private void BtnToggleScratchpad_Click(object sender, RoutedEventArgs e)
        {
            ScratchpadPanel.Visibility = ScratchpadPanel.Visibility == Visibility.Visible
                ? Visibility.Collapsed : Visibility.Visible;
        }

        private void BtnCloseScratchpad_Click(object sender, RoutedEventArgs e)
        {
            ScratchpadPanel.Visibility = Visibility.Collapsed;
        }

        private void BtnClearScratchpad_Click(object sender, RoutedEventArgs e)
        {
            TxtScratchpad.Text = string.Empty;
        }

        #endregion

        #region Submission Flow

        private async void BtnSubmitExam_Click(object sender, RoutedEventArgs e)
        {
            int answered = _answers.Count(kv => kv.Value.Count > 0);
            int unanswered = _questions.Count - answered;

            string confirmPrompt = $"Are you sure you want to finish and submit your exam?\n\n- Answered: {answered} Questions\n- Unanswered: {unanswered} Questions\n\nOnce submitted, you cannot re-enter.";

            var res = MessageBox.Show(confirmPrompt, "Confirm Submission", MessageBoxButton.YesNo, MessageBoxImage.Question);
            if (res != MessageBoxResult.Yes) return;

            await FinalizeExamSubmissionAsync();
        }

        private async void AutoSubmitExamOnTimeOut()
        {
            MessageBox.Show("Allocated examination time has expired. Your responses are being submitted automatically.", "Time Out", MessageBoxButton.OK, MessageBoxImage.Information);
            await FinalizeExamSubmissionAsync();
        }

        private async System.Threading.Tasks.Task FinalizeExamSubmissionAsync()
        {
            // Stop timers
            _examCountdownTimer?.Stop();
            _answerSyncTimer?.Stop();
            _heartbeatTimer?.Stop();

            // Disarm security hooks
            _isExamActive = false;
            try
            {
                _keyboardLockdown.Dispose();
                _mouseLockdown.Dispose();
                _trackpadLockdown.Dispose();
                _processWatchdog.Dispose();
            }
            catch {}

            if (!string.IsNullOrEmpty(_sessionToken) && !string.IsNullOrEmpty(_sessionId))
            {
                var submitRes = await _examService.SubmitExamAsync(_serverUrl, _sessionToken, _sessionId, _answers);

                LblReceiptCode.Text = submitRes.ReceiptCode ?? $"KARE-SUB-{_sessionId.Substring(0, 8).ToUpperInvariant()}";
                string candApp = _candidate?.ApplicationNumber ?? _candidate?.RollNumber ?? "";
                LblReceiptCandidate.Text = $"Candidate: {_candidate?.FullName} ({candApp})";
                LblReceiptSummary.Text = $"Total Answered: {_answers.Count(kv => kv.Value.Count > 0)} of {_questions.Count} Questions";

                ExamActivePanel.Visibility = Visibility.Collapsed;
                SubmissionReceiptPanel.Visibility = Visibility.Visible;
            }
            else
            {
                Close();
            }
        }

        private void BtnReceiptExit_Click(object sender, RoutedEventArgs e)
        {
            CleanupSecuritySubsystems();
            Application.Current.Shutdown();
        }

        #endregion

        #region Safe Exit & Window Lifecycle

        private void BtnExitApp_Click(object sender, RoutedEventArgs e)
        {
            ConfirmAndExit();
        }

        private void ConfirmAndExit()
        {
            LblExitConfirmMessage.Text = _isExamActive
                ? "An examination session is currently active.\n\nAre you sure you want to exit? Your answers and progress have been saved. Uncompleted questions will not receive marks."
                : "Are you sure you want to close and exit the KARE-SES Safe Exam Client?";

            ExitConfirmOverlay.Visibility = Visibility.Visible;
        }

        private void BtnCancelExit_Click(object sender, RoutedEventArgs e)
        {
            ExitConfirmOverlay.Visibility = Visibility.Collapsed;
        }

        private void BtnConfirmExit_Click(object sender, RoutedEventArgs e)
        {
            _isExitingCleanly = true;
            _isExamActive = false;
            ExitConfirmOverlay.Visibility = Visibility.Collapsed;
            CleanupSecuritySubsystems();
            Application.Current.Shutdown();
        }

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (_isExitingCleanly)
            {
                return;
            }

            e.Cancel = true;
            ConfirmAndExit();
        }

        private void CleanupSecuritySubsystems()
        {
            try
            {
                _focusWatchdogTimer?.Stop();
                _secondaryMonitorLockdown.ReleaseCursor();
                _secondaryMonitorLockdown.DismissBarriers();
                _secondaryMonitorLockdown.Dispose();
                _keyboardLockdown.Dispose();
                _mouseLockdown.Dispose();
                _trackpadLockdown.Dispose();
                _processWatchdog.Dispose();
            }
            catch {}
        }

        private void FocusWatchdog_Tick(object? sender, EventArgs e)
        {
            if (_mainWindowHandle == IntPtr.Zero) return;

            // If an in-window modal overlay is active or app is exiting, do not interfere
            if (_isExitingCleanly || ExitConfirmOverlay.Visibility == Visibility.Visible)
            {
                return;
            }

            // 1. Virtual Desktop Check via COM IVirtualDesktopManager
            if (_virtualDesktopManager != null)
            {
                try
                {
                    int hr = _virtualDesktopManager.IsWindowOnCurrentVirtualDesktop(_mainWindowHandle, out bool onCurrentDesktop);
                    if (hr == 0 && !onCurrentDesktop)
                    {
                        // The candidate navigated to a secondary virtual desktop!
                        // Instantly teleport SafeExamClient onto the active virtual desktop:
                        IntPtr activeForeground = Win32.GetForegroundWindow();
                        if (activeForeground != IntPtr.Zero)
                        {
                            _virtualDesktopManager.GetWindowDesktopId(activeForeground, out Guid activeDesktopId);
                            if (activeDesktopId != Guid.Empty)
                            {
                                _virtualDesktopManager.MoveWindowToDesktop(_mainWindowHandle, activeDesktopId);
                            }
                        }

                        // Violently maximize and reassert topmost focus
                        Win32.ShowWindow(_mainWindowHandle, Win32.SW_SHOWMAXIMIZED);
                        Win32.SetWindowPos(_mainWindowHandle, Win32.HWND_TOPMOST, 0, 0, 0, 0, Win32.SWP_NOMOVE | Win32.SWP_NOSIZE | Win32.SWP_SHOWWINDOW);
                        Win32.BringWindowToTop(_mainWindowHandle);
                        Win32.SetForegroundWindow(_mainWindowHandle);
                        Activate();
                        Focus();

                        if (_isExamActive && (DateTime.UtcNow - _lastFocusViolationUtc).TotalSeconds >= 2.0)
                        {
                            _lastFocusViolationUtc = DateTime.UtcNow;
                            RegisterSecurityViolation("Virtual desktop navigation attempt: Multiple desktop workspaces are strictly forbidden.");
                        }
                        return;
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"VDM tick notice: {ex.Message}");
                }
            }

            // 2. Foreground Focus Check
            IntPtr fg = Win32.GetForegroundWindow();
            if (fg != _mainWindowHandle && fg != IntPtr.Zero)
            {
                // Ignore if foreground belongs to one of our own secondary barrier windows
                if (_secondaryMonitorLockdown.IsBarrierWindow(fg))
                {
                    return;
                }

                // Check if the foreground window belongs to our own process!
                // If it is our own process (e.g. dialog, child element, context), NEVER steal focus from ourselves!
                Win32.GetWindowThreadProcessId(fg, out uint fgProcId);
                uint currentProcId = (uint)Environment.ProcessId;
                if (fgProcId == currentProcId)
                {
                    return;
                }

                try
                {
                    Win32.ShowWindow(_mainWindowHandle, Win32.SW_SHOWMAXIMIZED);
                    Win32.SetWindowPos(_mainWindowHandle, Win32.HWND_TOPMOST, 0, 0, 0, 0, Win32.SWP_NOMOVE | Win32.SWP_NOSIZE | Win32.SWP_SHOWWINDOW);
                    Win32.BringWindowToTop(_mainWindowHandle);
                    Win32.SetForegroundWindow(_mainWindowHandle);
                    Activate();
                    Focus();

                    if (_isExamActive && (DateTime.UtcNow - _lastFocusViolationUtc).TotalSeconds >= 2.0)
                    {
                        _lastFocusViolationUtc = DateTime.UtcNow;
                        RegisterSecurityViolation("Application lost foreground focus (Desktop/Window switch attempt).");
                    }
                }
                catch {}
            }

            // 3. Keep Mouse Confined During Active Exam
            if (_isExamActive)
            {
                _secondaryMonitorLockdown.ConfineCursor(this);
            }
        }

        private void HandleDisplayChanged()
        {
            Dispatcher.InvokeAsync(() =>
            {
                bool hasMultiple = _secondaryMonitorLockdown.HasMultipleMonitors();
                if (hasMultiple)
                {
                    _secondaryMonitorLockdown.EnforceBarriers();
                    if (_isExamActive)
                    {
                        RegisterSecurityViolation("Secondary display detected: External monitor connected during active examination.");
                    }
                    else
                    {
                        LblStatus.Text = "SECURITY HALT: Multiple displays detected. Please disconnect external monitors/HDMI cables to proceed.";
                        LblStatus.Foreground = Brushes.Crimson;
                        BtnLaunch.IsEnabled = false;
                    }
                }
                else
                {
                    _secondaryMonitorLockdown.DismissBarriers();
                    if (!_isExamActive && !BtnLaunch.IsEnabled && LblStatus.Text.Contains("Multiple displays detected"))
                    {
                        LblStatus.Text = "Single display verified. You may now authenticate.";
                        LblStatus.Foreground = (SolidColorBrush)FindResource("SuccessGreen");
                        BtnLaunch.IsEnabled = true;
                    }
                }

                if (_isExamActive)
                {
                    _secondaryMonitorLockdown.ConfineCursor(this);
                }
            });
        }

        protected override void OnDeactivated(EventArgs e)
        {
            base.OnDeactivated(e);
            Dispatcher.InvokeAsync(() =>
            {
                Topmost = true;
                Activate();
                if (_mainWindowHandle != IntPtr.Zero)
                {
                    Win32.SetForegroundWindow(_mainWindowHandle);
                }
                if (_isExamActive && (DateTime.UtcNow - _lastFocusViolationUtc).TotalSeconds >= 2.0)
                {
                    _lastFocusViolationUtc = DateTime.UtcNow;
                    RegisterSecurityViolation("Window deactivated: Application lost foreground focus.");
                }
            });
        }

        protected override void OnStateChanged(EventArgs e)
        {
            base.OnStateChanged(e);
            if (WindowState != WindowState.Maximized)
            {
                WindowState = WindowState.Maximized;
            }
        }

        #endregion

        #region Single-Contact Touch Restriction

        private void Window_PreviewTouchDown(object sender, TouchEventArgs e)
        {
            if (!_primaryTouchDeviceId.HasValue)
            {
                // Accept the first contact point as primary pointer
                _primaryTouchDeviceId = e.TouchDevice.Id;
            }
            else if (_primaryTouchDeviceId.Value != e.TouchDevice.Id)
            {
                // Drop all multi-touch / multi-finger contacts!
                e.Handled = true;
                if (_isExamActive)
                {
                    RegisterSecurityViolation("Multi-touch contact intercepted on trackpad/screen");
                }
            }
        }

        private void Window_PreviewTouchMove(object sender, TouchEventArgs e)
        {
            if (_primaryTouchDeviceId.HasValue && _primaryTouchDeviceId.Value != e.TouchDevice.Id)
            {
                // Drop secondary movement
                e.Handled = true;
            }
        }

        private void Window_PreviewTouchUp(object sender, TouchEventArgs e)
        {
            if (_primaryTouchDeviceId.HasValue && _primaryTouchDeviceId.Value == e.TouchDevice.Id)
            {
                _primaryTouchDeviceId = null;
            }
        }

        #endregion

        #region Candidate Keyboard Navigation

        private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
        {
            if (!_isExamActive) return;

            // If focused on Rough Space / Scratchpad, let candidate type freely
            if (TxtScratchpad.IsFocused) return;

            if (e.Key == Key.Left || e.Key == Key.PageUp)
            {
                if (_currentQuestionIndex > 0)
                {
                    _currentQuestionIndex--;
                    RenderCurrentQuestion();
                    UpdateQuestionPalette();
                    e.Handled = true;
                }
            }
            else if (e.Key == Key.Right || e.Key == Key.PageDown)
            {
                if (_currentQuestionIndex < _questions.Count - 1)
                {
                    _currentQuestionIndex++;
                    RenderCurrentQuestion();
                    UpdateQuestionPalette();
                    e.Handled = true;
                }
            }
            else if (e.Key == Key.R && Keyboard.Modifiers == ModifierKeys.None)
            {
                BtnMarkReview_Click(this, new RoutedEventArgs());
                e.Handled = true;
            }
            else if (e.Key == Key.Delete || e.Key == Key.Back)
            {
                BtnClearResponse_Click(this, new RoutedEventArgs());
                e.Handled = true;
            }
            else if (_questions.Count > 0 && _currentQuestionIndex < _questions.Count)
            {
                var q = _questions[_currentQuestionIndex];
                int optIndex = -1;
                if (e.Key == Key.D1 || e.Key == Key.NumPad1 || e.Key == Key.A) optIndex = 0;
                else if (e.Key == Key.D2 || e.Key == Key.NumPad2 || e.Key == Key.B) optIndex = 1;
                else if (e.Key == Key.D3 || e.Key == Key.NumPad3 || e.Key == Key.C) optIndex = 2;
                else if (e.Key == Key.D4 || e.Key == Key.NumPad4 || e.Key == Key.D) optIndex = 3;
                else if (e.Key == Key.D5 || e.Key == Key.NumPad5 || e.Key == Key.E) optIndex = 4;

                if (optIndex >= 0 && optIndex < q.Options.Count)
                {
                    SelectOption(q.Id, q.Options[optIndex].Id);
                    e.Handled = true;
                }
            }
        }

        #endregion
    }
}
