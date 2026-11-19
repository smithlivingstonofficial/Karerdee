"use client";

import React, { useState } from "react";
import { Department } from "@/types/database.types";
import { ArrowRightLeft, Sparkles, Globe, Building2, X, Loader2 } from "lucide-react";

interface BulkReassignScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  selectedCount: number;
  onConfirm: (targetScope: string) => Promise<void>;
  isUpdating: boolean;
}

export function BulkReassignScopeModal({
  isOpen,
  onClose,
  departments,
  selectedCount,
  onConfirm,
  isUpdating,
}: BulkReassignScopeModalProps) {
  const [targetScope, setTargetScope] = useState<string>("GENERAL_EN");

  if (!isOpen) return null;

  async function handleApply() {
    await onConfirm(targetScope);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-blue-50/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 border border-blue-200 shadow-2xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Reassign Scope ({selectedCount} Questions)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Move questions across core repositories or departments.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Destination Repository Scope:
          </label>

          <div className="space-y-2">
            {/* 1. General Core EN */}
            <label
              className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                targetScope === "GENERAL_EN"
                  ? "bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20 text-purple-950 font-semibold"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
              }`}
            >
              <input
                type="radio"
                name="targetScope"
                value="GENERAL_EN"
                checked={targetScope === "GENERAL_EN"}
                onChange={() => setTargetScope("GENERAL_EN")}
                className="w-4 h-4 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">General Core (English)</div>
                  <div className="text-[10px] text-slate-500">Universal institutional entrance core</div>
                </div>
              </div>
            </label>

            {/* 2. Common Tamil */}
            <label
              className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                targetScope === "GENERAL_TA"
                  ? "bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950 font-semibold"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
              }`}
            >
              <input
                type="radio"
                name="targetScope"
                value="GENERAL_TA"
                checked={targetScope === "GENERAL_TA"}
                onChange={() => setTargetScope("GENERAL_TA")}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Common Tamil (Research Methodology)</div>
                  <div className="text-[10px] text-slate-500">Universal core in Tamil language script</div>
                </div>
              </div>
            </label>

            {/* 3. Department Specific */}
            <div className="pt-2">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Or Assign to Department Curriculum:
              </span>
              <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {departments.map((dept) => (
                  <label
                    key={dept.id}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                      targetScope === dept.id
                        ? "bg-blue-50 border-blue-300 font-bold text-blue-900"
                        : "bg-white hover:bg-slate-100/80 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="targetScope"
                        value={dept.id}
                        checked={targetScope === dept.id}
                        onChange={() => setTargetScope(dept.id)}
                        className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                      />
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{dept.name}</span>
                    </div>
                    <span className="font-mono font-bold text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      {dept.code}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isUpdating}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reassigning...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Reassign {selectedCount} Questions</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
