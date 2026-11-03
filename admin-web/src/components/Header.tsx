import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { LogOut, User } from "lucide-react";

export async function Header() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch {
    user = null;
  }

  // If not authenticated (e.g. on /login), hide the header entirely
  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand with Official KARE Logo */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.kalasalingam.ac.in/wp-content/uploads/2022/02/Logo.png"
              alt="Kalasalingam Academy of Research and Education"
              className="h-10 w-auto max-w-[170px] object-contain transition-transform group-hover:scale-[1.02]"
            />
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-slate-900 text-base tracking-tight">
                KARE-SES
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Site-3.0
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600">
          <Link href="/admin" className="text-blue-700 hover:text-blue-800 transition-colors">
            Dashboard
          </Link>
          <Link href="/admin/exams/new" className="hover:text-slate-900 transition-colors">
            Exam Authoring
          </Link>
          <Link href="#proctor" className="hover:text-slate-900 transition-colors">
            Live Proctor
          </Link>
        </nav>

        {/* User Session & Logout */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-medium text-slate-800">{user.email}</span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
