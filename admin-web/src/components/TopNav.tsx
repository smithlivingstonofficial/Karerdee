import React from "react";
import Link from "next/link";
import { PlusCircle, Search, ShieldCheck } from "lucide-react";

export function TopNav() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-6 lg:px-8">
      {/* Search Input Bar */}
      <div className="flex items-center space-x-3 flex-1 max-w-md">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search examinations, passcodes, roll numbers..."
            className="w-full pl-9 pr-10 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-500 font-semibold border border-slate-300">
              ⌘K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        {/* System Health Badge */}
        <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Lockdown Security Active</span>
        </div>

        {/* Create Exam Direct Action */}
        <Link
          href="/admin/exams/new"
          className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
          <span>New Examination</span>
        </Link>
      </div>
    </header>
  );
}
