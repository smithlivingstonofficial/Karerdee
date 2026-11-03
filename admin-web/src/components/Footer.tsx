import { createClient } from "@/lib/supabase/server";

export async function Footer() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch {
    user = null;
  }

  // If not logged in (e.g. on /login), hide the footer entirely
  if (!user) {
    return null;
  }

  return (
    <footer className="w-full border-t border-slate-200 bg-white py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
        <span>
          <strong>KARE-SES</strong> — Kalasalingam Academy of Research and Education Secure Exam Software &amp; Management Suite
        </span>
        <span>Institutional Light Theme Standard • WCAG 2.1 AA</span>
      </div>
    </footer>
  );
}
