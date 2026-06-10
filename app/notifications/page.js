import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationsList } from "./NotificationsList";

export const metadata = { title: "Notifications — matchtutor" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, read, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen pb-24">
      <div className="max-w-[640px] mx-auto px-6 pt-10">
        <div className="mb-7">
          <h1 className="font-hand text-[40px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 700 }}>Notifications</h1>
          <p className="text-[14px] text-slate-500 mt-1">Updates about your account and verification.</p>
        </div>
        <NotificationsList initial={notifications ?? []} />
      </div>
    </div>
  );
}
