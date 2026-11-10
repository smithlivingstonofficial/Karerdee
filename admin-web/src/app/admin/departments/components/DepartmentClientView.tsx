"use client";

import React, { useState } from "react";
import { DepartmentModal } from "./DepartmentModal";
import { BulkDepartmentCsvModal } from "./BulkDepartmentCsvModal";
import { deleteDepartmentAction, seedStandardDepartmentsAction } from "../actions";
import {
  Building2,
  PlusCircle,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Users,
  Search,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Layers,
  ArrowRight,
  BookOpen
} from "lucide-react";
import Link from "next/link";

interface DepartmentClientViewProps {
  initialDepartments: {
    id: string;
    name: string;
    code: string;
    studentCount: number;
    questionCount?: number;
    created_at: string;
  }[];
}

export function DepartmentClientView({ initialDepartments }: DepartmentClientViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<{ id: string; name: string; code: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const filtered = initialDepartments.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEnrolled = initialDepartments.reduce((acc, curr) => acc + (curr.studentCount || 0), 0);
  const totalQuestionsCount = initialDepartments.reduce((acc, curr) => acc + (curr.questionCount || 0), 0);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setActionNotice(null);
    const res = await deleteDepartmentAction(id);
    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      setActionNotice({ type: "success", message: `Department "${name}" deleted.` });
    }
  }

  async function handleSeedStandardDepartments() {
    if (
      !confirm(
        "Initialize standard Kalasalingam Academic Departments?\n\nThis will add standard faculties (MCA, CSE, IT, AIDS, ECE, EEE, MECH, CIVIL, BIOTECH, COMMERCE, etc.) without affecting any existing records."
      )
    ) {
      return;
    }

    setSeeding(true);
    setActionNotice(null);
    const res = await seedStandardDepartmentsAction();
    setSeeding(false);

    if (res.error) {
      setActionNotice({ type: "error", message: res.error });
    } else {
      setActionNotice({
        type: "success",
        message: `Standard KARE academic departments initialized and synchronized successfully!`,
      });
    }
  }

  function handleOpenCreate() {
    setEditingDept(null);
    setModalOpen(true);
  }

  function handleOpenEdit(dept: { id: string; name: string; code: string }) {
    setEditingDept(dept);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 w-full">
      {/* 1. Combined Executive Command Center & Department Registry Cockpit */}
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
                  Department Management
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/80">
                  Academic Faculties
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleSeedStandardDepartments}
              disabled={seeding}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Populate standard Kalasalingam departments in one click"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{seeding ? "Initializing..." : "Seed KARE Depts"}</span>
            </button>

            <button
              type="button"
              onClick={() => setCsvModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bulk CSV</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-lg shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Department</span>
            </button>
          </div>
        </div>

        {/* 4 Clean Metric Cells (Zero Unwanted Text, Streamlined Padding) */}
        <div className="border-t border-slate-200/80 grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
          {/* Metric 1: Active Departments */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-blue-700 transition-colors">
                Active Faculties
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-slate-100 text-slate-600 border-slate-200">
                {initialDepartments.length} Depts
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {initialDepartments.length}
              </span>
              <span className="text-xs text-slate-400">academic disciplines</span>
            </div>
          </div>

          {/* Metric 2: Total Enrolled Candidates */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                Enrolled Candidates
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                {totalEnrolled} Active
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {totalEnrolled}
              </span>
              <span className="text-xs text-slate-400">phd examinees</span>
            </div>
          </div>

          {/* Metric 3: Department Curricula Questions */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-purple-700 transition-colors">
                Question Bank
              </span>
              <span className="font-bold px-1.5 py-0.2 rounded-full border text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                Curricular
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-black text-purple-700 tracking-tight">
                {totalQuestionsCount}
              </span>
              <span className="text-xs text-slate-400">faculty questions</span>
            </div>
          </div>

          {/* Metric 4: Candidate Registry Link */}
          <Link
            href="/admin/students"
            className="px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-700 transition-colors">
                Candidate Registry
              </span>
              <span className="font-bold text-indigo-700 text-xs inline-flex items-center group-hover:translate-x-0.5 transition-transform">
                Open <ArrowRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-xs font-bold text-slate-800">
                Roster Allocation &amp; Batches
              </span>
            </div>
          </Link>
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

      {/* Departments Table Card with Integrated Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {/* Header Toolbar */}
        <div className="p-4 sm:p-4.5 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 flex-shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Institutional Academic Faculties
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {filtered.length} Total
              </span>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search faculty or code..."
              className="w-full pl-9 pr-7 py-1.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-700 px-1 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Table Data */}
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3">Department Name</th>
                  <th className="px-4 py-3">Curriculum Code</th>
                  <th className="px-4 py-3">Enrolled Candidates</th>
                  <th className="px-4 py-3">Question Bank</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filtered.map((dept) => (
                  <tr key={dept.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100 flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="group-hover:text-blue-700 transition-colors">{dept.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {dept.code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        href={`/admin/students`}
                        className="inline-flex items-center space-x-1.5 text-xs text-slate-600 hover:text-blue-700 font-semibold transition-colors bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/70"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{dept.studentCount} Students</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        href={`/admin/departments/${dept.id}/questions`}
                        className="inline-flex items-center space-x-1.5 text-xs text-blue-700 hover:text-blue-900 bg-blue-50/80 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors font-bold shadow-2xs"
                        title="Open Department Question Repository"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{dept.questionCount ?? 0} Questions</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right space-x-1">
                      <Link
                        href={`/admin/departments/${dept.id}/questions`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all inline-block"
                        title="Manage Questions"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(dept)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all cursor-pointer"
                        title="Edit Department"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(dept.id, dept.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto border border-blue-100">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Departments Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your institution&apos;s academic departments (e.g. MCA, CSE, ECE) or click below to seed standard KARE faculties automatically.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleSeedStandardDepartments}
                disabled={seeding}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {seeding ? "Initializing..." : "Seed Standard KARE Departments"}
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Add Department
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 px-5 border-t border-slate-200/80 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">
            Showing <strong className="text-slate-700">{filtered.length}</strong> of{" "}
            <strong className="text-slate-700">{initialDepartments.length}</strong> academic departments
          </span>
          <Link
            href="/admin/students"
            className="font-bold text-blue-700 hover:text-blue-800 inline-flex items-center space-x-1 group"
          >
            <span>Candidate Registry</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Modals */}
      <DepartmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        department={editingDept}
      />

      <BulkDepartmentCsvModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
      />
    </div>
  );
}
