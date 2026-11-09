"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  lockWorkstationAction,
  unlockWorkstationAction,
  addExtraTimeAction,
  resetStrikesAction,
  resetCandidateWorkstationBindingAction,
  grantLateEntryAction,
  denyLateEntryAction,
  sendProctorWarningAction,
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

interface LiveProctoringClientViewProps {
  initialSessions: ProctoringSession[];
  recentViolations: ViolationFeedItem[];
  exams: { id: string; title: string; status: string; passcode: string }[];
}

export function LiveProctoringClientView({
  initialSessions,
  recentViolations: initialViolations,
  exams,
}: LiveProctoringClientViewProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ProctoringSession[]>(initialSessions);
  const [violations, setViolations] = useState<ViolationFeedItem[]>(initialViolations);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedExamId, setSelectedExamId] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<ViolationFeedItem | null>(null);
  const [warningTarget, setWarningTarget] = useState<{ sessionId: string; candidateName: string } | null>(null);
  const [warningPresetText, setWarningPresetText] = useState("Please look directly at your examination screen.");

  // Sync state when fresh server props arrive
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    setViolations(initialViolations);
  }, [initialViolations]);

  // Periodic background telemetry refresh every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);

  function handleManualRefresh() {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }

  // Filter sessions
  const filtered = sessions.filter((s) => {
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

  const activeCount = sessions.filter((s) => s.status === "IN_PROGRESS").length;
  const warningCount = sessions.filter((s) => s.strikesCount > 0 && s.status === "IN_PROGRESS").length;
  const lockedCount = sessions.filter((s) => s.status === "LOCKED").length;
  const submittedCount = sessions.filter((s) => s.status === "SUBMITTED").length;

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

  const pendingLateEntries = sessions.filter((s) => s.isPendingLateEntry && s.status === "LOCKED");

  return (
    <div className="space-y-6">
      {/* SaaS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Live Proctoring &amp; Workstation Command Center
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Realtime hardware monitor, low-level Win32 integrity feeds, and remote proctor intervention controls.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh active workstations and live telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-blue-700 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh Feed
          </button>

          <Link
            href="/sitting"
            target="_blank"
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Launch Sitting Engine Simulator
          </Link>
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
            className="text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

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

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Workstations</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Monitor className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{activeCount}</div>
          <span className="text-[10px] text-emerald-700 font-bold block mt-1">Live in-session</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Integrity Warnings</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">{warningCount}</div>
          <span className="text-[10px] text-amber-700 font-bold block mt-1">1-2 infractions recorded</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Locked Workstations</span>
            <div className="p-1.5 rounded-lg bg-red-50 text-red-700">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-700 mt-2">{lockedCount}</div>
          <span className="text-[10px] text-red-700 font-bold block mt-1">Struck out / proctor frozen</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Submissions Completed</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{submittedCount}</div>
          <span className="text-[10px] text-blue-700 font-bold block mt-1">Auto-graded &amp; finalized</span>
        </div>
      </div>

      {/* Main Grid: Workstations Table (8 cols) + Realtime Feed (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Candidate Sittings */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Candidate Workstations ({filtered.length})
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search candidate / app no..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 w-48 sm:w-60"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-semibold cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active (In Session)</option>
                  <option value="WARNING">Warnings (&gt;= 1 Strike)</option>
                  <option value="LOCKED">Locked Workstations</option>
                  <option value="SUBMITTED">Completed Submissions</option>
                </select>
              </div>
            </div>

            {/* Workstations Table */}
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <Monitor className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold">No active examination workstations match the query.</p>
                <p className="text-[11px] text-slate-400">
                  Workstations appear here automatically when candidates launch the Windows Lockdown Client.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="py-2.5 px-3">Candidate</th>
                      <th className="py-2.5 px-3">Dept</th>
                      <th className="py-2.5 px-3">Workstation &amp; Strikes</th>
                      <th className="py-2.5 px-3">Extra Time</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Intervention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filtered.map((s) => {
                      const isLocked = s.status === "LOCKED";
                      const isSubmitted = s.status === "SUBMITTED";
                      const isLoading = actionLoadingId === s.id || actionLoadingId === s.studentId;

                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isLocked ? "bg-red-50/30" : s.strikesCount > 0 ? "bg-amber-50/20" : ""
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{s.candidateName}</div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-blue-700 font-semibold">
                                {s.applicationNumber}
                              </span>
                              {s.hardwareFingerprint?.startsWith("WEB-") || s.hardwareFingerprint?.startsWith("BROWSER-") ? (
                                <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200 inline-flex items-center">
                                  <Globe className="w-2.5 h-2.5 mr-0.5" />
                                  Web
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 inline-flex items-center">
                                  <Monitor className="w-2.5 h-2.5 mr-0.5" />
                                  Desktop
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-xs">{s.email}</div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                              {s.departmentCode}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`font-mono text-[10px] font-black px-2 py-0.5 rounded border ${
                                  s.strikesCount === 0
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : s.strikesCount >= s.maxStrikes
                                    ? "bg-red-100 text-red-700 border-red-300"
                                    : "bg-amber-50 text-amber-700 border-amber-300"
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
                                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[9px] font-bold transition-colors cursor-pointer shadow-2xs"
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
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
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
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  s.status === "IN_PROGRESS"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : s.status === "LOCKED"
                                    ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                                    : s.status === "SUBMITTED"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {s.status === "IN_PROGRESS" && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
                                )}
                                {s.status}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {isSubmitted ? (
                              <span className="text-[10px] text-slate-400 font-semibold">Finalized</span>
                            ) : (
                              <div className="inline-flex items-center space-x-1.5">
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
                                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                                    title="Unlock Workstation"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleLock(s.id)}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                                    title="Freeze Workstation Immediately"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Issue Warning to Candidate Screen */}
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => setWarningTarget({ sessionId: s.id, candidateName: s.candidateName })}
                                  className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                                  title="Dispatch Warning to Candidate Screen"
                                >
                                  <Bell className="w-3.5 h-3.5" />
                                </button>

                                {/* Add Compensatory Time Dropdown / Button */}
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleAddExtraTime(s.id, 5)}
                                  className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                                  title="Add +5 Minutes Compensatory Time"
                                >
                                  +5m
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleAddExtraTime(s.id, 10)}
                                  className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                                  title="Add +10 Minutes Compensatory Time"
                                >
                                  +10m
                                </button>

                                {/* Reset Strikes */}
                                {s.strikesCount > 0 && (
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={() => handleResetStrikes(s.id)}
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
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
                                  className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                                  title="Reset PC Hardware Lock (Release to New Machine)"
                                >
                                  <Monitor className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
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
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3.5">
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
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {violations.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1.5 hover:border-red-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate max-w-[180px]">
                        {v.candidateName}
                      </span>
                      <span className="font-mono text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700 border border-red-200">
                        Strike #{v.strikeNumber}
                      </span>
                    </div>

                    <div className="text-[11px] font-medium text-red-700 flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{v.violationType}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span className="font-mono">{v.departmentCode} • {v.applicationNumber}</span>
                      <span suppressHydrationWarning>{formatTime(v.createdAt, true)}</span>
                    </div>

                    {v.snapshotUrl && (
                      <div className="pt-1.5 flex items-center justify-between border-t border-slate-200/60 mt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedEvidence(v)}
                          className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <Camera className="w-3 h-3 mr-1" />
                          View Photo Evidence
                        </button>
                        <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
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
              lockout dialog. Invigilators can review the integrity log and choose to <strong>Unlock</strong> or
              rebind hardware if legitimate issues occurred.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          EVIDENCE INSPECTOR MODAL: FULL RESOLUTION FORENSIC VIEWER
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

