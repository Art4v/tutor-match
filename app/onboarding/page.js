import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorProfileForEditor } from "@/lib/supabase/tutors";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = { title: "Welcome — matchtutor" };

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const initialTutor = await getTutorProfileForEditor(supabase, user.id);

  // No tutor row (e.g. a student) — the questionnaire is tutor-only.
  if (!initialTutor) redirect("/");

  // Already onboarded (or an existing/backfilled tutor) — skip the questionnaire.
  if (initialTutor.onboarded) redirect("/profile");

  return (
    <OnboardingWizard
      initialTutor={initialTutor}
      userId={user.id}
      userEmail={user.email}
    />
  );
}
