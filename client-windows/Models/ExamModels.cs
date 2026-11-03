using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace SafeExamClient.Models
{
    public sealed class OptionModel
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;
    }

    public sealed class QuestionModel
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("sectionId")]
        public string SectionId { get; set; } = string.Empty;

        [JsonPropertyName("questionType")]
        public string QuestionType { get; set; } = "MCQ_SINGLE";

        [JsonPropertyName("prompt")]
        public string Prompt { get; set; } = string.Empty;

        [JsonPropertyName("codeSnippet")]
        public string? CodeSnippet { get; set; }

        [JsonPropertyName("points")]
        public double Points { get; set; } = 1.0;

        [JsonPropertyName("negativePoints")]
        public double NegativePoints { get; set; } = 0.0;

        [JsonPropertyName("orderIndex")]
        public int OrderIndex { get; set; }

        [JsonPropertyName("options")]
        public List<OptionModel> Options { get; set; } = new();
    }

    public sealed class SectionModel
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("is_common")]
        public bool IsCommon { get; set; }

        [JsonPropertyName("target_departments")]
        public List<string>? TargetDepartments { get; set; }
    }

    public sealed class CandidateModel
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("rollNumber")]
        public string RollNumber { get; set; } = string.Empty;

        [JsonPropertyName("applicationNumber")]
        public string? ApplicationNumber { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }

        [JsonPropertyName("fullName")]
        public string FullName { get; set; } = string.Empty;

        [JsonPropertyName("department")]
        public string Department { get; set; } = string.Empty;
    }

    public sealed class ExamModel
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("durationMinutes")]
        public int DurationMinutes { get; set; } = 90;

        [JsonPropertyName("maxStrikes")]
        public int MaxStrikes { get; set; } = 3;

        [JsonPropertyName("currentStrikes")]
        public int CurrentStrikes { get; set; } = 0;

        [JsonPropertyName("status")]
        public string Status { get; set; } = "IN_PROGRESS";

        [JsonPropertyName("enableNegativeMarking")]
        public bool EnableNegativeMarking { get; set; }

        [JsonPropertyName("sections")]
        public List<SectionModel> Sections { get; set; } = new();

        [JsonPropertyName("questions")]
        public List<QuestionModel> Questions { get; set; } = new();

        [JsonPropertyName("serverTime")]
        public string? ServerTime { get; set; }

        [JsonPropertyName("serverEpochMs")]
        public long ServerEpochMs { get; set; }

        [JsonPropertyName("startTime")]
        public string? StartTime { get; set; }

        [JsonPropertyName("endTime")]
        public string? EndTime { get; set; }

        [JsonPropertyName("remainingSeconds")]
        public int RemainingSeconds { get; set; }

        [JsonPropertyName("calculatorMode")]
        public string CalculatorMode { get; set; } = "NONE";

        [JsonPropertyName("enableScratchpad")]
        public bool EnableScratchpad { get; set; } = true;

        [JsonPropertyName("enableQuestionFlagging")]
        public bool EnableQuestionFlagging { get; set; } = true;

        [JsonPropertyName("instructions")]
        public string? Instructions { get; set; }

        [JsonPropertyName("strikeAction")]
        public string StrikeAction { get; set; } = "LOCK_WORKSTATION";

        [JsonPropertyName("lockdownPolicy")]
        public LockdownPolicyModel? LockdownPolicy { get; set; }
    }

    public sealed class LockdownPolicyModel
    {
        [JsonPropertyName("blockKeyboardHooks")]
        public bool BlockKeyboardHooks { get; set; } = true;

        [JsonPropertyName("blockDisplayAffinity")]
        public bool BlockDisplayAffinity { get; set; } = true;

        [JsonPropertyName("blockMultipleMonitors")]
        public bool BlockMultipleMonitors { get; set; } = true;

        [JsonPropertyName("blockVirtualMachines")]
        public bool BlockVirtualMachines { get; set; } = true;

        [JsonPropertyName("blockBlacklistedProcesses")]
        public bool BlockBlacklistedProcesses { get; set; } = true;

        [JsonPropertyName("lockHardwareFingerprint")]
        public bool LockHardwareFingerprint { get; set; } = false;
    }

    public sealed class AuthResponseModel
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("token")]
        public string Token { get; set; } = string.Empty;

        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = string.Empty;

        [JsonPropertyName("candidate")]
        public CandidateModel? Candidate { get; set; }

        [JsonPropertyName("exam")]
        public ExamModel? Exam { get; set; }

        [JsonPropertyName("error")]
        public string? Error { get; set; }

        [JsonPropertyName("code")]
        public string? Code { get; set; }

        [JsonPropertyName("serverTime")]
        public string? ServerTime { get; set; }

        [JsonPropertyName("serverEpochMs")]
        public long ServerEpochMs { get; set; }

        [JsonPropertyName("startTime")]
        public string? StartTime { get; set; }

        [JsonPropertyName("endTime")]
        public string? EndTime { get; set; }

        [JsonPropertyName("graceCutoff")]
        public string? GraceCutoff { get; set; }

        [JsonPropertyName("remainingSeconds")]
        public int RemainingSeconds { get; set; }

        [JsonPropertyName("delayMinutes")]
        public int DelayMinutes { get; set; }

        [JsonPropertyName("pendingProctorApproval")]
        public bool PendingProctorApproval { get; set; }
    }

    public sealed class HeartbeatResponseModel
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("sessionStatus")]
        public string SessionStatus { get; set; } = "IN_PROGRESS";

        [JsonPropertyName("extraTimeMinutes")]
        public int ExtraTimeMinutes { get; set; }

        [JsonPropertyName("strikesCount")]
        public int StrikesCount { get; set; }

        [JsonPropertyName("serverTime")]
        public string? ServerTime { get; set; }

        [JsonPropertyName("serverEpochMs")]
        public long ServerEpochMs { get; set; }

        [JsonPropertyName("serverCalculatedSecondsRemaining")]
        public int ServerCalculatedSecondsRemaining { get; set; }

        [JsonPropertyName("isExpired")]
        public bool IsExpired { get; set; }
    }
}

