"use client";

import React, { useState, useEffect } from "react";
import { createStudentAction, updateStudentAction } from "../actions";
import { UserCheck, X, AlertCircle, Building2, KeyRound } from "lucide-react";

interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentOption[];
  student?: {
    id: string;
    full_name: string;
    application_number: string;
    email?: string | null;
    department_id?: string | null;
  } | null;
}

export function StudentModal({
  isOpen,
  onClose,
  departments,
  student,
}: StudentModalProps) {
  const [fullName, setFullName] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setFullName(student.full_name || "");
      setApplicationNumber(student.application_number || "");
      setEmail(student.email || "");
      setDepartmentId(student.department_id || "");
    } else {
      setFullName("");
      setApplicationNumber("");
      setEmail("");
      setDepartmentId(departments[0]?.id || "");
    }
    setError(null);
  }, [student, departments, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setLoading(true);

    const formData = new FormData();
    formData.append("fullName", fullName);
    formData.append("applicationNumber", applicationNumber);
    formData.append("email", email);
    formData.append("departmentId", departmentId);

    const res = student
      ? await updateStudentAction(student.id, formData)
      : await createStudentAction(formData);

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {student ? "Edit Candidate Record" : "Register Candidate"}
              </h2>
              <p className="text-[11px] text-slate-500">
                Institutional credentials used for desktop client authentication.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Candidate Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Application Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={applicationNumber}
                onChange={(e) => setApplicationNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 9921004123"
                className="w-full px-3.5 py-2 text-sm font-mono uppercase bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Candidate login credential in desktop client.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Department <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 cursor-pointer appearance-none"
                >
                  <option value="">— Unassigned / General Pool —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      [{d.code}] {d.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Optional. Routes department questions in multi-dept papers.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Institutional Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. candidate@klu.ac.in"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Used as the candidate&apos;s username for client login.
            </p>
          </div>

          {/* Login Credentials Box */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
              <KeyRound className="w-3.5 h-3.5 text-blue-700" />
              <span>Automated Candidate Login Access</span>
            </div>
            <div className="text-[11px] text-slate-600 leading-relaxed">
              Upon registration, a verified student account is automatically created:
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-blue-100">
                <span className="text-slate-400 block text-[10px] uppercase font-sans">Username</span>
                <span className="font-bold text-slate-900 truncate block">
                  {email ? email : "candidate@klu.ac.in"}
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-blue-100">
                <span className="text-slate-400 block text-[10px] uppercase font-sans">Password</span>
                <span className="font-bold text-slate-900 truncate block">
                  {applicationNumber ? applicationNumber : "Application No"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end space-x-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Saving..." : student ? "Update Candidate" : "Register Candidate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
