import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTutorProfileForEditor } from "@/lib/supabase/tutors";

export const metadata = { title: "Your profile" };

/**
 * Thin "take me to my own profile" resolver + onboarding gate. This is the
 * landing point for every post-auth flow (login, signup-email confirm, OAuth
 * callback, the nav "My profile" link) because those construct a fixed URL
 * before the tutor's slug is known/stable. Inline editing happens entirely on
 * the public profile page (/tutor/[slug]) — this route only redirects there.
 *
 * It also absorbs the first-login onboarding gate that used to live in the now
 * removed /settings page.
 */
export default async function ProfileRedirectPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const me = await getTutorProfileForEditor(supabase, user.id);

  // First-time tutors are greeted by the onboarding questionnaire before they
  // see their profile.
  if (me && !me.onboarded) redirect("/onboarding");

  // No tutor row (e.g. a student) — there's no profile page to resolve to.
  if (!me) redirect("/");

  redirect(`/tutor/${me.slug}`);
}
