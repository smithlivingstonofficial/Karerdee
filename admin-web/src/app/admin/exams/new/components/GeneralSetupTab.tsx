"use client";

import React, { useState } from "react";
import { ExamGeneralState } from "../types";
import {
  KeyRound,
  RefreshCw,
  Clock,
  Calendar,
  MinusCircle,
  FileText,
  Copy,
  Check,
  BookOpen,
  Hash,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatToISTDateTimeLocal, parseISTDateTime } from "@/lib/date";

interface GeneralSetupTabProps {
  general: ExamGeneralState;
  onChange: (updated: Partial<ExamGeneralState>) => void;
}

export function GeneralSetupTab({ general, onChange }: GeneralSetupTabProps) {
  const [copiedPasscode, setCopiedPasscode] = useState(false);

  function generateRandomPasscode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onChange({ passcode: code });
  }

  function copyPasscode() {
    if (!general.passcode) return;
    navigator.clipboard.writeText(general.passcode);
    setCopiedPasscode(true);
    setTimeout(() => setCopiedPasscode(false), 2000);
  }

  const durationPresets = [45, 60, 90, 120, 180];

  function calculateEndTime(startStr: string, durationMins: number): string {
    if (!startStr) return "";
    const startDate = parseISTDateTime(startStr);
    if (isNaN(startDate.getTime())) return "";
    const endDate = new Date(startDate.getTime() + durationMins * 60 * 1000);
    return formatToISTDateTimeLocal(endDate);
  }

  function handleStartTimeChange(newStart: string) {
    const updates: Partial<ExamGeneralState> = { startTime: newStart };
    if (newStart) {
      updates.endTime = calculateEndTime(newStart, general.durationMinutes || 90);
    }
    onChange(updates);
  }

  function handleDurationChange(mins: number) {
    const safeMins = Math.max(1, mins);
    const updates: Partial<ExamGeneralState> = { durationMinutes: safeMins };
    if (general.startTime) {
      updates.endTime = calculateEndTime(general.startTime, safeMins);
    }
    onChange(updates);
  }

  function handleSetStartNow() {
    const now = new Date();
    const startStr = formatToISTDateTimeLocal(now);
    handleStartTimeChange(startStr);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
      {/* Left Column: Paper Identity, Scope & Scoring Policy (7 cols) */}
      <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3.5">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
                01
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  Paper Identity &amp; Curriculum Scope
                </h3>
                <p className="text-[10px] text-slate-500">
                  Institutional title, course code, and scoring policy.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Required *
            </span>
          </div>

          {/* Title & Code in 8:4 row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-8 space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Examination Title <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={general.title}
                  onChange={(e) => onChange({ title: e.target.value })}
                  placeholder="e.g. Ph.D Research Methodology & CS Comprehensive Exam"
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs font-medium transition-all"
                />
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Course Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Hash className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={general.courseCode}
                  onChange={(e) => onChange({ courseCode: e.target.value.toUpperCase() })}
                  placeholder="MCA-301"
                  className="w-full pl-7 pr-2 py-1.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs font-bold transition-all"
                />
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Examination Synopsis &amp; Candidate Overview
            </label>
            <div className="relative">
              <div className="absolute top-2 left-2.5 pointer-events-none text-slate-400">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <textarea
                rows={2}
                value={general.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Brief syllabus scope or instructions displayed to candidates before commencing..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs leading-relaxed transition-all resize-none"
              />
            </div>
          </div>

          {/* Integrated Negative Marking Section (Filling the blank space) */}
          <div className="p-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
                general.enableNegativeMarking
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-200/80 text-slate-500"
              }`}>
                <MinusCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider truncate">
                    Negative Marking Penalty
                  </h4>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                    general.enableNegativeMarking
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-slate-200/60 text-slate-600 border-slate-300"
                  }`}>
                    {general.enableNegativeMarking ? "Penalty Active" : "Disabled (0 Marks)"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  Deducts fractional points for incorrect MCQ responses to deter blind guessing.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onChange({ enableNegativeMarking: !general.enableNegativeMarking })}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-700 ${
                general.enableNegativeMarking ? "bg-blue-700" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                  general.enableNegativeMarking ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Bottom Guidance Pill */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
          <span>Displayed on candidate examination screen</span>
          <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.2 rounded border border-blue-100">
            KARE-SES Online
          </span>
        </div>
      </div>

      {/* Right Column: Session Credentials & Timing (5 cols) */}
      <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
              02
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                Session Credentials &amp; Timing
              </h3>
              <p className="text-[10px] text-slate-500">
                Authentication passcode, duration, and admission window.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
            Active Guard
          </span>
        </div>

        <div className="space-y-2.5">
          {/* Passcode Row */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-800">
                Candidate Access Passcode <span className="text-red-500">*</span>
              </label>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100/70 text-blue-700 border border-blue-200">
                Encrypted
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={general.passcode}
                  onChange={(e) => onChange({ passcode: e.target.value.toUpperCase() })}
                  placeholder="PHD2026"
                  className="w-full pl-8 pr-2 py-1 text-xs font-mono uppercase font-black tracking-wider bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>

              <button
                type="button"
                onClick={generateRandomPasscode}
                className="inline-flex items-center px-2 py-1 text-xs font-bold text-blue-700 bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                title="Generate Random Passcode"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                New
              </button>

              <button
                type="button"
                onClick={copyPasscode}
                className="p-1 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
                title="Copy Passcode"
              >
                {copiedPasscode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Duration Row */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-800">
                Duration (Minutes) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center space-x-1">
                {durationPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleDurationChange(preset)}
                    className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded border transition-all cursor-pointer ${
                      general.durationMinutes === preset
                        ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {preset}m
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
                min={1}
                max={600}
                value={general.durationMinutes}
                onChange={(e) => handleDurationChange(parseInt(e.target.value) || 60)}
                className="w-full pl-8 pr-12 py-1 text-xs font-black bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              />
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[10px] text-slate-400 font-bold uppercase">
                Mins
              </div>
            </div>
          </div>

          {/* Admission Window Row (Auto-Calculates End Time from Start + Duration) */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                  <span>Admission Window</span>
                  <span className="text-[9px] font-extrabold text-blue-700 bg-blue-100/70 px-1 py-0.2 rounded border border-blue-200">
                    IST (UTC+05:30)
                  </span>
                </label>
                {general.startTime && general.endTime && (
                  <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 flex items-center">
                    <Sparkles className="w-2.5 h-2.5 mr-1 text-blue-600" />
                    Auto-End (+{general.durationMinutes}m)
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleSetStartNow}
                  className="text-[9px] font-bold text-blue-700 hover:text-blue-800 bg-white px-2 py-0.5 rounded-md border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer shadow-2xs"
                  title="Set start time to now and auto-compute end time"
                >
                  Set to Now
                </button>
                <span className="text-[9px] font-medium text-slate-400">
                  Lab Cutoff
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Start</span>
                  {general.startTime && (
                    <span className="text-[8px] font-semibold text-slate-400">Exam Opens</span>
                  )}
                </div>
                <input
                  type="datetime-local"
                  value={general.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full px-2 py-0.5 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all font-medium"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">End</span>
                  {general.endTime && (
                    <span className="text-[8px] font-bold text-emerald-700">Auto-Calculated</span>
                  )}
                </div>
                <input
                  type="datetime-local"
                  value={general.endTime}
                  onChange={(e) => onChange({ endTime: e.target.value })}
                  className="w-full px-2 py-0.5 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Passcode distributed by invigilators</span>
          <span className="font-semibold text-slate-600">Self-paced countdown</span>
        </div>
      </div>
    </div>
  );
}
