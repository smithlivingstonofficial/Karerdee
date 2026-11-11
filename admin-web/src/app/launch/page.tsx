"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ShieldCheck, 
  Globe, 
  ArrowRight, 
  Loader2,
  AlertTriangle
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
  const router = useRouter();

  const [payload, setPayload] = useState<TicketPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

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

  // Instantly redirect directly into the secure web sitting portal
  useEffect(() => {
    if (ticket) {
      const redirectTimer = setTimeout(() => {
        router.replace(`/sitting?ticket=${encodeURIComponent(ticket)}`);
      }, 500);
      return () => clearTimeout(redirectTimer);
    }
  }, [ticket, router]);

  if (parseError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 antialiased font-sans">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-6 shadow-sm text-center space-y-3">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Invalid Examination Link</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{parseError}</p>
          <div className="pt-2">
            <Link
              href="/sitting"
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors shadow-2xs"
            >
              Go to Examination Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const directSittingUrl = `/sitting?ticket=${encodeURIComponent(ticket)}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 antialiased font-sans">
      {/* Institutional Top Crest */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center p-2.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/KARE_Logo.png"
            alt="Kalasalingam University"
            className="w-16 h-16 object-contain"
          />
        </div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">
          KALASALINGAM ACADEMY OF RESEARCH AND EDUCATION
        </h1>
        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mt-0.5">
          KARE-SES • Secure Online Examination Engine
        </p>
      </div>

      {/* Main Forwarding Card */}
      <div className="max-w-lg w-full bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        {/* Candidate & Verification Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/15 border border-white/20 text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Verified Sitting Ticket
            </span>
            <span className="text-[11px] font-mono font-bold text-blue-100">
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

        {/* Direct Transition Area */}
        <div className="p-6 sm:p-7 space-y-6 text-center">
          <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-2xs">
            <Loader2 className="w-7 h-7 animate-spin text-blue-700" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Entering KARE Online Examination Portal...
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Transferring directly into your secure web examination workspace. Automated webcam proctoring and fullscreen watchdog will initialize.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href={directSittingUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 active:scale-[0.99] rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              <span>Enter Examination in Web Browser Now</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 border-t border-slate-100 p-3 text-center">
          <span className="text-[11px] text-slate-500 font-medium">
            Kalasalingam Academy of Research and Education • Online Examination Security Standard
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
