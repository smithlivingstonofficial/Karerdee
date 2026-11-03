"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { lookupCandidateExam, CandidateLookupResult } from "./actions";
import {
  Search,
  ExternalLink,
  Copy,
  Check,
  Download,
  ShieldCheck,
  AlertCircle,
  Clock,
  Calendar,
  Building,
  User,
  Hash,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lock,
  Radio,
  Mail,
  Globe,
  MonitorCheck,
  CheckCircle2,
} from "lucide-react";

function CandidatePortalContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const initialAppNo = searchParams.get("appNo") || "";

  const [email, setEmail] = useState(initialEmail);
  const [appNo, setAppNo] = useState(initialAppNo);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CandidateLookupResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (initialEmail && initialAppNo) {
      handleLookup(initialEmail, initialAppNo);
    }
  }, [initialEmail, initialAppNo]);

  async function handleLookup(customEmail?: string, customAppNo?: string) {
    const targetEmail = customEmail !== undefined ? customEmail : email;
    const targetAppNo = customAppNo !== undefined ? customAppNo : appNo;

    if (!targetEmail.trim() || !targetAppNo.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await lookupCandidateExam(targetEmail, targetAppNo);
      setResult(res);
    } catch {
      setResult({
        success: false,
        error: "Unable to connect to candidate registry. Please check your network connection.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(url: string) {
    const full = window.location.origin + url;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Institutional Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.kalasalingam.ac.in/wp-content/uploads/2022/02/Logo.png"
            alt="KARE Logo"
            className="h-10 w-auto max-w-[170px] object-contain transition-transform group-hover:scale-[1.02]"
          />
          <div className="h-5 w-px bg-slate-200 hidden sm:block" />
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight leading-none">
              KARE-SES
            </span>
            <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mt-0.5">
              Candidate Examination Portal
            </span>
          </div>
        </Link>

        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Home
          </Link>
          <Link
            href="/api/download/client"
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            <span className="hidden sm:inline">Download Windows Client</span>
            <span className="sm:hidden">Client</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors"
          >
            <span>Faculty Login</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Title & Introduction */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Radio className="w-3.5 h-3.5 text-blue-700 animate-pulse" />
            <span>Ph.D Research Eligibility &amp; Entrance Test 2026</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Candidate Authentication &amp; Exam Launch
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
            To prevent unauthorized access, enter both your registered institutional email and your private Application ID to view your admit card and launch your test.
          </p>
        </div>

        {/* 2-Field Authentication Form Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Field 1: Registered Email Address */}
              <div className="space-y-1.5">
                <label
                  htmlFor="candidateEmail"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Registered Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="candidateEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. bhavani.r@klu.ac.in"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white font-medium transition-all"
                  />
                </div>
              </div>

              {/* Field 2: Application ID (Password) */}
              <div className="space-y-1.5">
                <label
                  htmlFor="candidateAppNo"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Application ID / Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="candidateAppNo"
                    type="text"
                    required
                    value={appNo}
                    onChange={(e) => setAppNo(e.target.value)}
                    placeholder="e.g. KARE2026PHD002"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white font-mono font-bold tracking-wider transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Quick Test Candidates */}
              <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-400 text-[11px]">Demo:</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("bhavani.r@klu.ac.in");
                    setAppNo("KARE2026PHD002");
                    handleLookup("bhavani.r@klu.ac.in", "KARE2026PHD002");
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 font-mono text-[11px] font-semibold text-slate-700 transition-colors border border-slate-200"
                >
                  Bhavani (CSE)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("divya.p@klu.ac.in");
                    setAppNo("KARE2026PHD004");
                    handleLookup("divya.p@klu.ac.in", "KARE2026PHD004");
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 font-mono text-[11px] font-semibold text-slate-700 transition-colors border border-slate-200"
                >
                  Divya (AIDS)
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !email.trim() || !appNo.trim()}
                className="inline-flex items-center justify-center px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Verify &amp; Access Exam
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error Alert Card */}
        {result && !result.success && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-5 flex items-start space-x-3.5 shadow-2xs">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-red-900">Authentication Failed</h4>
              <p className="text-xs text-red-700 leading-relaxed">{result.error}</p>
            </div>
          </div>
        )}

        {/* Hall Ticket & Launch Pass Card */}
        {result?.success && result.candidate && result.exam && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Top Slip Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-white/20 text-white px-2.5 py-0.5 rounded-full inline-block">
                  Verified Candidate Admit Card
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  {result.exam.title}
                </h2>
                <p className="text-xs text-blue-100">
                  Paper Code: <span className="font-mono font-bold">{result.exam.courseCode}</span> • Kalasalingam Academy of Research and Education
                </p>
              </div>

              <div className="text-left sm:text-right bg-white/10 sm:bg-transparent p-3 sm:p-0 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-blue-200 block">Status</span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-400 text-emerald-950 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-900 animate-ping mr-1.5" />
                  Ready to Sit
                </span>
              </div>
            </div>

            {/* Candidate & Exam Metadata Grid */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-slate-200">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Candidate Name
                  </span>
                  <div className="flex items-center space-x-1.5 text-sm font-bold text-slate-900">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{result.candidate.fullName}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Application ID
                  </span>
                  <div className="text-sm font-mono font-bold text-blue-700">
                    {result.candidate.applicationNumber}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Department Track
                  </span>
                  <div className="flex items-center space-x-1.5 text-sm font-bold text-slate-900">
                    <Building className="w-4 h-4 text-slate-400" />
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono">
                      {result.candidate.departmentCode}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Master Passcode
                  </span>
                  <div className="flex items-center space-x-1.5 text-sm font-mono font-bold text-slate-900">
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    <span>{result.exam.passcode}</span>
                  </div>
                </div>
              </div>

              {/* Dual Launch Options Row */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900">
                    Choose Your Examination Environment
                  </h3>
                  <p className="text-xs text-slate-500">
                    You can complete your test using the Windows Lockdown Client (Recommended) or through the Secure Web Browser edition.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Option 1: Desktop Software */}
                  <div className="bg-white border-2 border-blue-600/30 hover:border-blue-600 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-700 flex items-center">
                          <ShieldCheck className="w-4 h-4 mr-1 text-blue-700" />
                          Recommended Mode
                        </span>
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                          Win32 Lockdown
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Windows Desktop Client
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Full OS-level lockdown. Drops Alt+Tab/Win keys, blocks screen recording, and buffers answers offline.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      {result.launchUrl && (
                        <Link
                          href={result.launchUrl}
                          className="w-full flex items-center justify-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          Launch in Desktop Software
                        </Link>
                      )}
                      <Link
                        href="/api/download/client"
                        className="w-full flex items-center justify-center px-4 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        Download SafeExamClient.exe
                      </Link>
                    </div>
                  </div>

                  {/* Option 2: Web Exam Edition */}
                  <div className="bg-white border border-slate-300 hover:border-slate-400 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center">
                          <Globe className="w-4 h-4 mr-1 text-slate-500" />
                          Web Browser Mode
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          Direct Access
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Online Web Examination
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Take the exam directly in your web browser. Enforces fullscreen mode, tab-switch watchdog, and continuous webcam proctoring.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2">
                      {result.webSittingUrl && (
                        <Link
                          href={result.webSittingUrl}
                          className="w-full flex items-center justify-center px-4 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                        >
                          <MonitorCheck className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
                          Take Exam in Web Browser
                        </Link>
                      )}
                      {result.launchUrl && (
                        <button
                          type="button"
                          onClick={() => handleCopy(result.launchUrl!)}
                          className="w-full flex items-center justify-center px-4 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              <span>Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1 text-slate-500" />
                              <span>Copy Desktop Launch Link</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions and Security Requirements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    <span>Integrity &amp; Anti-Cheating Rules</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed">
                    <li>Single screen only. Disconnect all secondary monitors.</li>
                    <li>Webcam must remain uncovered and face fully visible.</li>
                    <li>Switching tabs or minimizing window increments strikes.</li>
                    <li>Max 3 violations before automatic session termination.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-1.5 font-bold text-slate-900">
                    <Clock className="w-4 h-4 text-blue-700" />
                    <span>Duration &amp; Scoring Structure</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed">
                    <li>Total Duration: <strong>{result.exam.durationMinutes} Minutes</strong>.</li>
                    <li>Auto-saves responses in real-time to the cloud server.</li>
                    <li>Department curriculum tracks routed automatically.</li>
                    <li>Submission receipt issued immediately upon completion.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Client Download Banner */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 border border-blue-100">
              <Download className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Need the KARE Windows Safe Exam Client?
              </h3>
              <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
                Download the standalone Windows 64-bit executable (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">SafeExamClient.exe</code>). No installation or administrative privileges needed.
              </p>
            </div>
          </div>

          <Link
            href="/api/download/client"
            className="inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap self-start sm:self-center"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Download Windows Client
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-3">
          <div className="text-center sm:text-left">
            <span className="font-bold text-slate-800">Kalasalingam Academy of Research and Education</span>
            <span className="block text-[11px] text-slate-400">
              Anand Nagar, Krishnankoil, Srivilliputtur, Tamil Nadu 626126 • NAAC &apos;A++&apos; Accredited
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <Link href="/" className="hover:text-blue-700 transition-colors">
              Portal Home
            </Link>
            <span>•</span>
            <Link href="/login" className="hover:text-blue-700 transition-colors">
              Staff Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function CandidatePortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 text-xs font-semibold text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin text-blue-700 mr-2" />
          Loading Candidate Examination Portal...
        </div>
      }
    >
      <CandidatePortalContent />
    </Suspense>
  );
}
