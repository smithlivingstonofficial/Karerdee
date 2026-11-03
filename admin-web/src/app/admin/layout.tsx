import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";

export const metadata: Metadata = {
  title: "Admin Management Portal | KARE-SES",
  description: "Administrative console and live proctoring command center for KARE Safe Exam System.",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?returnTo=/admin");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SaaS Desktop Sidebar */}
      <Sidebar userEmail={user.email} />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

