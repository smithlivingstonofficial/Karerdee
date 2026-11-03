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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Department Management
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {initialDepartments.length} Departments
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage institutional faculties, curriculum codes, and student routing for multi-department exam papers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSeedStandardDepartments}
            disabled={seeding}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Populate standard Kalasalingam departments in one click"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            {seeding ? "Initializing..." : "Seed KARE Depts"}
          </button>

          <button
            type="button"
            onClick={() => setCsvModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Bulk CSV
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            Add Department
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Departments</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {initialDepartments.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Registered institutional curricula
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Enrolled Candidates</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {totalEnrolled}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Allocated across faculties
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Candidate Registry</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Assign Candidates</span>
            <Link
              href="/admin/students"
              className="inline-flex items-center text-xs font-bold text-blue-700 hover:text-blue-800 transition-colors"
            >
              Open Registry <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Add candidates with or without department
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

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by department name or code..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all"
          />
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="text-slate-900 font-bold">{filtered.length}</span> of {initialDepartments.length} Departments
        </div>
      </div>

      {/* Departments Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
              <thead className="bg-slate-50/75 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Department Name</th>
                  <th className="px-6 py-3.5">Curriculum Code</th>
                  <th className="px-6 py-3.5">Enrolled Candidates</th>
                  <th className="px-6 py-3.5">Question Bank</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filtered.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <span>{dept.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {dept.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/admin/students`}
                        className="inline-flex items-center space-x-1.5 text-xs text-slate-600 hover:text-blue-700 font-semibold transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{dept.studentCount} Students</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/admin/departments/${dept.id}/questions`}
                        className="inline-flex items-center space-x-1.5 text-xs text-blue-700 hover:text-blue-900 bg-blue-50/80 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors font-semibold"
                        title="Open Department Question Repository"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{dept.questionCount ?? 0} Questions</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-1">
                      <Link
                        href={`/admin/departments/${dept.id}/questions`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors inline-block"
                        title="Manage Questions"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(dept)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit Department"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(dept.id, dept.name)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
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
                className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                Add Department
              </button>
            </div>
          </div>
        )}
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
