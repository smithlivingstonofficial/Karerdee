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

  const departments = Array.from(
    new Set(violations.map((v) => v.departmentCode).filter(Boolean))
  ).sort();

  const filtered = violations.filter((v) => {
    const matchesSearch =
      v.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.applicationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.violationType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.examTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.hardwareFingerprint.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = selectedDept === "ALL" || v.departmentCode === selectedDept;
    const matchesStrike =
      selectedStrike === "ALL" ||
      (selectedStrike === "STRIKEOUT" ? v.strikeNumber >= 3 : String(v.strikeNumber) === selectedStrike);

    return matchesSearch && matchesDept && matchesStrike;
  });

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
    <div className="space-y-6">
      {/* SaaS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-700 flex items-center justify-center font-bold text-xs border border-red-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Institutional Security Violations &amp; Audit Logs
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Comprehensive forensics stream of system shortcut intercepts, hypervisor detections, and process watchdog interventions.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Export Audit CSV
          </button>
          <Link
            href="/admin/proctoring"
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Open Live Proctoring
          </Link>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Total Recorded Infractions ({filtered.length})
            </span>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search violation / candidate..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 w-48 sm:w-64"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-semibold cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={selectedStrike}
              onChange={(e) => setSelectedStrike(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 font-semibold cursor-pointer"
            >
              <option value="ALL">All Strikes</option>
              <option value="1">Strike #1</option>
              <option value="2">Strike #2</option>
              <option value="STRIKEOUT">Strikeout / Critical (&gt;= 3)</option>
            </select>
          </div>
        </div>

        {/* Violations Forensics Table */}
        {filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
            <p className="font-bold text-slate-700 text-sm">No Security Violations Recorded</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Workstations running the safe exam platform have maintained 100% integrity.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Candidate &amp; Dept</th>
                  <th className="py-2.5 px-3">Examination Paper</th>
                  <th className="py-2.5 px-3">Violation Event</th>
                  <th className="py-2.5 px-3">Strike Severity</th>
                  <th className="py-2.5 px-3">Photo Evidence</th>
                  <th className="py-2.5 px-3 text-right">Workstation HW</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-medium" suppressHydrationWarning>
                      <div>{formatDate(v.createdAt)}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {formatTime(v.createdAt, true)}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{v.candidateName}</div>
                      <div className="font-mono text-[10px] text-blue-700 font-semibold">
                        {v.applicationNumber}
                      </div>
                      <span className="inline-block mt-0.5 text-[9px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                        {v.departmentCode}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-semibold text-slate-800 max-w-xs truncate">
                      {v.examTitle}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-1.5 text-red-700 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{v.violationType}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`font-mono text-[10px] font-black px-2 py-0.5 rounded border ${
                          v.strikeNumber >= 3
                            ? "bg-red-100 text-red-700 border-red-300"
                            : v.strikeNumber === 2
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        Strike #{v.strikeNumber}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {v.snapshotUrl ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(v)}
                          className="group inline-flex items-center space-x-1.5 p-1 rounded-lg border border-slate-200 hover:border-blue-500 bg-white hover:bg-blue-50/50 shadow-2xs transition-all cursor-pointer"
                          title="Click to view full-resolution evidentiary photo"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={v.snapshotUrl}
                            alt="Forensic evidence"
                            className="w-10 h-7 object-cover rounded border border-slate-100"
                          />
                          <span className="text-[10px] font-bold text-blue-700 flex items-center pr-1">
                            <Camera className="w-3 h-3 mr-0.5" />
                            Inspect
                          </span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No snapshot</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-400 whitespace-nowrap">
                      {v.hardwareFingerprint ? v.hardwareFingerprint.slice(0, 16) + "..." : "UNBOUND"}
                    </td>
                  </tr>
                ))}
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
                <span className="font-semibold text-red-700">{selectedPhoto.violationType}</span>
                <span className="text-slate-400 font-mono" suppressHydrationWarning>
                  {new Date(selectedPhoto.createdAt).toUTCString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
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

