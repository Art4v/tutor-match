import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DisabledScreen } from "./DisabledScreen";

export const metadata = { title: "Account disabled" };
export const dynamic = "force-dynamic";

// The screen a DISABLED user is gated to (middleware.js redirects here on every
// non-exempt request). Guards: no session -> /login; an enabled account should
// never land here -> home. The "Request review" button is an inert placeholder
// for a future slice.
export default async function AccountDisabledPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  // Only disabled accounts belong here. Anything else (enabled, or an unreadable
  // row) goes home rather than showing a scary screen by mistake.
  if (profile?.status !== "disabled") redirect("/");

  return <DisabledScreen />;
}
