"use client";

import React, { memo, useState, useEffect } from "react";
import { ProctoringSession } from "./LiveProctoringClientView";
import { formatTime } from "@/lib/date";
import {
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
} from "lucide-react";

export interface CandidateProctorCardProps {
  session: ProctoringSession;
  unreadInquiriesCount?: number;
  isLoading?: boolean;
  onViewDetailed: (session: ProctoringSession) => void;
  onLock: (sessionId: string) => void;
  onUnlock: (sessionId: string) => void;
  onWarn: (sessionId: string, candidateName: string) => void;
  onRequestSnapshot: (sessionId: string, candidateName: string) => void;
  onAddExtraTime: (sessionId: string, minutes: number) => void;
  onOpenChat: (sessionId: string) => void;
  onResetStrikes?: (sessionId: string) => void;
  onRebindPC?: (studentId: string, candidateName: string) => void;
  onGrantLateEntry?: (sessionId: string, candidateName: string) => void;
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-violet-100 text-violet-700 border-violet-200",
    "bg-cyan-100 text-cyan-700 border-cyan-200",
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export const CandidateProctorCard = memo(function CandidateProctorCard({
  session,
  unreadInquiriesCount = 0,
  isLoading = false,
  onViewDetailed,
  onLock,
  onUnlock,
  onWarn,
  onRequestSnapshot,
  onAddExtraTime,
  onOpenChat,
  onResetStrikes,
  onRebindPC,
  onGrantLateEntry,
}: CandidateProctorCardProps) {
  const isLocked = session.status === "LOCKED";
  const isSubmitted = session.status === "SUBMITTED";
  const isWarning = session.strikesCount > 0 && !isLocked && !isSubmitted;

  // Track image load error to gracefully fall back to surveillance placeholder if URL is invalid
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [session.latestSnapshotUrl]);

  // Determine card outer border & status accent
  const borderStatusClass = isLocked
    ? "border-red-300 ring-2 ring-red-500/10 shadow-sm"
    : isWarning
    ? "border-amber-300 ring-1 ring-amber-500/10 shadow-sm"
    : isSubmitted
    ? "border-slate-200 opacity-90"
    : "border-slate-200 hover:border-blue-400 hover:shadow-md";

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden group ${borderStatusClass}`}
    >
      {/* 1. Header: Candidate Identity & Realtime Status */}
      <div className="p-3 pb-2.5 flex items-start justify-between gap-2 border-b border-slate-100 bg-white">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          {/* Avatar with dynamic color and status ring */}
          <div className="relative flex-shrink-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border shadow-2xs ${getAvatarColor(
                session.candidateName
              )}`}
            >
              {getInitials(session.candidateName)}
            </div>
            {/* Live Green Online Dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                isLocked
                  ? "bg-red-500 animate-pulse"
                  : isSubmitted
                  ? "bg-blue-500"
                  : "bg-emerald-500 animate-pulse"
              }`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5">
              <h3
                className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight truncate leading-tight hover:text-blue-700 cursor-pointer"
                onClick={() => onViewDetailed(session)}
                title={session.candidateName}
              >
                {session.candidateName}
              </h3>
            </div>

            <div className="flex items-center space-x-1.5 mt-1 flex-wrap gap-y-1">
              <span className="font-mono text-[9px] text-blue-700 font-bold bg-blue-50/90 px-1.5 py-0.5 rounded border border-blue-100 flex-shrink-0">
                {session.applicationNumber}
              </span>
              <span className="font-mono text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex-shrink-0">
                {session.departmentCode}
              </span>
            </div>
          </div>
        </div>

        {/* Status Pill Badge */}
        <div className="flex-shrink-0">
          {session.isPendingLateEntry && isLocked ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide border bg-amber-50 text-amber-800 border-amber-300 animate-pulse shadow-2xs">
              <Clock className="w-2.5 h-2.5 mr-1 text-amber-600" />
              LATE (+{session.lateEntryDetails?.delayMinutes ?? 15}m)
            </span>
          ) : (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border shadow-2xs ${
                session.status === "IN_PROGRESS"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : session.status === "LOCKED"
                  ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
                  : session.status === "SUBMITTED"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1 ${
                  session.status === "IN_PROGRESS"
                    ? "bg-emerald-600 animate-pulse"
                    : session.status === "LOCKED"
                    ? "bg-red-600 animate-pulse"
                    : session.status === "SUBMITTED"
                    ? "bg-blue-600"
                    : "bg-slate-400"
                }`}
              />
              {session.status === "IN_PROGRESS" ? "IN SESSION" : session.status}
            </span>
          )}
        </div>
      </div>

      {/* 2. Webcam Surveillance Viewport Frame (Aspect 16:9) */}
      <div className="relative aspect-video w-full bg-slate-900 overflow-hidden cursor-pointer">
        {session.latestSnapshotUrl && !imgError ? (
          <>
            {/* Captured Candidate Image */}
            <img
              src={session.latestSnapshotUrl}
              alt={`Webcam snap of ${session.candidateName}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
              onClick={() => onViewDetailed(session)}
            />

            {/* Live Camera HUD Overlays */}
            <div className="absolute inset-0 pointer-events-none p-2 flex flex-col justify-between">
              {/* Top Bar: Camera Live Badge + Timestamp */}
              <div className="flex items-center justify-between w-full">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-[9px] font-bold text-white border border-white/20 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1" />
                  LIVE CAM
                </span>

                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-[9px] font-mono text-white/90 border border-white/10 shadow-2xs">
                  {formatRelativeTime(session.latestSnapshotTime)}
                </span>
              </div>

              {/* Bottom Bar: Strikes Badge + Snapshots Count */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[9px] font-extrabold border shadow-2xs ${
                    session.strikesCount === 0
                      ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                      : session.strikesCount >= session.maxStrikes
                      ? "bg-red-950/85 text-red-300 border-red-500/50"
                      : "bg-amber-950/80 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {session.strikesCount === 0 ? (
                    <>
                      <Check className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                      0 / {session.maxStrikes} Clean
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-2.5 h-2.5 mr-1 text-amber-400" />
                      {session.strikesCount} / {session.maxStrikes} Strikes
                    </>
                  )}
                </span>

                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-[9px] font-mono text-white/90 border border-white/10 shadow-2xs">
                  <Camera className="w-2.5 h-2.5 mr-1 text-blue-300" />
                  {session.snapshotsCount || 1}
                </span>
              </div>
            </div>

            {/* Hover Action Overlay: Quick Inspect & Retake buttons */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2 p-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetailed(session);
                }}
                className="px-3 py-1.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 cursor-pointer transform hover:scale-105"
              >
                <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Inspect</span>
              </button>

              <button
                type="button"
                disabled={isLoading || isSubmitted || session.status !== "IN_PROGRESS"}
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestSnapshot(session.id, session.candidateName);
                }}
                className="p-1.5 rounded-xl bg-black/70 text-white hover:bg-black/90 border border-white/30 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-40"
                title="Capture Fresh Snapshot Now"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          /* Sleek Monitored Camera Placeholder Canvas */
          <div
            className="w-full h-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 flex flex-col items-center justify-center p-3 relative"
            onClick={() => onViewDetailed(session)}
          >
            {/* Background radar animation */}
            <div className="absolute w-24 h-24 rounded-full border border-blue-300/40 animate-ping pointer-events-none" />
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs mb-1.5 relative z-10">
              <Camera className="w-5 h-5 text-slate-500" />
            </div>

            <p className="text-[11px] font-bold text-slate-700 relative z-10 text-center leading-tight">
              Biometric Surveillance Active
            </p>
            <p className="text-[9px] text-slate-400 relative z-10 text-center mt-0.5">
              Continuous candidate monitoring
            </p>

            <button
              type="button"
              disabled={isLoading || isSubmitted || session.status !== "IN_PROGRESS"}
              onClick={(e) => {
                e.stopPropagation();
                onRequestSnapshot(session.id, session.candidateName);
              }}
              className="mt-2 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer disabled:opacity-40 relative z-10"
            >
              <Camera className="w-3 h-3" />
              <span>Capture Snapshot</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Live Actions & Progress Metrics Strip ("What they are doing in the exam") */}
      <div className="p-3 bg-white space-y-2 border-b border-slate-100 flex-1">
        {/* Recent Activity Ticker Box */}
        <div
          className={`p-2 rounded-xl border text-xs transition-colors ${
            isLocked
              ? "bg-red-50/60 border-red-200 text-red-900"
              : isWarning
              ? "bg-amber-50/60 border-amber-200 text-amber-900"
              : "bg-slate-50 border-slate-200/80 text-slate-800"
          }`}
        >
          <div className="flex items-center space-x-1.5">
            {isLocked ? (
              <ShieldAlert className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
            ) : isWarning ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            ) : session.latestActionType === "ANSWER" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            )}
            <span className="font-bold text-[11px] truncate leading-tight flex-1">
              {session.latestActionText || "Active in Examination Sitting"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-200/60">
            <span className="truncate">
              {formatRelativeTime(session.latestActionTime || session.startedAt)}
            </span>
            <span
              className="font-mono text-[9px] text-slate-400 truncate max-w-[110px]"
              title={session.hardwareFingerprint}
            >
              HW: {session.hardwareFingerprint.slice(0, 10)}...
            </span>
          </div>
        </div>

        {/* Live Metrics Row: Answers Saved + Compensatory Time + Unread Doubts */}
        <div className="flex items-center justify-between gap-1 flex-wrap text-[10px]">
          <div className="flex items-center space-x-1">
            <span
              className="inline-flex items-center font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
              title="Number of saved answers synchronized to database"
            >
              📝 {session.submissionsCount} Answers
            </span>

            {session.extraTimeMinutes > 0 && (
              <span className="inline-flex items-center font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-2.5 h-2.5 mr-0.5 text-blue-600" />
                +{session.extraTimeMinutes}m
              </span>
            )}
          </div>

          {unreadInquiriesCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenChat(session.id)}
              className="inline-flex items-center font-extrabold px-2 py-0.5 rounded-md bg-red-600 text-white animate-pulse shadow-xs cursor-pointer hover:bg-red-700 transition-colors"
              title="Candidate submitted inquiry or doubt"
            >
              <MessageCircle className="w-2.5 h-2.5 mr-1" />
              {unreadInquiriesCount} Doubt
            </button>
          )}
        </div>
      </div>

      {/* 4. Action Command Bar: Prominent "View Detailed" + Quick Intervention Suite */}
      <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 space-y-1.5">
        {/* Primary Action Button: View in Detailed */}
        <button
          type="button"
          onClick={() => onViewDetailed(session)}
          className="w-full py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs tracking-tight transition-all shadow-2xs hover:shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span>View in Detailed</span>
        </button>

        {/* Secondary Quick Controls Toolbar */}
        <div className="flex items-center justify-between gap-1">
          {/* Late Entry Approve Button if applicable */}
          {session.isPendingLateEntry && isLocked && onGrantLateEntry && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onGrantLateEntry(session.id, session.candidateName)}
              className="px-2 py-1 rounded-lg bg-blue-700 text-white hover:bg-blue-800 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs flex-1"
              title="Approve Candidate Late Entry"
            >
              Approve Late
            </button>
          )}

          {/* Freeze / Unlock Toggle */}
          {isLocked ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onUnlock(session.id)}
              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer shadow-2xs flex-1 flex items-center justify-center"
              title="Unlock Workstation"
            >
              <Unlock className="w-3.5 h-3.5 mr-1" />
              <span className="text-[10px] font-bold">Unlock</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isLoading || isSubmitted}
              onClick={() => onLock(session.id)}
              className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-40 flex-1 flex items-center justify-center"
              title="Freeze Workstation Immediately"
            >
              <Lock className="w-3.5 h-3.5 mr-1" />
              <span className="text-[10px] font-bold">Freeze</span>
            </button>
          )}

          {/* Screen Warning Dispatcher */}
          <button
            type="button"
            disabled={isLoading || isSubmitted}
            onClick={() => onWarn(session.id, session.candidateName)}
            className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
            title="Dispatch Warning Notice to Candidate Screen"
          >
            <Bell className="w-3.5 h-3.5" />
          </button>

          {/* Candidate Doubt Chat */}
          <button
            type="button"
            onClick={() => onOpenChat(session.id)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer relative shadow-2xs ${
              unreadInquiriesCount > 0
                ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 ring-2 ring-blue-400/40"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
            }`}
            title="Open Candidate Doubt Chat"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {unreadInquiriesCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -right-0.5 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Snapshot Trigger */}
          <button
            type="button"
            disabled={isLoading || isSubmitted || session.status !== "IN_PROGRESS"}
            onClick={() => onRequestSnapshot(session.id, session.candidateName)}
            className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
            title="Request Instant Webcam Photo Verification"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          {/* Quick +5m Time */}
          <button
            type="button"
            disabled={isLoading || isSubmitted}
            onClick={() => onAddExtraTime(session.id, 5)}
            className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
            title="Add +5 Minutes Compensatory Time"
          >
            +5m
          </button>

          {/* Strikes Reset if strikes > 0 */}
          {session.strikesCount > 0 && onResetStrikes && (
            <button
              type="button"
              disabled={isLoading || isSubmitted}
              onClick={() => onResetStrikes(session.id)}
              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              title="Reset Strikes Counter to 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* PC Rebind if onRebindPC passed */}
          {onRebindPC && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onRebindPC(session.studentId, session.candidateName)}
              className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              title="Reset Hardware Binding (Switch Machine)"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
