import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mb-4 border border-blue-100 shadow-xs">
        <FileQuestion className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">404 — Page Not Found</h1>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">
        The examination resource or page you requested could not be located in KARE-SES.
      </p>
      <div className="mt-5">
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

