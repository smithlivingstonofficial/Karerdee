import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Globe,
  Download,
  ExternalLink,
  Search,
  CheckCircle2,
  Lock,
  Camera,
  Activity,
  ArrowRight,
  Radio,
  Building,
  FileText,
  AlertTriangle,
  MonitorCheck,
  UserCheck,
  KeyRound,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "KARE-SES — Secure Examination Software & Portal | Kalasalingam University",
  description: "Official online examination portal and software launchpad for Kalasalingam Academy of Research and Education.",
};

export default function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Official Institutional Header */}
      <header className="h-20 bg-white border-b border-slate-200/90 sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.kalasalingam.ac.in/wp-content/uploads/2022/02/Logo.png"
              alt="Kalasalingam Academy of Research and Education"
              className="h-12 w-auto max-w-[210px] object-contain transition-transform group-hover:scale-[1.01]"
            />
            <div className="h-7 w-px bg-slate-200 hidden md:block" />
            <div className="hidden md:flex flex-col">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">
                KARE-SES
              </span>
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                Safe Exam Platform • Site-3.0
              </span>
            </div>
          </Link>
        </div>

        {/* Header Right Nav */}
        <nav className="flex items-center space-x-2 sm:space-x-4 text-xs font-semibold">
          <Link
            href="/candidate"
            className="hidden sm:inline-flex items-center px-3 py-2 text-slate-700 hover:text-blue-700 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Candidate Portal
          </Link>
          <Link
            href="#guidelines"
            className="hidden md:inline-flex items-center px-3 py-2 text-slate-700 hover:text-blue-700 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Exam Guidelines
          </Link>
          <Link
            href="/sitting"
            className="inline-flex items-center px-3.5 py-2 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl shadow-2xs transition-colors"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-700" />
            <span className="hidden sm:inline">Enter Exam Portal</span>
            <span className="sm:hidden">Sitting</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-2xs transition-colors"
          >
            <span>Faculty Login</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1 hidden sm:inline" />
          </Link>
        </nav>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100/70 border-b border-slate-200/80 py-16 sm:py-24">
        {/* Soft Background Accents */}
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
          {/* Active Cycle Badge */}
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <Radio className="w-3.5 h-3.5 text-blue-700 animate-pulse" />
            <span>Ph.D Research Eligibility &amp; Entrance Examination 2026</span>
          </div>

          {/* Main Headline */}
          <div className="space-y-4 max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Institutional Lockdown &amp; Online Examination Portal
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto font-normal">
              Official entrance and research examination engine for Kalasalingam Academy of Research and Education. Built with Win32 lockdown barriers, screen capture deterrence, and one-click smart launch.
            </p>
          </div>

          {/* Instant Candidate Hall Ticket Search Card */}
          <div className="max-w-xl mx-auto bg-white border border-slate-300/80 rounded-2xl p-5 sm:p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] text-left space-y-4">
            <div className="space-y-0.5">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-800">
                Candidate Verification &amp; Exam Access
              </span>
              <p className="text-[11px] text-slate-500">
                Enter your registered email and private Application ID to access your examination pass.
              </p>
            </div>

            <form
              action="/candidate"
              method="GET"
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Registered Email */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <input
                    id="candidateEmailInput"
                    name="email"
                    type="email"
                    required
                    placeholder="Registered Email ID"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Application ID / Password */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="candidateAppInput"
                    name="appNo"
                    type="text"
                    required
                    placeholder="Application ID (Password)"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Two-factor protected candidate portal</span>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-5 py-2.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Verify &amp; Access Exam</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              </div>
            </form>
          </div>

          {/* Quick Action Badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
            <Link
              href="/sitting"
              className="inline-flex items-center px-4 py-2 font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-all"
            >
              <Globe className="w-4 h-4 mr-2" />
              Enter Online Examination Portal
            </Link>
            <Link
              href="/candidate"
              className="inline-flex items-center px-4 py-2 font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition-all"
            >
              <UserCheck className="w-4 h-4 mr-2 text-emerald-600" />
              Verify Candidate Registration
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center px-4 py-2 font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition-all"
            >
              <KeyRound className="w-4 h-4 mr-2 text-slate-500" />
              Invigilator &amp; Faculty Login
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Four-Step Candidate Workflow */}
      <section id="guidelines" className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Examination Sitting Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              4 Steps to Take Your Examination
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Follow these simple instructions on test day to ensure a smooth, disruption-free sitting.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 relative">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-extrabold text-sm flex items-center justify-center">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Open Web Portal
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Navigate directly to the official KARE-SES Web Examination Portal on your computer or laptop. No software installation needed.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 relative">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-extrabold text-sm flex items-center justify-center">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Authenticate Identity
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sign in with your registered Institutional Email, your official Application Number (as password), and your exam security passcode.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 relative">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-extrabold text-sm flex items-center justify-center">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Pre-Flight Verification
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Review your allocated department track, verify your live webcam proctoring preview, and agree to the institutional code of conduct.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3 relative">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-extrabold text-sm flex items-center justify-center">
                4
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Attempt &amp; Auto-Sync
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Attempt questions routed to your department curriculum. Responses are automatically synchronized to the cloud in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Security & Lockdown Specifications */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-700">
              Examination Security Standards
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Tamper-Proof Academic Integrity
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              The KARE-SES Web Examination Engine enforces multi-layered browser barriers and automated AI proctoring to protect candidate merit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Win32 Keyboard Lockdown
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Low-level keyboard hooks (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">WH_KEYBOARD_LL</code>) intercept and drop Alt+Tab, Windows keys, Ctrl+Esc, and Task Manager access.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Screen Capture Deterrence
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Uses Win32 <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">SetWindowDisplayAffinity</code> to blank out test contents from OBS Studio, Snipping Tool, Zoom, and screen recorders.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                <Camera className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                AI &amp; Human Proctoring
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Real-time webcam telemetry streams frame snapshots and multi-face violation telemetry directly to the invigilator command console.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. System Requirements Checklist */}
      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <MonitorCheck className="w-6 h-6 text-blue-700" />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Minimum Candidate System Requirements
                </h3>
                <p className="text-xs text-slate-500">
                  Ensure your computer meets these specifications prior to exam commencement.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-start space-x-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">Operating System</strong>
                  <span className="text-slate-500">Windows 10 or Windows 11 (64-bit edition).</span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">Display Configuration</strong>
                  <span className="text-slate-500">Single primary monitor. Secondary screens must be unplugged.</span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">Webcam &amp; Peripherals</strong>
                  <span className="text-slate-500">Integrated or external USB webcam with unobstructed view.</span>
                </div>
              </div>

              <div className="flex items-start space-x-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block">Network Connection</strong>
                  <span className="text-slate-500">Stable broadband / Wi-Fi (min 2 Mbps upload speed).</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Institutional Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
          <div className="space-y-1 text-center md:text-left">
            <div className="font-extrabold text-slate-900 text-sm">
              Kalasalingam Academy of Research and Education
            </div>
            <p className="text-[11px] text-slate-500">
              Deemed to be University under Section 3 of UGC Act 1956 • Anand Nagar, Krishnankoil, Tamil Nadu 626126
            </p>
            <p className="text-[11px] text-slate-400">
              Accredited by NAAC with &apos;A++&apos; Grade • KARE Safe Exam System (KARE-SES Site-3.0)
            </p>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold">
            <Link href="/candidate" className="hover:text-blue-700 transition-colors">
              Candidate Portal
            </Link>
            <span>•</span>
            <Link href="/sitting" className="hover:text-blue-700 transition-colors">
              Exam Sitting Portal
            </Link>
            <span>•</span>
            <Link href="/login" className="text-blue-700 hover:text-blue-800 font-bold transition-colors">
              Administrator Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
