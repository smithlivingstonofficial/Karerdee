"use client";

import React, { useState } from "react";
import { formatDateTime } from "@/lib/date";
import {
  Printer,
  X,
  Search,
  Filter,
  CheckCircle2,
  ShieldCheck,
  Building2,
  KeyRound,
  Calendar,
  Clock,
  Layers,
  FileText,
} from "lucide-react";

interface CandidateTicketItem {
  id: string;
  applicationNumber: string;
  fullName: string;
  email: string;
  departmentCode: string;
  departmentName: string;
}

interface HallTicketsPrintViewProps {
  isOpen: boolean;
  onClose: () => void;
  exam: any;
  candidates: CandidateTicketItem[];
}

export function HallTicketsPrintView({
  isOpen,
  onClose,
  exam,
  candidates,
}: HallTicketsPrintViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");

  if (!isOpen) return null;

  // Extract unique departments from candidate roster
  const departmentsList = Array.from(
    new Set(candidates.map((c) => c.departmentCode).filter(Boolean))
  );

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    if (selectedDept !== "ALL" && c.departmentCode !== selectedDept) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.fullName.toLowerCase().includes(q);
      const matchApp = c.applicationNumber.toLowerCase().includes(q);
      return matchName || matchApp;
    }
    return true;
  });

  function handlePrint() {
    window.print();
  }

  // Format date helper
  const formattedStartTime = exam.start_time
    ? formatDateTime(exam.start_time)
    : "Scheduled Sitting Time";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      {/* 1. Modal Navigation Header (Hidden during Print) */}
      <div className="w-full max-w-5xl bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">
              Candidate Hall Tickets &amp; Passcode Slips
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {filteredCandidates.length} Slips Generated
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Formatted for standard A4 batch printing (2 tickets per page) with invigilator verification blocks.
          </p>
        </div>

        {/* Filter & Action Buttons */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {/* Dept Filter */}
          {departmentsList.length > 1 && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Departments ({candidates.length})</option>
              {departmentsList.map((d) => (
                <option key={d} value={d}>
                  {d} Department
                </option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate..."
              className="pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-900 placeholder:text-slate-400 w-36 sm:w-44"
            />
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print Slips (A4 / PDF)
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Print-Ready Tickets Canvas */}
      <div className="w-full max-w-5xl space-y-6 print:space-y-0 print:w-full print:max-w-none">
        {filteredCandidates.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-xs print:hidden">
            No candidates matched the selected filter.
          </div>
        ) : (
          filteredCandidates.map((candidate, idx) => (
            <div
              key={candidate.id}
              className="bg-white border-2 border-slate-300 rounded-2xl p-6 shadow-sm print:shadow-none print:rounded-none print:border-b-2 print:border-dashed print:border-slate-400 print:mb-8 print:p-6 print:break-inside-avoid relative"
            >
              {/* Institution Header */}
              <div className="border-b-2 border-slate-900 pb-3 text-center space-y-0.5">
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600">
                  Kalasalingam Academy of Research and Education
                </div>
                <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                  (Deemed to be University Under Sec. 3 of UGC Act 1956) • Anand Nagar, Krishnankoil
                </div>
                <div className="pt-1 text-xs font-black uppercase tracking-wider text-slate-900">
                  Office of the Controller of Examinations — PhD Qualifying &amp; Entrance Examination
                </div>
              </div>

              {/* Sub-Header: Ticket Type & Cut Marker */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 py-2 border-b border-slate-200">
                <span className="font-bold text-blue-900 uppercase">
                  Candidate Sitting Pass &amp; Workstation Slip
                </span>
                <span className="font-mono text-slate-400">
                  SLIP REF: {exam.id.slice(0, 8).toUpperCase()}-{candidate.applicationNumber}
                </span>
              </div>

              {/* Candidate Credentials & Exam Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 text-xs">
                {/* Left: Candidate Information */}
                <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Candidate Full Name
                    </span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {candidate.fullName}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Application / Roll No
                      </span>
                      <span className="text-xs font-mono font-black text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                        {candidate.applicationNumber}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Department
                      </span>
                      <span className="text-xs font-bold text-slate-800 block mt-0.5">
                        {candidate.departmentCode} — {candidate.departmentName}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Institutional Email
                    </span>
                    <span className="text-[11px] font-medium text-slate-600 font-mono block mt-0.5">
                      {candidate.email}
                    </span>
                  </div>
                </div>

                {/* Right: Examination Schedule & Passcode */}
                <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Examination Paper
                    </span>
                    <span className="text-xs font-black text-slate-900 block mt-0.5">
                      {exam.title}
                    </span>
                    {exam.course_code && (
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        Code: {exam.course_code}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Duration
                      </span>
                      <span className="text-xs font-bold text-slate-800 block mt-0.5">
                        {exam.duration_minutes || 90} Minutes
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Scheduled Window
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 block mt-0.5">
                        {formattedStartTime}
                      </span>
                    </div>
                  </div>

                  {/* Passcode Box */}
                  <div className="pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Workstation Entry Passcode
                    </span>
                    <div className="mt-0.5 inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg">
                      <KeyRound className="w-3.5 h-3.5 text-blue-700" />
                      <span className="text-sm font-mono font-black text-blue-900 tracking-wider">
                        {exam.passcode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security & System Sitting Guidelines */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[10px] text-amber-900 space-y-1">
                <div className="font-bold uppercase tracking-wider flex items-center text-amber-800">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  KARE-SES Institutional Online Examination Guidelines
                </div>
                <p className="leading-relaxed">
                  1. Navigate to the official <strong>KARE-SES Online Examination Portal</strong> in your web browser and sign in using your Institutional Email, Application Number (as password), and the Passcode printed above.
                  <br />
                  2. Automated browser security enforces fullscreen kiosk mode and active webcam proctoring. Exiting fullscreen, switching tabs, minimizing the window, or connecting secondary displays will register an automatic security infraction strike.
                  <br />
                  3. Answers are automatically preserved and synchronized to the cloud in real time. Do not close or refresh your browser tab until your cryptographic submission receipt is generated.
                </p>
              </div>

              {/* Signatures Verification Footer */}
              <div className="grid grid-cols-2 gap-8 pt-6 mt-4 border-t border-slate-200 text-center text-xs text-slate-500">
                <div className="space-y-6">
                  <div className="h-8 border-b border-dashed border-slate-300 max-w-[200px] mx-auto" />
                  <span className="text-[10px] font-bold uppercase tracking-wider block">
                    Candidate Signature
                  </span>
                </div>

                <div className="space-y-6">
                  <div className="h-8 border-b border-dashed border-slate-300 max-w-[200px] mx-auto" />
                  <span className="text-[10px] font-bold uppercase tracking-wider block">
                    Lab Invigilator / Chief Superintendent Signature
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

