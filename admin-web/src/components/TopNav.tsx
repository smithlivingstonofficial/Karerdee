"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  Search,
  ShieldCheck,
  Radio,
  Bell,
  Activity,
  FileText,
  Users,
  Layers,
  ChevronRight,
  Loader2,
  X,
  BookOpen,
  ShieldAlert,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";

interface SearchResultExam {
  id: string;
  title: string;
  category: string;
  courseCode: string;
  passcode: string;
  status: string;
  durationMinutes: number;
  url: string;
}

interface SearchResultStudent {
  id: string;
  title: string;
  category: string;
  applicationNumber: string;
  departmentCode: string;
  email: string;
  url: string;
}

interface SearchResultNav {
  id: string;
  title: string;
  category: string;
  subtitle: string;
  url: string;
  badge: string;
}

interface SearchResultDept {
  id: string;
  title: string;
  category: string;
  code: string;
  url: string;
}

export function TopNav() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMac, setIsMac] = useState(false);

  const [exams, setExams] = useState<SearchResultExam[]>([]);
  const [students, setStudents] = useState<SearchResultStudent[]>([]);
  const [navigation, setNavigation] = useState<SearchResultNav[]>([]);
  const [departments, setDepartments] = useState<SearchResultDept[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Platform detection for ⌘K vs Ctrl+K
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch search results with debouncing
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setExams(data.exams || []);
          setStudents(data.students || []);
          setNavigation(data.navigation || []);
          setDepartments(data.departments || []);
        }
      } catch (err) {
        console.error("Search fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const handleSelectResult = (url: string) => {
    setIsOpen(false);
    setSearchQuery("");
    router.push(url);
  };

  const getNavMeta = (id: string) => {
    switch (id) {
      case "nav-exams":
        return { icon: FileText, color: "bg-blue-50 text-blue-700 border-blue-200" };
      case "nav-proctoring":
        return { icon: Radio, color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "nav-new":
        return { icon: PlusCircle, color: "bg-blue-50 text-blue-700 border-blue-200" };
      case "nav-questions":
        return { icon: BookOpen, color: "bg-purple-50 text-purple-700 border-purple-200" };
      case "nav-students":
        return { icon: Users, color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
      case "nav-violations":
        return { icon: ShieldAlert, color: "bg-amber-50 text-amber-700 border-amber-200" };
      default:
        return { icon: Activity, color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const hasResults =
    exams.length > 0 || students.length > 0 || departments.length > 0 || navigation.length > 0;

  return (
    <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 select-none">
      {/* 1. Left: Universal Search Input with Live Dropdown */}
      <div ref={containerRef} className="relative flex-1 max-w-sm sm:max-w-md lg:max-w-lg">
        <div className="relative w-full group">
          {/* Magnifying Glass Icon (Fixed padding and centering) */}
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-blue-700 transition-colors flex items-center">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>

          {/* Search Input - Clean pl-10 ensures ZERO overlap with the icon */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            placeholder="Search exams, students, passcodes, questions..."
            className="w-full pl-10 pr-16 py-1.5 text-xs bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/90 focus:border-blue-600 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
          />

          {/* Right Shortcut Badge / Clear Button */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <kbd className="inline-flex items-center space-x-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white text-slate-500 font-bold border border-slate-200 shadow-2xs">
              <span>{isMac ? "⌘" : "Ctrl"}</span>
              <span>K</span>
            </kbd>
          </div>
        </div>

        {/* 2. Interactive Spotlight Command Palette Dropdown */}
        {isOpen && (
          <div className="absolute left-0 right-0 sm:min-w-[480px] top-full mt-2 bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[480px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
            {isLoading && (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
                <span>Searching institutional repository...</span>
              </div>
            )}

            {!isLoading && hasResults && (
              <div className="p-2 space-y-3">
                {/* Section A: Examinations */}
                {exams.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Examinations</span>
                      <span className="text-slate-400 font-mono text-[9px]">{exams.length}</span>
                    </div>
                    {exams.map((exam) => (
                      <button
                        key={exam.id}
                        type="button"
                        onClick={() => handleSelectResult(exam.url)}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 border border-blue-100">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                              {exam.title}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
                              <span className="font-mono font-bold bg-slate-100 text-slate-700 px-1 rounded border border-slate-200">
                                {exam.courseCode}
                              </span>
                              <span>•</span>
                              <span className="font-mono text-slate-600">Pass: {exam.passcode}</span>
                              <span>•</span>
                              <span>{exam.durationMinutes}m</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                              exam.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : exam.status === "SCHEDULED"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {exam.status}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Section B: Candidates */}
                {students.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Candidates</span>
                      <span className="text-slate-400 font-mono text-[9px]">{students.length}</span>
                    </div>
                    {students.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleSelectResult(student.url)}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0 border border-indigo-100">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                              {student.title}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 truncate mt-0.5">
                              <span className="font-mono font-bold text-slate-700">{student.applicationNumber}</span>
                              <span>•</span>
                              <span className="truncate">{student.email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            {student.departmentCode}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Section C: Quick Navigation Workspaces */}
                {navigation.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      {searchQuery ? "Quick Actions" : "Suggested Workspaces"}
                    </div>
                    {navigation.map((nav) => {
                      const { icon: NavIcon, color: iconColor } = getNavMeta(nav.id);
                      return (
                        <button
                          key={nav.id}
                          type="button"
                          onClick={() => handleSelectResult(nav.url)}
                          className="w-full text-left p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all flex items-center justify-between cursor-pointer group"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center flex-shrink-0 border`}
                            >
                              <NavIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                                {nav.title}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">{nav.subtitle}</div>
                            </div>
                          </div>

                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!isLoading && !hasResults && searchQuery && (
              <div className="p-8 text-center space-y-1.5">
                <Search className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-800">No matching records found</p>
                <p className="text-[11px] text-slate-400">
                  No exams, students, or passcodes match &quot;{searchQuery}&quot;.
                </p>
              </div>
            )}

            {/* Dropdown Footer */}
            <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span className="flex items-center space-x-1">
                <CornerDownLeft className="w-3 h-3 text-slate-400" />
                <span>Press Enter to select</span>
              </span>
              <span>ESC to dismiss</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right: High-Precision Controls Cluster (Clean, Zero Unwanted Text) */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Lockdown Defense Pill */}
        <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Lockdown Active</span>
        </div>

        {/* Live Proctoring Quick Jump Icon */}
        <Link
          href="/admin/proctoring"
          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer"
          title="Open Live Proctoring Console"
        >
          <Activity className="w-4 h-4" />
        </Link>

        {/* Security Violations Quick Jump Icon */}
        <Link
          href="/admin/violations"
          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-all cursor-pointer"
          title="Inspect Security Strikes & Forensics"
        >
          <Bell className="w-4 h-4" />
        </Link>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* New Examination Primary Action */}
        <Link
          href="/admin/exams/new"
          className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-xs hover:shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
        >
          <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
          <span>New Examination</span>
        </Link>
      </div>
    </header>
  );
}
