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
  const [workstationFilter, setWorkstationFilter] = useState<"ALL" | "BOUND" | "LOCKED" | "IDLE">("ALL");
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

        // Refresh server data
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Candidate Registry
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {initialStudents.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Supervise enrolled candidates, institutional application numbers, and emergency workstation hardware bindings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
            Bulk Import CSV
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Register Candidate
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Enrolled Candidates</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {students.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {departments.length} academic departments
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Workstation Bindings</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <MonitorCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {boundWorkstationsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1.5">
            <span>Locked to specific client hardware</span>
            {lockedWorkstationsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                {lockedWorkstationsCount} locked
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Institutional Departments</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {departments.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Configured for examination routing
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
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

      {/* Candidates Table Container */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {/* Filter and Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Department & Workstation Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedDeptId("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedDeptId === "ALL"
                  ? "bg-blue-700 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedDeptId === d.id
                      ? "bg-blue-700 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedDeptId === "UNASSIGNED"
                    ? "bg-blue-700 text-white shadow-2xs"
                    : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                }`}
              >
                Unassigned ({unassignedCount})
              </button>
            )}

            {/* Separator */}
            <span className="text-slate-300 mx-1">|</span>

            {/* Workstation Lock Quick Filter */}
            <button
              type="button"
              onClick={() => setWorkstationFilter("ALL")}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                workstationFilter === "ALL"
                  ? "bg-slate-800 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Workstations
            </button>
            <button
              type="button"
              onClick={() => setWorkstationFilter("BOUND")}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                workstationFilter === "BOUND"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
              }`}
            >
              Locked to PC ({boundWorkstationsCount})
            </button>
            {lockedWorkstationsCount > 0 && (
              <button
                type="button"
                onClick={() => setWorkstationFilter("LOCKED")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  workstationFilter === "LOCKED"
                    ? "bg-red-700 text-white shadow-2xs"
                    : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                }`}
              >
                Infractions ({lockedWorkstationsCount})
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, app no, email, HW..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Table View */}
        {filteredStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-5">Candidate Name</th>
                  <th className="py-3 px-5">Login Username (Email)</th>
                  <th className="py-3 px-5">Password (App Number)</th>
                  <th className="py-3 px-5">Department</th>
                  <th className="py-3 px-5">Workstation Status &amp; Hardware Binding</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900 text-sm">
                          {s.full_name}
                        </div>
                        <div className="text-[10px] text-slate-400" suppressHydrationWarning>
                          Registered {formatDate(s.created_at)}
                        </div>
                      </td>

                      {/* Login Username (Email) */}
                      <td className="py-3.5 px-5">
                        <div className="inline-flex items-center space-x-1.5 text-slate-700 font-mono text-xs">
                          <span>{s.email}</span>
                          {s.email && (
                            <button
                              type="button"
                              onClick={() => handleCopy(s.email!)}
                              className="text-slate-400 hover:text-slate-700 transition-colors"
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

                      {/* Login Password (Application Number) */}
                      <td className="py-3.5 px-5">
                        <div className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors">
                          <KeyRound className="w-3 h-3 text-slate-400" />
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {s.application_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(s.application_number)}
                            className="text-slate-400 hover:text-slate-700 transition-colors"
                            title="Copy Password / Application Number"
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
                      <td className="py-3.5 px-5">
                        {s.department ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {s.department.code}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-italic text-[11px]">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Workstation Status & Hardware Binding Details */}
                      <td className="py-3.5 px-5">
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
                            <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-800 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-md px-2 py-1 transition-colors w-fit">
                              <Monitor className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
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

                            {/* Associated Exam Title */}
                            {s.activeSession?.examTitle && (
                              <div className="text-[10px] text-slate-500 truncate max-w-[210px]" title={s.activeSession.examTitle}>
                                Exam: <span className="font-semibold text-slate-700">{s.activeSession.examTitle}</span>
                              </div>
                            )}

                            {/* Emergency Reset Workstation Button */}
                            <div>
                              <button
                                type="button"
                                disabled={resettingId === s.id}
                                onClick={() => handleResetWorkstation(s.id, s.full_name)}
                                className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200/90 border border-amber-300 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
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
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isBound && (
                            <button
                              type="button"
                              disabled={resettingId === s.id}
                              onClick={() => handleResetWorkstation(s.id, s.full_name)}
                              className="p-1.5 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="Reset Workstation Lock"
                            >
                              <RotateCcw className={`w-4 h-4 ${resettingId === s.id ? "animate-spin" : ""}`} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Edit Candidate"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id, s.full_name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Candidate"
                          >
                            <Trash2 className="w-4 h-4" />
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
              {searchTerm || selectedDeptId !== "ALL"
                ? "No matching candidates found"
                : "No candidates enrolled yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || selectedDeptId !== "ALL"
                ? "Try adjusting your search criteria or department filter."
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
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
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
