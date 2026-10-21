import { DeskBackdrop } from "@/components/DeskBackdrop";
import { getPendingCounts } from "@/lib/supabase/adminDashboard";
import { requireAdmin } from "./guard";
import { AdminNav } from "./_components/AdminNav";

export const metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// Every /admin page sits inside this layout, so the 404-for-non-admins check
// runs once here for the chrome. Pages that read data call requireAdmin()
// themselves too (see guard.js for why).
export default async function AdminLayout({ children }) {
  const { supabase } = await requireAdmin();
  const counts = await getPendingCounts(supabase);

  return (
    <div className="desk-surface bleed-under-nav relative min-h-screen">
      <DeskBackdrop className="-z-10" />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6 lg:gap-8">
          <AdminNav counts={counts} />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
