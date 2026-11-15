"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import {
  lockWorkstationAction,
  unlockWorkstationAction,
  addExtraTimeAction,
  resetStrikesAction,
  resetCandidateWorkstationBindingAction,
  grantLateEntryAction,
  denyLateEntryAction,
  sendProctorWarningAction,
  sendProctorReplyAction,
  markInquiryResolvedAction,
} from "../actions";
import { formatTime, formatDate, formatDateTime } from "@/lib/date";
import {
  Activity,
  ShieldAlert,
  Lock,
  Unlock,
  Clock,
  RotateCcw,
  Search,
  Users,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Building2,
  KeyRound,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Wifi,
  WifiOff,
  Radio,
  FileText,
  Camera,
  X,
  Globe,
  Bell,
  MessageSquare,
  MessageCircle,
  Send,
  CheckCheck,
  Copy,
  Check,
  Filter,
  Layers,
  HelpCircle,
  Tag,
  ChevronRight,
  UserCheck,
} from "lucide-react";

export interface ProctoringSession {
  id: string;
  studentId: string;
  candidateName: string;
  applicationNumber: string;
  email: string;
  departmentCode: string;
  departmentName: string;
  examId: string;
  examTitle: string;
  examPasscode: string;
  maxStrikes: number;
  strikesCount: number;
  status: "IN_PROGRESS" | "LOCKED" | "PAUSED" | "SUBMITTED" | "DISQUALIFIED";
  hardwareFingerprint: string;
  clientVersion?: string;
  extraTimeMinutes: number;
  startedAt: string;
  updatedAt: string;
  submissionsCount: number;
  isPendingLateEntry?: boolean;
  lateEntryDetails?: {
    delayMinutes: number;
    graceBufferMinutes: number;
    attemptedAt: string;
    reason: string;
  } | null;
  recentViolations: {
    id: string;
    violationType: string;
    strikeNumber: number;
    createdAt: string;
  }[];
}

export interface ViolationFeedItem {
  id: string;
  sessionId: string;
  candidateName: string;
  applicationNumber: string;
  departmentCode: string;
  examTitle: string;
  violationType: string;
  strikeNumber: number;
  snapshotUrl?: string | null;
  createdAt: string;
  metadata?: any;
}

export interface ExamClassificationItem {
  id: string;
  title: string;
  courseCode?: string | null;
  status: string;
  passcode: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number;
}

export interface CandidateInquiryItem {
  id: string;
  sessionId: string;
  messageId?: string;
  sender: "CANDIDATE" | "PROCTOR";
  category: "QUESTION_DOUBT" | "TECH_ISSUE" | "SUBMISSION_ISSUE" | "GENERAL_DOUBT";
  questionNumber?: number | null;
  message: string;
  candidateName: string;
  applicationNumber: string;
  departmentCode: string;
  examId: string;
  examTitle: string;
  status: "UNREAD" | "READ" | "RESOLVED";
  createdAt: string;
}

interface LiveProctoringClientViewProps {
  initialSessions: ProctoringSession[];
  recentViolations: ViolationFeedItem[];
  exams: ExamClassificationItem[];
  initialInquiries?: CandidateInquiryItem[];
}

export function LiveProctoringClientView({
  initialSessions,
  recentViolations: initialViolations,
  exams,
  initialInquiries = [],
}: LiveProctoringClientViewProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ProctoringSession[]>(initialSessions);
  const [violations, setViolations] = useState<ViolationFeedItem[]>(initialViolations);
  const [inquiries, setInquiries] = useState<CandidateInquiryItem[]>(initialInquiries);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedExamId, setSelectedExamId] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<ViolationFeedItem | null>(null);
  const [warningTarget, setWarningTarget] = useState<{ sessionId: string; candidateName: string } | null>(null);
  const [warningPresetText, setWarningPresetText] = useState("Please look directly at your examination screen.");

  // Candidate Helpdesk & Doubt Assistance State
  const [isHelpdeskOpen, setIsHelpdeskOpen] = useState(false);
  const [selectedInquirySessionId, setSelectedInquirySessionId] = useState<string | null>(null);
  const [inquirySearch, setInquirySearch] = useState("");
  const [inquiryTab, setInquiryTab] = useState<"UNRESOLVED" | "ALL" | "RESOLVED">("UNRESOLVED");
  const [proctorReplyText, setProctorReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [copiedPasscodeId, setCopiedPasscodeId] = useState<string | null>(null);

  // Sync state when fresh server props arrive
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    setViolations(initialViolations);
  }, [initialViolations]);

  useEffect(() => {
    if (initialInquiries) {
      setInquiries(initialInquiries);
    }
  }, [initialInquiries]);

  // Periodic background telemetry refresh every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);

  // Supabase Realtime Listener for Candidate Inquiries and Live Broadcasts
  useEffect(() => {
    const channel = supabaseClient
      .channel("exam-proctor-broadcast")
      .on("broadcast", { event: "candidate_inquiry" }, (eventPayload: any) => {
        const payload = eventPayload?.payload || eventPayload;
        if (!payload) return;

        const newInquiry: CandidateInquiryItem = {
          id: payload.messageId || `inq_${Date.now()}`,
          sessionId: payload.sessionId,
          messageId: payload.messageId,
          sender: "CANDIDATE",
          category: payload.category || "GENERAL_DOUBT",
          questionNumber: payload.questionNumber || null,
          message: payload.message,
          candidateName: payload.candidateName || "Candidate",
          applicationNumber: payload.applicationNumber || "",
          departmentCode: payload.departmentCode || "GENERAL",
          examId: payload.examId || "",
          examTitle: payload.examTitle || "Examination",
          status: "UNREAD",
          createdAt: payload.timestamp || new Date().toISOString(),
        };

        setInquiries((prev) => [newInquiry, ...prev]);
        setNotice({
          type: "success",
          text: `💬 New inquiry from ${newInquiry.candidateName} (${newInquiry.departmentCode}): "${newInquiry.message.slice(0, 45)}..."`,
        });
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  function handleManualRefresh() {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }

  function handleCopyPasscode(examId: string, passcode: string) {
    if (!passcode) return;
    navigator.clipboard.writeText(passcode);
    setCopiedPasscodeId(examId);
    setTimeout(() => setCopiedPasscodeId(null), 2500);
  }

  // Filter sessions
  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        s.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.departmentCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.hardwareFingerprint.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && s.status === "IN_PROGRESS") ||
        (statusFilter === "WARNING" && s.strikesCount > 0 && s.status !== "LOCKED") ||
        (statusFilter === "LOCKED" && s.status === "LOCKED") ||
        (statusFilter === "SUBMITTED" && s.status === "SUBMITTED");

      const matchesExam = selectedExamId === "ALL" || s.examId === selectedExamId;

      return matchesSearch && matchesStatus && matchesExam;
    });
  }, [sessions, searchTerm, statusFilter, selectedExamId]);

  // Context-aware metrics
  const scopedSessions = useMemo(() => {
    return selectedExamId === "ALL" ? sessions : sessions.filter((s) => s.examId === selectedExamId);
  }, [sessions, selectedExamId]);

  const activeCount = scopedSessions.filter((s) => s.status === "IN_PROGRESS").length;
  const warningCount = scopedSessions.filter((s) => s.strikesCount > 0 && s.status === "IN_PROGRESS").length;
  const lockedCount = scopedSessions.filter((s) => s.status === "LOCKED").length;
  const submittedCount = scopedSessions.filter((s) => s.status === "SUBMITTED").length;

  // Unread inquiries count
  const unreadInquiriesCount = useMemo(() => {
    return inquiries.filter((inq) => inq.sender === "CANDIDATE" && inq.status !== "RESOLVED").length;
  }, [inquiries]);

  // Inquiries grouped by session
  const inquiriesBySession = useMemo(() => {
    const map = new Map<string, CandidateInquiryItem[]>();
    for (const inq of inquiries) {
      const list = map.get(inq.sessionId) || [];
      list.push(inq);
      map.set(inq.sessionId, list);
    }
    return map;
  }, [inquiries]);

  // Selected session inquiry thread
  const selectedThreadInquiries = useMemo(() => {
    if (!selectedInquirySessionId) return [];
    const list = inquiriesBySession.get(selectedInquirySessionId) || [];
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [selectedInquirySessionId, inquiriesBySession]);

  const selectedThreadSession = useMemo(() => {
    if (!selectedInquirySessionId) return null;
    return sessions.find((s) => s.id === selectedInquirySessionId) || null;
  }, [selectedInquirySessionId, sessions]);

  async function handleLock(sessionId: string) {
    if (!confirm("Are you sure you want to FREEZE this workstation immediately?")) return;
    setActionLoadingId(sessionId);
    setNotice(null);
    try {
      const res = await lockWorkstationAction(sessionId);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setNotice({ type: "success", text: "Workstation locked successfully." });
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, status: "LOCKED" } : s))
        );
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to lock workstation." });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleUnlock(sessionId: string) {
    setActionLoadingId(sessionId);
    setNotice(null);
    try {
      const res = await unlockWorkstationAction(sessionId);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setNotice({ type: "success", text: "Workstation unlocked. Candidate can resume sitting." });
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, status: "IN_PROGRESS" } : s))
        );
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to unlock workstation." });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleAddExtraTime(sessionId: string, minutes: number) {
    setActionLoadingId(sessionId);
    setNotice(null);
    try {
      const res = await addExtraTimeAction(sessionId, minutes);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setNotice({ type: "success", text: `Added +${minutes} minutes compensatory time.` });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, extraTimeMinutes: (s.extraTimeMinutes || 0) + minutes }
              : s
          )
        );
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to add compensatory time." });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleResetStrikes(sessionId: string) {
    if (!confirm("Reset strikes counter to 0 for this candidate?")) return;
    setActionLoadingId(sessionId);
    setNotice(null);
    try {
      const res = await resetStrikesAction(sessionId);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setNotice({ type: "success", text: "Candidate strikes reset to 0." });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, strikesCount: 0, status: "IN_PROGRESS" }
              : s
          )
        );
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to reset strike counter." });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRebindPC(studentId: string, candidateName: string) {
    if (
      !confirm(
        `Release hardware binding for ${candidateName}? This allows them to log in from a replacement PC.`
      )
    )
      return;
    setActionLoadingId(studentId);
    setNotice(null);
    try {
      const res = await resetCandidateWorkstationBindingAction(studentId);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setNotice({ type: "success", text: `Hardware binding released for ${candidateName}.` });
        setSessions((prev) =>
          prev.map((s) =>
            s.studentId === studentId
              ? { ...s, hardwareFingerprint: "UNBOUND_RESET_BY_ADMIN", status: "IN_PROGRESS" }
              : s
          )
        );
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to release hardware binding." });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleGrantLateEntry(sessionId: string, candidateName: string) {
    setActionLoadingId(sessionId);
    setNotice(null);
    try {
      const res = await grantLateEntryAction(sessionId);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setNotice({
          type: "success",
          text: `Late entry exception granted for ${candidateName}. Workstation unlocked.`,
        });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, status: "IN_PROGRESS", isPendingLateEntry: false }
              : s
          )
        );
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to grant late entry." });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDenyLateEntry(sessionId: string, candidateName: string) {
    if (!confirm(`Are you sure you want to DENY late entry for ${candidateName}? This will disqualify them.`)) return;
    setActionLoadingId(sessionId);
    setNotice(null);
    try {
      const res = await denyLateEntryAction(sessionId);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setNotice({
          type: "error",
          text: `Late entry denied for ${candidateName}. Candidate disqualified.`,
        });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, status: "DISQUALIFIED", isPendingLateEntry: false }
              : s
          )
        );
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to deny late entry." });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSendWarning() {
    if (!warningTarget) return;
    setActionLoadingId(warningTarget.sessionId);
    setNotice(null);
    try {
      const res = await sendProctorWarningAction(warningTarget.sessionId, warningPresetText);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setNotice({ type: "success", text: `Warning dispatched to ${warningTarget.candidateName} in real time.` });
        setWarningTarget(null);
        router.refresh();
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to dispatch warning." });
    } finally {
      setActionLoadingId(null);
    }
  }

  // Handle Proctor Reply Dispatch
  async function handleSendProctorReply() {
    if (!selectedInquirySessionId || !proctorReplyText.trim()) return;
    setIsSendingReply(true);

    try {
      const targetSession = sessions.find((s) => s.id === selectedInquirySessionId);
      const res = await sendProctorReplyAction(selectedInquirySessionId, proctorReplyText.trim());

      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        const newReply: CandidateInquiryItem = {
          id: `reply_${Date.now()}`,
          sessionId: selectedInquirySessionId,
          sender: "PROCTOR",
          category: "GENERAL_DOUBT",
          message: proctorReplyText.trim(),
          candidateName: targetSession?.candidateName || "Candidate",
          applicationNumber: targetSession?.applicationNumber || "",
          departmentCode: targetSession?.departmentCode || "GENERAL",
          examId: targetSession?.examId || "",
          examTitle: targetSession?.examTitle || "Examination",
          status: "RESOLVED",
          createdAt: new Date().toISOString(),
        };

        setInquiries((prev) => [newReply, ...prev]);
        setProctorReplyText("");
        setNotice({
          type: "success",
          text: `Reply dispatched to candidate screen in real time.`,
        });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to dispatch reply." });
    } finally {
      setIsSendingReply(false);
    }
  }

  // Handle Mark Inquiry as Resolved
  async function handleMarkResolved(inquiryId: string) {
    try {
      const res = await markInquiryResolvedAction(inquiryId);
      if (res.error) {
        setNotice({ type: "error", text: res.error });
      } else {
        setInquiries((prev) =>
          prev.map((inq) => (inq.id === inquiryId ? { ...inq, status: "RESOLVED" } : inq))
        );
        setNotice({ type: "success", text: "Inquiry marked as resolved." });
      }
    } catch (err: any) {
      setNotice({ type: "error", text: err.message || "Failed to update inquiry." });
    }
  }

  const formatViolationType = (type: string) => {
    switch (type) {
      case "WINDOW_UNFOCUSED":
        return "Window Lost Focus";
      case "FULLSCREEN_EXIT":
        return "Full-Screen Exited";
      case "MULTIPLE_DISPLAYS":
        return "Multiple Displays";
      case "KEYBOARD_RESTRICTION":
        return "Prohibited Keystroke";
      case "DEVTOOLS_ATTEMPT":
        return "DevTools Detected";
      case "CLIPBOARD_ACCESS":
        return "Clipboard Blocked";
      case "SUSPICIOUS_WEBCAM_ACTIVITY":
        return "Suspicious Gaze / Head Pose";
      default:
        return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const pendingLateEntries = scopedSessions.filter((s) => s.isPendingLateEntry && s.status === "LOCKED");

  // Selected Exam Object
  const currentExamObj = exams.find((e) => e.id === selectedExamId);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 w-full">
      {/* 1. Combined Executive Command Center & Proctoring Telemetry Deck */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Top Header Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-white via-slate-50/30 to-blue-50/20">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Official Square KARE Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 p-0.5 flex items-center justify-center flex-shrink-0 shadow-2xs overflow-hidden">
              <img
                src="/kare-square-logo.png"
                alt="KARE Logo"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Live Proctoring &amp; Invigilation Deck
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
                  Live Telemetry
                </span>
                {selectedExamId !== "ALL" && currentExamObj && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    Scoped: {currentExamObj.title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Candidate Helpdesk / Doubt Assistance Trigger */}
            <button
              type="button"
              onClick={() => {
                setIsHelpdeskOpen(true);
                if (!selectedInquirySessionId && inquiries.length > 0) {
                  setSelectedInquirySessionId(inquiries[0].sessionId);
                }
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer relative"
              title="Open Live Candidate Helpdesk & Doubt Inquiries"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>Candidate Helpdesk</span>
              {unreadInquiriesCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-red-600 text-white animate-pulse">
                  {unreadInquiriesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Refresh active workstations and live telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 text-blue-700 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh Feed</span>
            </button>

            <Link
              href="/sitting"
              target="_blank"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Sitting Simulator</span>
            </Link>
          </div>
        </div>

        {/* 4 Clean Metric Cells (Context-reactive) */}
        <div className="border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {/* Metric 1: Active Workstations */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                Active Workstations
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] flex items-center space-x-1 ${
                  activeCount > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {activeCount > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping mr-0.5" />
                )}
                <span>{activeCount > 0 ? "In Session" : "Idle"}</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {activeCount}
              </span>
              <span className="text-xs text-slate-400">
                examinees sitting {selectedExamId !== "ALL" ? "in this exam" : "overall"}
              </span>
            </div>
          </div>

          {/* Metric 2: Integrity Warnings */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
                Integrity Warnings
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] ${
                  warningCount > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {warningCount > 0 ? `${warningCount} Flagged` : "Clean"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-amber-700 tracking-tight">
                {warningCount}
              </span>
              <span className="text-xs text-slate-400">infractions recorded</span>
            </div>
          </div>

          {/* Metric 3: Locked Workstations */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-red-700 transition-colors">
                Locked Workstations
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] ${
                  lockedCount > 0
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {lockedCount > 0 ? "Struck Out" : "Zero Frozen"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-red-700 tracking-tight">
                {lockedCount}
              </span>
              <span className="text-xs text-slate-400">proctor frozen</span>
            </div>
          </div>

          {/* Metric 4: Completed Submissions */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
                Completed Submissions
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                {submittedCount} Finalized
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {submittedCount}
              </span>
              <span className="text-xs text-slate-400">auto-graded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notices */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {notice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          2. EXAM CLASSIFICATION SELECTOR DECK (Scope by Examination Paper)
         ===================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 flex-shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Examination Classification Deck
              </h2>
              <p className="text-[11px] text-slate-500">
                Select an examination paper to scope workstations, telemetry, and live candidate doubts.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {exams.length} Configured Examinations
            </span>
            {selectedExamId !== "ALL" && (
              <button
                type="button"
                onClick={() => setSelectedExamId("ALL")}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 mr-0.5" />
                <span>Show All Exams</span>
              </button>
            )}
          </div>
        </div>

        {/* Exam Cards Deck */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
          {/* Card: All Examinations (Master View) */}
          <button
            type="button"
            onClick={() => setSelectedExamId("ALL")}
            className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 relative group ${
              selectedExamId === "ALL"
                ? "bg-blue-50/40 border-blue-600 ring-2 ring-blue-600/20 shadow-xs"
                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 group-hover:text-blue-700 transition-colors">
                  Consolidated View
                </span>
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm mt-0.5">
                  All Examinations
                </h3>
              </div>
              <span
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                  selectedExamId === "ALL"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                }`}
              >
                {selectedExamId === "ALL" ? <Check className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
              <span>Total Examinees</span>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                {sessions.length} Candidates
              </span>
            </div>
          </button>

          {/* Cards for each specific exam */}
          {exams.map((exam) => {
            const isSelected = selectedExamId === exam.id;
            const examSessions = sessions.filter((s) => s.examId === exam.id);
            const activeInExam = examSessions.filter((s) => s.status === "IN_PROGRESS").length;
            const lockedInExam = examSessions.filter((s) => s.status === "LOCKED").length;

            return (
              <div
                key={exam.id}
                onClick={() => setSelectedExamId(exam.id)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2.5 relative group ${
                  isSelected
                    ? "bg-blue-50/40 border-blue-600 ring-2 ring-blue-600/20 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                }`}
              >
                {/* Top Row: Title & Status */}
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-extrabold uppercase font-mono text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                        {exam.courseCode || "EXAM"}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                          exam.status === "ONGOING"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : exam.status === "COMPLETED"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {exam.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm mt-1 truncate" title={exam.title}>
                      {exam.title}
                    </h3>
                  </div>

                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                </div>

                {/* Middle: Passcode & Duration */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center space-x-1">
                    <KeyRound className="w-3 h-3 text-slate-400" />
                    <span className="font-mono font-bold text-slate-700">
                      {exam.passcode || "None"}
                    </span>
                    {exam.passcode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPasscode(exam.id, exam.passcode);
                        }}
                        className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                        title="Copy Exam Passcode"
                      >
                        {copiedPasscodeId === exam.id ? (
                          <CheckCheck className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 font-medium">
                    {exam.durationMinutes || 90} Mins
                  </span>
                </div>

                {/* Bottom Row: Candidate Counts */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-900">{examSessions.length} sitting</span>
                    {activeInExam > 0 && (
                      <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded">
                        {activeInExam} active
                      </span>
                    )}
                    {lockedInExam > 0 && (
                      <span className="text-[10px] font-extrabold bg-red-50 text-red-700 px-1.5 py-0.2 rounded">
                        {lockedInExam} locked
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 group-hover:underline">
                    {isSelected ? "Active Focus" : "Select"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* High-Priority Late Entry Exception Review */}
      {pendingLateEntries.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs border border-amber-300">
                <Clock className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Late Arrival Exceptions Awaiting Invigilator Action
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                    {pendingLateEntries.length} Pending
                  </span>
                </h3>
                <p className="text-xs text-slate-600">
                  These candidates attempted login after the scheduled grace buffer expired. Review delay details and grant entry exception if legitimate.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingLateEntries.map((ple) => (
              <div
                key={ple.id}
                className="bg-white border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3 shadow-2xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {ple.candidateName}
                    </div>
                    <div className="font-mono text-xs text-blue-700 font-semibold">
                      {ple.applicationNumber} • {ple.departmentCode}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {ple.email}
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 font-mono">
                    +{ple.lateEntryDetails?.delayMinutes ?? 15} Mins Late
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-2 font-medium">
                  {ple.lateEntryDetails?.reason || "Candidate attempted authentication after scheduled start + grace buffer."}
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={actionLoadingId === ple.id}
                    onClick={() => handleDenyLateEntry(ple.id, ple.candidateName)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                  >
                    Deny Entry
                  </button>
                  <button
                    type="button"
                    disabled={actionLoadingId === ple.id}
                    onClick={() => handleGrantLateEntry(ple.id, ple.candidateName)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition-colors shadow-2xs cursor-pointer flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    <span>Grant Late Entry Exception</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Workstations Table (8 cols) + Realtime Feed (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Active Candidate Sittings */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            {/* Filter & Search Bar */}
            <div className="p-4 sm:p-4.5 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 flex-shrink-0">
                  <Monitor className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Candidate Workstations
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {filtered.length} Total
                  </span>
                  {selectedExamId !== "ALL" && currentExamObj && (
                    <span className="text-xs text-slate-500 font-medium">
                      in {currentExamObj.title}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search candidate / app no..."
                    className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 w-48 sm:w-60 transition-all shadow-2xs"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-700 font-semibold cursor-pointer shadow-2xs transition-all"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active (In Session)</option>
                  <option value="WARNING">Warnings (≥ 1 Strike)</option>
                  <option value="LOCKED">Locked Workstations</option>
                  <option value="SUBMITTED">Completed Submissions</option>
                </select>
              </div>
            </div>

            {/* Workstations Table */}
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <Monitor className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No active examination workstations match the query.</p>
                <p className="text-[11px] text-slate-400">
                  Workstations appear here automatically when candidates launch the examination portal.
                </p>
                {selectedExamId !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSelectedExamId("ALL")}
                    className="mt-2 inline-flex items-center px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    View All Examinations
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/80">
                    <tr>
                      <th className="py-3 px-4">Candidate &amp; Exam</th>
                      <th className="py-3 px-3">Dept</th>
                      <th className="py-3 px-3">Workstation &amp; Strikes</th>
                      <th className="py-3 px-3">Extra Time</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Intervention &amp; Doubt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filtered.map((s) => {
                      const isLocked = s.status === "LOCKED";
                      const isSubmitted = s.status === "SUBMITTED";
                      const isLoading = actionLoadingId === s.id || actionLoadingId === s.studentId;
                      const sessionInquiries = inquiriesBySession.get(s.id) || [];
                      const hasUnreadInquiry = sessionInquiries.some(
                        (i) => i.sender === "CANDIDATE" && i.status !== "RESOLVED"
                      );

                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isLocked ? "bg-red-50/30" : s.strikesCount > 0 ? "bg-amber-50/20" : ""
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{s.candidateName}</div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-blue-700 font-semibold">
                                {s.applicationNumber}
                              </span>
                              <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200 inline-flex items-center">
                                <Globe className="w-2.5 h-2.5 mr-0.5" />
                                Online
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5 font-medium">
                              {s.examTitle}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-xs">{s.email}</div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200/60">
                              {s.departmentCode}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                  s.strikesCount === 0
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : s.strikesCount >= s.maxStrikes
                                    ? "bg-red-50 text-red-700 border-red-300"
                                    : "bg-amber-50 text-amber-800 border-amber-300"
                                }`}
                              >
                                Strikes: {s.strikesCount} / {s.maxStrikes}
                              </span>
                              {(() => {
                                const sessionEvidence = violations.find(
                                  (v) => v.sessionId === s.id && v.snapshotUrl
                                );
                                if (!sessionEvidence) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedEvidence(sessionEvidence)}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[9px] font-bold transition-colors cursor-pointer shadow-2xs"
                                    title="View forensic webcam snapshot"
                                  >
                                    <Camera className="w-2.5 h-2.5 mr-0.5" />
                                    Photo
                                  </button>
                                );
                              })()}
                            </div>
                            <div className="font-mono text-[9px] text-slate-400 mt-1 truncate max-w-[140px]" title={s.hardwareFingerprint}>
                              HW: {s.hardwareFingerprint}
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {s.extraTimeMinutes > 0 ? (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                +{s.extraTimeMinutes} Mins
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">None</span>
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {s.isPendingLateEntry && s.status === "LOCKED" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-300 animate-pulse">
                                <Clock className="w-3 h-3 mr-1 text-amber-600" />
                                LATE (+{s.lateEntryDetails?.delayMinutes ?? 15}m)
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide border shadow-2xs ${
                                  s.status === "IN_PROGRESS"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/90"
                                    : s.status === "LOCKED"
                                    ? "bg-red-50 text-red-700 border-red-200/90 animate-pulse"
                                    : s.status === "SUBMITTED"
                                    ? "bg-blue-50 text-blue-700 border-blue-200/90"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                    s.status === "IN_PROGRESS"
                                      ? "bg-emerald-600 animate-pulse"
                                      : s.status === "LOCKED"
                                      ? "bg-red-600 animate-pulse"
                                      : s.status === "SUBMITTED"
                                      ? "bg-blue-600"
                                      : "bg-slate-400"
                                  }`}
                                />
                                {s.status === "IN_PROGRESS"
                                  ? "IN SESSION"
                                  : s.status}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5">
                              {/* Open Candidate Chat / Doubt Desk */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInquirySessionId(s.id);
                                  setIsHelpdeskOpen(true);
                                }}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer relative shadow-2xs ${
                                  hasUnreadInquiry
                                    ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
                                    : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                }`}
                                title="Open Candidate Doubt & Chat Thread"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                {hasUnreadInquiry && (
                                  <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -right-0.5 ring-2 ring-white animate-pulse" />
                                )}
                              </button>

                              {s.isPendingLateEntry && isLocked && (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleGrantLateEntry(s.id, s.candidateName)}
                                  className="px-2 py-1 rounded-md bg-blue-700 text-white hover:bg-blue-800 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                                  title="Grant Late Entry Exception"
                                >
                                  Approve
                                </button>
                              )}

                              {/* Lock / Unlock Button */}
                              {isLocked ? (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleUnlock(s.id)}
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
                                  title="Unlock Workstation"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isLoading || isSubmitted}
                                  onClick={() => handleLock(s.id)}
                                  className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
                                  title="Freeze Workstation Immediately"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Issue Warning to Candidate Screen */}
                              <button
                                type="button"
                                disabled={isLoading || isSubmitted}
                                onClick={() => setWarningTarget({ sessionId: s.id, candidateName: s.candidateName })}
                                className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
                                title="Dispatch Warning to Candidate Screen"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </button>

                              {/* Add Compensatory Time Button */}
                              <button
                                type="button"
                                disabled={isLoading || isSubmitted}
                                onClick={() => handleAddExtraTime(s.id, 5)}
                                className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
                                title="Add +5 Minutes Compensatory Time"
                              >
                                +5m
                              </button>

                              {/* Reset Strikes */}
                              {s.strikesCount > 0 && (
                                <button
                                  type="button"
                                  disabled={isLoading || isSubmitted}
                                  onClick={() => handleResetStrikes(s.id)}
                                  className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                                  title="Clear Strikes Counter"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Rebind Hardware PC */}
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleRebindPC(s.studentId, s.candidateName)}
                                className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                                title="Reset PC Hardware Lock (Release to New Machine)"
                              >
                                <Monitor className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Infraction Feed */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Realtime Integrity Feed
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                {violations.length} Incidents
              </span>
            </div>

            {violations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
                <p className="font-bold text-slate-700">Clean Integrity Stream</p>
                <p className="text-[11px] text-slate-400">Zero security infractions registered.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {violations.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs space-y-1 hover:border-amber-300 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[170px]">
                        {v.candidateName}
                      </span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        Strike #{v.strikeNumber}
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-amber-700 flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                      <span className="truncate">{formatViolationType(v.violationType)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span className="font-mono text-slate-500">{v.departmentCode} • {v.applicationNumber}</span>
                      <span suppressHydrationWarning>{formatTime(v.createdAt, true)}</span>
                    </div>

                    {v.snapshotUrl && (
                      <div className="pt-1.5 flex items-center justify-between border-t border-slate-200/60 mt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedEvidence(v)}
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Camera className="w-3 h-3 mr-1" />
                          View Photo
                        </button>
                        <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          Photo Captured
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Hardware Lockdown Specs */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-slate-600">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Proctor Lockdown Protocol
            </span>
            <p className="text-[11px] leading-relaxed">
              When a candidate reaches their strike threshold, their workstation renders an unbypassable
              lockout dialog. Invigilators can review the integrity log, resolve student inquiries, and choose to <strong>Unlock</strong> or
              rebind hardware if legitimate issues occurred.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. CANDIDATE HELPDESK & DOUBT ASSISTANCE DRAWER / MODAL
         ===================================================================== */}
      {isHelpdeskOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[800px]">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-white via-slate-50 to-blue-50/30 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center border border-blue-200 shadow-2xs">
                  <MessageSquare className="w-4 h-4 text-blue-700" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      Live Candidate Helpdesk &amp; Doubt Assistance Desk
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      Realtime Messaging
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Review and reply to candidate question clarifications, tech issues, and doubt requests in real time.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHelpdeskOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content: 2 Columns (Thread List 4 cols + Chat View 8 cols) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Left Column: Candidates & Inquiries List */}
              <div className="md:col-span-5 flex flex-col min-h-0 bg-slate-50/60">
                {/* Search & Tabs */}
                <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={inquirySearch}
                      onChange={(e) => setInquirySearch(e.target.value)}
                      placeholder="Search candidate / question #..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                    />
                  </div>

                  <div className="flex items-center space-x-1">
                    {(["UNRESOLVED", "ALL", "RESOLVED"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setInquiryTab(tab)}
                        className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold transition-colors cursor-pointer text-center ${
                          inquiryTab === tab
                            ? "bg-blue-600 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {tab === "UNRESOLVED"
                          ? `Unresolved (${unreadInquiriesCount})`
                          : tab === "ALL"
                          ? `All (${inquiries.length})`
                          : "Resolved"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Candidate Threads List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {Array.from(inquiriesBySession.entries()).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                      <HelpCircle className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                      <p className="font-semibold text-slate-600">No Candidate Inquiries Yet</p>
                      <p className="text-[11px] text-slate-400">
                        When candidates ask doubts from their exam screen, they will appear here instantly.
                      </p>
                    </div>
                  ) : (
                    Array.from(inquiriesBySession.entries())
                      .filter(([sessId, thread]) => {
                        const first = thread[0];
                        const last = thread[thread.length - 1];
                        const hasUnresolved = thread.some(
                          (i) => i.sender === "CANDIDATE" && i.status !== "RESOLVED"
                        );

                        if (inquiryTab === "UNRESOLVED" && !hasUnresolved) return false;
                        if (inquiryTab === "RESOLVED" && hasUnresolved) return false;

                        if (inquirySearch) {
                          const q = inquirySearch.toLowerCase();
                          return (
                            first.candidateName.toLowerCase().includes(q) ||
                            first.applicationNumber.toLowerCase().includes(q) ||
                            first.departmentCode.toLowerCase().includes(q) ||
                            thread.some((i) => i.message.toLowerCase().includes(q))
                          );
                        }
                        return true;
                      })
                      .map(([sessId, thread]) => {
                        const first = thread[0];
                        const last = thread[thread.length - 1];
                        const isSelected = selectedInquirySessionId === sessId;
                        const hasUnresolved = thread.some(
                          (i) => i.sender === "CANDIDATE" && i.status !== "RESOLVED"
                        );

                        return (
                          <button
                            key={sessId}
                            type="button"
                            onClick={() => setSelectedInquirySessionId(sessId)}
                            className={`w-full text-left p-3 transition-colors cursor-pointer flex flex-col space-y-1.5 ${
                              isSelected
                                ? "bg-blue-50/70 border-l-4 border-l-blue-600 shadow-2xs"
                                : "hover:bg-slate-100/70 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-xs truncate max-w-[170px]">
                                {first.candidateName}
                              </span>
                              <span className="text-[10px] text-slate-400" suppressHydrationWarning>
                                {formatTime(last.createdAt, true)}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                {first.departmentCode} • {first.applicationNumber}
                              </span>
                              {first.questionNumber && (
                                <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                                  Q#{first.questionNumber}
                                </span>
                              )}
                              {hasUnresolved ? (
                                <span className="text-[9px] font-extrabold bg-red-50 text-red-700 px-1.5 py-0.2 rounded border border-red-200">
                                  Action Required
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                                  Resolved
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-600 line-clamp-1 italic">
                              &ldquo;{last.message}&rdquo;
                            </p>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Right Column: Active Thread & Response Desk */}
              <div className="md:col-span-7 flex flex-col min-h-0 bg-white">
                {selectedThreadSession || selectedThreadInquiries.length > 0 ? (
                  <>
                    {/* Thread Header with Candidate Quick Intervention */}
                    <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50 flex-shrink-0">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {selectedThreadSession?.candidateName || selectedThreadInquiries[0]?.candidateName}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                            {selectedThreadSession?.applicationNumber || selectedThreadInquiries[0]?.applicationNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {selectedThreadSession?.examTitle || selectedThreadInquiries[0]?.examTitle} • Dept:{" "}
                          {selectedThreadSession?.departmentCode || selectedThreadInquiries[0]?.departmentCode}
                        </div>
                      </div>

                      {/* Quick Actions for this candidate */}
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        {selectedThreadSession?.status === "LOCKED" && (
                          <button
                            type="button"
                            onClick={() => handleUnlock(selectedThreadSession.id)}
                            className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                          >
                            <Unlock className="w-3 h-3 mr-1" />
                            Unlock PC
                          </button>
                        )}

                        {selectedThreadSession && (
                          <button
                            type="button"
                            onClick={() => handleAddExtraTime(selectedThreadSession.id, 5)}
                            className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            +5m Extra
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Chat Messages Stream */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {selectedThreadInquiries.map((msg) => {
                        const isCandidate = msg.sender === "CANDIDATE";

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isCandidate ? "items-start" : "items-end"}`}
                          >
                            <div className="flex items-center space-x-1.5 mb-1 text-[10px] text-slate-400">
                              <span className="font-bold text-slate-700">
                                {isCandidate ? msg.candidateName : "Official Invigilator"}
                              </span>
                              <span suppressHydrationWarning>• {formatTime(msg.createdAt, true)}</span>
                              {msg.questionNumber && (
                                <span className="font-bold text-purple-700 bg-purple-50 px-1 rounded border border-purple-200">
                                  Regarding Q#{msg.questionNumber}
                                </span>
                              )}
                              {isCandidate && msg.status !== "RESOLVED" && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkResolved(msg.id)}
                                  className="text-emerald-700 font-bold hover:underline cursor-pointer"
                                  title="Mark this inquiry resolved"
                                >
                                  [Mark Resolved]
                                </button>
                              )}
                            </div>

                            <div
                              className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                                isCandidate
                                  ? "bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/80"
                                  : "bg-blue-600 text-white rounded-tr-xs"
                              }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Response Suggestion Chips */}
                    <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto flex-shrink-0 text-[11px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
                        Canned:
                      </span>
                      {[
                        "Checking with subject faculty regarding question clarification. Please proceed with next item.",
                        "Workstation lock released. Please refresh your browser screen and resume.",
                        "Compensatory +5 minutes has been credited to your sitting timer.",
                        "Option formatting verified. Please choose the most accurate answer.",
                      ].map((canned, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setProctorReplyText(canned)}
                          className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-blue-400 text-slate-600 text-[10px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                        >
                          {canned.slice(0, 32)}...
                        </button>
                      ))}
                    </div>

                    {/* Reply Composer */}
                    <div className="p-3 border-t border-slate-200 bg-white flex items-end space-x-2 flex-shrink-0">
                      <textarea
                        value={proctorReplyText}
                        onChange={(e) => setProctorReplyText(e.target.value)}
                        placeholder="Type response to candidate (broadcasted directly to their exam screen)..."
                        rows={2}
                        className="flex-1 p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 resize-none font-medium"
                      />
                      <button
                        type="button"
                        disabled={isSendingReply || !proctorReplyText.trim()}
                        onClick={handleSendProctorReply}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Reply</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-xs space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-300" />
                    <p className="font-semibold text-slate-600">Select an inquiry thread from the left</p>
                    <p className="text-[11px] text-slate-400 text-center max-w-sm">
                      Choose any candidate inquiry to view their doubt thread, issue compensatory extra time, or dispatch real-time responses.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. EVIDENCE INSPECTOR MODAL: FULL RESOLUTION FORENSIC VIEWER
         ===================================================================== */}
      {selectedEvidence && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-700 flex items-center justify-center border border-red-200">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Integrity Violation Evidence Inspector
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Forensic webcam snapshot captured during active security watchdog trigger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvidence(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Snapshot Preview Image */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 shadow-inner aspect-[4/3] flex items-center justify-center">
              {selectedEvidence.snapshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedEvidence.snapshotUrl}
                  alt="Forensic evidence snapshot"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400 text-xs p-6 space-y-2">
                  <Camera className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="font-semibold text-slate-300">No Snapshot Captured for This Infraction</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    This violation was generated without a video stream frame.
                  </p>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white border border-white/10 text-[10px] font-mono font-bold backdrop-blur-xs flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>EVIDENTIARY CAPTURE</span>
              </div>
            </div>

            {/* Incident Forensics Metadata Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedEvidence.candidateName}</span>
                  <span className="text-[11px] font-mono text-blue-700 font-semibold block">
                    {selectedEvidence.applicationNumber} ({selectedEvidence.departmentCode})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Examination Paper</span>
                  <span className="font-semibold text-slate-800 text-xs truncate block">{selectedEvidence.examTitle}</span>
                  <span className="text-[11px] text-slate-500 block" suppressHydrationWarning>
                    {formatDateTime(selectedEvidence.createdAt)}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200/80 pt-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Violation:</span>
                  <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px]">
                    {selectedEvidence.violationType}
                  </span>
                </div>
                <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                  Strike #{selectedEvidence.strikeNumber}
                </span>
              </div>
            </div>

            {/* Proctored Intervention Quick Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={actionLoadingId === selectedEvidence.sessionId}
                  onClick={() => handleUnlock(selectedEvidence.sessionId)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Unlock className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Unlock Workstation
                </button>
                <button
                  type="button"
                  disabled={actionLoadingId === selectedEvidence.sessionId}
                  onClick={() => handleAddExtraTime(selectedEvidence.sessionId, 5)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  +5m Extra Time
                </button>
                <button
                  type="button"
                  disabled={actionLoadingId === selectedEvidence.sessionId}
                  onClick={() => handleResetStrikes(selectedEvidence.sessionId)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Clear Strikes
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvidence(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Dispatch Modal */}
      {warningTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Issue Warning to Candidate
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWarningTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>
                Candidate: <span className="font-bold text-slate-900">{warningTarget.candidateName}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                This warning will be delivered immediately to the candidate's active sitting window in real time.
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Quick Preset Messages:
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  "Please look directly at your examination screen.",
                  "Secondary person or excessive noise detected in your room.",
                  "Do not attempt to exit fullscreen or switch windows.",
                  "Please adjust your webcam so your face is clearly visible.",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWarningPresetText(preset)}
                    className={`text-left p-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      warningPresetText === preset
                        ? "bg-amber-50 text-amber-900 border-amber-300 font-semibold"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 block">
                Warning Message:
              </label>
              <textarea
                value={warningPresetText}
                onChange={(e) => setWarningPresetText(e.target.value)}
                rows={3}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium text-slate-900"
                placeholder="Type custom warning..."
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWarningTarget(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!warningPresetText.trim() || actionLoadingId === warningTarget.sessionId}
                onClick={handleSendWarning}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Bell className="w-3.5 h-3.5 mr-1" />
                <span>Send Warning Now</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
