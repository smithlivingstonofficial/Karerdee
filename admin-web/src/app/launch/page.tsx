"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { 
  ShieldCheck, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  Laptop,
  ArrowRight,
  Info
} from "lucide-react";

interface TicketPayload {
  examId?: string;
  studentId?: string;
  applicationNumber?: string;
  fullName?: string;
  email?: string;
  exp?: number;
}

function LaunchpadContent() {
  const searchParams = useSearchParams();
  const ticket = searchParams.get("ticket") || "";

  const [payload, setPayload] = useState<TicketPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [launchAttempted, setLaunchAttempted] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Decode unverified JWT payload for instant candidate name & exam display
  useEffect(() => {
    if (!ticket) {
      setParseError("No examination launch ticket was provided. Please use the personalized link sent by your administrator.");
      return;
    }

    try {
      const parts = ticket.split(".");
      if (parts.length >= 2) {
        const decoded = JSON.parse(atob(parts[1]));
        setPayload(decoded);
      } else {
        setParseError("The examination launch ticket format is invalid.");
      }
    } catch {
      setParseError("Could not decode examination ticket. Please request a new invitation link.");
    }
  }, [ticket]);

  // Attempt to launch custom URI scheme kareses://
  const triggerNativeLaunch = () => {
    if (!ticket) return;

    setIsRetrying(true);
    setLaunchAttempted(true);

    const serverOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const customUri = `kareses://launch?ticket=${encodeURIComponent(ticket)}&server=${encodeURIComponent(serverOrigin)}`;

    // Attempt protocol launch via window.location
    window.location.href = customUri;

    // Monitor if browser loses focus (indicates protocol handler was opened)
    let blurred = false;
    const onBlur = () => {
      blurred = true;
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("visibilitychange", () => {
      if (document.hidden) blurred = true;
    });

    // Fallback: If after 2.5 seconds the browser hasn't lost focus, reveal download instructions
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      setIsRetrying(false);
      if (!blurred) {
        setShowFallback(true);
      }
    }, 2500);
  };

  useEffect(() => {
    if (payload && !launchAttempted) {
      // Auto-trigger launch on initial load
      const timer = setTimeout(() => {
        triggerNativeLaunch();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [payload]);

  if (parseError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 shadow-sm text-center">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Invalid Examination Link</h2>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">{parseError}</p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
          >
            Return to Portal Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 antialiased">
      {/* Institutional Top Crest */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center p-2.5 bg-white border border-slate-200 rounded-2xl shadow-xs mb-3">
          <img
            src="/KARE_Logo.png"
            alt="Kalasalingam University"
            className="w-16 h-16 object-contain"
          />
        </div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">
          KALASALINGAM ACADEMY OF RESEARCH AND EDUCATION
        </h1>
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest mt-0.5">
          KARE-SES • Secure Exam Platform Launchpad
        </p>
      </div>

      {/* Main Card */}
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Candidate & Verification Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 border border-white/20 text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Verified Sitting Ticket
            </span>
            <span className="text-[11px] font-mono text-blue-100">
              {payload?.applicationNumber || "DIRECT"}
            </span>
          </div>

          <h2 className="text-lg font-black text-white leading-tight">
            {payload?.fullName || "Candidate"}
          </h2>
          <p className="text-xs text-blue-100 mt-0.5">
            Institutional Email: <span className="font-mono text-white font-medium">{payload?.email || "—"}</span>
          </p>
        </div>

        {/* Dynamic Launch Status Area */}
        <div className="p-6 space-y-6">
          {!showFallback ? (
            /* State 1: Connecting / Launching */
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto border border-blue-100">
                <RefreshCw className={`w-6 h-6 ${isRetrying ? "animate-spin" : ""}`} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Opening KARE Safe Exam Client...
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                If prompted by your browser, click <strong className="text-slate-900 font-semibold">"Open KARE Safe Exam Client"</strong> or <strong className="text-slate-900 font-semibold">"Always Allow"</strong> to enter the secure environment.
              </p>
            </div>
          ) : (
            /* State 2: Software Not Detected - Guided Setup */
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong className="font-bold block text-amber-950">Desktop Exam Software Required</strong>
                  Your examination must be attended inside the standalone Windows Safe Exam Client to ensure academic security and proctor compliance.
                </div>
              </div>

              {/* Step by step download & launch */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-900">Download the Client</h4>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Get the pre-configured standalone exam software for Windows (64-bit).
                    </p>
                    <a
                      href="/api/download/client"
                      download="SafeExamClient.exe"
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download SafeExamClient.exe
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Run the Software Once</h4>
                    <p className="text-[11px] text-slate-500">
                      Double-click <code className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300">SafeExamClient.exe</code> on your laptop. It will auto-register the secure protocol on your machine.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-900">Click Launch Exam</h4>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Once downloaded or installed, click below to enter directly into your waiting room and instructions.
                    </p>
                    <button
                      type="button"
                      onClick={triggerNativeLaunch}
                      disabled={isRetrying}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {isRetrying ? "Connecting..." : "Launch Exam Now →"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Trigger Button */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={triggerNativeLaunch}
              disabled={isRetrying}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Laptop className="w-4 h-4" />
              {isRetrying ? "Launching Software..." : "Open in Desktop Software"}
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 border-t border-slate-100 p-3 text-center">
          <span className="text-[11px] text-slate-500 font-medium">
            Kalasalingam Academy of Research and Education • Examination Security Standard
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LaunchpadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LaunchpadContent />
    </Suspense>
  );
}

