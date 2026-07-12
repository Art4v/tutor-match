// ============================================================================
// /choose-role — the mandatory role gate every new account passes through.
// ----------------------------------------------------------------------------
// Role selection is deferred out of signup (0041): a new user (email or OAuth)
// is created with profiles.role = NULL, then middleware forces them here before
// they can reach anything else. Picking a role calls the choose_role() RPC,
// which sets profiles.role and creates the tutor/student extension row.
//
// This server guard: logged-out -> /login; already chose a role -> their home
// (middleware also enforces this, but the page guards directly too). Only a
// genuine NULL-role user renders the chooser.
// ============================================================================

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ChooseRoleForm from "./ChooseRoleForm";

export default async function ChooseRolePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role) redirect(profile.role === "tutor" ? "/profile" : "/");

  return <ChooseRoleForm />;
}
