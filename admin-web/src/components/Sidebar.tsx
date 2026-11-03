"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import {
  LayoutDashboard,
  FilePlus,
  Activity,
  Users,
  ShieldAlert,
  Settings,
  LogOut,
  Layers,
  Radio,
  BookOpen,
  FileText,
} from "lucide-react";

interface SidebarProps {
  userEmail?: string;
}

export function Sidebar({ userEmail = "admin@kalasalingam.ac.in" }: SidebarProps) {
  const pathname = usePathname();

  const navGroups = [
    {
      label: "MAIN OPERATIONS",
      items: [
        {
          title: "Dashboard",
          href: "/admin",
          icon: LayoutDashboard,
          active: pathname === "/admin",
        },
        {
          title: "Examinations",
          href: "/admin/exams",
          icon: FileText,
          active: pathname === "/admin/exams" || (pathname.startsWith("/admin/exams/") && pathname !== "/admin/exams/new"),
        },
        {
          title: "Authoring Studio",
          href: "/admin/exams/new",
          icon: FilePlus,
          active: pathname.startsWith("/admin/exams/new"),
        },
        {
          title: "Live Proctoring",
          href: "/admin/proctoring",
          icon: Activity,
          active: pathname.startsWith("/admin/proctoring"),
          badge: "Live",
          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        },
      ],
    },
    {
      label: "INSTITUTIONAL ROSTER",
      items: [
        {
          title: "Question Bank",
          href: "/admin/questions",
          icon: BookOpen,
          active: pathname.startsWith("/admin/questions"),
          badge: "Master",
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
        },
        {
          title: "Departments & Batches",
          href: "/admin/departments",
          icon: Layers,
          active: pathname.startsWith("/admin/departments"),
        },
        {
          title: "Candidate Registry",
          href: "/admin/students",
          icon: Users,
          active: pathname.startsWith("/admin/students"),
        },
      ],
    },
    {
      label: "INTEGRITY & SECURITY",
      items: [
        {
          title: "Security Violations",
          href: "/admin/violations",
          icon: ShieldAlert,
          active: pathname.startsWith("/admin/violations"),
        },
        {
          title: "System Audit Logs",
          href: "/admin/violations",
          icon: Settings,
          active: false,
        },
      ],
    },
  ];

  // Extract initials for avatar
  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "AD";

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 min-h-screen sticky top-0 h-screen select-none z-30">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
        <Link href="/admin" className="flex items-center space-x-3 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.kalasalingam.ac.in/wp-content/uploads/2022/02/Logo.png"
            alt="Kalasalingam Logo"
            className="h-9 w-auto max-w-[130px] object-contain transition-transform group-hover:scale-[1.02]"
          />
          <div className="flex flex-col">
            <span className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">
              KARE-SES
            </span>
            <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">
              Site-3.0
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider px-3 uppercase block mb-1.5">
              {group.label}
            </span>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                      item.active
                        ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          item.active
                            ? "text-blue-700"
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      <span>{item.title}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Realtime Engine Status Pill Card */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center space-x-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Realtime Engine</span>
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              Active
            </span>
          </div>
          <div className="text-[11px] text-slate-500 leading-tight">
            WebSocket telemetry stream connected to Supabase.
          </div>
        </div>
      </div>

      {/* User Footer Profile & Sign Out */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate" title={userEmail}>
                {userEmail.split("@")[0]}
              </div>
              <div className="text-[10px] font-medium text-slate-400 truncate">
                Super Administrator
              </div>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
