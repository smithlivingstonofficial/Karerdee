"use client";

import React, { useState, useMemo } from "react";
import { SectionState, CandidateStudentItem } from "../types";
import { Department } from "@/types/database.types";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  CheckSquare,
  Square,
  Filter,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface CandidateRosterTabProps {
  sections: SectionState[];
  departments: Department[];
  students: CandidateStudentItem[];
  selectedStudentIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
}

const ITEMS_PER_PAGE = 30;

export function CandidateRosterTab({
  sections,
  departments,
  students = [],
  selectedStudentIds = [],
  onSelectionChange,
}: CandidateRosterTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SELECTED" | "UNSELECTED">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // 1. Identify which departments are selected in Section 02 (Part B or specialization tracks)
  const examDeptCodes = useMemo(() => {
    const codes = new Set<string>();
    sections.forEach((sec) => {
      if (!sec.isCommon && sec.targetDepartments && sec.targetDepartments.length > 0) {
        sec.targetDepartments.forEach((d) => codes.add(d.trim().toUpperCase()));
      }
    });
    return Array.from(codes).sort();
  }, [sections]);

  const hasSpecificDeptTracks = examDeptCodes.length > 0;

  // 2. Classify students into exam-eligible vs other
  const { eligibleStudents, otherStudents } = useMemo(() => {
    if (!hasSpecificDeptTracks) {
      // If exam has no specific department restriction (e.g. general only), all active students are eligible
      return { eligibleStudents: students, otherStudents: [] };
    }

    const eligible: CandidateStudentItem[] = [];
    const other: CandidateStudentItem[] = [];

    students.forEach((s) => {
      const code = s.department?.code ? s.department.code.toUpperCase() : "";
      if (examDeptCodes.includes(code)) {
        eligible.push(s);
      } else {
        other.push(s);
      }
    });

    return { eligibleStudents: eligible, otherStudents: other };
  }, [students, examDeptCodes, hasSpecificDeptTracks]);

  // Department counts for pills
  const deptStats = useMemo(() => {
    const map = new Map<string, { total: number; selected: number; name: string }>();

    // Initialize with all selected exam departments
    examDeptCodes.forEach((code) => {
      const deptObj = departments.find((d) => d.code.toUpperCase() === code);
      map.set(code, {
        total: 0,
        selected: 0,
        name: deptObj?.name || code,
      });
    });

    students.forEach((s) => {
      const code = s.department?.code ? s.department.code.toUpperCase() : "OTHER";
      if (!map.has(code)) {
        const deptObj = departments.find((d) => d.code.toUpperCase() === code);
        map.set(code, {
          total: 0,
          selected: 0,
          name: deptObj?.name || code,
        });
      }
      const entry = map.get(code)!;
      entry.total += 1;
      if (selectedStudentIds.includes(s.id)) {
        entry.selected += 1;
      }
    });

    return map;
  }, [examDeptCodes, departments, students, selectedStudentIds]);

  // 3. Filtered candidate list based on active tab, search, and status
  const filteredCandidates = useMemo(() => {
    return students.filter((s) => {
      const code = s.department?.code ? s.department.code.toUpperCase() : "";
      const isSelected = selectedStudentIds.includes(s.id);

      // Department filter
      if (selectedDeptFilter === "EXAM_DEPTS") {
        if (hasSpecificDeptTracks && !examDeptCodes.includes(code)) return false;
      } else if (selectedDeptFilter === "OTHER_DEPTS") {
        if (hasSpecificDeptTracks && examDeptCodes.includes(code)) return false;
      } else if (selectedDeptFilter !== "ALL") {
        if (code !== selectedDeptFilter) return false;
      }

      // Status filter
      if (statusFilter === "SELECTED" && !isSelected) return false;
      if (statusFilter === "UNSELECTED" && isSelected) return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = s.full_name?.toLowerCase().includes(query);
        const appMatch = s.application_number?.toLowerCase().includes(query);
        const rollMatch = s.roll_number?.toLowerCase().includes(query);
        const emailMatch = s.email?.toLowerCase().includes(query);
        const deptMatch =
          s.department?.name?.toLowerCase().includes(query) ||
          s.department?.code?.toLowerCase().includes(query);

        if (!nameMatch && !appMatch && !rollMatch && !emailMatch && !deptMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    students,
    selectedDeptFilter,
    statusFilter,
    searchQuery,
    selectedStudentIds,
    hasSpecificDeptTracks,
    examDeptCodes,
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedCandidates = useMemo(() => {
    const start = (currentPageSafe - 1) * ITEMS_PER_PAGE;
    return filteredCandidates.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCandidates, currentPageSafe]);

  // Selection actions
  function toggleStudent(studentId: string) {
    if (selectedStudentIds.includes(studentId)) {
      onSelectionChange(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      onSelectionChange([...selectedStudentIds, studentId]);
    }
  }

  function selectAllFiltered() {
    const filteredIds = filteredCandidates.map((s) => s.id);
    const newSet = new Set([...selectedStudentIds, ...filteredIds]);
    onSelectionChange(Array.from(newSet));
  }

  function deselectAllFiltered() {
    const filteredIdsSet = new Set(filteredCandidates.map((s) => s.id));
    onSelectionChange(selectedStudentIds.filter((id) => !filteredIdsSet.has(id)));
  }

  function selectAllEligible() {
    const eligibleIds = eligibleStudents.map((s) => s.id);
    const newSet = new Set([...selectedStudentIds, ...eligibleIds]);
    onSelectionChange(Array.from(newSet));
  }

  function clearAllSelections() {
    onSelectionChange([]);
  }

  const selectedCount = selectedStudentIds.length;
  const eligibleCount = eligibleStudents.length;
  const isAllFilteredSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((s) => selectedStudentIds.includes(s.id));

  return (
    <div className="space-y-4">
      {/* 1. Header Banner & Strict Access Notice */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                <Users className="w-5 h-5" />
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Candidate Roster &amp; Access Authorization
              </h2>
              <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                Step 04
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Select which candidates are authorized to sit this examination. Only candidates
              checked below will have permission to authenticate and enter the exam room.
              All non-selected students are strictly blocked by the institutional gatekeeper.
            </p>
          </div>

          {/* Quick Metrics Pill */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl self-start lg:self-center">
            <div className="text-center px-3 py-1">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Authorized
              </div>
              <div className="text-base font-black text-blue-700">
                {selectedCount}{" "}
                <span className="text-xs font-normal text-slate-400">/ {students.length}</span>
              </div>
            </div>
            <div className="h-7 w-px bg-slate-200" />
            <div className="text-center px-3 py-1">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Dept Tracks
              </div>
              <div className="text-base font-black text-slate-800">
                {hasSpecificDeptTracks ? `${examDeptCodes.length} Selected` : "All Tracks"}
              </div>
            </div>
            <div className="h-7 w-px bg-slate-200" />
            <div className="text-center px-3 py-1">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Status
              </div>
              <div className="inline-flex items-center text-xs font-bold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Zero-Trust Active
              </div>
            </div>
          </div>
        </div>

        {/* Informational Guidance Alert */}
        {hasSpecificDeptTracks && (
          <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start space-x-2.5 text-xs text-blue-900">
            <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-blue-950">
                Auto-Scoped to Part B Selected Departments ({examDeptCodes.length} Departments):
              </span>{" "}
              This exam has department specialization sections assigned to{" "}
              <strong>{examDeptCodes.join(", ")}</strong>. The roster below automatically highlights
              the {eligibleCount} registered candidates from those departments.
            </div>
          </div>
        )}
      </div>

      {/* 2. Department Track Filter Matrix & Quick Selection Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter by Department Track:</span>
          </div>

          {/* Quick Select Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {hasSpecificDeptTracks && (
              <button
                type="button"
                onClick={selectAllEligible}
                className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Select All Exam Depts ({eligibleCount})
              </button>
            )}

            <button
              type="button"
              onClick={selectAllFiltered}
              className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-2xs"
            >
              <CheckSquare className="w-3.5 h-3.5 mr-1" />
              Select Filtered ({filteredCandidates.length})
            </button>

            <button
              type="button"
              onClick={deselectAllFiltered}
              className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-2xs"
            >
              <Square className="w-3.5 h-3.5 mr-1" />
              Clear Filtered
            </button>

            {selectedCount > 0 && (
              <button
                type="button"
                onClick={clearAllSelections}
                className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset All ({selectedCount})
              </button>
            )}
          </div>
        </div>

        {/* Department Pills / Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => {
              setSelectedDeptFilter("ALL");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              selectedDeptFilter === "ALL"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80"
            }`}
          >
            <span>All Candidates</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedDeptFilter === "ALL"
                  ? "bg-slate-800 text-slate-100"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {selectedCount}/{students.length}
            </span>
          </button>

          {hasSpecificDeptTracks && (
            <button
              type="button"
              onClick={() => {
                setSelectedDeptFilter("EXAM_DEPTS");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                selectedDeptFilter === "EXAM_DEPTS"
                  ? "bg-blue-700 text-white shadow-2xs"
                  : "bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200"
              }`}
            >
              <span>Selected Exam Depts</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  selectedDeptFilter === "EXAM_DEPTS"
                    ? "bg-blue-800 text-blue-100"
                    : "bg-blue-200/80 text-blue-800"
                }`}
              >
                {eligibleStudents.filter((s) => selectedStudentIds.includes(s.id)).length}/
                {eligibleCount}
              </span>
            </button>
          )}

          {/* Individual Department Buttons */}
          {(hasSpecificDeptTracks ? examDeptCodes : Array.from(deptStats.keys())).map((code) => {
            const stats = deptStats.get(code);
            const isFilterActive = selectedDeptFilter === code;
            const total = stats?.total || 0;
            const selected = stats?.selected || 0;
            const isFull = total > 0 && selected === total;

            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setSelectedDeptFilter(code);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  isFilterActive
                    ? "bg-blue-700 text-white shadow-2xs ring-1 ring-blue-700"
                    : isFull
                    ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                <span>{code}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isFilterActive
                      ? "bg-blue-800 text-blue-100"
                      : isFull
                      ? "bg-emerald-200/80 text-emerald-900"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {selected}/{total}
                </span>
              </button>
            );
          })}

          {hasSpecificDeptTracks && otherStudents.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedDeptFilter("OTHER_DEPTS");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                selectedDeptFilter === "OTHER_DEPTS"
                  ? "bg-slate-700 text-white shadow-2xs"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              <span>Other Departments</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
                {otherStudents.filter((s) => selectedStudentIds.includes(s.id)).length}/
                {otherStudents.length}
              </span>
            </button>
          )}
        </div>

        {/* 3. Search and Quick Status Filter Bar */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name, application ID, roll number, or email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 rounded-lg outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center space-x-1 text-xs">
            <span className="text-slate-500 font-semibold mr-1">Status:</span>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                statusFilter === "ALL"
                  ? "bg-slate-200 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All ({filteredCandidates.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("SELECTED");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                statusFilter === "SELECTED"
                  ? "bg-emerald-100 text-emerald-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Authorized Only
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("UNSELECTED");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                statusFilter === "UNSELECTED"
                  ? "bg-red-100 text-red-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Unselected Only
            </button>
          </div>
        </div>
      </div>

      {/* 4. Candidate Table / List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {filteredCandidates.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No Candidates Match Your Filters</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Try clearing your search query or switching to &ldquo;All Candidates&rdquo; to view
              the institutional student registry.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedDeptFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="mt-3 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isAllFilteredSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllFiltered();
                        } else {
                          deselectAllFiltered();
                        }
                      }}
                      className="w-4 h-4 rounded text-blue-700 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      title={isAllFilteredSelected ? "Deselect all in view" : "Select all in view"}
                    />
                  </th>
                  <th className="py-3 px-4">Candidate Information</th>
                  <th className="py-3 px-4">Application ID (Password)</th>
                  <th className="py-3 px-4">Department / Track</th>
                  <th className="py-3 px-4 text-center">Authorization Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCandidates.map((cand, idx) => {
                  const isSelected = selectedStudentIds.includes(cand.id);
                  const deptCode = cand.department?.code?.toUpperCase() || "GEN";
                  const isExamDept = examDeptCodes.includes(deptCode);

                  // Initials for avatar
                  const initials = cand.full_name
                    ? cand.full_name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                    : "C";

                  return (
                    <tr
                      key={cand.id}
                      onClick={() => toggleStudent(cand.id)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer select-none ${
                        isSelected ? "bg-blue-50/30" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudent(cand.id)}
                          className="w-4 h-4 rounded text-blue-700 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Candidate Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border ${
                              isSelected
                                ? "bg-blue-700 text-white border-blue-800 shadow-2xs"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                              <span>{cand.full_name}</span>
                              {!cand.is_active && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {cand.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Application ID */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>{cand.application_number}</span>
                        </div>
                        {cand.roll_number && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 pl-0.5">
                            Roll: {cand.roll_number}
                          </div>
                        )}
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded border ${
                              isExamDept
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {deptCode}
                          </span>
                          <span className="text-slate-600 font-medium text-[11px] truncate max-w-xs">
                            {cand.department?.name || "General"}
                          </span>
                        </div>
                      </td>

                      {/* Authorization Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {isSelected ? (
                          <span className="inline-flex items-center text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Authorized to Sit
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            <XCircle className="w-3 h-3 mr-1 text-slate-400" />
                            Access Blocked
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleStudent(cand.id)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                          }`}
                        >
                          {isSelected ? "Revoke Access" : "Grant Access"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination Footer */}
        {filteredCandidates.length > 0 && (
          <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing{" "}
              <strong>
                {(currentPageSafe - 1) * ITEMS_PER_PAGE + 1} -{" "}
                {Math.min(currentPageSafe * ITEMS_PER_PAGE, filteredCandidates.length)}
              </strong>{" "}
              of <strong>{filteredCandidates.length}</strong> candidates (
              <strong>{selectedCount}</strong> total authorized)
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={currentPageSafe <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-semibold text-slate-700 px-2">
                Page {currentPageSafe} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPageSafe >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
