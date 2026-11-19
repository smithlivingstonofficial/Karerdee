"use client";

import React from "react";
import { DepartmentQuestion } from "@/types/database.types";
import { Trash2, AlertTriangle, X, Loader2, Sparkles, Globe, Building2 } from "lucide-react";

interface BulkDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedQuestions: DepartmentQuestion[];
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function BulkDeleteConfirmModal({
  isOpen,
  onClose,
  selectedQuestions,
  onConfirm,
  isDeleting,
}: BulkDeleteConfirmModalProps) {
  if (!isOpen) return null;

  const count = selectedQuestions.length;
  const previewQuestions = selectedQuestions.slice(0, 4);
  const remainingCount = count - previewQuestions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-red-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0 border border-red-200 shadow-2xs">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Delete {count} {count === 1 ? "Question" : "Questions"}?
              </h3>
              <p className="text-xs text-red-600 font-medium">
                This bulk operation is irreversible.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 text-xs text-amber-900 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Permanent Institutional Removal:</span>
              <p className="leading-relaxed text-amber-800">
                Are you sure you want to remove <strong>{count}</strong> selected {count === 1 ? "question" : "questions"}? All associated choices, answer keys, and formatting will be permanently deleted from the question bank.
              </p>
            </div>
          </div>

          {/* Question Preview List */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Selected Questions Preview:
            </span>
            <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200/80 divide-y divide-slate-100">
              {previewQuestions.map((q, idx) => {
                const isTamil = Boolean(
                  (q.prompt && /[\u0B80-\u0BFF]/.test(q.prompt)) ||
                  (q.topic && /tamil|தமிழ்/i.test(q.topic))
                );

                return (
                  <div key={q.id} className="pt-1.5 first:pt-0 pb-1 text-xs">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-mono font-bold text-[10px] text-slate-400">
                        #{idx + 1}
                      </span>
                      {!q.department_id ? (
                        isTamil ? (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                            Tamil
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                            General
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {q.department?.code || "DEPT"}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-slate-500">
                        {q.topic}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium line-clamp-2 leading-snug">
                      {q.prompt}
                    </p>
                  </div>
                );
              })}

              {remainingCount > 0 && (
                <div className="pt-2 text-center text-xs font-semibold text-slate-500">
                  + {remainingCount} more selected {remainingCount === 1 ? "question" : "questions"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting Questions...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete {count} {count === 1 ? "Question" : "Questions"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
