import { login } from "./actions";
import Link from "next/link";
import { Lock, Mail, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const resolvedParams = await searchParams;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100 p-4 sm:p-6 overflow-y-auto">
      {/* Central Professional Login Card */}
      <div className="w-full max-w-[440px] bg-white border border-slate-200/90 rounded-2xl shadow-[0_10px_35px_rgba(15,23,42,0.06)] p-8 sm:p-10 transition-all">
        {/* Institution Brand & Official Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-full flex justify-center items-center py-2 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.kalasalingam.ac.in/wp-content/uploads/2022/02/Logo.png"
              alt="Kalasalingam Academy of Research and Education Logo"
              className="h-16 w-auto max-w-[280px] object-contain drop-shadow-sm"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              KARE-SES
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Secure Exam Software • Admin Portal
            </p>
          </div>
        </div>

        {/* Error Notification Alert */}
        {resolvedParams?.error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start space-x-3 text-left">
            <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 font-semibold leading-relaxed">
              {resolvedParams.error}
            </div>
          </div>
        )}

        {/* Form Container */}
        <form action={login} className="space-y-5">
          <input type="hidden" name="returnTo" value={resolvedParams?.returnTo || "/admin"} />

          {/* Institutional Email Address */}
          <div className="space-y-1.5 text-left">
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Institutional Email
            </label>
            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="faculty@kalasalingam.ac.in"
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5 text-left">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Password
            </label>
            <div className="relative rounded-xl shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 transition-colors"
              />
            </div>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-700 transition-all cursor-pointer mt-7"
          >
            <span>Sign In to Admin Console</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </form>

        {/* Link Back to Candidate Portal */}
        <div className="mt-8 pt-5 border-t border-slate-200 text-center space-y-2">
          <p className="text-xs text-slate-500">
            Are you a registered examination candidate?
          </p>
          <Link
            href="/"
            className="inline-flex items-center text-xs font-bold text-blue-700 hover:text-blue-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Go to Candidate Examination Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
