"use client";

import React, { useState } from "react";
import { SectionState } from "../types";
import { Department } from "@/types/database.types";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Globe,
  Building2,
  Clock,
  CheckCircle2,
  Layers,
  Sparkles,
  HelpCircle,
  Hash,
} from "lucide-react";

interface SectionsTabProps {
  sections: SectionState[];
  departments: Department[];
  enableNegativeMarking: boolean;
  onSectionsChange: (sections: SectionState[]) => void;
}

export function SectionsTab({
  sections,
  departments,
  enableNegativeMarking,
  onSectionsChange,
}: SectionsTabProps) {
  const [selectedSecId, setSelectedSecId] = useState<string>(sections[0]?.id || "");

  // Strictly use registered departments from Supabase database
  const availableDepts = departments || [];

  const activeSection = sections.find((s) => s.id === selectedSecId) || sections[0];

  function addSection() {
    const nextOrder = sections.length + 1;
    const newSection: SectionState = {
      id: `sec-${Date.now()}`,
      title: `Part ${String.fromCharCode(64 + nextOrder)} — Specialization Track`,
      isCommon: false,
      targetDepartments: availableDepts.length > 0 ? [availableDepts[0].code] : [],
      defaultPoints: 1.0,
      defaultNegativePoints: 0.25,
      orderIndex: nextOrder,
      navigationMode: "FLEXIBLE",
      timeLimitMinutes: null,
      targetQuestionCount: 25,
    };
    onSectionsChange([...sections, newSection]);
    setSelectedSecId(newSection.id);
  }

  function removeSection(id: string) {
    if (sections.length <= 1) {
      alert("An examination must have at least one section.");
      return;
    }
    const remaining = sections.filter((s) => s.id !== id);
    onSectionsChange(remaining);
    if (selectedSecId === id) {
      setSelectedSecId(remaining[0].id);
    }
  }

  function updateActiveSection(partial: Partial<SectionState>) {
    if (!activeSection) return;
    onSectionsChange(
      sections.map((s) => (s.id === activeSection.id ? { ...s, ...partial } : s))
    );
  }

  function toggleDepartment(deptCode: string) {
    if (!activeSection) return;
    const current = activeSection.targetDepartments || [];
    const updated = current.includes(deptCode)
      ? current.filter((d) => d !== deptCode)
      : [...current, deptCode];
    updateActiveSection({ targetDepartments: updated });
  }

  function moveSection(index: number, direction: "UP" | "DOWN") {
    if (
      (direction === "UP" && index === 0) ||
      (direction === "DOWN" && index === sections.length - 1)
    ) {
      return;
    }

    const reordered = [...sections];
    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    reordered.forEach((s, i) => (s.orderIndex = i + 1));
    onSectionsChange(reordered);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
      {/* Left Column: Compact Section Roster (4 cols) */}
      <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-3">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200/80">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                Exam Sections ({sections.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 hover:bg-blue-100 rounded-lg transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </button>
          </div>

          {/* Section Roster List */}
          <div className="space-y-1.5">
            {sections.map((sec, idx) => {
              const isSelected = sec.id === (activeSection?.id || "");
              return (
                <div
                  key={sec.id}
                  onClick={() => setSelectedSecId(sec.id)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? "bg-blue-50/70 border-blue-600 shadow-2xs ring-1 ring-blue-500/20"
                      : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span
                      className={`w-5 h-5 rounded-md font-extrabold text-[10px] flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "bg-blue-700 text-white"
                          : "bg-slate-200/80 text-slate-700"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1 pr-1">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {sec.title}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {sec.isCommon
                          ? `Common Core • Target: ${sec.targetQuestionCount ?? 25} Qs`
                          : `Depts: ${sec.targetDepartments?.join(", ") || "None"} • Target: ${sec.targetQuestionCount ?? 25} Qs`}
                      </span>
                    </div>
                  </div>

                  {/* Reorder & Delete */}
                  <div className="flex items-center space-x-0.5 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSection(idx, "UP");
                      }}
                      disabled={idx === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSection(idx, "DOWN");
                      }}
                      disabled={idx === sections.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSection(sec.id);
                      }}
                      disabled={sections.length <= 1}
                      className="p-1 rounded text-slate-400 hover:text-red-700 disabled:opacity-20 cursor-pointer"
                      title="Delete Section"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Click to switch active section</span>
          <span className="font-semibold text-slate-600">Strict Roster Mapping</span>
        </div>
      </div>

      {/* Right Column: Detailed Config Inspector for Selected Section (8 cols) */}
      {activeSection && (
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            {/* Header: Title edit */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2 flex-1">
                <span className="text-xs font-bold text-slate-500">Title:</span>
                <input
                  type="text"
                  value={activeSection.title}
                  onChange={(e) => updateActiveSection({ title: e.target.value })}
                  placeholder="Section Title"
                  className="text-xs sm:text-sm font-bold text-slate-900 bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                />
              </div>
              <span
                className={`ml-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                  activeSection.isCommon
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-purple-50 text-purple-700 border-purple-200"
                }`}
              >
                {activeSection.isCommon ? "Common Core" : "Dept Elective"}
              </span>
            </div>

            {/* Department Routing Policy */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Candidate Department Routing Policy
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Common to all */}
                <div
                  onClick={() => updateActiveSection({ isCommon: true })}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center space-x-2.5 ${
                    activeSection.isCommon
                      ? "bg-blue-50/70 border-blue-600 shadow-2xs ring-1 ring-blue-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
                    activeSection.isCommon ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Common to All Candidates
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Every student answers this section.
                    </span>
                  </div>
                  {activeSection.isCommon && (
                    <CheckCircle2 className="w-4 h-4 text-blue-700 ml-auto flex-shrink-0" />
                  )}
                </div>

                {/* Department Specific */}
                <div
                  onClick={() => updateActiveSection({ isCommon: false })}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center space-x-2.5 ${
                    !activeSection.isCommon
                      ? "bg-purple-50/70 border-purple-600 shadow-2xs ring-1 ring-purple-500/20"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${
                    !activeSection.isCommon ? "bg-purple-700 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      Department Elective
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Restricted to registered department majors only.
                    </span>
                  </div>
                  {!activeSection.isCommon && (
                    <CheckCircle2 className="w-4 h-4 text-purple-700 ml-auto flex-shrink-0" />
                  )}
                </div>
              </div>

              {/* Department Chips (when Elective): STRICTLY from Supabase Database */}
              {!activeSection.isCommon && (
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                      Target Departments ({activeSection.targetDepartments?.length || 0} selected)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Select from registered database:
                    </span>
                  </div>

                  {availableDepts.length === 0 ? (
                    <div className="text-xs text-slate-500 py-2 text-center bg-white rounded-lg border border-slate-200">
                      No departments found in the system registry. Please add departments in the Departments manager.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {availableDepts.map((dept) => {
                        const isSelected = activeSection.targetDepartments?.includes(dept.code);
                        return (
                          <button
                            key={dept.id || dept.code}
                            type="button"
                            onClick={() => toggleDepartment(dept.code)}
                            title={dept.name}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                              isSelected
                                ? "bg-purple-700 text-white border-purple-700 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <span>{dept.code}</span>
                            <span className={`text-[9px] font-normal opacity-80 ${isSelected ? "text-purple-100" : "text-slate-400"}`}>
                              ({dept.name.length > 20 ? `${dept.name.slice(0, 18)}...` : dept.name})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4 Settings Cards: Navigation, Total Questions, Timer, Scoring */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
              {/* Navigation Mode */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Navigation Policy
                </label>
                <select
                  value={activeSection.navigationMode || "FLEXIBLE"}
                  onChange={(e) =>
                    updateActiveSection({
                      navigationMode: e.target.value as "FLEXIBLE" | "SEQUENTIAL",
                    })
                  }
                  className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all cursor-pointer"
                >
                  <option value="FLEXIBLE">Flexible (Free Jump)</option>
                  <option value="SEQUENTIAL">Sequential (Locked Next)</option>
                </select>
                <p className="text-[9px] text-slate-400 leading-tight">
                  {activeSection.navigationMode === "SEQUENTIAL" ? "Answers locked upon next" : "Can jump between questions"}
                </p>
              </div>

              {/* Total Questions Limit */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block flex items-center justify-between">
                  <span>Total Questions</span>
                  <span className="text-[9px] text-blue-700 font-extrabold lowercase">quota</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-3 h-3 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={activeSection.targetQuestionCount ?? 25}
                    onChange={(e) => {
                      const val = e.target.value ? Math.max(1, parseInt(e.target.value)) : 25;
                      updateActiveSection({ targetQuestionCount: val });
                    }}
                    placeholder="25"
                    className="w-full pl-6 pr-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all text-left"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">
                  Target questions for this part
                </p>
              </div>

              {/* Section Timer */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Section Timer (Mins)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                    <Clock className="w-3 h-3" />
                  </div>
                  <input
                    type="number"
                    min={1}
                    placeholder="Unconstrained"
                    value={activeSection.timeLimitMinutes || ""}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      updateActiveSection({ timeLimitMinutes: val });
                    }}
                    className="w-full pl-6 pr-2 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all font-semibold"
                  />
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">
                  Auto-submits section when expires
                </p>
              </div>

              {/* Default Marks & Penalty */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                  Marks / Penalty
                </label>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    value={activeSection.defaultPoints ?? 1.0}
                    onChange={(e) =>
                      updateActiveSection({
                        defaultPoints: parseFloat(e.target.value) || 1.0,
                      })
                    }
                    className="w-full px-1.5 py-1 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 text-center"
                    title="Positive Marks"
                  />

                  {enableNegativeMarking && (
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={activeSection.defaultNegativePoints ?? 0.25}
                      onChange={(e) =>
                        updateActiveSection({
                          defaultNegativePoints: parseFloat(e.target.value) || 0.0,
                        })
                      }
                      className="w-full px-1.5 py-1 text-xs font-bold bg-amber-50 border border-amber-200 rounded-lg text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-600 text-center"
                      title="Negative Penalty"
                    />
                  )}
                </div>
                <p className="text-[9px] text-slate-400 leading-tight">
                  {enableNegativeMarking ? "Marks | Penalty deduct" : "Default question points"}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Section settings saved automatically</span>
            <span className="font-semibold text-blue-700">Part {activeSection.orderIndex} Active</span>
          </div>
        </div>
      )}
    </div>
  );
}
