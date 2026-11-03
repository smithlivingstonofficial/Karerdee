"use client";

import React from "react";
import { ExamGeneralState, LockdownPolicyState } from "../types";
import {
  ShieldAlert,
  ShieldCheck,
  Keyboard,
  EyeOff,
  Monitor,
  Cpu,
  Binary,
  Shuffle,
  Lock,
  Radio,
  Sliders,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface SecurityLockdownTabProps {
  general: ExamGeneralState;
  onChange: (updated: Partial<ExamGeneralState>) => void;
}

export function SecurityLockdownTab({ general, onChange }: SecurityLockdownTabProps) {
  const policy = general.lockdownPolicy || {
    blockKeyboardHooks: true,
    blockDisplayAffinity: true,
    blockMultipleMonitors: true,
    blockVirtualMachines: true,
    blockBlacklistedProcesses: true,
    lockHardwareFingerprint: false,
  };

  function updatePolicy(field: keyof LockdownPolicyState, value: boolean) {
    onChange({
      lockdownPolicy: {
        ...policy,
        [field]: value,
      },
    });
  }

  function armStandardProfile() {
    onChange({
      lockdownPolicy: {
        blockKeyboardHooks: true,
        blockDisplayAffinity: true,
        blockMultipleMonitors: true,
        blockVirtualMachines: true,
        blockBlacklistedProcesses: true,
        lockHardwareFingerprint: false,
      },
    });
  }

  function armAllGuards() {
    onChange({
      lockdownPolicy: {
        blockKeyboardHooks: true,
        blockDisplayAffinity: true,
        blockMultipleMonitors: true,
        blockVirtualMachines: true,
        blockBlacklistedProcesses: true,
        lockHardwareFingerprint: true,
      },
    });
  }

  const activeGuardsCount = Object.values(policy).filter(Boolean).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
      {/* Left Column: Strike Management & Anti-Glance Controls (5 cols) */}
      <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
        {/* Card 1: Strike Tolerances & Enforcement Action */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
                01
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  Violation Strike Management
                </h3>
                <p className="text-[10px] text-slate-500">
                  Infraction limits and automated enforcement consequences.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.2 rounded-full border border-blue-200">
              Proctor Guard
            </span>
          </div>

          {/* Strike Tolerance Input & Quick Presets */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-800">
                Maximum Strike Tolerance
              </label>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onChange({ maxStrikes: val })}
                    className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded border transition-all cursor-pointer ${
                      general.maxStrikes === val
                        ? "bg-blue-700 text-white border-blue-700 shadow-2xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {val} Strike{val > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <input
                type="number"
                min={1}
                max={10}
                value={general.maxStrikes}
                onChange={(e) =>
                  onChange({ maxStrikes: Math.max(1, parseInt(e.target.value) || 3) })
                }
                className="w-full pl-8 pr-12 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
              />
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[10px] text-slate-400 font-bold uppercase">
                Strikes
              </div>
            </div>

            <p className="text-[9px] text-slate-400 leading-tight">
              Exceeding {general.maxStrikes} infractions immediately triggers enforcement.
            </p>
          </div>

          {/* Enforcement Action Selector */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-800 block">
              Enforcement Action on Strikeout
            </label>
            <select
              value={general.strikeAction}
              onChange={(e) =>
                onChange({
                  strikeAction: e.target.value as "LOCK_WORKSTATION" | "FORCE_SUBMIT" | "FLAG_SILENT",
                })
              }
              className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all cursor-pointer"
            >
              <option value="LOCK_WORKSTATION">Lock Workstation (Requires Proctor Master Key)</option>
              <option value="FORCE_SUBMIT">Force Submit & Terminate Sitting Immediately</option>
              <option value="FLAG_SILENT">Silent Audit Flag (Record Incident, Don't Disrupt)</option>
            </select>

            {/* Dynamic Consequence Note */}
            <div
              className={`p-2 rounded-lg text-[10px] leading-relaxed border ${
                general.strikeAction === "LOCK_WORKSTATION"
                  ? "bg-amber-50/80 border-amber-200 text-amber-900"
                  : general.strikeAction === "FORCE_SUBMIT"
                  ? "bg-red-50/80 border-red-200 text-red-900"
                  : "bg-blue-50/80 border-blue-200 text-blue-900"
              }`}
            >
              {general.strikeAction === "LOCK_WORKSTATION" &&
                "Locks workstation with a security overlay; candidate cannot proceed without invigilator physical key."}
              {general.strikeAction === "FORCE_SUBMIT" &&
                "Auto-grades answered items, force-submits exam record, and immediately terminates the desktop client."}
              {general.strikeAction === "FLAG_SILENT" &&
                "Session continues uninterrupted; telemetry flags candidate audit transcript for post-exam review."}
            </div>
          </div>
        </div>

        {/* Card 2: Anti-Glance Shuffling Controls */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
                02
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  Anti-Glance Shuffling Controls
                </h3>
                <p className="text-[10px] text-slate-500">
                  Deter neighbor screen-peeking in dense computer laboratories.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Lab Defense</span>
          </div>

          <div className="space-y-2">
            {/* Randomize Questions */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700 flex-shrink-0">
                  <Shuffle className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    Randomize Question Order
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Distinct permutation per candidate roll number
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onChange({ randomizeQuestions: !general.randomizeQuestions })}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  general.randomizeQuestions ? "bg-blue-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                    general.randomizeQuestions ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Randomize Options */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-indigo-100/70 text-indigo-700 flex-shrink-0">
                  <Shuffle className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">
                    Randomize MCQ Choices (A, B, C, D)
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Shuffles options while preserving correct answer key
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onChange({ randomizeOptions: !general.randomizeOptions })}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  general.randomizeOptions ? "bg-blue-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                    general.randomizeOptions ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Win32 Desktop Lockdown Architecture (7 cols) */}
      <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3.5">
        <div>
          {/* Header with Arm Shortcuts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
                03
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  Win32 Desktop Lockdown Architecture
                </h3>
                <p className="text-[10px] text-slate-500">
                  Native Windows OS defense barriers enforced inside the desktop client.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 self-start sm:self-center">
              <button
                type="button"
                onClick={armStandardProfile}
                className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-md transition-all cursor-pointer shadow-2xs"
                title="Arm standard 5 recommended guards"
              >
                Recommended (5/6)
              </button>
              <button
                type="button"
                onClick={armAllGuards}
                className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md transition-all cursor-pointer shadow-2xs"
                title="Arm all 6 defense guards"
              >
                Arm All (6/6)
              </button>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-300">
                {activeGuardsCount}/6 Armed
              </span>
            </div>
          </div>

          {/* 6 Hardware Shields in 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5">
            {/* Shield 1: Keyboard Hook */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-2.5">
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700 flex-shrink-0 mt-0.5">
                  <Keyboard className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Keyboard Hook
                    </span>
                    <span className="text-[8px] font-bold px-1 rounded bg-slate-200/70 text-slate-600">
                      WH_KEYBOARD_LL
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-relaxed">
                    Drops Alt+Tab, Windows Key, Ctrl+Esc, Alt+F4, and PrintScreen.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updatePolicy("blockKeyboardHooks", !policy.blockKeyboardHooks)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  policy.blockKeyboardHooks ? "bg-blue-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                    policy.blockKeyboardHooks ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Shield 2: Screen Capture Shield */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-2.5">
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700 flex-shrink-0 mt-0.5">
                  <EyeOff className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Screen Capture Shield
                    </span>
                    <span className="text-[8px] font-bold px-1 rounded bg-slate-200/70 text-slate-600">
                      WDA_EXCLUDE
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-relaxed">
                    Renders black in OBS, Snipping Tool, Zoom, Teams, and screenshot utilities.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updatePolicy("blockDisplayAffinity", !policy.blockDisplayAffinity)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  policy.blockDisplayAffinity ? "bg-blue-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                    policy.blockDisplayAffinity ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Shield 3: Multi-Monitor Blocker */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-2.5">
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700 flex-shrink-0 mt-0.5">
                  <Monitor className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Multi-Monitor Guard
                    </span>
                    <span className="text-[8px] font-bold px-1 rounded bg-slate-200/70 text-slate-600">
                      Single Display
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-relaxed">
                    Requires 1 monitor. Blocks secondary screens, projectors, and splitters.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updatePolicy("blockMultipleMonitors", !policy.blockMultipleMonitors)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  policy.blockMultipleMonitors ? "bg-blue-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                    policy.blockMultipleMonitors ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Shield 4: VM Detection */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-2.5">
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700 flex-shrink-0 mt-0.5">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Hypervisor &amp; VM Detector
                    </span>
                    <span className="text-[8px] font-bold px-1 rounded bg-slate-200/70 text-slate-600">
                      Bare Metal
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-relaxed">
                    Detects VMware, VirtualBox, Hyper-V, and QEMU virtualized sandboxes.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updatePolicy("blockVirtualMachines", !policy.blockVirtualMachines)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  policy.blockVirtualMachines ? "bg-blue-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                    policy.blockVirtualMachines ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Shield 5: Process Watchdog */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-2.5">
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700 flex-shrink-0 mt-0.5">
                  <Binary className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Process Watchdog
                    </span>
                    <span className="text-[8px] font-bold px-1 rounded bg-slate-200/70 text-slate-600">
                      Anti-Remote
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-relaxed">
                    Scans process tree for AnyDesk, TeamViewer, Discord, and debuggers.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updatePolicy("blockBlacklistedProcesses", !policy.blockBlacklistedProcesses)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                  policy.blockBlacklistedProcesses ? "bg-blue-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                    policy.blockBlacklistedProcesses ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Shield 6: Hardware Fingerprint */}
            <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-2.5">
              <div className="flex items-start space-x-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-purple-100/70 text-purple-700 flex-shrink-0 mt-0.5">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Hardware Fingerprint Binding
                    </span>
                    <span className="text-[8px] font-bold px-1 rounded bg-purple-100 text-purple-700">
                      Strict Lab
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-relaxed">
                    Binds session to physical motherboard UUID + CPU ID preventing proxy logins.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updatePolicy("lockHardwareFingerprint", !policy.lockHardwareFingerprint)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 ${
                  policy.lockHardwareFingerprint ? "bg-purple-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-2xs ring-0 transition duration-200 ease-in-out ${
                    policy.lockHardwareFingerprint ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Hardware hooks active upon exam unlock</span>
          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
            Win32 Kernel Lockdown Active
          </span>
        </div>
      </div>
    </div>
  );
}
