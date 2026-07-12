import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountSettings } from "./AccountSettings";

export const metadata = { title: "Account — matchtutor" };

export default async function AccountPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Role drives whether the student-only profile-photo card renders; full_name
  // seeds its initial-letter fallback. Both are self-scoped (RLS allows the
  // self-read). The avatar itself only exists for students (0042), so we fetch
  // it lazily once we know the role.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role ?? null;

  let initialAvatarUrl = null;
  if (role === "student") {
    const { data: student } = await supabase
      .from("student_profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    initialAvatarUrl = student?.avatar_url ?? null;
  }

  return (
    <AccountSettings
      userEmail={user.email}
      userId={user.id}
      role={role}
      fullName={profile?.full_name ?? null}
      initialAvatarUrl={initialAvatarUrl}
    />
  );
}
