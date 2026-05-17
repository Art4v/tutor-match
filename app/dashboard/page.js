import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorProfileForEditor } from "@/lib/supabase/tutors";
import { DashboardEditor } from "./DashboardEditor";

export const metadata = { title: "Edit your profile — tutormatch" };

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const initialTutor = await getTutorProfileForEditor(supabase, user.id);

  return (
    <DashboardEditor
      initialTutor={initialTutor}
      userId={user.id}
      userEmail={user.email}
    />
  );
}
