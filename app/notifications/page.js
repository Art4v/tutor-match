import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationsList } from "./NotificationsList";

export const metadata = { title: "Notifications" };
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
    <div className="bg-surface pb-16">
      <div className="max-w-[680px] mx-auto px-4 lg:px-6 pt-8">
        <h1 className="mb-6 text-[24px] leading-8 font-semibold text-[color:var(--text)]">Notifications</h1>
        <NotificationsList initial={notifications ?? []} />
      </div>
    </div>
  );
}
