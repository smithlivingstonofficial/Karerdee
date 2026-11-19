"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getCandidateDetailedLogAction } from "../actions";
import { formatTime, formatDate, formatDateTime } from "@/lib/date";
import {
  X,
  Camera,
  Lock,
  Unlock,
  Bell,
  Clock,
  RotateCcw,
  Monitor,
  MessageCircle,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Check,
  Search,
  Maximize2,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Eye,
  Send,
  HelpCircle,
  KeyRound,
  Layers,
  ChevronRight,
  Filter,
  FileText,
  UserCheck,
  Shield,
  Zap,
} from "lucide-react";

export interface CandidateDetailedModalProps {
  sessionId: string;
  onClose: () => void;
  onLockWorkstation?: (sessionId: string, reason?: string) => Promise<any>;
  onUnlockWorkstation?: (sessionId: string) => Promise<any>;
  onSendWarning?: (sessionId: string, message: string) => Promise<any>;
  onAddExtraTime?: (sessionId: string, minutes: number) => Promise<any>;
  onResetStrikes?: (sessionId: string) => Promise<any>;
  onRebindHardware?: (studentId: string, candidateName: string) => Promise<any>;
  onRequestSnapshot?: (sessionId: string, candidateName: string) => Promise<any>;
  onSendReply?: (sessionId: string, replyText: string, messageId?: string) => Promise<any>;
}

interface ForensicEvent {
  id: string;
  type: "START" | "ANSWER" | "VIOLATION" | "PROCTOR" | "CHAT" | "SUBMIT" | "SNAPSHOT";
  title: string;
  description: string;
  timestamp: string;
  strikeNumber?: number;
  snapshotUrl?: string | null;
  metadata?: any;
}

export function CandidateDetailedModal({
  sessionId,
  onClose,
  onLockWorkstation,
  onUnlockWorkstation,
  onSendWarning,
  onAddExtraTime,
  onResetStrikes,
  onRebindHardware,
  onRequestSnapshot,
  onSendReply,
}: CandidateDetailedModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [proctorActions, setProctorActions] = useState<any[]>([]);

  // Selected snapshot for photo viewer
  const [selectedSnapshotUrl, setSelectedSnapshotUrl] = useState<string | null>(null);
  const [selectedSnapshotMeta, setSelectedSnapshotMeta] = useState<{ time?: string; label?: string } | null>(null);

  // Active tab & filter
  const [activeTab, setActiveTab] = useState<"TIMELINE" | "INTERVENE" | "CHAT">("TIMELINE");
  const [timelineFilter, setTimelineFilter] = useState<"ALL" | "VIOLATIONS" | "ANSWERS" | "PROCTOR">("ALL");

  // Inline action forms state
  const [warningPreset, setWarningPreset] = useState<string>("Please keep your eyes focused on the screen and do not look away.");
  const [freezeReason, setFreezeReason] = useState<string>("Suspicious behavioral telemetry detected by invigilator.");
  const [chatMessage, setChatMessage] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch candidate log
  const loadCandidateData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await getCandidateDetailedLogAction(sessionId);
      if (res.error) {
        setError(res.error);
      } else {
        setSessionData(res.session);
        setViolations(res.violations || []);
        setSubmissions(res.submissions || []);
        setProctorActions(res.proctorActions || []);

        // Pick latest snapshot
        const latestSnap = (res.violations || []).find((v: any) => v.snapshot_url);
        if (latestSnap) {
          setSelectedSnapshotUrl(latestSnap.snapshot_url);
          setSelectedSnapshotMeta({
            time: latestSnap.created_at,
            label: latestSnap.violation_type || "Webcam Snapshot",
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load candidate detailed logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadCandidateData();
  }, [loadCandidateData]);

  // Extract all snapshots across violations
  const allSnapshots = useMemo(() => {
    return violations
      .filter((v) => v.snapshot_url)
      .map((v) => ({
        id: v.id,
        url: v.snapshot_url,
        time: v.created_at,
        type: v.violation_type,
        strikeNumber: v.strike_number,
      }));
  }, [violations]);

  // Generate Chronological Forensic Action Log
  const timelineEvents: ForensicEvent[] = useMemo(() => {
    if (!sessionData) return [];
    const events: ForensicEvent[] = [];

    // 1. Session Start
    if (sessionData.started_at) {
      events.push({
        id: "sess_start",
        type: "START",
        title: "Examination Session Launched",
        description: `Candidate authenticated and locked down desktop client (${sessionData.client_version || "WPF .NET 8"}). HW: ${sessionData.hardware_fingerprint || "UNBOUND"}`,
        timestamp: sessionData.started_at,
      });
    }

    // 2. Submissions / Answers
    submissions.forEach((sub, idx) => {
      events.push({
        id: `sub_${sub.id || idx}`,
        type: "ANSWER",
        title: `Question Submission Saved`,
        description: `Recorded answer synchronization. ${sub.is_auto_graded ? `Auto-graded: ${sub.awarded_points ?? 0} pts.` : "Response captured."}`,
        timestamp: sub.last_synced_at || sessionData.started_at,
      });
    });

    // 3. Violations & Integrity events
    violations.forEach((v) => {
      const isSnapshotOnly = v.metadata?.action === "CMD_REQUEST_SNAP" || v.metadata?.isAuditSnapshot;
      events.push({
        id: `viol_${v.id}`,
        type: isSnapshotOnly ? "SNAPSHOT" : "VIOLATION",
        title: isSnapshotOnly ? "Forensic Webcam Snapshot Verified" : (v.violation_type?.replace(/_/g, " ") || "Integrity Violation"),
        description: v.metadata?.reason || v.metadata?.message || `Infraction logged. Strike #${v.strike_number || 0}`,
        timestamp: v.created_at,
        strikeNumber: v.strike_number,
        snapshotUrl: v.snapshot_url,
        metadata: v.metadata,
      });
    });

    // 4. Proctor Actions
    proctorActions.forEach((p) => {
      const payload = p.action_payload || {};
      const isChat = payload.type === "CANDIDATE_MESSAGE" || payload.type === "PROCTOR_REPLY";
      events.push({
        id: `proctor_${p.id}`,
        type: isChat ? "CHAT" : "PROCTOR",
        title: isChat ? (payload.sender === "PROCTOR" ? "Invigilator Dispatched Message" : "Candidate Submitted Question Doubt") : `Proctor Action: ${p.action_type || "Intervention"}`,
        description: p.reason || payload.message || "Administrative intervention recorded.",
        timestamp: p.created_at,
        metadata: payload,
      });
    });

    // 5. Final Submission
    if (sessionData.submitted_at) {
      events.push({
        id: "sess_submit",
        type: "SUBMIT",
        title: "Examination Finalized & Submitted",
        description: "Candidate completed sitting and final paper answer script was permanently sealed.",
        timestamp: sessionData.submitted_at,
      });
    }

    // Sort descending (most recent at top)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events;
  }, [sessionData, submissions, violations, proctorActions]);

  // Filtered timeline
  const filteredTimeline = useMemo(() => {
    if (timelineFilter === "ALL") return timelineEvents;
    if (timelineFilter === "VIOLATIONS") {
      return timelineEvents.filter((e) => e.type === "VIOLATION" || e.type === "SNAPSHOT");
    }
    if (timelineFilter === "ANSWERS") {
      return timelineEvents.filter((e) => e.type === "ANSWER" || e.type === "START" || e.type === "SUBMIT");
    }
    if (timelineFilter === "PROCTOR") {
      return timelineEvents.filter((e) => e.type === "PROCTOR" || e.type === "CHAT");
    }
    return timelineEvents;
  }, [timelineEvents, timelineFilter]);

  // Action handlers with visual notice
  async function handleLock() {
    if (!onLockWorkstation) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await onLockWorkstation(sessionId, freezeReason);
      if (res?.error) {
        setActionNotice({ type: "error", text: res.error });
      } else {
        setActionNotice({ type: "success", text: "Workstation frozen. Candidate screen is locked." });
        setSessionData((prev: any) => prev ? { ...prev, status: "LOCKED" } : prev);
        loadCandidateData(true);
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message || "Failed to lock workstation." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnlock() {
    if (!onUnlockWorkstation) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await onUnlockWorkstation(sessionId);
      if (res?.error) {
        setActionNotice({ type: "error", text: res.error });
      } else {
        setActionNotice({ type: "success", text: "Workstation unlocked. Candidate can continue." });
        setSessionData((prev: any) => prev ? { ...prev, status: "IN_PROGRESS" } : prev);
        loadCandidateData(true);
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message || "Failed to unlock workstation." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendWarning() {
    if (!onSendWarning || !warningPreset.trim()) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await onSendWarning(sessionId, warningPreset.trim());
      if (res?.error) {
        setActionNotice({ type: "error", text: res.error });
      } else {
        setActionNotice({ type: "success", text: "Warning dispatched to candidate's screen in real time." });
        loadCandidateData(true);
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message || "Failed to dispatch warning." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddExtraTime(minutes: number) {
    if (!onAddExtraTime) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await onAddExtraTime(sessionId, minutes);
      if (res?.error) {
        setActionNotice({ type: "error", text: res.error });
      } else {
        setActionNotice({ type: "success", text: `+${minutes} minutes compensatory time granted.` });
        setSessionData((prev: any) => prev ? { ...prev, extra_time_minutes: (prev.extra_time_minutes || 0) + minutes } : prev);
        loadCandidateData(true);
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message || "Failed to grant extra time." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetStrikes() {
    if (!onResetStrikes) return;
    if (!confirm("Are you sure you want to clear this candidate's strikes back to 0?")) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await onResetStrikes(sessionId);
      if (res?.error) {
        setActionNotice({ type: "error", text: res.error });
      } else {
        setActionNotice({ type: "success", text: "Candidate strikes cleared to 0." });
        setSessionData((prev: any) => prev ? { ...prev, strikes_count: 0, status: "IN_PROGRESS" } : prev);
        loadCandidateData(true);
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message || "Failed to reset strikes." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRebindPC() {
    if (!onRebindHardware || !sessionData?.student?.id) return;
    if (!confirm(`Reset machine binding for ${sessionData.student.full_name}? Candidate can log in on another PC.`)) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await onRebindHardware(sessionData.student.id, sessionData.student.full_name);
      if (res?.error) {
        setActionNotice({ type: "error", text: res.error });
      } else {
        setActionNotice({ type: "success", text: "Hardware binding released. Candidate can authenticate on replacement workstation." });
        loadCandidateData(true);
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message || "Failed to rebind workstation." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSnapRequest() {
    if (!onRequestSnapshot || !sessionData) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await onRequestSnapshot(sessionId, sessionData.student?.full_name || "Candidate");
      if (res?.error) {
        setActionNotice({ type: "error", text: res.error });
      } else {
        setActionNotice({ type: "success", text: "Webcam capture command dispatched to workstation! Waiting for frame..." });
        // Poll shortly after
        setTimeout(() => loadCandidateData(true), 2500);
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message || "Failed to request webcam snapshot." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendChatReply() {
    if (!onSendReply || !chatMessage.trim()) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await onSendReply(sessionId, chatMessage.trim());
      if (res?.error) {
        setActionNotice({ type: "error", text: res.error });
      } else {
        setActionNotice({ type: "success", text: "Response transmitted to candidate." });
        setChatMessage("");
        loadCandidateData(true);
      }
    } catch (e: any) {
      setActionNotice({ type: "error", text: e.message || "Failed to send chat reply." });
    } finally {
      setActionLoading(false);
    }
  }

  const student = sessionData?.student || {};
  const department = student?.department || {};
  const exam = sessionData?.exam || {};
  const isLocked = sessionData?.status === "LOCKED";
  const isSubmitted = sessionData?.status === "SUBMITTED";

  // Calculate elapsed time & remaining time
  const timeInfo = useMemo(() => {
    if (!sessionData?.started_at) return { elapsed: "--", remaining: "--", percent: 0 };
    const startMs = new Date(sessionData.started_at).getTime();
    const endMs = sessionData.submitted_at ? new Date(sessionData.submitted_at).getTime() : Date.now();
    const elapsedMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));

    const totalAllowedMinutes = (exam.duration_minutes || 90) + (sessionData.extra_time_minutes || 0);
    const remainingMinutes = Math.max(0, totalAllowedMinutes - elapsedMinutes);
    const percent = Math.min(100, Math.round((elapsedMinutes / totalAllowedMinutes) * 100));

    return {
      elapsed: `${elapsedMinutes}m`,
      remaining: `${remainingMinutes}m`,
      totalAllowed: `${totalAllowedMinutes}m`,
      percent,
    };
  }, [sessionData, exam]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header Banner */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center font-extrabold text-sm shadow-xs flex-shrink-0">
              {student.full_name ? student.full_name.slice(0, 2).toUpperCase() : "CA"}
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                  {student.full_name || "Candidate Surveillance Dossier"}
                </h2>
                <span className="font-mono text-xs text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  {student.application_number || student.roll_number || "NO-APP-ID"}
                </span>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {department.code ? `${department.code} • ${department.name || ""}` : "Department"}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                <span className="font-semibold text-slate-700 truncate max-w-md">
                  {exam.title || "Examination Paper"}
                </span>
                <span>•</span>
                <span className="truncate">{student.email || ""}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 flex-shrink-0">
            {/* Status Pill */}
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold tracking-wide border shadow-2xs ${
                sessionData?.status === "IN_PROGRESS"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isLocked
                  ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
                  : isSubmitted
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mr-1.5 ${
                  sessionData?.status === "IN_PROGRESS"
                    ? "bg-emerald-600 animate-pulse"
                    : isLocked
                    ? "bg-red-600 animate-pulse"
                    : isSubmitted
                    ? "bg-blue-600"
                    : "bg-slate-400"
                }`}
              />
              {sessionData?.status === "IN_PROGRESS" ? "IN SESSION" : (sessionData?.status || "LOADING")}
            </span>

            {/* Refresh Button */}
            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                loadCandidateData(true);
              }}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-200 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Notice Bar if present */}
        {actionNotice && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
              actionNotice.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <div className="flex items-center space-x-2">
              {actionNotice.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-red-600" />
              )}
              <span>{actionNotice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body: Split Investigation Studio */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-bold text-slate-700">Loading Candidate Telemetry & Forensic Stream...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600 space-y-2">
            <ShieldAlert className="w-8 h-8 mx-auto" />
            <p className="font-bold text-sm">{error}</p>
            <button
              type="button"
              onClick={() => loadCandidateData()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* LEFT COLUMN (5 of 12 cols): Surveillance Evidence & Biometrics Studio */}
            <div className="lg:col-span-5 p-5 space-y-5 bg-slate-50/50 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Section Title */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Camera className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Live Webcam Surveillance
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {allSnapshots.length} Capture(s)
                  </span>
                </div>

                {/* Primary High-Resolution Snapshot Frame */}
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-300 shadow-inner group">
                  {selectedSnapshotUrl ? (
                    <>
                      <img
                        src={selectedSnapshotUrl}
                        alt="Candidate surveillance view"
                        className="w-full h-full object-cover"
                      />
                      {/* Top HUD overlay */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1" />
                          BIOMETRIC AUDIT
                        </span>
                        {selectedSnapshotMeta?.time && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono text-white/90">
                            {formatTime(selectedSnapshotMeta.time)}
                          </span>
                        )}
                      </div>

                      {/* Bottom HUD overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                        <span className="text-[10px] text-white/90 font-mono bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
                          {selectedSnapshotMeta?.label || "Webcam Frame"}
                        </span>
                        <a
                          href={selectedSnapshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pointer-events-auto p-1 rounded-md bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs transition-colors"
                          title="Open full resolution in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                      <Camera className="w-10 h-10 mb-2 text-slate-500" />
                      <p className="text-xs font-bold text-slate-300">No snapshot recorded yet</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                        Dispatch an on-demand snapshot command to verify the examinee&apos;s face and physical workspace immediately.
                      </p>
                    </div>
                  )}
                </div>

                {/* Instant Snapshot Dispatch Button */}
                <button
                  type="button"
                  disabled={actionLoading || isSubmitted || sessionData?.status !== "IN_PROGRESS"}
                  onClick={handleSnapRequest}
                  className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-40"
                >
                  <Camera className="w-4 h-4" />
                  <span>Request Fresh Live Webcam Snapshot</span>
                </button>

                {/* All Snapshots Filmstrip Gallery */}
                {allSnapshots.length > 1 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Snapshot Archive ({allSnapshots.length} Photos)
                    </p>
                    <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin">
                      {allSnapshots.map((snap, idx) => (
                        <button
                          key={snap.id}
                          type="button"
                          onClick={() => {
                            setSelectedSnapshotUrl(snap.url);
                            setSelectedSnapshotMeta({
                              time: snap.time,
                              label: snap.type || `Photo #${idx + 1}`,
                            });
                          }}
                          className={`relative w-20 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all cursor-pointer ${
                            selectedSnapshotUrl === snap.url
                              ? "border-blue-600 ring-2 ring-blue-500/30 scale-102"
                              : "border-slate-300 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={snap.url}
                            alt={`Snap ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] font-mono text-white text-center py-0.5 truncate px-1">
                            {formatTime(snap.time)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Workstation Hardware & Security Lockdown Integrity Card */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-800">Workstation Integrity</h4>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Lockdown Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Hardware Binding</p>
                      <p className="font-mono font-bold text-slate-800 truncate" title={sessionData?.hardware_fingerprint}>
                        {sessionData?.hardware_fingerprint || "UNBOUND"}
                      </p>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Client Version</p>
                      <p className="font-mono font-bold text-slate-800 truncate">
                        {sessionData?.client_version || "WPF .NET 8"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 text-[10px] text-slate-600 pt-1">
                    <div className="flex items-center space-x-1.5 text-emerald-700">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Screen Recorder Blocking Active (WDA_EXCLUDEFROMCAPTURE)</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-emerald-700">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Win32 Low-Level Keyboard Hook Active (Hotkeys Suppressed)</span>
                    </div>
                  </div>

                  {onRebindHardware && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleRebindPC}
                      className="w-full mt-1 py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer border border-slate-200 flex items-center justify-center space-x-1.5"
                    >
                      <Monitor className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reset Hardware Lock (Allow New PC)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Exam Duration & Time Clock Bar */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    Exam Clock
                  </span>
                  <span className="font-mono font-extrabold text-slate-900">
                    {timeInfo.elapsed} / {timeInfo.totalAllowed}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 ${
                      timeInfo.percent >= 90
                        ? "bg-red-500"
                        : timeInfo.percent >= 75
                        ? "bg-amber-500"
                        : "bg-blue-600"
                    }`}
                    style={{ width: `${timeInfo.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Started: {formatTime(sessionData?.started_at)}</span>
                  <span className="font-bold text-slate-700">
                    {timeInfo.remaining} Remaining
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (7 of 12 cols): Forensic Activity Stream & Command Center */}
            <div className="lg:col-span-7 flex flex-col bg-white">
              {/* Tabs Navigation Header */}
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center space-x-1.5 bg-slate-200/70 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveTab("TIMELINE")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      activeTab === "TIMELINE"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Forensic Activity Stream ({timelineEvents.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("INTERVENE")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      activeTab === "INTERVENE"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Intervention Controls</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("CHAT")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                      activeTab === "CHAT"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Doubt Chat</span>
                  </button>
                </div>

                {/* Sub-filters for Timeline */}
                {activeTab === "TIMELINE" && (
                  <div className="flex items-center space-x-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setTimelineFilter("ALL")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                        timelineFilter === "ALL"
                          ? "bg-blue-600 text-white"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter("VIOLATIONS")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                        timelineFilter === "VIOLATIONS"
                          ? "bg-red-600 text-white"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Alerts ({violations.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter("ANSWERS")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                        timelineFilter === "ANSWERS"
                          ? "bg-emerald-600 text-white"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Answers ({submissions.length})
                    </button>
                  </div>
                )}
              </div>

              {/* Tab 1: Forensic Activity Stream ("What they are doing in the exam") */}
              {activeTab === "TIMELINE" && (
                <div className="p-5 flex-1 overflow-y-auto space-y-4">
                  {filteredTimeline.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 space-y-2">
                      <Activity className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-bold text-xs text-slate-600">No events recorded in this category</p>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 pl-5">
                      {filteredTimeline.map((ev) => {
                        const isViol = ev.type === "VIOLATION";
                        const isAnswer = ev.type === "ANSWER";
                        const isProctor = ev.type === "PROCTOR";
                        const isStart = ev.type === "START";
                        const isSubmit = ev.type === "SUBMIT";
                        const isSnap = ev.type === "SNAPSHOT";

                        return (
                          <div key={ev.id} className="relative group">
                            {/* Dot icon on line */}
                            <span
                              className={`absolute -left-[27px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold shadow-2xs ${
                                isViol
                                  ? "bg-red-600 text-white ring-2 ring-red-400/30"
                                  : isAnswer
                                  ? "bg-emerald-600 text-white"
                                  : isProctor
                                  ? "bg-blue-600 text-white"
                                  : isSnap
                                  ? "bg-indigo-600 text-white"
                                  : isSubmit
                                  ? "bg-purple-600 text-white"
                                  : "bg-slate-500 text-white"
                              }`}
                            />

                            <div className="bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-200 transition-colors space-y-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`text-xs font-black tracking-tight ${
                                      isViol
                                        ? "text-red-700"
                                        : isAnswer
                                        ? "text-emerald-800"
                                        : isProctor
                                        ? "text-blue-800"
                                        : "text-slate-800"
                                    }`}
                                  >
                                    {ev.title}
                                  </span>

                                  {ev.strikeNumber !== undefined && ev.strikeNumber > 0 && (
                                    <span className="font-mono text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.2 rounded border border-red-200">
                                      Strike #{ev.strikeNumber}
                                    </span>
                                  )}
                                </div>

                                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                  {formatDateTime(ev.timestamp)}
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 leading-relaxed">
                                {ev.description}
                              </p>

                              {/* Snapshot attachment thumbnail if violation has photo */}
                              {ev.snapshotUrl && (
                                <div className="pt-1.5 flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSnapshotUrl(ev.snapshotUrl!);
                                      setSelectedSnapshotMeta({
                                        time: ev.timestamp,
                                        label: ev.title,
                                      });
                                    }}
                                    className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold transition-colors cursor-pointer"
                                  >
                                    <Camera className="w-3 h-3" />
                                    <span>Inspect Captured Webcam Evidence</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Invigilator Command & Intervention Center */}
              {activeTab === "INTERVENE" && (
                <div className="p-5 flex-1 overflow-y-auto space-y-5">
                  {/* Freeze / Unlock Panel */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {isLocked ? (
                          <Lock className="w-4 h-4 text-red-600" />
                        ) : (
                          <Unlock className="w-4 h-4 text-emerald-600" />
                        )}
                        <h4 className="text-xs font-black text-slate-900 uppercase">
                          Workstation Lock & Freeze Controls
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isLocked
                            ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {isLocked ? "Currently Locked" : "Currently Active"}
                      </span>
                    </div>

                    {isLocked ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600">
                          This workstation is currently frozen. The candidate cannot view exam questions or submit answers.
                        </p>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={handleUnlock}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                        >
                          <Unlock className="w-4 h-4" />
                          <span>Release Lock & Resume Sitting</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-xs text-slate-600">
                          Locking immediately freezes the candidate&apos;s screen with a full-screen lockdown banner.
                        </p>
                        <input
                          type="text"
                          value={freezeReason}
                          onChange={(e) => setFreezeReason(e.target.value)}
                          placeholder="Reason for freezing workstation..."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                        />
                        <button
                          type="button"
                          disabled={actionLoading || isSubmitted}
                          onClick={handleLock}
                          className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs disabled:opacity-40"
                        >
                          <Lock className="w-4 h-4" />
                          <span>Freeze Workstation Now</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dispatch Warning to Screen */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-black text-slate-900 uppercase">
                        Dispatch Direct Warning to Screen
                      </h4>
                    </div>

                    <p className="text-xs text-slate-600">
                      Transmits a high-priority warning popup over the candidate&apos;s exam interface in real-time.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        Quick Preset Warnings
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Please keep your eyes focused on the screen.",
                          "No talking or looking away from your workstation.",
                          "Ensure your entire face is visible in the camera frame.",
                          "Close any unauthorized background applications.",
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setWarningPreset(preset)}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-[10px] font-semibold text-slate-700 text-left transition-colors cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={warningPreset}
                      onChange={(e) => setWarningPreset(e.target.value)}
                      className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />

                    <button
                      type="button"
                      disabled={actionLoading || isSubmitted || !warningPreset.trim()}
                      onClick={handleSendWarning}
                      className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs disabled:opacity-40"
                    >
                      <Bell className="w-4 h-4" />
                      <span>Transmit Warning to Examinee</span>
                    </button>
                  </div>

                  {/* Compensatory Time & Strike Reset Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Compensatory Time */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-800">Add Compensatory Time</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Allocated extra: +{sessionData?.extra_time_minutes || 0} minutes
                      </p>
                      <div className="flex items-center space-x-2">
                        {[5, 10, 15].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            disabled={actionLoading || isSubmitted}
                            onClick={() => handleAddExtraTime(mins)}
                            className="flex-1 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                          >
                            +{mins}m
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Strikes Counter */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                      <div className="flex items-center space-x-1.5">
                        <RotateCcw className="w-4 h-4 text-slate-600" />
                        <h4 className="text-xs font-bold text-slate-800">Clear Strikes</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Current strikes: {sessionData?.strikes_count || 0} / {exam?.max_strikes || 3}
                      </p>
                      <button
                        type="button"
                        disabled={actionLoading || isSubmitted || (sessionData?.strikes_count || 0) === 0}
                        onClick={handleResetStrikes}
                        className="w-full py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                      >
                        Reset Strikes to 0
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Candidate Live Chat / Doubt Desk */}
              {activeTab === "CHAT" && (
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {timelineEvents.filter((e) => e.type === "CHAT").length === 0 ? (
                      <div className="p-12 text-center text-slate-400 space-y-2">
                        <MessageCircle className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="font-bold text-xs text-slate-600">No doubts or messages yet</p>
                        <p className="text-[11px] text-slate-400">
                          Inquiries raised by the candidate during the exam appear here instantly.
                        </p>
                      </div>
                    ) : (
                      timelineEvents
                        .filter((e) => e.type === "CHAT")
                        .map((msg) => {
                          const isProctor = msg.metadata?.sender === "PROCTOR";
                          return (
                            <div
                              key={msg.id}
                              className={`p-3 rounded-2xl border text-xs max-w-[85%] space-y-1 ${
                                isProctor
                                  ? "ml-auto bg-blue-600 text-white border-blue-700"
                                  : "mr-auto bg-slate-100 text-slate-800 border-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] opacity-80 pb-0.5">
                                <span className="font-bold">
                                  {isProctor ? "Invigilator Response" : student.full_name}
                                </span>
                                <span>{formatTime(msg.timestamp)}</span>
                              </div>
                              <p className="leading-relaxed font-medium">{msg.description}</p>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Send Direct Reply Input */}
                  <div className="border-t border-slate-200 pt-3 flex items-center space-x-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatReply();
                        }
                      }}
                      placeholder="Type direct response to candidate screen..."
                      className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                    <button
                      type="button"
                      disabled={actionLoading || !chatMessage.trim()}
                      onClick={handleSendChatReply}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 flex items-center space-x-1.5 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
