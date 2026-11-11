"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getExamDetailsWithRosterAction,
  updateExamStatusAction,
  duplicateExamAction,
  ExamDetailsData,
} from "../actions";
import { ExamStatus } from "@/types/database.types";
import { HallTicketsPrintView } from "./components/HallTicketsPrintView";
import { formatDate } from "@/lib/date";
import {
  ArrowLeft,
  Printer,
  Edit,
  Play,
  Square,
  Copy,
  Clock,
  Layers,
  HelpCircle,
  Shield,
  KeyRound,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
  FileText,
  Search,
  ExternalLink,
  ShieldAlert,
  Calculator,
  BarChart2,
} from "lucide-react";

export default function ExamDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params?.id as string;

  const [details, setDetails] = useState<ExamDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [generatingTicketCandId, setGeneratingTicketCandId] = useState<string | null>(null);
  const [copiedCandId, setCopiedCandId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyCandidateDirectLaunchLink = async (candId: string) => {
    if (!details?.exam) return;
    try {
      setGeneratingTicketCandId(candId);
      const res = await fetch("/api/exam/launch-ticket/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: details.exam.id,
          studentId: candId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ticket) {
        alert(data.error || "Failed to generate candidate direct launch link.");
        return;
      }

      const launchUrl = `${window.location.origin}/sitting?ticket=${data.ticket}`;
      await navigator.clipboard.writeText(launchUrl);
      setCopiedCandId(candId);
      setTimeout(() => setCopiedCandId(null), 2500);
    } catch (err: any) {
      console.error("Copy Link Error:", err);
      alert("Could not copy launch link to clipboard.");
    } finally {
      setGeneratingTicketCandId(null);
    }
  };

  const copyAllCandidateLinks = async () => {
    if (!details?.exam || !details?.candidates) return;
    try {
      setCopiedAll(true);
      const links: string[] = [];
      for (const c of details.candidates) {
        const res = await fetch("/api/exam/launch-ticket/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examId: details.exam.id,
            studentId: c.id,
          }),
        });
        const data = await res.json();
        if (res.ok && data.ticket) {
          links.push(`${c.fullName} (${c.applicationNumber}) - ${c.email}:\n${window.location.origin}/sitting?ticket=${data.ticket}\n`);
        }
      }

      if (links.length > 0) {
        await navigator.clipboard.writeText(links.join("\n"));
        setTimeout(() => setCopiedAll(false), 3000);
      }
    } catch (err) {
      console.error(err);
      setCopiedAll(false);
    }
  };

  async function loadDetails() {
    if (!examId) return;
    setIsLoading(true);
    const res = await getExamDetailsWithRosterAction(examId);
    if (res.data) {
      setDetails(res.data);
    } else {
      setErrorMsg(res.error || "Failed to load examination details.");
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadDetails();
  }, [examId]);

  function copyPasscode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedPasscode(true);
    setTimeout(() => setCopiedPasscode(false), 2000);
  }

  async function handleStatusChange(newStatus: ExamStatus) {
    if (!examId) return;
    setIsActing(true);
    const res = await updateExamStatusAction(examId, newStatus);
    setIsActing(false);
    if (res.error) {
      alert(res.error);
    } else {
      loadDetails();
    }
  }

  async function handleDuplicate() {
    if (!examId) return;
    setIsActing(true);
    const res = await duplicateExamAction(examId);
    setIsActing(false);
    if (res.newExamId) {
      router.push(`/admin/exams/new?id=${res.newExamId}`);
    } else {
      alert(res.error || "Failed to duplicate examination.");
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-16 text-center text-slate-500 text-xs font-semibold shadow-xs">
        <Loader2 className="w-6 h-6 animate-spin text-blue-700 mx-auto mb-2" />
        Loading examination specification &amp; roster...
      </div>
    );
  }

  if (errorMsg || !details) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-12 text-center shadow-xs space-y-3">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Examination Not Found</h3>
        <p className="text-xs text-slate-500">{errorMsg || "The requested examination does not exist."}</p>
        <Link
          href="/admin/exams"
          className="inline-flex items-center px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to Examinations Hub
        </Link>
      </div>
    );
  }

  const { exam, sections, questions, candidates } = details;
  const config = exam.config || {};
  const lockdownPolicy = config.lockdown_policy || {};

  // Filter candidates roster
  const filteredCandidates = candidates.filter((c) => {
    if (!rosterSearch.trim()) return true;
    const q = rosterSearch.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.applicationNumber.toLowerCase().includes(q) ||
      c.departmentCode.toLowerCase().includes(q)
    );
  });

  // Calculate questions by section/department
  const commonSection = sections.find((s) => s.is_common);
  const deptSections = sections.filter((s) => !s.is_common);
  const commonQuestionsCount = questions.filter(
    (q) => q.section_id === commonSection?.id
  ).length;

  return (
    <div className="space-y-4 pb-12 w-full">
      {/* 1. Sleek Minimal Breadcrumb & Navigation */}
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
        <div className="flex items-center space-x-2">
          <Link
            href="/admin/exams"
            className="hover:text-blue-700 flex items-center transition-colors text-slate-600 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Examinations
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
            {exam.title}
          </span>
          {exam.course_code && (
            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
              {exam.course_code}
            </span>
          )}
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-400">
          <span>Examination Details &amp; Slips</span>
        </div>
      </div>

      {/* 2. Primary Header Action Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                exam.status === "ACTIVE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse"
                  : exam.status === "SCHEDULED"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : exam.status === "DRAFT"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {exam.status === "ACTIVE" && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-ping" />
              )}
              {exam.status}
            </span>

            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-600 font-medium" suppressHydrationWarning>
              Created {formatDate(exam.created_at)}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {exam.title}
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2 flex-shrink-0">
          <Link
            href={`/admin/exams/${exam.id}/results`}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl shadow-2xs transition-all cursor-pointer"
            title="View Candidate Scores, Roster Gradebook & Item Accuracy"
          >
            <BarChart2 className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
            <span>Gradebook &amp; Analytics</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            <span>Print Hall Tickets ({candidates.length})</span>
          </button>

          {exam.status === "SCHEDULED" && (
            <button
              type="button"
              onClick={() => handleStatusChange("ACTIVE")}
              disabled={isActing}
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              <span>Activate Exam Now</span>
            </button>
          )}

          {exam.status === "ACTIVE" && (
            <button
              type="button"
              onClick={() => handleStatusChange("COMPLETED")}
              disabled={isActing}
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
              <span>Conclude Sitting</span>
            </button>
          )}

          <Link
            href={`/admin/exams/new?id=${exam.id}`}
            className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span>Edit Exam</span>
          </Link>
        </div>
      </div>

      {/* 3. Main Specification & Roster Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (8 cols): Sections & Candidates Roster */}
        <div className="lg:col-span-8 space-y-4">
          {/* Section Breakdown Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Modular Section Architecture ({sections.length} Parts)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dual-Track Routing: Universal core aptitude plus specialization tracks.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                {questions.length} Total MCQs
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Part A Card */}
              {commonSection && (
                <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      PART A — COMMON CORE
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {commonQuestionsCount} Qs
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {commonSection.title}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Compulsory quantitative &amp; research methodology delivered universally.
                  </p>
                </div>
              )}

              {/* Part B Card */}
              {deptSections.map((sec) => (
                <div
                  key={sec.id}
                  className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      PART B — DEPARTMENT TRACKS
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {questions.filter((q) => q.section_id === sec.id).length} Qs
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{sec.title}</h4>
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span className="text-[10px] text-slate-500 font-medium">Mapped Majors:</span>
                    {(sec.target_departments || []).map((dept: string) => (
                      <span
                        key={dept}
                        className="text-[10px] font-bold bg-white text-purple-800 px-1.5 py-0.2 rounded border border-purple-200"
                      >
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Candidate Eligibility & Roster Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Enrolled Candidate Roster ({candidates.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Students registered under the targeted department specializations.
                  </p>
                </div>
              </div>

              {/* Roster Actions & Search */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyAllCandidateLinks}
                  disabled={copiedAll || candidates.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="Copy all candidate direct launch URLs for email dispatch"
                >
                  {copiedAll ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>All Links Copied! ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All Links</span>
                    </>
                  )}
                </button>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Filter roster..."
                    className="pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-900 placeholder:text-slate-400 w-36"
                  />
                </div>
              </div>
            </div>

            {filteredCandidates.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No registered candidates found matching the criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Application No</th>
                      <th className="py-2.5 px-3">Candidate Name</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Institutional Email</th>
                      <th className="py-2.5 px-3 text-center">Passcode</th>
                      <th className="py-2.5 px-3 text-right">Direct One-Click Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredCandidates.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-800">
                          {c.applicationNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {c.fullName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                            {c.departmentCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {c.email}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {exam.passcode}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => copyCandidateDirectLaunchLink(c.id)}
                            disabled={generatingTicketCandId === c.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border shadow-2xs transition-all cursor-pointer ${
                              copiedCandId === c.id
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : "bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                            title="Copy direct one-click launch link for this candidate"
                          >
                            {copiedCandId === c.id ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copied! ✓</span>
                              </>
                            ) : generatingTicketCandId === c.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                <span>Generating...</span>
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Sitting Gateways & Lockdown Controls */}
        <div className="lg:col-span-4 space-y-4">
          {/* Key Sitting Parameters Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <KeyRound className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
              Sitting Credentials &amp; Window
            </h3>

            {/* Passcode Copy Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Master Sitting Passcode
                </span>
                <span className="text-lg font-mono font-black text-blue-900 block mt-0.5">
                  {exam.passcode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyPasscode(exam.passcode)}
                className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-all cursor-pointer"
              >
                {copiedPasscode ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100 pt-1">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 font-medium">Exam Duration</span>
                <span className="font-bold text-slate-900">{exam.duration_minutes || 90} Mins</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 font-medium">Passing Score</span>
                <span className="font-bold text-slate-900">{config.passing_score || 50}%</span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 font-medium">Negative Marking</span>
                <span className="font-bold text-slate-900">
                  {exam.enable_negative_marking ? "Active (-0.25 pt)" : "Disabled (0 pt)"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 font-medium">Max Strike Tolerance</span>
                <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {exam.max_strikes || 3} Strikes
                </span>
              </div>
            </div>
          </div>

          {/* Zero-Trust Lockdown Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <Shield className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
              Win32 Hardware Security Barriers
            </h3>

            <div className="space-y-2 text-xs">
              {[
                { label: "Low-Level Keyboard Hook (WH_KEYBOARD_LL)", armed: lockdownPolicy.blockKeyboardHooks ?? true },
                { label: "Screen Capture Shield (WDA_EXCLUDEFROMCAPTURE)", armed: lockdownPolicy.blockDisplayAffinity ?? true },
                { label: "VM & Hypervisor Detector", armed: lockdownPolicy.blockVirtualMachines ?? true },
                { label: "Process Watchdog (AnyDesk, TeamViewer)", armed: lockdownPolicy.blockBlacklistedProcesses ?? true },
                { label: "Multi-Monitor Blocker", armed: lockdownPolicy.blockMultipleMonitors ?? true },
                { label: "Hardware Fingerprint Binding", armed: lockdownPolicy.lockHardwareFingerprint ?? false },
              ].map((guard, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-700 font-medium text-[11px] truncate max-w-[210px]">
                    {guard.label}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      guard.armed
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {guard.armed ? "Armed" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Candidate Digital Tools Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center">
              <Calculator className="w-3.5 h-3.5 mr-1.5 text-indigo-700" />
              Candidate Digital Aids
            </h3>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 font-medium">In-Exam Calculator</span>
                <span className="font-bold text-slate-900">
                  {config.calculator_mode || "Disabled"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 font-medium">Digital Scratchpad</span>
                <span className="font-bold text-slate-900">
                  {config.enable_scratchpad ? "Available" : "Disabled"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 font-medium">Question Review Flagging</span>
                <span className="font-bold text-slate-900">
                  {config.enable_question_flagging ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Printable Hall Tickets Modal Overlay */}
      <HallTicketsPrintView
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        exam={exam}
        candidates={candidates}
      />
    </div>
  );
}

