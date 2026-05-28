import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorProfileForEditor } from "@/lib/supabase/tutors";
import { SettingsEditor } from "./SettingsEditor";

export const metadata = { title: "Settings — matchtutor" };

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const initialTutor = await getTutorProfileForEditor(supabase, user.id);

  return (
    <SettingsEditor
      initialTutor={initialTutor}
      userId={user.id}
      userEmail={user.email}
    />
  );
}
