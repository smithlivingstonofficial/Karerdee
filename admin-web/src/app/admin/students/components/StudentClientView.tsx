"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StudentModal } from "./StudentModal";
import { BulkStudentCsvModal } from "./BulkStudentCsvModal";
import { deleteStudentAction, resetHardwareBindingAction } from "../actions";
import { formatDate } from "@/lib/date";
import {
  Users,
  PlusCircle,
  FileSpreadsheet,
  Search,
  Building2,
  Edit2,
  Trash2,
  MonitorCheck,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Copy,
  Check,
  KeyRound,
  Monitor,
  ShieldAlert,
  Laptop,
  Lock,
  Unlock,
  Filter,
  X,
  Sparkles,
} from "lucide-react";

export interface StudentRecord {
  id: string;
  auth_user_id?: string | null;
  full_name: string;
  application_number: string;
  email?: string | null;
  department_id?: string | null;
  created_at: string;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  activeSession?: {
    id: string;
    hardware_fingerprint: string;
    client_version?: string;
    status: string;
    started_at?: string;
    strikes_count?: number;
    examTitle?: string;
    examId?: string;
  } | null;
}

interface StudentClientViewProps {
  initialStudents: StudentRecord[];
  departments: { id: string; name: string; code: string }[];
}

export function StudentClientView({
  initialStudents,
  departments,
}: StudentClientViewProps) {
  const router = useRouter();
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents);

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL");
  const [workstationFilter, setWorkstationFilter] = useState<"ALL" | "BOUND" | "LOCKED" | "IDLE" | "UNASSIGNED">("ALL");
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [copiedAppNum, setCopiedAppNum] = useState<string | null>(null);

  // Filter students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.application_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.department?.code && s.department.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.activeSession?.hardware_fingerprint &&
        s.activeSession.hardware_fingerprint.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesDept =
      selectedDeptId === "ALL"
        ? true
        : selectedDeptId === "UNASSIGNED"
        ? !s.department_id
        : s.department_id === selectedDeptId;

    const isBound = Boolean(
      s.activeSession &&
      s.activeSession.hardware_fingerprint &&
      s.activeSession.hardware_fingerprint !== "UNBOUND_RESET_BY_ADMIN" &&
      s.activeSession.hardware_fingerprint !== "UNBOUND" &&
      !s.activeSession.hardware_fingerprint.startsWith("RELEASED_FOR_REBIND")
    );

    const isLockedInfraction = s.activeSession?.status === "LOCKED";

    const matchesWorkstation =
      workstationFilter === "ALL"
        ? true
        : workstationFilter === "BOUND"
        ? isBound
        : workstationFilter === "LOCKED"
        ? isLockedInfraction
        : workstationFilter === "UNASSIGNED"
        ? !s.department_id
        : !isBound;

    return matchesSearch && matchesDept && matchesWorkstation;
  });

  const unassignedCount = students.filter((s) => !s.department_id).length;

  const boundWorkstationsCount = students.filter(
    (s) =>
      s.activeSession &&
      s.activeSession.hardware_fingerprint &&
      s.activeSession.hardware_fingerprint !== "UNBOUND_RESET_BY_ADMIN" &&
      s.activeSession.hardware_fingerprint !== "UNBOUND" &&
      !s.activeSession.hardware_fingerprint.startsWith("RELEASED_FOR_REBIND")
  ).length;

  const lockedWorkstationsCount = students.filter(
    (s) => s.activeSession && s.activeSession.status === "LOCKED"
  ).length;

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove candidate "${name}"?`)) return;
    setActionNotice(null);
    const res = await deleteStudentAction(id);
    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setActionNotice({ type: "success", message: `Candidate "${name}" removed.` });
      router.refresh();
    }
  }

  async function handleResetWorkstation(studentId: string, studentName: string) {
    if (
      !confirm(
        `Emergency Workstation Unbind for ${studentName}:\n\nAre you sure you want to release this candidate's hardware binding? They will be able to log in immediately from a replacement lab computer or laptop.`
      )
    ) {
      return;
    }

    setResettingId(studentId);
    setActionNotice(null);

    try {
      const res = await resetHardwareBindingAction(studentId);

      if (res.error) {
        setActionNotice({ type: "error", message: res.error });
      } else {
        // Optimistically update candidate workstation status in local state
        setStudents((prev) =>
          prev.map((s) => {
            if (s.id !== studentId) return s;
            return {
              ...s,
              activeSession: s.activeSession
                ? {
                    ...s.activeSession,
                    hardware_fingerprint: "UNBOUND_RESET_BY_ADMIN",
                    status: "IN_PROGRESS",
                  }
                : {
                    id: `temp-${Date.now()}`,
                    hardware_fingerprint: "UNBOUND_RESET_BY_ADMIN",
                    status: "IN_PROGRESS",
                  },
            };
          })
        );

        setActionNotice({
          type: "success",
          message: `Workstation binding released for ${studentName}. The candidate can now log in immediately on any computer.`,
        });

        router.refresh();
      }
    } catch (err: any) {
      setActionNotice({
        type: "error",
        message: err.message || "Failed to reset workstation.",
      });
    } finally {
      setResettingId(null);
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedAppNum(text);
    setTimeout(() => setCopiedAppNum(null), 1800);
  }

  function handleOpenCreate() {
    setEditingStudent(null);
    setStudentModalOpen(true);
  }

  function handleOpenEdit(student: StudentRecord) {
    setEditingStudent(student);
    setStudentModalOpen(true);
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

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 w-full">
      {/* 1. Master Executive Command Cockpit Header */}
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
                  Candidate Registry
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80">
                  {students.length} Registered Scholars
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCsvModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bulk Import CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Register Candidate</span>
            </button>
          </div>
        </div>

        {/* 4 Clean Metric Cells */}
        <div className="border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {/* Metric 1: Total Enrolled Candidates */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
                Total Enrolled
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                {students.length} Scholars
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {students.length}
              </span>
              <span className="text-xs text-slate-400">candidates</span>
            </div>
          </div>

          {/* Metric 2: Active Workstation Bindings */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-amber-700 transition-colors">
                Hardware Locked
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                {boundWorkstationsCount} Bound
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-amber-700 tracking-tight">
                {boundWorkstationsCount}
              </span>
              <span className="text-xs text-slate-400">locked to lab PCs</span>
            </div>
          </div>

          {/* Metric 3: Infraction Lockouts */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-red-700 transition-colors">
                Security Lockouts
              </span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded-full border text-[9px] ${
                  lockedWorkstationsCount > 0
                    ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {lockedWorkstationsCount > 0 ? `${lockedWorkstationsCount} Struck Out` : "Zero Strikes"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span
                className={`text-2xl font-black tracking-tight ${
                  lockedWorkstationsCount > 0 ? "text-red-600" : "text-slate-900"
                }`}
              >
                {lockedWorkstationsCount}
              </span>
              <span className="text-xs text-slate-400">
                {lockedWorkstationsCount > 0 ? "requires unfreeze" : "all sessions clean"}
              </span>
            </div>
          </div>

          {/* Metric 4: Institutional Departments */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-700 transition-colors">
                Academic Faculties
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-slate-100 text-slate-600 border-slate-200">
                {departments.length} Depts
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {departments.length}
              </span>
              <span className="text-xs text-slate-400">curricula allocated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in shadow-2xs ${
            actionNotice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionNotice.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Main Candidate Registry Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {/* Tier 1: Toolbar with Workstation Status Tabs & Quick Search */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
          {/* Segmented Workstation Status Selector */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl space-x-1 w-fit overflow-x-auto max-w-full scrollbar-none">
            <button
              type="button"
              onClick={() => setWorkstationFilter("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                workstationFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setWorkstationFilter("BOUND")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                workstationFilter === "BOUND"
                  ? "bg-white text-amber-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>Locked to PC ({boundWorkstationsCount})</span>
            </button>
            {lockedWorkstationsCount > 0 && (
              <button
                type="button"
                onClick={() => setWorkstationFilter("LOCKED")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  workstationFilter === "LOCKED"
                    ? "bg-white text-red-700 shadow-xs"
                    : "text-red-600 hover:text-red-700"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span>Infractions ({lockedWorkstationsCount})</span>
              </button>
            )}
            {unassignedCount > 0 && (
              <button
                type="button"
                onClick={() => setWorkstationFilter("UNASSIGNED")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  workstationFilter === "UNASSIGNED"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Unassigned ({unassignedCount})
              </button>
            )}
          </div>

          {/* Integrated Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate name, email, app no..."
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
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center space-x-1.5 overflow-x-auto scrollbar-none bg-white">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex-shrink-0">
            Faculty:
          </span>
          <button
            type="button"
            onClick={() => setSelectedDeptId("ALL")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
              selectedDeptId === "ALL"
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/90"
            }`}
          >
            All Departments ({students.length})
          </button>
          {departments.map((d) => {
            const count = students.filter((s) => s.department_id === d.id).length;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDeptId(d.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                  selectedDeptId === d.id
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/90"
                }`}
              >
                {d.code} ({count})
              </button>
            );
          })}
          {unassignedCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedDeptId("UNASSIGNED")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${
                selectedDeptId === "UNASSIGNED"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              Unassigned ({unassignedCount})
            </button>
          )}
        </div>

        {/* 3. Candidates High-Contrast Table View */}
        {filteredStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 sm:px-5">Candidate &amp; Identity</th>
                  <th className="py-3 px-4 sm:px-5">Login Email</th>
                  <th className="py-3 px-4 sm:px-5">Application / Passcode</th>
                  <th className="py-3 px-4 sm:px-5">Department</th>
                  <th className="py-3 px-4 sm:px-5">Workstation &amp; Hardware Lock</th>
                  <th className="py-3 px-4 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredStudents.map((s) => {
                  const isBound = Boolean(
                    s.activeSession &&
                    s.activeSession.hardware_fingerprint &&
                    s.activeSession.hardware_fingerprint !== "UNBOUND_RESET_BY_ADMIN" &&
                    s.activeSession.hardware_fingerprint !== "UNBOUND" &&
                    !s.activeSession.hardware_fingerprint.startsWith("RELEASED_FOR_REBIND")
                  );

                  const isUnboundWaiting = Boolean(
                    s.activeSession &&
                    (s.activeSession.hardware_fingerprint === "UNBOUND_RESET_BY_ADMIN" ||
                      s.activeSession.hardware_fingerprint === "UNBOUND" ||
                      s.activeSession.hardware_fingerprint.startsWith("RELEASED_FOR_REBIND"))
                  );

                  const isLockedInfraction = s.activeSession?.status === "LOCKED";
                  const initials = getInitials(s.full_name);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Candidate Name & Registered Date */}
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200/60 flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm tracking-tight">
                              {s.full_name}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5" suppressHydrationWarning>
                              Registered {formatDate(s.created_at)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Login Username / Email */}
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="inline-flex items-center space-x-1.5 text-slate-700 font-mono text-xs">
                          <span className="font-medium">{s.email || "—"}</span>
                          {s.email && (
                            <button
                              type="button"
                              onClick={() => handleCopy(s.email!)}
                              className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5 rounded"
                              title="Copy Email ID"
                            >
                              {copiedAppNum === s.email ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Application Number (Security Token Badge) */}
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="inline-flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200/90 transition-colors shadow-2xs">
                          <KeyRound className="w-3 h-3 text-slate-400" />
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {s.application_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(s.application_number)}
                            className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer p-0.5 rounded"
                            title="Copy Application Number"
                          >
                            {copiedAppNum === s.application_number ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 sm:px-5">
                        {s.department ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                            {s.department.code}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Workstation Status & Hardware Binding Details */}
                      <td className="py-3.5 px-4 sm:px-5">
                        {isBound ? (
                          <div className="space-y-1.5 min-w-[210px]">
                            {/* Badges: Status + Client Version */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {isLockedInfraction ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                                  <ShieldAlert className="w-3 h-3 text-red-600" />
                                  <span>Locked (Violation)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                  <span>Locked to PC</span>
                                </span>
                              )}

                              {s.activeSession?.client_version && (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  <Laptop className="w-2.5 h-2.5 text-slate-400" />
                                  <span>{s.activeSession.client_version}</span>
                                </span>
                              )}
                            </div>

                            {/* Hardware Fingerprint display with 1-click copy */}
                            <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-800 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-md px-2 py-0.5 transition-colors w-fit">
                              <Monitor className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate max-w-[130px] font-bold" title={s.activeSession?.hardware_fingerprint}>
                                {s.activeSession?.hardware_fingerprint}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(s.activeSession?.hardware_fingerprint || "")}
                                className="text-slate-400 hover:text-slate-700 cursor-pointer ml-1"
                                title="Copy Hardware Fingerprint"
                              >
                                {copiedAppNum === s.activeSession?.hardware_fingerprint ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* Emergency Reset Workstation Button */}
                            <div>
                              <button
                                type="button"
                                disabled={resettingId === s.id}
                                onClick={() => handleResetWorkstation(s.id, s.full_name)}
                                className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200/90 border border-amber-300 rounded-md shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                                title="Click to release hardware lock so candidate can immediately log in from a new/replacement PC"
                              >
                                <RotateCcw className={`w-3 h-3 mr-1 text-amber-700 ${resettingId === s.id ? "animate-spin" : ""}`} />
                                Reset Workstation
                              </button>
                            </div>
                          </div>
                        ) : isUnboundWaiting ? (
                          <div className="space-y-1 min-w-[180px]">
                            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                              <span>Unbound • Ready to Rebind</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Lock released. Candidate can log in on any computer.
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Ready / Idle
                            </span>
                            <div>
                              <button
                                type="button"
                                disabled={resettingId === s.id}
                                onClick={() => handleResetWorkstation(s.id, s.full_name)}
                                className="text-[10px] font-semibold text-slate-400 hover:text-amber-700 underline transition-colors cursor-pointer"
                                title="Force clear any latent or stale workstation locks"
                              >
                                Force Clear Locks
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 sm:px-5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {isBound && (
                            <button
                              type="button"
                              disabled={resettingId === s.id}
                              onClick={() => handleResetWorkstation(s.id, s.full_name)}
                              className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="Reset Workstation Lock"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${resettingId === s.id ? "animate-spin" : ""}`} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Candidate"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id, s.full_name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Candidate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {searchTerm || selectedDeptId !== "ALL" || workstationFilter !== "ALL"
                ? "No matching candidates found"
                : "No candidates enrolled yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || selectedDeptId !== "ALL" || workstationFilter !== "ALL"
                ? "Try clearing your search query or switching the faculty filter."
                : "Register individual candidates or import complete student cohorts using the Bulk Import CSV template."}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Upload CSV
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Register Candidate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <StudentModal
        isOpen={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        departments={departments}
        student={editingStudent}
      />

      <BulkStudentCsvModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
      />
    </div>
  );
}
