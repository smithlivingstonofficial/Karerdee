"use client";

import React, { useState } from "react";
import { ExamGeneralState } from "../types";
import {
  Calculator,
  FileEdit,
  Bookmark,
  Clock,
  CheckCircle2,
  FileText,
  Sparkles,
  Shield,
  Ban,
  Percent,
  RefreshCw,
  Plus,
  HelpCircle,
  Check,
} from "lucide-react";

interface CandidateToolsTabProps {
  general: ExamGeneralState;
  onChange: (updated: Partial<ExamGeneralState>) => void;
}

const DEFAULT_INSTRUCTIONS = `1. Ensure all background applications are terminated before starting.
2. The examination environment is protected by Win32 low-level hardware hooks.
3. Switching windows or pressing restricted shortcuts will register an infraction strike.
4. You must keep your webcam unobstructed throughout the sitting.
5. Digital scratchpad and calculator (if enabled) are available in the top utility ribbon.`;

export function CandidateToolsTab({ general, onChange }: CandidateToolsTabProps) {
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const lateEntryPresets = [0, 10, 15, 30];
  const earlyExitPresets = [0, 33, 50, 75];

  function appendInstructionRule(ruleText: string) {
    const current = general.instructions.trim();
    if (current.includes(ruleText)) return;
    const lines = current ? current.split("\n") : [];
    const nextNum = lines.length + 1;
    const updated = current ? `${current}\n${nextNum}. ${ruleText}` : `1. ${ruleText}`;
    onChange({ instructions: updated });
  }

  function resetInstructions() {
    onChange({ instructions: DEFAULT_INSTRUCTIONS });
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  }

  const unlockMinutes = Math.round(
    ((general.durationMinutes || 90) * (general.earlySubmissionMinPercent || 50)) / 100
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
      {/* Left Column: Digital Aids, Calculator & Timing Gates (7 cols) */}
      <div className="lg:col-span-7 space-y-3.5 flex flex-col justify-between">
        {/* Card 1: Embedded In-Exam Calculator & Digital Aids */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
                01
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  In-Exam Calculator &amp; Digital Candidate Aids
                </h3>
                <p className="text-[10px] text-slate-500">
                  Select computation engine and interactive test-taking utilities.
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                general.calculatorMode === "SCIENTIFIC"
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : general.calculatorMode === "BASIC"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {general.calculatorMode === "SCIENTIFIC"
                ? "Scientific Mode"
                : general.calculatorMode === "BASIC"
                ? "Basic Arithmetic"
                : "Calculator Off"}
            </span>
          </div>

          {/* Calculator Mode Selection (3 Compact Clickable Cards) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Calculation Engine Permission
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* None */}
              <div
                onClick={() => onChange({ calculatorMode: "NONE" })}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  general.calculatorMode === "NONE"
                    ? "bg-blue-50/70 border-blue-600 ring-1 ring-blue-500/20 shadow-2xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Disabled (None)</span>
                    {general.calculatorMode === "NONE" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    No calculator provided. Ideal for qualitative, social sciences or theory exams.
                  </p>
                </div>
                <span className="text-[9px] font-semibold text-slate-400 mt-2 block">
                  Standard Lockdown
                </span>
              </div>

              {/* Basic */}
              <div
                onClick={() => onChange({ calculatorMode: "BASIC" })}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  general.calculatorMode === "BASIC"
                    ? "bg-blue-50/70 border-blue-600 ring-1 ring-blue-500/20 shadow-2xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Basic Arithmetic</span>
                    {general.calculatorMode === "BASIC" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Four-function arithmetic (+, -, ×, ÷), percentages and memory registers.
                  </p>
                </div>
                <span className="text-[9px] font-bold text-blue-700 mt-2 block">
                  Arithmetic (+, -, ×, ÷)
                </span>
              </div>

              {/* Scientific */}
              <div
                onClick={() => onChange({ calculatorMode: "SCIENTIFIC" })}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  general.calculatorMode === "SCIENTIFIC"
                    ? "bg-purple-50/70 border-purple-600 ring-1 ring-purple-500/20 shadow-2xs"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Scientific Engine</span>
                    {general.calculatorMode === "SCIENTIFIC" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-700 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Trigonometry, logarithms, exponents, roots, parentheses and constants (π, e).
                  </p>
                </div>
                <span className="text-[9px] font-bold text-purple-700 mt-2 block">
                  Full Academic (Trig, Log)
                </span>
              </div>
            </div>
          </div>

          {/* Digital Candidate Aids: Scratchpad & Flagging (Compact Toggle Rows) */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              In-Exam Digital Utilities
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Scratchpad */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700 flex-shrink-0">
                    <FileEdit className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Digital Scratchpad
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Slide-over canvas for rough work
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onChange({ enableScratchpad: !general.enableScratchpad })}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    general.enableScratchpad ? "bg-blue-700" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                      general.enableScratchpad ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Question Flagging */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-indigo-100/70 text-indigo-700 flex-shrink-0">
                    <Bookmark className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Review Flagging
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Bookmark uncertain items to review
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onChange({ enableQuestionFlagging: !general.enableQuestionFlagging })
                  }
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    general.enableQuestionFlagging ? "bg-blue-700" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                      general.enableQuestionFlagging ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Admission Tolerances & Early Submission Gates */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
                02
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  Admission Tolerances &amp; Early Submission Gates
                </h3>
                <p className="text-[10px] text-slate-500">
                  Enforce late arrival grace windows and prevent premature walkouts.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
              Auto-Lock Gates
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Late Entry Grace Period */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800">
                  Late Entry Grace
                </label>
                <div className="flex items-center space-x-1">
                  {lateEntryPresets.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChange({ lateEntryBufferMinutes: val })}
                      className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded border transition-all cursor-pointer ${
                        general.lateEntryBufferMinutes === val
                          ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {val}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={general.lateEntryBufferMinutes}
                  onChange={(e) =>
                    onChange({
                      lateEntryBufferMinutes: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full pl-8 pr-12 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                />
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[10px] text-slate-400 font-bold uppercase">
                  Mins
                </div>
              </div>

              <p className="text-[9px] text-slate-400 leading-tight">
                Candidate login locked {general.lateEntryBufferMinutes} mins after exam start.
              </p>
            </div>

            {/* Early Submission Lockout */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800">
                  Early Exit Gate
                </label>
                <div className="flex items-center space-x-1">
                  {earlyExitPresets.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChange({ earlySubmissionMinPercent: val })}
                      className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded border transition-all cursor-pointer ${
                        general.earlySubmissionMinPercent === val
                          ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Percent className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={general.earlySubmissionMinPercent}
                  onChange={(e) =>
                    onChange({
                      earlySubmissionMinPercent: Math.min(
                        100,
                        Math.max(0, parseInt(e.target.value) || 0)
                      ),
                    })
                  }
                  className="w-full pl-8 pr-12 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                />
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[10px] text-slate-400 font-bold uppercase">
                  % Time
                </div>
              </div>

              <p className="text-[9px] text-slate-400 leading-tight">
                Submit unlocks after {unlockMinutes} mins ({general.earlySubmissionMinPercent}% sitting).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Pre-Exam Candidate Instructions & Honor Code (5 cols) */}
      <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
                03
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  Candidate Honor Code &amp; Guidelines
                </h3>
                <p className="text-[10px] text-slate-500">
                  Displayed on desktop terminal before entering lockdown.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetInstructions}
              className="inline-flex items-center px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-all cursor-pointer shadow-2xs"
              title="Reset to default proctoring rules"
            >
              {copiedTemplate ? (
                <>
                  <Check className="w-3 h-3 mr-1 text-emerald-600" />
                  Loaded
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reset
                </>
              )}
            </button>
          </div>

          {/* Quick Snippet Appenders */}
          <div className="pt-2.5 pb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Insert Standard Clauses:
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() =>
                  appendInstructionRule("Background apps like browsers or IDEs will trigger an immediate strike.")
                }
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                + Win32 Lockdown
              </button>
              <button
                type="button"
                onClick={() =>
                  appendInstructionRule("Candidate face must remain fully visible to the front webcam at all times.")
                }
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                + Webcam Rule
              </button>
              <button
                type="button"
                onClick={() =>
                  appendInstructionRule("Use the on-screen digital calculator for numerical questions; physical devices are prohibited.")
                }
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                + Calculator Notice
              </button>
            </div>
          </div>

          {/* Monospace Guidelines Textarea */}
          <div className="mt-1">
            <textarea
              rows={11}
              value={general.instructions}
              onChange={(e) => onChange({ instructions: e.target.value })}
              placeholder="1. Enter sitting rules and examination guidelines..."
              className="w-full px-3 py-2.5 text-xs font-mono leading-relaxed bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
          <span>{general.instructions?.split("\n").length || 0} instruction clauses</span>
          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.2 rounded border border-blue-100">
            KARE-SES Native
          </span>
        </div>
      </div>
    </div>
  );
}
