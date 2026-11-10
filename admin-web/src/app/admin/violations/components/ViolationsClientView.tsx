"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/date";
import {
  ShieldAlert,
  Search,
  Download,
  AlertTriangle,
  Building2,
  Calendar,
  Filter,
  Monitor,
  ExternalLink,
  Users,
  CheckCircle2,
  Camera,
  X,
  Copy,
  Check,
  Sparkles,
  BookOpen,
  Clock,
  ShieldCheck,
  Laptop,
  Activity,
  ArrowRight,
} from "lucide-react";

export interface ViolationRecord {
  id: string;
  sessionId: string;
  candidateName: string;
  applicationNumber: string;
  email: string;
  departmentCode: string;
  examTitle: string;
  violationType: string;
  strikeNumber: number;
  hardwareFingerprint: string;
  snapshotUrl?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface ViolationsClientViewProps {
  violations: ViolationRecord[];
}

export function ViolationsClientView({ violations }: ViolationsClientViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStrike, setSelectedStrike] = useState("ALL");
  const [selectedPhoto, setSelectedPhoto] = useState<ViolationRecord | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const departments = Array.from(
    new Set(violations.map((v) => v.departmentCode).filter(Boolean))
  ).sort();

  // Metrics
  const criticalCount = violations.filter((v) => v.strikeNumber >= 3).length;
  const uniqueCandidates = new Set(violations.map((v) => v.applicationNumber).filter(Boolean)).size;
  const snapshotCount = violations.filter((v) => Boolean(v.snapshotUrl)).length;
  const strike1Count = violations.filter((v) => v.strikeNumber === 1).length;
  const strike2Count = violations.filter((v) => v.strikeNumber === 2).length;

  const filtered = violations.filter((v) => {
    const matchesSearch =
      v.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.violationType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.examTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.hardwareFingerprint.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = selectedDept === "ALL" || v.departmentCode === selectedDept;
    const matchesStrike =
      selectedStrike === "ALL"
        ? true
        : selectedStrike === "STRIKEOUT"
        ? v.strikeNumber >= 3
        : String(v.strikeNumber) === selectedStrike;

    return matchesSearch && matchesDept && matchesStrike;
  });

  function formatViolationType(type: string) {
    switch (type) {
      case "WINDOW_UNFOCUSED":
        return "Window Lost Focus";
      case "FULLSCREEN_EXIT":
        return "Full-Screen Exited";
      case "MULTIPLE_DISPLAYS":
        return "Multiple Displays Detected";
      case "KEYBOARD_RESTRICTION":
      case "SYSTEM_KEY_INTERCEPTED":
        return "Prohibited Keystroke Intercepted";
      case "SCREEN_CAPTURE_BLOCKED":
        return "Screen Capture Blocked";
      case "DEVTOOLS_ATTEMPT":
        return "DevTools Inspection Blocked";
      case "VM_HYPERVISOR_DETECTED":
        return "Hypervisor / VM Detected";
      case "SUSPICIOUS_PROCESS":
        return "Blacklisted App Blocked";
      case "CLIPBOARD_ACCESS":
        return "Clipboard Access Blocked";
      case "SUSPICIOUS_WEBCAM_ACTIVITY":
        return "Suspicious Head Movement";
      case "NO_FACE_DETECTED":
        return "No Face in View";
      case "MULTIPLE_FACES":
        return "Multiple Faces Detected";
      default:
        return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedToken(text);
    setTimeout(() => setCopiedToken(null), 1800);
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function handleExportCsv() {
    const headers = [
      "Timestamp",
      "Candidate Name",
      "Application Number",
      "Department",
      "Exam Title",
      "Violation Type",
      "Strike Number",
      "Hardware Fingerprint",
      "Snapshot Evidence URL",
    ].join(",");

    const rows = filtered.map((v) =>
      [
        `"${new Date(v.createdAt).toISOString()}"`,
        `"${v.candidateName}"`,
        `"${v.applicationNumber}"`,
        `"${v.departmentCode}"`,
        `"${v.examTitle}"`,
        `"${v.violationType.replace(/"/g, '""')}"`,
        v.strikeNumber,
        `"${v.hardwareFingerprint}"`,
        v.snapshotUrl ? `"${v.snapshotUrl}"` : `"N/A"`,
      ].join(",")
    );

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `KARE_SES_Security_Violations_Audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 w-full">
      {/* 1. Master Executive Command Cockpit Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {/* Top Header Row */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-white via-slate-50/30 to-red-50/20">
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
                  Security Violations &amp; Forensics
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200/80">
                  Forensic Audit Trail
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-40"
              title="Export filtered forensics log as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Audit CSV</span>
            </button>

            <Link
              href="/admin/proctoring"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Open Live Proctoring</span>
            </Link>
          </div>
        </div>

        {/* 4 Clean Metric Cells */}
        <div className="border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {/* Metric 1: Total Infractions */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-red-700 transition-colors">
                Total Infractions
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-red-50 text-red-700 border-red-200">
                {violations.length} Logged
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {violations.length}
              </span>
              <span className="text-xs text-slate-400">forensic events</span>
            </div>
          </div>

          {/* Metric 2: Critical Strikeouts */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-red-700 transition-colors">
                Critical Strikeouts
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] ${
                  criticalCount > 0
                    ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {criticalCount > 0 ? `${criticalCount} Frozen` : "Zero Frozen"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span
                className={`text-2xl font-black tracking-tight ${
                  criticalCount > 0 ? "text-red-600" : "text-slate-900"
                }`}
              >
                {criticalCount}
              </span>
              <span className="text-xs text-slate-400">
                {criticalCount > 0 ? "proctor lockout triggered" : "clean integrity"}
              </span>
            </div>
          </div>

          {/* Metric 3: Flagged Candidates */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-purple-700 transition-colors">
                Flagged Scholars
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                {uniqueCandidates} Examinees
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {uniqueCandidates}
              </span>
              <span className="text-xs text-slate-400">with strikes</span>
            </div>
          </div>

          {/* Metric 4: Evidentiary Photo Snapshots */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
                Evidentiary Archive
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                {snapshotCount} Snapshots
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-blue-700 tracking-tight">
                {snapshotCount}
              </span>
              <span className="text-xs text-slate-400">photo frames</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Violations Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {/* Tier 1: Toolbar with Strike Level Segmented Control & Integrated Search */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
          {/* Segmented Strike Severity Selector */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl space-x-1 w-fit overflow-x-auto max-w-full scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedStrike("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                selectedStrike === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Infractions ({violations.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStrike("1")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                selectedStrike === "1"
                  ? "bg-white text-amber-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>Strike #1 ({strike1Count})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStrike("2")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                selectedStrike === "2"
                  ? "bg-white text-orange-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              <span>Strike #2 ({strike2Count})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStrike("STRIKEOUT")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                selectedStrike === "STRIKEOUT"
                  ? "bg-white text-red-700 shadow-xs"
                  : "text-red-600 hover:text-red-700"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              <span>Strikeouts &ge; 3 ({criticalCount})</span>
            </button>
          </div>

          {/* Integrated Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate, app no, violation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Horizontal Department Scope Filter Pills */}
        {departments.length > 0 && (
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center space-x-1.5 overflow-x-auto scrollbar-none bg-white">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex-shrink-0">
              Faculty:
            </span>
            <button
              type="button"
              onClick={() => setSelectedDept("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                selectedDept === "ALL"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/90"
              }`}
            >
              All Departments ({violations.length})
            </button>
            {departments.map((d) => {
              const count = violations.filter((v) => v.departmentCode === d).length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDept(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                    selectedDept === d
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/90"
                  }`}
                >
                  {d} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Forensics Stream High-Contrast Table */}
        {filtered.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {searchTerm || selectedDept !== "ALL" || selectedStrike !== "ALL"
                ? "No matching security infractions found"
                : "No Security Violations Recorded"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || selectedDept !== "ALL" || selectedStrike !== "ALL"
                ? "Try clearing your search query or switching the strike filter."
                : "Active workstations running the Safe Exam client have maintained 100% exam integrity."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 sm:px-5">Timestamp</th>
                  <th className="py-3 px-4 sm:px-5">Candidate &amp; Identity</th>
                  <th className="py-3 px-4 sm:px-5">Examination Paper</th>
                  <th className="py-3 px-4 sm:px-5">Violation Incident</th>
                  <th className="py-3 px-4 sm:px-5">Strike Severity</th>
                  <th className="py-3 px-4 sm:px-5">Photo Evidence</th>
                  <th className="py-3 px-4 sm:px-5 text-right">Workstation HW</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((v) => {
                  const initials = getInitials(v.candidateName);
                  const isStrikeout = v.strikeNumber >= 3;
                  const isStrike2 = v.strikeNumber === 2;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap text-slate-600 font-medium" suppressHydrationWarning>
                        <div className="font-bold text-slate-900">{formatDate(v.createdAt)}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {formatTime(v.createdAt, true)}
                        </div>
                      </td>

                      {/* Candidate Identity */}
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200/60 flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm tracking-tight">
                              {v.candidateName}
                            </div>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-bold text-slate-600">
                                {v.applicationNumber}
                              </span>
                              <span className="inline-block text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200/80">
                                {v.departmentCode}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Examination Paper */}
                      <td className="py-3.5 px-4 sm:px-5 font-semibold text-slate-800 max-w-xs truncate">
                        <div className="truncate font-semibold text-slate-900" title={v.examTitle}>
                          {v.examTitle}
                        </div>
                      </td>

                      {/* Violation Incident */}
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200/90 shadow-2xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                          <span>{formatViolationType(v.violationType)}</span>
                        </div>
                      </td>

                      {/* Strike Severity */}
                      <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                        <span
                          className={`font-mono text-[11px] font-black px-2.5 py-0.5 rounded-md border inline-flex items-center space-x-1 ${
                            isStrikeout
                              ? "bg-red-100 text-red-800 border-red-300"
                              : isStrike2
                              ? "bg-orange-100 text-orange-800 border-orange-300"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {isStrikeout && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse mr-0.5" />}
                          <span>Strike #{v.strikeNumber}</span>
                        </span>
                      </td>

                      {/* Photo Evidence */}
                      <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                        {v.snapshotUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPhoto(v)}
                            className="group inline-flex items-center space-x-1.5 p-1 pr-2 rounded-lg border border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/50 shadow-2xs transition-all cursor-pointer"
                            title="Click to view evidentiary snapshot"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={v.snapshotUrl}
                              alt="Forensic evidence"
                              className="w-9 h-6 object-cover rounded border border-slate-100"
                            />
                            <span className="text-[10px] font-bold text-blue-700 flex items-center">
                              <Camera className="w-3 h-3 mr-0.5" />
                              Inspect
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No snapshot</span>
                        )}
                      </td>

                      {/* Workstation HW */}
                      <td className="py-3.5 px-4 sm:px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-600">
                          <Monitor className="w-3 h-3 text-slate-400 mr-0.5" />
                          <span title={v.hardwareFingerprint}>
                            {v.hardwareFingerprint ? v.hardwareFingerprint.slice(0, 14) + "…" : "UNBOUND"}
                          </span>
                          {v.hardwareFingerprint && (
                            <button
                              type="button"
                              onClick={() => handleCopy(v.hardwareFingerprint)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer ml-0.5"
                              title="Copy hardware fingerprint"
                            >
                              {copiedToken === v.hardwareFingerprint ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
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

      {/* =====================================================================
          PHOTO LIGHTBOX MODAL: FULL RESOLUTION FORENSIC VIEWER
         ===================================================================== */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-700 flex items-center justify-center border border-red-200 font-bold">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Forensic Security Snapshot Preview
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Evidentiary frame recorded during security infraction trigger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 shadow-inner aspect-[4/3] flex items-center justify-center">
              {selectedPhoto.snapshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPhoto.snapshotUrl}
                  alt="Forensic evidence frame"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-400 text-xs p-6 space-y-1">
                  <Camera className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="font-semibold text-slate-300">No Snapshot Archived</p>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white border border-white/10 text-[10px] font-mono font-bold backdrop-blur-xs flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>EVIDENTIARY CAPTURE</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-900 text-xs">{selectedPhoto.candidateName}</span>
                  <span className="text-[11px] font-mono text-blue-700 font-semibold block">
                    {selectedPhoto.applicationNumber} ({selectedPhoto.departmentCode})
                  </span>
                </div>
                <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                  Strike #{selectedPhoto.strikeNumber}
                </span>
              </div>
              <div className="border-t border-slate-200/80 pt-2 flex justify-between items-center text-[11px]">
                <span className="font-bold text-red-700">
                  {formatViolationType(selectedPhoto.violationType)}
                </span>
                <span className="text-slate-400 font-mono" suppressHydrationWarning>
                  {formatDate(selectedPhoto.createdAt)} {formatTime(selectedPhoto.createdAt, true)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <Link
                href="/admin/proctoring"
                className="text-xs font-bold text-blue-700 hover:text-blue-800 inline-flex items-center space-x-1"
              >
                <span>Open Live Proctoring Deck</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
